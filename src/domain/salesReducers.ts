import type {
  AppData,
  AuditEvent,
  CashMovement,
  Ingredient,
  Order,
  Purchase,
  Shift,
  StockMovement,
  UserProfile,
} from '../types.ts'
import { uid } from '../lib/format.ts'
import { normalizeOrder } from '../lib/migrate.ts'
import { paymentMethodAmount } from '../lib/order.ts'
import { weightedAverageCost } from '../lib/domainMath.ts'
import type { SyncMutation } from '../lib/localDb.ts'

export function generateReceiptToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function orderConsumption(prev: AppData, order: Order): Map<string, number> {
  const map = new Map<string, number>()
  order.items.forEach(line => {
    const recipe = prev.recipes.find(r => r.productId === line.id)
    recipe?.items.forEach(ri => map.set(ri.ingredientId, (map.get(ri.ingredientId) ?? 0) + ri.qty * line.qty))
    line.modifiers?.forEach(mod =>
      mod.recipeItems?.forEach(ri => map.set(ri.ingredientId, (map.get(ri.ingredientId) ?? 0) + ri.qty * line.qty))
    )
  })
  return map
}

export function applyConsumptionDelta(
  prev: AppData,
  deltas: Map<string, number>,
  order: Order,
  actor: UserProfile | null,
  note: string,
) {
  const ingredients = [...prev.ingredients]
  const movements: StockMovement[] = []
  const stockDeltas: { ingredientId: string; delta: number }[] = []
  const now = new Date().toISOString()

  deltas.forEach((consumptionDelta, ingredientId) => {
    if (Math.abs(consumptionDelta) < 0.000001) return
    const index = ingredients.findIndex(i => i.id === ingredientId)
    if (index < 0) return
    const ingredient = ingredients[index]
    const stockDelta = -consumptionDelta
    const nextStock = ingredient.stock + stockDelta
    ingredients[index] = { ...ingredient, stock: nextStock, updatedAt: now }
    const movement: StockMovement = {
      id: uid('stock'),
      ingredientId: ingredient.id,
      type: stockDelta < 0 ? 'sale' : 'return',
      qty: stockDelta,
      before: ingredient.stock,
      after: nextStock,
      unit: ingredient.unit,
      unitCostSnapshot: ingredient.averageCost,
      note,
      reference: order.number,
      userId: actor?.id ?? order.cashierId,
      userName: actor?.name ?? order.cashierName,
      createdAt: now,
    }
    movements.push(movement)
    stockDeltas.push({ ingredientId, delta: stockDelta })
  })

  return { ingredients, movements, stockDeltas }
}

export function reverseOrderInventory(
  prev: AppData,
  order: Order,
  actor: UserProfile | null,
  note: string,
) {
  const consumption = orderConsumption(prev, order)
  const reverse = new Map<string, number>()
  consumption.forEach((qty, id) => reverse.set(id, -qty))
  return applyConsumptionDelta(prev, reverse, order, actor, note)
}

export function reduceSaveOrder(
  current: AppData,
  order: Order,
  actor: UserProfile | null,
): { nextState: AppData; mutations: SyncMutation[] } {
  const existing = current.orders.find(o => o.id === order.id)
  const isCommittedStatus = ['held', 'paid'].includes(order.status)
  const shouldCommitInventory = isCommittedStatus && !(existing?.inventoryCommitted || order.inventoryCommitted)
  const shouldReconcileInventory = Boolean(existing?.inventoryCommitted && isCommittedStatus)
  const effective: Order = normalizeOrder(
    shouldCommitInventory
      ? { ...order, inventoryCommitted: true }
      : { ...order, inventoryCommitted: order.inventoryCommitted ?? existing?.inventoryCommitted ?? false }
  )

  let stockResult: {
    ingredients: Ingredient[]
    movements: StockMovement[]
    stockDeltas: { ingredientId: string; delta: number }[]
  } | null = null

  if (shouldCommitInventory) {
    stockResult = applyConsumptionDelta(
      current,
      orderConsumption(current, effective),
      effective,
      actor,
      `Penjualan ${effective.number}`
    )
  } else if (shouldReconcileInventory && existing) {
    const oldUse = orderConsumption(current, existing)
    const newUse = orderConsumption(current, effective)
    const ids = new Set([...oldUse.keys(), ...newUse.keys()])
    const delta = new Map<string, number>()
    ids.forEach(id => delta.set(id, (newUse.get(id) ?? 0) - (oldUse.get(id) ?? 0)))
    stockResult = applyConsumptionDelta(current, delta, effective, actor, `Perubahan pesanan ${effective.number}`)
  }

  const receiptToken = effective.status === 'paid'
    ? (effective.receiptToken || generateReceiptToken())
    : effective.receiptToken

  const finalOrder: Order = receiptToken ? { ...effective, receiptToken } : effective

  const now = new Date().toISOString()
  const auditEvent: AuditEvent = {
    id: uid('audit'),
    createdAt: now,
    userId: actor?.id ?? 'system',
    userName: actor?.name ?? 'System',
    action: finalOrder.status === 'paid' ? 'sale.completed' : existing ? 'order.updated' : 'order.held',
    entity: 'order',
    entityId: finalOrder.id,
    detail: `${finalOrder.status === 'paid' ? 'Menyelesaikan' : existing ? 'Memperbarui' : 'Menyimpan'} ${finalOrder.number} • ${finalOrder.total}`,
    severity: 'info',
  }

  const baseOrders = existing
    ? current.orders.map(o => (o.id === finalOrder.id ? finalOrder : o))
    : [finalOrder, ...current.orders]

  const nextState: AppData = {
    ...current,
    orders: baseOrders,
    audit: [auditEvent, ...current.audit].slice(0, 1000),
    ingredients: stockResult ? stockResult.ingredients : current.ingredients,
    stockMovements: stockResult ? [...stockResult.movements, ...current.stockMovements] : current.stockMovements,
  }

  const batchId = uid('batch')
  const mutations: SyncMutation[] = [
    { id: uid('sync'), batchId, collection: 'orders', docId: finalOrder.id, op: 'set', payload: finalOrder, createdAt: now },
    { id: uid('sync'), batchId, collection: 'audit_logs', docId: auditEvent.id, op: 'set', payload: auditEvent, createdAt: now },
  ]

  // Jika order lunas, sertakan dokumen public_receipts yang sah dan immutable dalam outbox yang sama
  if (finalOrder.status === 'paid' && finalOrder.receiptToken) {
    mutations.push({
      id: uid('sync'),
      batchId,
      collection: 'public_receipts',
      docId: finalOrder.receiptToken,
      op: 'set',
      payload: {
        v: 1,
        orderId: finalOrder.id,
        number: finalOrder.number,
        queueNumber: finalOrder.queueNumber,
        total: finalOrder.total,
        subtotal: finalOrder.subtotal,
        discount: finalOrder.discount,
        tax: finalOrder.tax,
        service: finalOrder.service,
        createdAt: finalOrder.createdAt,
        createdBy: finalOrder.cashierId,
        brand: current.settings.brandName,
        outlet: current.settings.outletName,
        address: current.settings.address,
        phone: current.settings.phone,
        tagline: current.settings.tagline,
        order: {
          number: finalOrder.number,
          queueNumber: finalOrder.queueNumber,
          createdAt: finalOrder.createdAt,
          type: finalOrder.type,
          tableName: finalOrder.tableName,
          customerName: finalOrder.customerName,
          items: finalOrder.items,
          subtotal: finalOrder.subtotal,
          discount: finalOrder.discount,
          tax: finalOrder.tax,
          service: finalOrder.service,
          total: finalOrder.total,
          payments: finalOrder.payments ?? (finalOrder.payment ? [finalOrder.payment] : []),
        },
      },
      createdAt: now,
    })
  }

  if (stockResult) {
    stockResult.stockDeltas.forEach(x =>
      mutations.push({
        id: uid('sync'),
        batchId,
        collection: 'ingredients',
        docId: x.ingredientId,
        op: 'increment',
        payload: { stock: x.delta, updatedAt: now },
        createdAt: now,
      })
    )
    stockResult.movements.forEach(m =>
      mutations.push({
        id: uid('sync'),
        batchId,
        collection: 'stock_movements',
        docId: m.id,
        op: 'set',
        payload: m,
        createdAt: now,
      })
    )
  }

  return { nextState, mutations }
}

export function reduceUpdateOrder(
  current: AppData,
  order: Order,
  actor: UserProfile | null,
): { nextState: AppData; mutations: SyncMutation[] } {
  const previous = current.orders.find(o => o.id === order.id)
  const normalized = normalizeOrder(order)
  const stationChanged = JSON.stringify(previous?.stationStatus ?? {}) !== JSON.stringify(normalized.stationStatus ?? {})
  const changed = Boolean(stationChanged || previous?.kitchenStatus !== normalized.kitchenStatus)
  const now = new Date().toISOString()
  const auditEvent: AuditEvent | null = changed
    ? {
        id: uid('audit'),
        createdAt: now,
        userId: actor?.id ?? 'system',
        userName: actor?.name ?? 'System',
        action: 'kitchen.status',
        entity: 'order',
        entityId: normalized.id,
        detail: `${normalized.number} • Produksi ${JSON.stringify(previous?.stationStatus ?? {})} → ${JSON.stringify(normalized.stationStatus ?? {})}`,
        severity: 'info',
      }
    : null

  const nextState: AppData = {
    ...current,
    orders: current.orders.map(o => (o.id === order.id ? normalized : o)),
    audit: auditEvent ? [auditEvent, ...current.audit].slice(0, 1000) : current.audit,
  }

  const batchId = uid('batch')
  const mutations: SyncMutation[] = [
    { id: uid('sync'), batchId, collection: 'orders', docId: normalized.id, op: 'set', payload: normalized, createdAt: now },
  ]
  if (auditEvent) {
    mutations.push({
      id: uid('sync'),
      batchId,
      collection: 'audit_logs',
      docId: auditEvent.id,
      op: 'set',
      payload: auditEvent,
      createdAt: now,
    })
  }

  return { nextState, mutations }
}

export function reduceVoidOrder(
  current: AppData,
  orderId: string,
  reason: string,
  actor: UserProfile | null,
  shift: Shift | undefined,
): { nextState: AppData; mutations: SyncMutation[] } | null {
  const order = current.orders.find(o => o.id === orderId)
  if (!order || order.status === 'void' || order.status === 'refunded') return null
  const now = new Date().toISOString()
  const updated: Order = normalizeOrder({
    ...order,
    status: 'void',
    voidReason: reason,
    voidedAt: now,
    voidDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(now)),
    reversalShiftId: shift?.id,
    updatedAt: now,
  })
  const cashRefund = paymentMethodAmount(order, 'cash')
  const cashReverse: CashMovement | undefined =
    cashRefund > 0 && shift && actor
      ? {
          id: uid('cash'),
          shiftId: shift.id,
          type: 'out',
          amount: cashRefund,
          note: `Void ${order.number}`,
          createdAt: now,
          userId: actor.id,
          userName: actor.name,
        }
      : undefined
  const reversed = order.inventoryCommitted || order.status === 'paid'
    ? reverseOrderInventory(current, order, actor, `Pengembalian stok • Void ${order.number}`)
    : null
  const auditEvent: AuditEvent = {
    id: uid('audit'),
    createdAt: now,
    userId: actor?.id ?? 'system',
    userName: actor?.name ?? 'System',
    action: 'sale.void',
    entity: 'order',
    entityId: orderId,
    detail: `Void ${order.number} • ${reason}`,
    severity: 'critical',
  }
  const nextState: AppData = {
    ...current,
    orders: current.orders.map(o => (o.id === orderId ? updated : o)),
    ingredients: reversed?.ingredients ?? current.ingredients,
    stockMovements: reversed ? [...reversed.movements, ...current.stockMovements] : current.stockMovements,
    cashMovements: cashReverse ? [cashReverse, ...current.cashMovements] : current.cashMovements,
    audit: [auditEvent, ...current.audit].slice(0, 1000),
  }
  const batchId = uid('batch')
  const mutations: SyncMutation[] = [
    { id: uid('sync'), batchId, collection: 'orders', docId: updated.id, op: 'set', payload: updated, createdAt: now },
    { id: uid('sync'), batchId, collection: 'audit_logs', docId: auditEvent.id, op: 'set', payload: auditEvent, createdAt: now },
  ]
  reversed?.stockDeltas.forEach(x =>
    mutations.push({
      id: uid('sync'),
      batchId,
      collection: 'ingredients',
      docId: x.ingredientId,
      op: 'increment',
      payload: { stock: x.delta, updatedAt: now },
      createdAt: now,
    })
  )
  reversed?.movements.forEach(m =>
    mutations.push({
      id: uid('sync'),
      batchId,
      collection: 'stock_movements',
      docId: m.id,
      op: 'set',
      payload: m,
      createdAt: now,
    })
  )
  if (cashReverse) {
    mutations.push({
      id: uid('sync'),
      batchId,
      collection: 'cash_movements',
      docId: cashReverse.id,
      op: 'set',
      payload: cashReverse,
      createdAt: now,
    })
  }
  return { nextState, mutations }
}

export function reduceRefundOrder(
  current: AppData,
  orderId: string,
  reason: string,
  actor: UserProfile | null,
  shift: Shift | undefined,
): { nextState: AppData; mutations: SyncMutation[] } | null {
  const order = current.orders.find(o => o.id === orderId)
  if (!order || order.status === 'void' || order.status === 'refunded') return null
  const now = new Date().toISOString()
  const updated: Order = normalizeOrder({
    ...order,
    status: 'refunded',
    refundReason: reason,
    refundedAt: now,
    refundDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(now)),
    reversalShiftId: shift?.id,
    updatedAt: now,
  })
  const cashRefund = paymentMethodAmount(order, 'cash')
  const cashReverse: CashMovement | undefined =
    cashRefund > 0 && shift && actor
      ? {
          id: uid('cash'),
          shiftId: shift.id,
          type: 'out',
          amount: cashRefund,
          note: `Refund ${order.number}`,
          createdAt: now,
          userId: actor.id,
          userName: actor.name,
        }
      : undefined
  const reversed = order.inventoryCommitted || order.status === 'paid'
    ? reverseOrderInventory(current, order, actor, `Pengembalian stok • Refund ${order.number}`)
    : null
  const auditEvent: AuditEvent = {
    id: uid('audit'),
    createdAt: now,
    userId: actor?.id ?? 'system',
    userName: actor?.name ?? 'System',
    action: 'sale.refund',
    entity: 'order',
    entityId: orderId,
    detail: `Refund ${order.number} • ${reason}`,
    severity: 'critical',
  }
  const nextState: AppData = {
    ...current,
    orders: current.orders.map(o => (o.id === orderId ? updated : o)),
    ingredients: reversed?.ingredients ?? current.ingredients,
    stockMovements: reversed ? [...reversed.movements, ...current.stockMovements] : current.stockMovements,
    cashMovements: cashReverse ? [cashReverse, ...current.cashMovements] : current.cashMovements,
    audit: [auditEvent, ...current.audit].slice(0, 1000),
  }
  const batchId = uid('batch')
  const mutations: SyncMutation[] = [
    { id: uid('sync'), batchId, collection: 'orders', docId: updated.id, op: 'set', payload: updated, createdAt: now },
    { id: uid('sync'), batchId, collection: 'audit_logs', docId: auditEvent.id, op: 'set', payload: auditEvent, createdAt: now },
  ]
  reversed?.stockDeltas.forEach(x =>
    mutations.push({
      id: uid('sync'),
      batchId,
      collection: 'ingredients',
      docId: x.ingredientId,
      op: 'increment',
      payload: { stock: x.delta, updatedAt: now },
      createdAt: now,
    })
  )
  reversed?.movements.forEach(m =>
    mutations.push({
      id: uid('sync'),
      batchId,
      collection: 'stock_movements',
      docId: m.id,
      op: 'set',
      payload: m,
      createdAt: now,
    })
  )
  if (cashReverse) {
    mutations.push({
      id: uid('sync'),
      batchId,
      collection: 'cash_movements',
      docId: cashReverse.id,
      op: 'set',
      payload: cashReverse,
      createdAt: now,
    })
  }
  return { nextState, mutations }
}

export function reduceAdjustStock(
  current: AppData,
  ingredientId: string,
  delta: number,
  type: StockMovement['type'],
  note: string,
  actor: UserProfile | null,
): { nextState: AppData; mutations: SyncMutation[] } | null {
  const ingredient = current.ingredients.find(i => i.id === ingredientId)
  if (!ingredient || !actor || !delta) return null
  const now = new Date().toISOString()
  const updated: Ingredient = { ...ingredient, stock: ingredient.stock + delta, updatedAt: now }
  const movement: StockMovement = {
    id: uid('stock'),
    ingredientId,
    type,
    qty: delta,
    before: ingredient.stock,
    after: updated.stock,
    unit: ingredient.unit,
    unitCostSnapshot: ingredient.averageCost,
    note,
    userId: actor.id,
    userName: actor.name,
    createdAt: now,
  }
  const auditEvent: AuditEvent = {
    id: uid('audit'),
    createdAt: now,
    userId: actor.id,
    userName: actor.name,
    action: `stock.${type}`,
    entity: 'ingredient',
    entityId: ingredient.id,
    detail: `${ingredient.name}: ${delta > 0 ? '+' : ''}${delta} ${ingredient.unit} • ${note}`,
    severity: type === 'waste' ? 'warning' : 'info',
  }
  const nextState: AppData = {
    ...current,
    ingredients: current.ingredients.map(i => (i.id === ingredientId ? updated : i)),
    stockMovements: [movement, ...current.stockMovements],
    audit: [auditEvent, ...current.audit].slice(0, 1000),
  }
  const batchId = uid('batch')
  const mutations: SyncMutation[] = [
    {
      id: uid('sync'),
      batchId,
      collection: 'ingredients',
      docId: updated.id,
      op: 'increment',
      payload: { stock: delta, updatedAt: now },
      createdAt: now,
    },
    { id: uid('sync'), batchId, collection: 'stock_movements', docId: movement.id, op: 'set', payload: movement, createdAt: now },
    { id: uid('sync'), batchId, collection: 'audit_logs', docId: auditEvent.id, op: 'set', payload: auditEvent, createdAt: now },
  ]
  return { nextState, mutations }
}

export function reduceReceivePurchase(
  current: AppData,
  purchase: Purchase,
  actor: UserProfile | null,
): { nextState: AppData; mutations: SyncMutation[] } | null {
  if (!actor) return null
  const received = { ...purchase, status: 'received' as const }
  const now = received.createdAt || new Date().toISOString()
  const ingredients = [...current.ingredients]
  const movements: StockMovement[] = []
  const batchId = uid('batch')
  const mutations: SyncMutation[] = []

  received.items.forEach(item => {
    const idx = ingredients.findIndex(i => i.id === item.ingredientId)
    if (idx < 0) return
    const ingredient = ingredients[idx]
    const nextStock = ingredient.stock + item.qty
    const weightedCost = weightedAverageCost(ingredient.stock, ingredient.averageCost, item.qty, item.unitCost)
    const next = { ...ingredient, stock: nextStock, averageCost: weightedCost, updatedAt: now }
    ingredients[idx] = next
    const movement: StockMovement = {
      id: uid('stock'),
      ingredientId: item.ingredientId,
      type: 'purchase',
      qty: item.qty,
      before: ingredient.stock,
      after: next.stock,
      unit: item.unit,
      unitCostSnapshot: item.unitCost,
      note: `Pembelian ${received.number}`,
      reference: received.number,
      userId: actor.id,
      userName: actor.name,
      createdAt: now,
    }
    movements.push(movement)
    mutations.push(
      {
        id: uid('sync'),
        batchId,
        collection: 'ingredients',
        docId: next.id,
        op: 'weightedPurchase',
        payload: { qty: item.qty, unitCost: item.unitCost, updatedAt: now },
        createdAt: now,
      },
      { id: uid('sync'), batchId, collection: 'stock_movements', docId: movement.id, op: 'set', payload: movement, createdAt: now }
    )
  })

  const products = current.products.map(product => {
    const recipe = current.recipes.find(r => r.productId === product.id)
    if (!recipe?.items.length) return product
    const cost = Math.round(
      recipe.items.reduce(
        (sum, item) => sum + (ingredients.find(i => i.id === item.ingredientId)?.averageCost ?? 0) * item.qty,
        0
      )
    )
    const updated = { ...product, cost }
    if (updated.cost !== product.cost) {
      mutations.push({
        id: uid('sync'),
        batchId,
        collection: 'products',
        docId: updated.id,
        op: 'set',
        payload: updated,
        createdAt: now,
      })
    }
    return updated
  })

  const auditEvent: AuditEvent = {
    id: uid('audit'),
    createdAt: now,
    userId: actor.id,
    userName: actor.name,
    action: 'purchase.receive',
    entity: 'purchase',
    entityId: received.id,
    detail: `Menerima pembelian ${received.number}`,
    severity: 'info',
  }

  const nextState: AppData = {
    ...current,
    purchases: [received, ...current.purchases],
    ingredients,
    products,
    stockMovements: [...movements, ...current.stockMovements],
    audit: [auditEvent, ...current.audit].slice(0, 1000),
  }

  mutations.unshift({
    id: uid('sync'),
    batchId,
    collection: 'purchases',
    docId: received.id,
    op: 'set',
    payload: received,
    createdAt: now,
  })
  mutations.push({
    id: uid('sync'),
    batchId,
    collection: 'audit_logs',
    docId: auditEvent.id,
    op: 'set',
    payload: auditEvent,
    createdAt: now,
  })

  return { nextState, mutations }
}

export function reduceOpenShift(
  current: AppData,
  openingCash: number,
  actor: UserProfile | null,
): { nextState: AppData; mutations: SyncMutation[]; value: Shift | null } {
  if (!actor || current.shifts.some(s => s.cashierId === actor.id && s.status === 'open')) {
    return { nextState: current, mutations: [], value: null }
  }
  const now = new Date().toISOString()
  const shift: Shift = {
    id: uid('shift'),
    cashierId: actor.id,
    cashierName: actor.name,
    openedAt: now,
    openingCash,
    status: 'open',
  }
  const auditEvent: AuditEvent = {
    id: uid('audit'),
    createdAt: now,
    userId: actor.id,
    userName: actor.name,
    action: 'shift.open',
    entity: 'shift',
    entityId: shift.id,
    detail: `Membuka shift dengan kas awal ${openingCash}`,
    severity: 'info',
  }
  const nextState: AppData = {
    ...current,
    shifts: [shift, ...current.shifts],
    audit: [auditEvent, ...current.audit].slice(0, 1000),
  }
  const batchId = uid('batch')
  const mutations: SyncMutation[] = [
    { id: uid('sync'), batchId, collection: 'shifts', docId: shift.id, op: 'set', payload: shift, createdAt: now },
    { id: uid('sync'), batchId, collection: 'audit_logs', docId: auditEvent.id, op: 'set', payload: auditEvent, createdAt: now },
  ]
  return { nextState, mutations, value: shift }
}

export function reduceCloseShift(
  current: AppData,
  actualCash: number,
  note: string | undefined,
  actor: UserProfile | null,
): { nextState: AppData; mutations: SyncMutation[]; value: Shift | null } {
  const shift = current.shifts.find(s => s.cashierId === actor?.id && s.status === 'open')
  if (!shift || !actor) return { nextState: current, mutations: [], value: null }
  const now = new Date().toISOString()
  const updated: Shift = {
    ...shift,
    actualClosingCash: actualCash,
    closedAt: now,
    status: 'closed',
    note,
  }
  const auditEvent: AuditEvent = {
    id: uid('audit'),
    createdAt: now,
    userId: actor.id,
    userName: actor.name,
    action: 'shift.close',
    entity: 'shift',
    entityId: shift.id,
    detail: `Menutup shift • kas aktual ${actualCash}`,
    severity: 'warning',
  }
  const nextState: AppData = {
    ...current,
    shifts: current.shifts.map(s => (s.id === shift.id ? updated : s)),
    audit: [auditEvent, ...current.audit].slice(0, 1000),
  }
  const batchId = uid('batch')
  const mutations: SyncMutation[] = [
    { id: uid('sync'), batchId, collection: 'shifts', docId: updated.id, op: 'set', payload: updated, createdAt: now },
    { id: uid('sync'), batchId, collection: 'audit_logs', docId: auditEvent.id, op: 'set', payload: auditEvent, createdAt: now },
  ]
  return { nextState, mutations, value: updated }
}

export function reduceAddCashMovement(
  current: AppData,
  type: 'in' | 'out',
  amount: number,
  note: string,
  actor: UserProfile | null,
): { nextState: AppData; mutations: SyncMutation[]; value: CashMovement | null } {
  const shift = current.shifts.find(s => s.cashierId === actor?.id && s.status === 'open')
  if (!shift || !actor || amount <= 0) return { nextState: current, mutations: [], value: null }
  const now = new Date().toISOString()
  const movement: CashMovement = {
    id: uid('cash'),
    shiftId: shift.id,
    type,
    amount,
    note,
    createdAt: now,
    userId: actor.id,
    userName: actor.name,
  }
  const auditEvent: AuditEvent = {
    id: uid('audit'),
    createdAt: now,
    userId: actor.id,
    userName: actor.name,
    action: `cash.${type}`,
    entity: 'shift',
    entityId: shift.id,
    detail: `${type === 'in' ? 'Kas masuk' : 'Kas keluar'} ${amount} • ${note}`,
    severity: 'warning',
  }
  const nextState: AppData = {
    ...current,
    cashMovements: [movement, ...current.cashMovements],
    audit: [auditEvent, ...current.audit].slice(0, 1000),
  }
  const batchId = uid('batch')
  const mutations: SyncMutation[] = [
    { id: uid('sync'), batchId, collection: 'cash_movements', docId: movement.id, op: 'set', payload: movement, createdAt: now },
    { id: uid('sync'), batchId, collection: 'audit_logs', docId: auditEvent.id, op: 'set', payload: auditEvent, createdAt: now },
  ]
  return { nextState, mutations, value: movement }
}

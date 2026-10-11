import assert from 'node:assert/strict'
import test from 'node:test'
import {
  orderConsumption,
  reduceAdjustStock,
  reduceReceivePurchase,
  reduceRefundOrder,
  reduceSaveOrder,
  reduceVoidOrder,
} from '../src/domain/salesReducers.ts'
import type { AppData, Order, Purchase, UserProfile } from '../src/types.ts'

const mockUser: UserProfile = {
  id: 'usr-1',
  name: 'Budi Kasir',
  email: 'budi@posbakso.com',
  role: 'cashier',
  roleLabel: 'Kasir',
  active: true,
  avatarInitials: 'BK',
}

function createBaseState(): AppData {
  return {
    schemaVersion: 2,
    products: [
      {
        id: 'prod-bakso',
        sku: 'BKS-01',
        name: 'Bakso Urat',
        category: 'Makanan',
        price: 25000,
        cost: 15000,
        image: '',
        active: true,
        trackStock: true,
      },
    ],
    ingredients: [
      {
        id: 'ing-daging',
        sku: 'ING-01',
        name: 'Daging Sapi Giling',
        stock: 100,
        unit: 'porsi',
        minStock: 10,
        averageCost: 15000,
        active: true,
      },
    ],
    recipes: [
      {
        productId: 'prod-bakso',
        items: [{ ingredientId: 'ing-daging', qty: 1 }],
      },
    ],
    orders: [],
    shifts: [
      {
        id: 'shift-1',
        cashierId: 'usr-1',
        cashierName: 'Budi Kasir',
        openedAt: '2026-10-11T08:00:00Z',
        openingCash: 200000,
        status: 'open',
      },
    ],
    cashMovements: [],
    users: [mockUser],
    roles: [],
    suppliers: [],
    purchases: [],
    stockMovements: [],
    printers: [],
    settings: {
      outletName: 'Bakso Mas Budi',
      brandName: 'PosBakso',
      tagline: 'Mantap & Gurih',
      address: 'Jl. Ahmad Yani',
      phone: '081234567890',
      footerReceipt: 'Terima kasih',
      taxEnabled: false,
      taxPercent: 0,
      serviceEnabled: false,
      servicePercent: 0,
      currency: 'IDR',
      queuePrefix: 'A',
      receiptPrefix: 'BU',
      logoUrl: '',
      tables: ['01', '02'],
      holdExpiryMinutes: 120,
      receipt: {} as any,
    },
    audit: [],
  }
}

test('orderConsumption calculates raw ingredient needs correctly', () => {
  const state = createBaseState()
  const order: Order = {
    id: 'ord-1',
    number: 'BU-001',
    queueNumber: 'A-01',
    createdAt: '2026-10-11T10:00:00Z',
    updatedAt: '2026-10-11T10:00:00Z',
    cashierId: 'usr-1',
    cashierName: 'Budi Kasir',
    type: 'dine_in',
    status: 'paid',
    items: [
      {
        id: 'prod-bakso',
        sku: 'BKS-01',
        name: 'Bakso Urat',
        category: 'Makanan',
        price: 25000,
        cost: 15000,
        image: '',
        active: true,
        qty: 3,
      },
    ],
    subtotal: 75000,
    discount: 0,
    tax: 0,
    service: 0,
    total: 75000,
  }

  const consumption = orderConsumption(state, order)
  assert.equal(consumption.get('ing-daging'), 3)
})

test('reduceSaveOrder commits sale and deducts inventory accurately', () => {
  const state = createBaseState()
  const order: Order = {
    id: 'ord-1',
    number: 'BU-001',
    queueNumber: 'A-01',
    createdAt: '2026-10-11T10:00:00Z',
    updatedAt: '2026-10-11T10:00:00Z',
    cashierId: 'usr-1',
    cashierName: 'Budi Kasir',
    type: 'dine_in',
    status: 'paid',
    items: [
      {
        id: 'prod-bakso',
        sku: 'BKS-01',
        name: 'Bakso Urat',
        category: 'Makanan',
        price: 25000,
        cost: 15000,
        image: '',
        active: true,
        qty: 4,
      },
    ],
    subtotal: 100000,
    discount: 0,
    tax: 0,
    service: 0,
    total: 100000,
  }

  const result = reduceSaveOrder(state, order, mockUser)
  assert.equal(result.nextState.orders.length, 1)
  assert.equal(result.nextState.orders[0].inventoryCommitted, true)

  const ingredient = result.nextState.ingredients.find(i => i.id === 'ing-daging')
  assert.equal(ingredient?.stock, 96) // 100 - 4 = 96
  assert.equal(result.nextState.stockMovements.length, 1)
  assert.equal(result.nextState.stockMovements[0].qty, -4)

  // Pastikan mutasi sync outbox terbentuk
  const incMutation = result.mutations.find(m => m.collection === 'ingredients')
  assert.equal(incMutation?.op, 'increment')
  assert.equal((incMutation?.payload as any)?.stock, -4)
})

test('reduceVoidOrder reverses inventory and records outbox', () => {
  const state = createBaseState()
  const paidOrder: Order = {
    id: 'ord-1',
    number: 'BU-001',
    queueNumber: 'A-01',
    createdAt: '2026-10-11T10:00:00Z',
    updatedAt: '2026-10-11T10:00:00Z',
    cashierId: 'usr-1',
    cashierName: 'Budi Kasir',
    type: 'dine_in',
    status: 'paid',
    items: [
      {
        id: 'prod-bakso',
        sku: 'BKS-01',
        name: 'Bakso Urat',
        category: 'Makanan',
        price: 25000,
        cost: 15000,
        image: '',
        active: true,
        qty: 2,
      },
    ],
    subtotal: 50000,
    discount: 0,
    tax: 0,
    service: 0,
    total: 50000,
    inventoryCommitted: true,
    payment: {
      method: 'cash',
      label: 'Tunai',
      amount: 50000,
      paidAt: '2026-10-11T10:00:00Z',
    },
  }

  // Awal: stok 98 setelah penjualan
  const afterSaleState: AppData = {
    ...state,
    orders: [paidOrder],
    ingredients: [{ ...state.ingredients[0], stock: 98 }],
  }

  const shift = afterSaleState.shifts[0]
  const voidResult = reduceVoidOrder(afterSaleState, 'ord-1', 'Salah meja', mockUser, shift)
  assert.ok(voidResult)
  assert.equal(voidResult.nextState.orders[0].status, 'void')
  assert.equal(voidResult.nextState.ingredients[0].stock, 100) // 98 + 2 dikembalikan
  assert.equal(voidResult.nextState.cashMovements.length, 1)
  assert.equal(voidResult.nextState.cashMovements[0].type, 'out')
  assert.equal(voidResult.nextState.cashMovements[0].amount, 50000)
})

test('reduceAdjustStock produces auditable adjustment movement', () => {
  const state = createBaseState()
  const result = reduceAdjustStock(state, 'ing-daging', 15, 'adjustment', 'Stok opname bulanan', mockUser)
  assert.ok(result)
  assert.equal(result.nextState.ingredients[0].stock, 115)
  assert.equal(result.nextState.stockMovements[0].qty, 15)
  assert.equal(result.nextState.stockMovements[0].type, 'adjustment')
})

test('reduceReceivePurchase updates weighted cost and stocks', () => {
  const state = createBaseState()
  const purchase: Purchase = {
    id: 'pur-1',
    number: 'PUR-001',
    supplierName: 'Pak Daging',
    createdAt: '2026-10-11T09:00:00Z',
    status: 'draft',
    items: [
      {
        ingredientId: 'ing-daging',
        name: 'Daging Sapi Giling',
        qty: 100,
        unit: 'porsi',
        unitCost: 20000,
      },
    ],
    total: 2000000,
  }

  const result = reduceReceivePurchase(state, purchase, mockUser)
  assert.ok(result)
  assert.equal(result.nextState.ingredients[0].stock, 200) // 100 + 100
  // (100 * 15000 + 100 * 20000) / 200 = 17500
  assert.equal(result.nextState.ingredients[0].averageCost, 17500)
  // BOM produk terupdate biaya HPP-nya
  assert.equal(result.nextState.products[0].cost, 17500)
})

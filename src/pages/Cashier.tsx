import { useEffect, useMemo, useRef, useState } from 'react'
import type { CartItem, Order, OrderType, Payment, Product } from '../types'
import { Icon } from '../components/Icon'
import { ProductCard } from '../components/ProductCard'
import { CartPanel } from '../components/CartPanel'
import { Receipt } from '../components/Receipt'
import { PaymentModal } from '../components/PaymentModal'
import { Modal } from '../components/Modal'
import { localDateKey, rupiahCompact, uid } from '../lib/format'
import { itemLineTotal } from '../lib/order'
import { usePosStore } from '../context/PosStore'
import { autoPrintReceipt, printKitchenDeltaNative, printKitchenNative, printReceiptNative } from '../services/printer'
import { createHumanOrderNumber, createQueueNumber, getTerminalCode } from '../lib/terminal'
import { calculateOrderTotals } from '../lib/domainMath'
import { playAddToCart, playSuccessChime } from '../lib/sound'

export function CashierPage({
  onOpenShift,
  resumeOrder,
  reorderOrder,
  onResumeHandled,
  onReorderHandled,
}: {
  onOpenShift?: () => void
  resumeOrder?: Order | null
  reorderOrder?: Order | null
  onResumeHandled?: () => void
  onReorderHandled?: () => void
}) {
  const { data, currentUser, getOpenShift, saveOrder, can } = usePosStore()
  const [category, setCategory] = useState('Semua')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [mobileCart, setMobileCart] = useState(false)
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [orderType, setOrderType] = useState<OrderType>('dine_in')
  const [tableName, setTableName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [note, setNote] = useState('')
  const [discount, setDiscount] = useState(0)
  const [draftOrder, setDraftOrder] = useState<Order | null>(null)
  const [reorderNotice, setReorderNotice] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [printNotice, setPrintNotice] = useState('')
  const [configProduct, setConfigProduct] = useState<Product | null>(null)
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([])
  const [itemNote, setItemNote] = useState('')

  // Optimasi availability produk dengan O(1) index lookups
  const recipesByProduct = useMemo(
    () => new Map(data.recipes.map(recipe => [recipe.productId, recipe])),
    [data.recipes]
  )
  const ingredientById = useMemo(
    () => new Map(data.ingredients.map(item => [item.id, item])),
    [data.ingredients]
  )

  const products = useMemo(
    () =>
      data.products
        .filter(p => p.active)
        .map(p => {
          if (!p.trackStock) return { ...p, stock: undefined }
          const recipe = recipesByProduct.get(p.id)
          if (!recipe?.items.length) return { ...p, stock: 0 }
          const portions = Math.min(
            ...recipe.items.map(r => {
              const ing = ingredientById.get(r.ingredientId)
              return ing && r.qty > 0 ? Math.floor(ing.stock / r.qty) : 0
            })
          )
          return { ...p, stock: Number.isFinite(portions) ? Math.max(0, portions) : 0 }
        }),
    [data.products, recipesByProduct, ingredientById]
  )

  const favoriteIds = useMemo(() => {
    const sold = new Map<string, number>()
    data.orders
      .filter(o => o.status === 'paid')
      .forEach(o => o.items.forEach(i => sold.set(i.id, (sold.get(i.id) ?? 0) + i.qty)))
    return [...sold.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id)
  }, [data.orders])

  // Kategori menu dinamis dari produk aktual tanpa coupling ke data/seed
  const menuCategories = useMemo(() => {
    const categorySet = new Set<string>()
    data.products.filter(p => p.active).forEach(p => {
      if (p.category) categorySet.add(p.category)
    })
    return ['Semua', 'Favorit', ...Array.from(categorySet)]
  }, [data.products])

  const filtered = useMemo(() => {
    const term = query.toLowerCase()
    const result = products.filter(
      p =>
        (category === 'Favorit'
          ? favoriteIds.includes(p.id)
          : category === 'Semua' || p.category === category) &&
        (p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
    )
    return category === 'Favorit'
      ? result.sort((a, b) => favoriteIds.indexOf(a.id) - favoriteIds.indexOf(b.id))
      : result
  }, [products, category, query, favoriteIds])

  const subtotal = cart.reduce((s, i) => s + itemLineTotal(i), 0)
  const totals = calculateOrderTotals(
    subtotal,
    discount,
    data.settings.taxEnabled,
    data.settings.taxPercent,
    data.settings.serviceEnabled,
    data.settings.servicePercent
  )
  const tax = totals.tax
  const service = totals.service
  const total = totals.total
  const shift = getOpenShift()

  const occupiedTables = useMemo(
    () =>
      data.orders
        .filter(
          o =>
            o.id !== draftOrder?.id &&
            o.type === 'dine_in' &&
            o.tableName &&
            !['void', 'refunded'].includes(o.status) &&
            (o.status === 'held' || (o.kitchenStatus ?? 'new') !== 'served')
        )
        .map(o => o.tableName!)
        .filter((v, i, a) => a.indexOf(v) === i),
    [data.orders, draftOrder?.id]
  )

  useEffect(() => {
    if (!resumeOrder) return
    setDraftOrder(resumeOrder)
    setCart(resumeOrder.items)
    setOrderType(resumeOrder.type)
    setTableName(resumeOrder.tableName ?? '')
    setCustomerName(resumeOrder.customerName ?? '')
    setCustomerPhone(resumeOrder.customerPhone ?? '')
    setCustomerEmail(resumeOrder.customerEmail ?? '')
    setNote(resumeOrder.note ?? '')
    setDiscount(resumeOrder.discount)
    onResumeHandled?.()
  }, [resumeOrder, onResumeHandled])

  useEffect(() => {
    if (!reorderOrder) return
    const available = reorderOrder.items.flatMap(oldItem => {
      const product = products.find(p => p.id === oldItem.id)
      if (!product) return []
      const modifiers = oldItem.modifiers?.flatMap(oldModifier => {
        const current = product.modifierOptions?.find(option => option.id === oldModifier.id)
        return current ? [{ id: current.id, name: current.name, price: current.price, recipeItems: current.recipeItems }] : []
      })
      return [{ ...product, lineId: uid('line'), qty: oldItem.qty, modifiers, note: oldItem.note }]
    })
    const skipped = reorderOrder.items.length - available.length
    const oldModifierCount = reorderOrder.items.reduce((sum, item) => sum + (item.modifiers?.length ?? 0), 0)
    const currentModifierCount = available.reduce((sum, item) => sum + (item.modifiers?.length ?? 0), 0)
    const skippedModifiers = oldModifierCount - currentModifierCount
    setDraftOrder(null)
    setCart(available)
    setOrderType(reorderOrder.type)
    setTableName('')
    setCustomerName(reorderOrder.customerName ?? '')
    setCustomerPhone(reorderOrder.customerPhone ?? '')
    setCustomerEmail(reorderOrder.customerEmail ?? '')
    setNote(reorderOrder.note ?? '')
    setDiscount(0)
    setCheckoutError('')
    setReorderNotice(
      available.length
        ? `Pesanan baru dari ${reorderOrder.number}. Harga memakai menu saat ini.${
            skipped ? ` ${skipped} item nonaktif dilewati.` : ''
          }${skippedModifiers ? ` ${skippedModifiers} topping yang tidak lagi tersedia dilewati.` : ''}`
        : `Tidak ada item aktif dari ${reorderOrder.number} yang dapat dipesan lagi.`
    )
    onReorderHandled?.()
  }, [reorderOrder, onReorderHandled, products])

  const searchInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.key === 'F9') {
        e.preventDefault()
        if (cart.length) pay()
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (cart.length) void hold()
      } else if (e.key === 'Escape' && !paymentOpen && !configProduct && !receipt) {
        if (draftOrder) {
          e.preventDefault()
          reset()
        } else if (searchInputRef.current === document.activeElement) {
          searchInputRef.current?.blur()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cart.length, paymentOpen, configProduct, receipt, draftOrder])

  const addLine = (product: Product, modifiers: { name: string; price: number }[] = [], lineNote = '') => {
    playAddToCart()
    setCart(cur => {
      const plain = !modifiers.length && !lineNote
      const found = plain
        ? cur.find(i => i.id === product.id && !i.modifiers?.length && !i.note)
        : undefined
      if (found) {
        return cur.map(i =>
          (i.lineId ?? i.id) === (found.lineId ?? found.id) ? { ...i, qty: i.qty + 1 } : i
        )
      }
      return [...cur, { ...product, lineId: uid('line'), qty: 1, modifiers, note: lineNote || undefined }]
    })
  }

  const add = (id: string) => {
    const product = products.find(i => i.id === id)
    if (!product) return
    if (product.modifierOptions?.length) {
      setConfigProduct(product)
      setSelectedModifierIds([])
      setItemNote('')
      return
    }
    addLine(product)
  }

  const confirmConfigured = () => {
    if (!configProduct) return
    const modifiers = (configProduct.modifierOptions ?? [])
      .filter(m => selectedModifierIds.includes(m.id))
      .map(m => ({ id: m.id, name: m.name, price: m.price, recipeItems: m.recipeItems }))
    addLine(configProduct, modifiers, itemNote.trim())
    setConfigProduct(null)
    setSelectedModifierIds([])
    setItemNote('')
  }

  const qty = (lineId: string, delta: number) =>
    setCart(cur =>
      cur
        .map(i => ((i.lineId ?? i.id) === lineId ? { ...i, qty: i.qty + delta } : i))
        .filter(i => i.qty > 0)
    )

  const reset = () => {
    setCart([])
    setDiscount(0)
    setNote('')
    setTableName('')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setOrderType('dine_in')
    setDraftOrder(null)
    setReorderNotice('')
    setCheckoutError('')
  }

  const validateOrder = () => {
    if (orderType === 'dine_in' && !tableName) {
      setCheckoutError('Pilih meja untuk pesanan makan di tempat sebelum menyimpan atau membayar.')
      return false
    }
    setCheckoutError('')
    return true
  }

  const buildOrder = (status: 'held' | 'paid', payments?: Payment[]): Order => {
    const dateKey = localDateKey()
    const now = new Date().toISOString()
    const hasKitchen = cart.some(i => i.kitchenRoute === 'kitchen')
    const hasBar = cart.some(i => i.kitchenRoute === 'bar')
    const stationStatus = { ...(draftOrder?.stationStatus ?? {}) }
    if (hasKitchen && !stationStatus.kitchen) stationStatus.kitchen = 'new'
    if (hasBar && !stationStatus.bar) stationStatus.bar = 'new'
    return {
      id: draftOrder?.id ?? uid('order'),
      number: draftOrder?.number ?? createHumanOrderNumber(data.settings.receiptPrefix, dateKey),
      queueNumber: draftOrder?.queueNumber ?? createQueueNumber(data.settings.queuePrefix, dateKey),
      terminalCode: draftOrder?.terminalCode ?? getTerminalCode(),
      createdAt: draftOrder?.createdAt ?? now,
      updatedAt: now,
      businessDate: draftOrder?.businessDate ?? dateKey,
      cashierId: currentUser?.id ?? 'unknown',
      cashierName: currentUser?.name ?? 'Kasir',
      shiftId: shift?.id ?? draftOrder?.shiftId,
      type: orderType,
      tableName: orderType === 'dine_in' ? tableName || undefined : undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      note: note || undefined,
      status,
      holdExpiresAt:
        status === 'held'
          ? new Date(Date.now() + (data.settings.holdExpiryMinutes ?? 120) * 60_000).toISOString()
          : undefined,
      kitchenStatus: draftOrder?.kitchenStatus ?? 'new',
      stationStatus,
      inventoryCommitted: draftOrder?.inventoryCommitted ?? false,
      items: cart,
      subtotal,
      discount,
      tax,
      service,
      total,
      payment: payments?.[0],
      payments,
    }
  }

  const hold = async () => {
    if (!cart.length || !validateOrder()) return
    const order = buildOrder('held')

    try {
      // 1. Durabilitas transaksi lokal + outbox mutlak harus berhasil terlebih dahulu
      await saveOrder(order)
    } catch (error) {
      setCheckoutError(
        'Pesanan tidak tersimpan. Penyimpanan lokal gagal: ' +
          (error instanceof Error ? error.message : String(error))
      )
      return
    }

    const stationPrinters = data.printers.filter(p => p.type !== 'cashier' && p.autoPrint)
    stationPrinters.forEach(p => {
      const task = draftOrder
        ? printKitchenDeltaNative(draftOrder, order, data.settings, p)
        : printKitchenNative(order, data.settings, p)
      void task.then(r => {
        if (!r.ok && !['disabled', 'no-routed-items', 'no-changes'].includes(r.reason ?? '')) {
          setPrintNotice(
            `Pesanan ${order.queueNumber} tersimpan, tetapi ${p.name} gagal mencetak: ${r.reason}. Gunakan Print Job → Retry.`
          )
        }
      })
    })
    reset()
    setMobileCart(false)
  }

  const pay = () => {
    if (!cart.length || !validateOrder()) return
    if (!shift) {
      onOpenShift?.()
      return
    }
    setPaymentOpen(true)
  }

  const confirmPayment = async (payments: Payment[]) => {
    const order = buildOrder('paid', payments)

    try {
      // 1. Durability barrier: Tunggu transaksi tersimpan di IndexedDB sebelum print
      await saveOrder(order)
    } catch (error) {
      setCheckoutError(
        'Transaksi belum tersimpan. Pembayaran tidak akan dianggap selesai sampai penyimpanan lokal berhasil: ' +
          (error instanceof Error ? error.message : String(error))
      )
      return
    }

    // 2. Feedback pembayaran sukses
    playSuccessChime()
    setPaymentOpen(false)
    setMobileCart(false)
    setReceipt(order)

    // 3. Pencetakan struk fisik
    const printer = data.printers.find(p => p.type === 'cashier')
    const stationPrinters = data.printers.filter(p => p.type !== 'cashier' && p.autoPrint)

    void autoPrintReceipt(order, data.settings, printer).then(r => {
      if (!r.ok && r.reason !== 'disabled') {
        setPrintNotice(
          `Pembayaran ${order.number} berhasil, tetapi struk kasir gagal dicetak: ${r.reason}. Print job aman tersimpan dan dapat di-Retry.`
        )
      }
    })

    stationPrinters.forEach(p => {
      const task = draftOrder
        ? printKitchenDeltaNative(draftOrder, order, data.settings, p)
        : printKitchenNative(order, data.settings, p)
      void task.then(r => {
        if (!r.ok && !['disabled', 'no-routed-items', 'no-changes'].includes(r.reason ?? '')) {
          setPrintNotice(`Pembayaran berhasil, tetapi ${p.name} gagal mencetak: ${r.reason}. Print job dapat di-Retry.`)
        }
      })
    })
  }

  const finishReceipt = () => {
    setReceipt(null)
    reset()
  }

  return (
    <>
      {draftOrder && (
        <div className="draft-banner">
          <Icon name="history" />
          <span>
            <strong>Melanjutkan {draftOrder.number}</strong> • {draftOrder.queueNumber}
          </span>
          <button onClick={reset}>Batalkan</button>
        </div>
      )}
      {reorderNotice && (
        <div className="operational-alert reorder-alert">
          <Icon name="history" />
          <div>
            <strong>Pesan Lagi</strong>
            <span>{reorderNotice}</span>
          </div>
          <button onClick={() => setReorderNotice('')}>Tutup</button>
        </div>
      )}
      {printNotice && (
        <div className="operational-alert print-alert">
          <Icon name="printer" />
          <div>
            <strong>Status printer</strong>
            <span>{printNotice}</span>
          </div>
          <button onClick={() => setPrintNotice('')}>Tutup</button>
        </div>
      )}
      {checkoutError && (
        <div className="operational-alert validation-alert">
          <Icon name="alert" />
          <div>
            <strong>Pesanan belum lengkap</strong>
            <span>{checkoutError}</span>
          </div>
          <button onClick={() => setCheckoutError('')}>Tutup</button>
        </div>
      )}
      {!shift && (
        <div className="operational-alert">
          <Icon name="alert" />
          <div>
            <strong>Shift kasir belum dibuka</strong>
            <span>Buka shift dan isi kas awal sebelum menerima pembayaran.</span>
          </div>
          <button onClick={onOpenShift}>Buka Shift</button>
        </div>
      )}

      <div className="cashier-layout">
        <section className="catalog-panel">
          <div className="catalog-tools">
            <label className="search-box">
              <Icon name="search" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cari menu / kode produk (F2: Cari • F4: Simpan • F9: Bayar)..."
              />
            </label>
          </div>
          <div className="category-row">
            {menuCategories.map(c => (
              <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="section-title">
            <div>
              <h2>{category === 'Favorit' ? 'Menu Paling Disukai' : 'Pilih Menu'}</h2>
              <p>
                {category === 'Favorit' ? 'Berdasarkan transaksi lunas' : 'Menu aktif dan siap dipesan'} •{' '}
                {filtered.length} produk
              </p>
            </div>
            <span className="subtle-badge">{data.settings.outletName}</span>
          </div>
          <div className="product-grid">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} onAdd={() => add(p.id)} />
            ))}
          </div>
          {category === 'Favorit' && !filtered.length && (
            <div className="empty-state">
              <Icon name="orders" size={32} />
              <strong>Favorit segera muncul</strong>
              <span>Menu terlaris akan terisi otomatis setelah ada transaksi lunas.</span>
            </div>
          )}
        </section>

        <CartPanel
          items={cart}
          onQty={qty}
          onClear={reset}
          onPay={pay}
          onHold={hold}
          validationError={checkoutError}
          orderType={orderType}
          onOrderType={setOrderType}
          tableName={tableName}
          onTableName={setTableName}
          customerName={customerName}
          onCustomerName={setCustomerName}
          customerPhone={customerPhone}
          onCustomerPhone={setCustomerPhone}
          customerEmail={customerEmail}
          onCustomerEmail={setCustomerEmail}
          tables={data.settings.tables ?? []}
          occupiedTables={occupiedTables}
          note={note}
          onNote={setNote}
          discount={can('sale.discount') ? discount : 0}
          onDiscount={v => can('sale.discount') && setDiscount(Math.min(v, subtotal))}
          tax={tax}
          service={service}
        />
      </div>

      {!!cart.length && (
        <button className="mobile-cart-bar" onClick={() => setMobileCart(true)}>
          <span>
            <Icon name="receipt" /> {cart.reduce((n, i) => n + i.qty, 0)} item
          </span>
          <strong>{rupiahCompact(total)}</strong>
          <span>
            Lihat Pesanan <Icon name="chevron" size={14} />
          </span>
        </button>
      )}

      {mobileCart && (
        <div className="mobile-sheet-wrap">
          <button className="sheet-scrim" onClick={() => setMobileCart(false)} />
          <div className="mobile-cart-sheet">
            <div className="sheet-handle" />
            <button className="sheet-close" onClick={() => setMobileCart(false)}>
              Tutup
            </button>
            <CartPanel
              compact
              items={cart}
              onQty={qty}
              onClear={reset}
              onPay={pay}
              onHold={hold}
              validationError={checkoutError}
              orderType={orderType}
              onOrderType={setOrderType}
              tableName={tableName}
              onTableName={setTableName}
              customerName={customerName}
              onCustomerName={setCustomerName}
              customerPhone={customerPhone}
              onCustomerPhone={setCustomerPhone}
              customerEmail={customerEmail}
              onCustomerEmail={setCustomerEmail}
              tables={data.settings.tables ?? []}
              occupiedTables={occupiedTables}
              note={note}
              onNote={setNote}
              discount={can('sale.discount') ? discount : 0}
              onDiscount={v => can('sale.discount') && setDiscount(Math.min(v, subtotal))}
              tax={tax}
              service={service}
            />
          </div>
        </div>
      )}

      {configProduct && (
        <Modal
          open
          title={configProduct.name}
          subtitle="Pilih modifier/topping dan catatan khusus item"
          onClose={() => setConfigProduct(null)}
          size="sm"
        >
          <div className="modifier-picker">
            {configProduct.modifierOptions?.map(m => (
              <button
                key={m.id}
                className={selectedModifierIds.includes(m.id) ? 'active' : ''}
                onClick={() =>
                  setSelectedModifierIds(cur =>
                    cur.includes(m.id) ? cur.filter(x => x !== m.id) : [...cur, m.id]
                  )
                }
              >
                <span>{m.name}</span>
                <b>{m.price ? `+${rupiahCompact(m.price)}` : 'Tanpa biaya'}</b>
                <Icon name={selectedModifierIds.includes(m.id) ? 'check' : 'plus'} size={15} />
              </button>
            ))}
          </div>
          <label className="field-label">Catatan item</label>
          <input
            className="text-input"
            value={itemNote}
            onChange={e => setItemNote(e.target.value)}
            placeholder="Contoh: kuah sedikit, jangan terlalu matang"
          />
          <div className="modal-actions">
            <button className="secondary" onClick={() => setConfigProduct(null)}>
              Batal
            </button>
            <button className="primary" onClick={confirmConfigured}>
              Tambahkan
            </button>
          </div>
        </Modal>
      )}

      <PaymentModal open={paymentOpen} total={total} onClose={() => setPaymentOpen(false)} onConfirm={confirmPayment} />

      {receipt && (
        <Receipt
          order={receipt}
          settings={data.settings}
          paperWidth={data.printers.find(p => p.type === 'cashier')?.paperWidth ?? 80}
          printWidthDots={data.printers.find(p => p.type === 'cashier')?.printWidthDots}
          printLogo={data.printers.find(p => p.type === 'cashier')?.printLogo ?? true}
          onClose={finishReceipt}
          onThermalPrint={async () => {
            const printer = data.printers.find(p => p.type === 'cashier')
            return printer
              ? printReceiptNative(receipt, data.settings, printer)
              : { ok: false, reason: 'Printer kasir belum dikonfigurasi' }
          }}
        />
      )}
    </>
  )
}

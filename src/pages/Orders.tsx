import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Receipt } from '../components/Receipt'
import { KitchenTicket } from '../components/KitchenTicket'
import { Modal } from '../components/Modal'
import { usePosStore } from '../context/PosStore'
import { dateTimeId, rupiahCompact } from '../lib/format'
import { itemLineTotal, paymentSummary } from '../lib/order'
import type { Order } from '../types'
import { printReceiptNative } from '../services/printer'

const statusLabel: Record<Order['status'], string> = { held:'Tersimpan', paid:'Lunas', void:'Void', refunded:'Refund' }
const kitchenLabel = { new: 'Baru', preparing: 'Diproses', ready: 'Siap', served: 'Disajikan' } as const

function holdState(order: Order) {
  if (order.status !== 'held' || !order.holdExpiresAt) return null
  const diff = new Date(order.holdExpiresAt).getTime() - Date.now()
  if (diff <= 0) return { expired: true, text: 'Kedaluwarsa' }
  const mins = Math.ceil(diff / 60000)
  return { expired: false, text: mins < 60 ? `${mins} menit lagi` : `${Math.ceil(mins / 60)} jam lagi` }
}

export function OrdersPage({ onResume, onReorder }: { onResume?: (order: Order) => void; onReorder?: (order: Order) => void }) {
  const { data, can, voidOrder, refundOrder } = usePosStore()
  const [filter, setFilter] = useState<'all' | Order['status']>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)
  const [receipt, setReceipt] = useState<Order | null>(null)
  const [kitchen, setKitchen] = useState<Order | null>(null)
  const [action, setAction] = useState<'void' | 'refund' | null>(null)
  const [reason, setReason] = useState('')

  const orders = useMemo(() => data.orders
    .filter(o => (filter === 'all' || o.status === filter) && (
      o.number.toLowerCase().includes(query.toLowerCase()) ||
      o.cashierName.toLowerCase().includes(query.toLowerCase()) ||
      o.tableName?.toLowerCase().includes(query.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(query.toLowerCase()) ||
      o.customerPhone?.includes(query) || o.customerEmail?.toLowerCase().includes(query.toLowerCase())
    ))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.orders, filter, query])

  const requestVoid = (order: Order, defaultReason = '') => {
    setSelected(order)
    setReason(defaultReason)
    setAction('void')
  }

  return <div className="module-page">
    <div className="module-toolbar">
      <label className="search-box wide"><Icon name="search"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nomor transaksi, kasir, meja, pelanggan..."/></label>
      <div className="segmented">
        {(['all', 'held', 'paid', 'void', 'refunded'] as const).map(s => <button className={filter === s ? 'active' : ''} key={s} onClick={() => setFilter(s)}>{s === 'all' ? 'Semua' : statusLabel[s]}</button>)}
      </div>
    </div>

    <div className="data-card">
      <table className="data-table">
        <thead><tr><th>Transaksi</th><th>Waktu</th><th>Order</th><th>Kasir</th><th>Status</th><th>Dapur</th><th className="right">Total</th><th/></tr></thead>
        <tbody>{orders.map(o => {
          const hold = holdState(o)
          return <tr key={o.id} className={hold?.expired ? 'row-warning tappable-row' : 'tappable-row'} onClick={() => setSelected(o)}>
            <td><strong>{o.number}</strong><small>{o.queueNumber}</small></td>
            <td>{dateTimeId(o.createdAt)}</td>
            <td>{o.type === 'dine_in' ? `Dine In${o.tableName ? ' • ' + o.tableName : ''}` : o.type === 'takeaway' ? 'Bungkus' : 'Delivery'}{o.customerName && <small>{o.customerName}</small>}</td>
            <td>{o.cashierName}</td>
            <td><span className={`status-badge ${o.status}`}>{statusLabel[o.status]}</span>{hold && <small className={hold.expired ? 'text-danger' : 'muted'}>{hold.text}</small>}</td>
            <td><span className={`status-badge kitchen-${o.kitchenStatus ?? 'new'}`}>{kitchenLabel[o.kitchenStatus ?? 'new']}</span></td>
            <td className="right"><strong>{rupiahCompact(o.total)}</strong></td>
            <td className="right"><button className="icon-button" onClick={event => { event.stopPropagation(); setSelected(o) }} aria-label={`Lihat ${o.number}`}><Icon name="eye"/></button></td>
          </tr>
        })}</tbody>
      </table>
      {!orders.length && <div className="empty-state"><Icon name="orders" size={36}/><strong>Tidak ada pesanan</strong><span>Ubah filter atau buat transaksi baru dari Kasir.</span></div>}
    </div>

    {selected && <Modal open title={`Detail ${selected.number}`} subtitle={dateTimeId(selected.createdAt)} onClose={() => setSelected(null)} size="lg">
      <div className="order-detail-grid">
        <div>
          <h3>Item Pesanan</h3>
          {selected.items.map((i, index) => <div className="detail-line detail-line-rich" key={i.lineId ?? `${i.id}-${index}`}><span><b>{i.qty}×</b> {i.name}{i.modifiers?.map(m => <small key={m.name}>+ {m.name}</small>)}{i.note && <small>{i.note}</small>}</span><strong>{rupiahCompact(itemLineTotal(i))}</strong></div>)}
          <div className="detail-total"><span>Total</span><strong>{rupiahCompact(selected.total)}</strong></div>
        </div>
        <div className="detail-meta">
          <h3>Informasi</h3>
          <dl>
            <div><dt>Status</dt><dd><span className={`status-badge ${selected.status}`}>{statusLabel[selected.status]}</span></dd></div>
            {holdState(selected) && <div><dt>Masa Hold</dt><dd className={holdState(selected)?.expired ? 'text-danger' : ''}>{holdState(selected)?.text}<small>{selected.holdExpiresAt ? ` • ${dateTimeId(selected.holdExpiresAt)}` : ''}</small></dd></div>}
            <div><dt>Dapur</dt><dd>{kitchenLabel[selected.kitchenStatus ?? 'new']}</dd></div>
            <div><dt>Kasir</dt><dd>{selected.cashierName}</dd></div>
            <div><dt>Tipe</dt><dd>{selected.type}</dd></div>
            <div><dt>Meja</dt><dd>{selected.tableName ?? '-'}</dd></div>
            <div><dt>Pelanggan</dt><dd>{selected.customerName ?? '-'}</dd></div>
            {selected.customerPhone&&<div><dt>WhatsApp</dt><dd>{selected.customerPhone}</dd></div>}
            {selected.customerEmail&&<div><dt>Email</dt><dd>{selected.customerEmail}</dd></div>}
            <div><dt>Pembayaran</dt><dd>{paymentSummary(selected)}</dd></div>
          </dl>
        </div>
      </div>
      {holdState(selected)?.expired && selected.status === 'held' && <div className="inline-message warning"><Icon name="alert"/><span>Pesanan hold sudah melewati batas waktu. Batalkan untuk melepaskan reservasi stok, atau buka kembali di Kasir bila masih valid.</span></div>}
      <div className="modal-actions">
        <button className="secondary" onClick={() => setKitchen(selected)}><Icon name="kitchen"/>Ticket Dapur</button>
        {selected.status === 'held' && onResume && <button className="primary" onClick={() => { onResume(selected); setSelected(null) }}><Icon name="cashier"/>Buka di Kasir</button>}
        {selected.status === 'held' && can('sale.void') && <button className="danger-button" onClick={() => requestVoid(selected, holdState(selected)?.expired ? 'Hold kedaluwarsa' : '')}>Batalkan Hold</button>}
        {selected.status === 'paid' && <button className="secondary" onClick={() => setReceipt(selected)}><Icon name="printer"/>Cetak Ulang</button>}
        {selected.status === 'paid' && onReorder && <button className="primary" onClick={() => { onReorder(selected); setSelected(null) }}><Icon name="plus"/>Pesan Lagi</button>}
        {selected.status === 'paid' && can('sale.void') && <button className="danger-button" onClick={() => setAction('void')}>Void</button>}
        {selected.status === 'paid' && can('sale.refund') && <button className="danger-button" onClick={() => setAction('refund')}>Refund</button>}
      </div>
    </Modal>}

    {action && selected && <Modal open title={action === 'void' ? (selected.status === 'held' ? 'Batalkan Hold' : 'Void Transaksi') : 'Refund Transaksi'} subtitle="Tindakan ini dicatat pada audit log dan inventory direkonsiliasi." onClose={() => setAction(null)} size="sm">
      <label className="field-label">Alasan</label>
      <textarea className="text-area" value={reason} onChange={e => setReason(e.target.value)} placeholder="Tuliskan alasan yang jelas"/>
      <button className="danger-button full" disabled={reason.trim().length < 3} onClick={() => { action === 'void' ? voidOrder(selected.id, reason) : refundOrder(selected.id, reason); setAction(null); setSelected(null); setReason('') }}>Konfirmasi {action === 'void' ? (selected.status === 'held' ? 'Pembatalan' : 'Void') : 'Refund'}</button>
    </Modal>}

    {receipt && <Receipt order={receipt} settings={data.settings} paperWidth={data.printers.find(p => p.type === 'cashier')?.paperWidth ?? 80} printWidthDots={data.printers.find(p => p.type === 'cashier')?.printWidthDots} printLogo={data.printers.find(p => p.type === 'cashier')?.printLogo ?? true} onClose={() => setReceipt(null)} onThermalPrint={can('sale.reprint') ? async () => { const printer = data.printers.find(p => p.type === 'cashier'); return printer ? printReceiptNative(receipt, data.settings, printer) : { ok: false, reason: 'Printer kasir belum dikonfigurasi' } } : undefined}/>}
    {kitchen && <KitchenTicket order={kitchen} settings={data.settings} onClose={() => setKitchen(null)}/>} 
  </div>
}

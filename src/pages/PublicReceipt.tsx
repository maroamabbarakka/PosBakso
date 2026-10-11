import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { decodeOnlineReceipt, fetchRemoteReceipt, type PublicReceiptData } from '../lib/digitalReceipt.ts'
import { dateTimeId, rupiahCompact } from '../lib/format.ts'
import { itemLineTotal, itemUnitPrice } from '../lib/order.ts'

type ReceiptTrust = 'verified' | 'offline-unverified'

export function PublicReceiptPage() {
  const [data, setData] = useState<PublicReceiptData | null>(null)
  const [trust, setTrust] = useState<ReceiptTrust>('verified')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [qr, setQr] = useState('')

  useEffect(() => {
    void QRCode.toDataURL(location.href, {
      width: 220,
      margin: 1,
      color: { dark: '#171717', light: '#ffffff' },
    }).then(setQr)
  }, [])

  useEffect(() => {
    async function loadReceipt() {
      const hash = location.hash.replace(/^#/, '')
      if (!hash) {
        setLoading(false)
        setError(true)
        return
      }

      // 1. Periksa apakah hash merupakan token 192-bit acak (48 karakter hex)
      const tokenCandidate = hash.includes('-') ? hash.split('-')[0] : hash
      if (/^[0-9a-f]{32,64}$/i.test(tokenCandidate)) {
        const remote = await fetchRemoteReceipt(tokenCandidate)
        if (remote) {
          setData(remote)
          setTrust('verified')
          setLoading(false)
          return
        }
      }

      // 2. Fallback offline legacy: jika data berupa payload Base64 mentah
      // PENTING: Jangan beri tanda 'resmi/terverifikasi' untuk data mentah URL
      const fallback = decodeOnlineReceipt(hash)
      if (fallback) {
        setData(fallback)
        setTrust('offline-unverified')
        setLoading(false)
        return
      }

      setLoading(false)
      setError(true)
    }

    void loadReceipt()
  }, [])

  if (loading) {
    return (
      <main className="online-receipt-page">
        <section className="online-receipt-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div className="online-brand-mark" style={{ animation: 'spin 1.5s linear infinite' }}>♨</div>
          <p style={{ marginTop: '1rem', color: '#666' }}>Memverifikasi keaslian nota digital pada server...</p>
        </section>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="online-receipt-error">
        <strong>Nota Tidak Valid atau Belum Terverifikasi</strong>
        <p>Tautan nota ini tidak terdaftar pada server kasir, sudah kedaluwarsa, atau terjadi modifikasi URL.</p>
      </main>
    )
  }

  const o = data.order
  const orderType = o.type === 'dine_in'
    ? `Makan di tempat${o.tableName ? ` • ${o.tableName}` : ''}`
    : o.type === 'takeaway'
    ? 'Bungkus'
    : 'Delivery'

  return (
    <main className="online-receipt-page">
      <section className="online-receipt-card">
        <header>
          <div className="online-brand-mark">♨</div>
          <span>{trust === 'verified' ? 'NOTA DIGITAL RESMI' : 'NOTA LOKAL (OFFLINE)'}</span>
          <h1>{data.brand}</h1>
          <p>{data.outlet}</p>
        </header>

        <div className={`online-receipt-status ${trust === 'verified' ? 'verified' : 'unverified'}`}>
          <small>Nomor antrean</small>
          <strong>{o.queueNumber}</strong>
          <span>
            {trust === 'verified' ? 'Pesanan terverifikasi cloud ✓' : '⚠️ Belum diverifikasi server cloud'}
          </span>
        </div>

        {trust === 'offline-unverified' && (
          <div style={{ margin: '0.75rem 0', padding: '0.6rem 0.8rem', background: '#fff3cd', color: '#856404', borderRadius: '6px', fontSize: '12px', lineHeight: 1.4 }}>
            <strong>Peringatan Keabsahan:</strong> Nota ini dihasilkan secara lokal dan belum tervalidasi oleh server pusat. Tidak dapat digunakan sebagai bukti audit pembayaran resmi sampai disinkronkan oleh pihak kasir.
          </div>
        )}

        <dl>
          <div><dt>No. transaksi</dt><dd>{o.number}</dd></div>
          <div><dt>Waktu</dt><dd>{dateTimeId(o.createdAt)}</dd></div>
          <div><dt>Tipe</dt><dd>{orderType}</dd></div>
          {o.customerName && <div><dt>Pelanggan</dt><dd>{o.customerName}</dd></div>}
        </dl>

        <div className="online-items">
          {o.items.map((item, index) => (
            <article key={item.lineId ?? `${item.id}-${index}`}>
              <div>
                <strong>{item.name}</strong>
                <small>{item.qty} × {rupiahCompact(itemUnitPrice(item))}</small>
                {item.modifiers?.map(m => (
                  <small key={m.id ?? m.name}>+ {m.name}</small>
                ))}
                {item.note && <em>{item.note}</em>}
              </div>
              <b>{rupiahCompact(itemLineTotal(item))}</b>
            </article>
          ))}
        </div>

        <div className="online-totals">
          <div><span>Subtotal</span><b>{rupiahCompact(o.subtotal)}</b></div>
          {o.discount > 0 && <div><span>Diskon</span><b>-{rupiahCompact(o.discount)}</b></div>}
          {o.tax > 0 && <div><span>Pajak</span><b>{rupiahCompact(o.tax)}</b></div>}
          {o.service > 0 && <div><span>Layanan</span><b>{rupiahCompact(o.service)}</b></div>}
          <div className="total"><span>Total</span><b>{rupiahCompact(o.total)}</b></div>
        </div>

        <div className="online-payment">
          <span>Pembayaran</span>
          <strong>{o.payments?.map(p => p.label).join(' + ') || '-'}</strong>
        </div>

        <footer>
          {qr && <img src={qr} alt="QR nota ini" />}
          <strong>{data.tagline}</strong>
          <p>{data.address}<br />{data.phone}</p>
          <small>
            {trust === 'verified'
              ? 'Tercatat resmi dalam sistem Cloud POS.'
              : 'Salinan lokal sementara.'}
          </small>
        </footer>
      </section>
    </main>
  )
}

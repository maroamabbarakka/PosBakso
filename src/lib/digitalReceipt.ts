import { doc, getDoc, setDoc } from 'firebase/firestore'
import { cloudSyncEnabled, db } from './firebase'
import type { Order, OutletSettings } from '../types.ts'
import { dateTimeId } from './format.ts'
import { itemLineTotal, orderPayments } from './order.ts'

export type PublicReceiptData = {
  v: 1
  brand: string
  outlet: string
  address: string
  phone: string
  tagline: string
  order: Pick<
    Order,
    | 'number'
    | 'queueNumber'
    | 'createdAt'
    | 'type'
    | 'tableName'
    | 'customerName'
    | 'items'
    | 'subtotal'
    | 'discount'
    | 'tax'
    | 'service'
    | 'total'
    | 'payments'
  >
}

export type PublicReceiptDocument = PublicReceiptData & {
  orderId: string
  createdBy: string
  createdAt: string
  total: number
}

export function randomReceiptToken(): string {
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

const toBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach(byte => (binary += String.fromCharCode(byte)))
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)))
}

export function publicReceiptData(order: Order, settings: OutletSettings): PublicReceiptData {
  return {
    v: 1,
    brand: settings.brandName,
    outlet: settings.outletName,
    address: settings.address,
    phone: settings.phone,
    tagline: settings.tagline,
    order: {
      number: order.number,
      queueNumber: order.queueNumber,
      createdAt: order.createdAt,
      type: order.type,
      tableName: order.tableName,
      customerName: order.customerName,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      service: order.service,
      total: order.total,
      payments: order.payments ?? (order.payment ? [order.payment] : []),
    },
  }
}

/**
 * Mengembalikan URL nota digital resmi yang aman.
 * Jika order memiliki receiptToken (192-bit acak yang terverifikasi),
 * gunakan token tersebut. URL ini tidak memuat payload Base64 mentah sehingga tidak bisa dipalsukan.
 */
export function onlineReceiptUrl(order: Order, settings?: OutletSettings): string {
  if (order.receiptToken) {
    return `${window.location.origin}/nota#${order.receiptToken}`
  }
  if (!settings) {
    return `${window.location.origin}/nota#${order.id}`
  }
  // Fallback hanya untuk data historis lama sebelum sistem receiptToken aktif
  return `${window.location.origin}/nota#${toBase64Url(JSON.stringify(publicReceiptData(order, settings)))}`
}

/**
 * Menerbitkan nota digital ke dokumen immutable Firestore public_receipts/{token}.
 */
export async function publishDigitalReceipt(order: Order, settings: OutletSettings): Promise<string> {
  const token = order.receiptToken || randomReceiptToken()
  const payload = publicReceiptData(order, settings)
  if (cloudSyncEnabled && db) {
    try {
      await setDoc(doc(db, 'public_receipts', token), {
        ...payload,
        orderId: order.id,
        total: order.total,
        createdBy: order.cashierId,
        createdAt: order.createdAt,
      })
      return `${window.location.origin}/nota#${token}`
    } catch {
      // Abaikan bila offline, antrean mutasi outbox akan menyinkronkannya
    }
  }
  return `${window.location.origin}/nota#${token}`
}

export function decodeOnlineReceipt(hash: string): PublicReceiptData | null {
  try {
    const raw = hash.replace(/^#/, '')
    const base64Part = raw.includes('-') ? raw.split('-')[1] : raw
    const parsed = JSON.parse(fromBase64Url(base64Part)) as PublicReceiptData
    return parsed?.v === 1 && parsed.order?.number && Array.isArray(parsed.order.items) ? parsed : null
  } catch {
    return null
  }
}

export async function fetchRemoteReceipt(token: string): Promise<PublicReceiptData | null> {
  if (!cloudSyncEnabled || !db) return null
  try {
    const snap = await getDoc(doc(db, 'public_receipts', token))
    if (!snap.exists()) return null
    const data = snap.data() as PublicReceiptData
    return data?.v === 1 && data.order?.number ? data : null
  } catch {
    return null
  }
}

const amount = (value: number) => `Rp${Math.round(value).toLocaleString('id-ID')}`

export function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  return digits
}

export function digitalReceiptText(order: Order, settings: OutletSettings, url?: string) {
  const link = url || onlineReceiptUrl(order, settings)
  const lines = [
    `*${settings.brandName}*`,
    settings.outletName,
    `Pesanan *${order.queueNumber}*`,
    `No. ${order.number}`,
    dateTimeId(order.createdAt),
    '',
  ]
  order.items.forEach(item => {
    lines.push(`${item.qty}x ${item.name} — ${amount(itemLineTotal(item))}`)
    item.modifiers?.forEach(mod => lines.push(`   + ${mod.name}`))
    if (item.note) lines.push(`   Catatan: ${item.note}`)
  })
  lines.push('', `Subtotal: ${amount(order.subtotal)}`)
  if (order.discount) lines.push(`Diskon: -${amount(order.discount)}`)
  if (order.tax) lines.push(`Pajak: ${amount(order.tax)}`)
  if (order.service) lines.push(`Layanan: ${amount(order.service)}`)
  lines.push(`*TOTAL: ${amount(order.total)}*`)
  const payments = orderPayments(order)
  if (payments.length) lines.push(`Pembayaran: ${payments.map(p => p.label).join(' + ')}`)
  lines.push(
    '',
    `Nota online: ${link}`,
    order.kitchenStatus === 'ready'
      ? 'Pesanan sudah siap diambil.'
      : 'Pesanan telah kami terima dan sedang diproses.',
    settings.tagline || 'Terima kasih atas kunjungan Anda.',
    settings.phone ? `Kontak: ${settings.phone}` : ''
  )
  return lines.filter(line => line !== undefined).join('\n').trim()
}

export function whatsappReceiptUrl(order: Order, settings: OutletSettings, phone = order.customerPhone ?? '', url?: string) {
  const number = normalizeWhatsappNumber(phone)
  return `https://wa.me/${number}?text=${encodeURIComponent(digitalReceiptText(order, settings, url))}`
}

export function emailReceiptUrl(order: Order, settings: OutletSettings, email = order.customerEmail ?? '', url?: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    `Struk ${settings.brandName} — ${order.number}`
  )}&body=${encodeURIComponent(digitalReceiptText(order, settings, url))}`
}

export async function shareDigitalReceipt(order: Order, settings: OutletSettings) {
  const url = await publishDigitalReceipt(order, settings)
  const text = digitalReceiptText(order, settings, url)
  if (navigator.share) {
    try {
      await navigator.share({ title: `Struk ${order.number}`, text, url })
      return 'shared'
    } catch {
      // Dibatalkan pengguna
    }
  }
  await navigator.clipboard.writeText(`${text}\n${url}`)
  return 'copied'
}

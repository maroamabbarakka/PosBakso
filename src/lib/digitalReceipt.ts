import type { Order, OutletSettings } from '../types'
import { dateTimeId } from './format'
import { itemLineTotal, orderPayments } from './order'

export type PublicReceiptData={v:1;brand:string;outlet:string;address:string;phone:string;tagline:string;order:Pick<Order,'number'|'queueNumber'|'createdAt'|'type'|'tableName'|'customerName'|'items'|'subtotal'|'discount'|'tax'|'service'|'total'|'payments'>}
const toBase64Url=(value:string)=>{const bytes=new TextEncoder().encode(value);let binary='';bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
const fromBase64Url=(value:string)=>{const normalized=value.replace(/-/g,'+').replace(/_/g,'/');const binary=atob(normalized+'='.repeat((4-normalized.length%4)%4));return new TextDecoder().decode(Uint8Array.from(binary,char=>char.charCodeAt(0)))}
export function publicReceiptData(order:Order,settings:OutletSettings):PublicReceiptData{return{v:1,brand:settings.brandName,outlet:settings.outletName,address:settings.address,phone:settings.phone,tagline:settings.tagline,order:{number:order.number,queueNumber:order.queueNumber,createdAt:order.createdAt,type:order.type,tableName:order.tableName,customerName:order.customerName,items:order.items,subtotal:order.subtotal,discount:order.discount,tax:order.tax,service:order.service,total:order.total,payments:order.payments??(order.payment?[order.payment]:[])}}}
export function onlineReceiptUrl(order:Order,settings:OutletSettings){return`${window.location.origin}/nota#${toBase64Url(JSON.stringify(publicReceiptData(order,settings)))}`}
export function decodeOnlineReceipt(hash:string):PublicReceiptData|null{try{const parsed=JSON.parse(fromBase64Url(hash.replace(/^#/,''))) as PublicReceiptData;return parsed?.v===1&&parsed.order?.number&&Array.isArray(parsed.order.items)?parsed:null}catch{return null}}

const amount=(value:number)=>`Rp${Math.round(value).toLocaleString('id-ID')}`
export function normalizeWhatsappNumber(value:string){const digits=value.replace(/\D/g,'');if(!digits)return'';if(digits.startsWith('0'))return`62${digits.slice(1)}`;if(digits.startsWith('62'))return digits;return digits}
export function digitalReceiptText(order:Order,settings:OutletSettings){
  const lines=[`*${settings.brandName}*`,settings.outletName,`Pesanan *${order.queueNumber}*`,`No. ${order.number}`,dateTimeId(order.createdAt),'']
  order.items.forEach(item=>{lines.push(`${item.qty}x ${item.name} — ${amount(itemLineTotal(item))}`);item.modifiers?.forEach(mod=>lines.push(`   + ${mod.name}`));if(item.note)lines.push(`   Catatan: ${item.note}`)})
  lines.push('',`Subtotal: ${amount(order.subtotal)}`);if(order.discount)lines.push(`Diskon: -${amount(order.discount)}`);if(order.tax)lines.push(`Pajak: ${amount(order.tax)}`);if(order.service)lines.push(`Layanan: ${amount(order.service)}`);lines.push(`*TOTAL: ${amount(order.total)}*`)
  const payments=orderPayments(order);if(payments.length)lines.push(`Pembayaran: ${payments.map(p=>p.label).join(' + ')}`)
  lines.push('',`Nota online: ${onlineReceiptUrl(order,settings)}`,order.kitchenStatus==='ready'?'Pesanan sudah siap diambil.':'Pesanan telah kami terima dan sedang diproses.',settings.tagline||'Terima kasih atas kunjungan Anda.',settings.phone?`Kontak: ${settings.phone}`:'')
  return lines.filter(line=>line!==undefined).join('\n').trim()
}
export function whatsappReceiptUrl(order:Order,settings:OutletSettings,phone=order.customerPhone??''){const number=normalizeWhatsappNumber(phone);return `https://wa.me/${number}?text=${encodeURIComponent(digitalReceiptText(order,settings))}`}
export function emailReceiptUrl(order:Order,settings:OutletSettings,email=order.customerEmail??''){return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Struk ${settings.brandName} — ${order.number}`)}&body=${encodeURIComponent(digitalReceiptText(order,settings))}`}
export async function shareDigitalReceipt(order:Order,settings:OutletSettings){const text=digitalReceiptText(order,settings),url=onlineReceiptUrl(order,settings);if(navigator.share){await navigator.share({title:`Struk ${order.number}`,text,url});return'shared'}await navigator.clipboard.writeText(`${text}\n${url}`);return'copied'}

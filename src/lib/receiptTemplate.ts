import type { Order, OutletSettings } from '../types'
import { dateTimeId, rupiahCompact } from './format'

/**
 * Safe, deterministic receipt template replacement shared by browser preview and ESC/POS payload.
 * Unknown tokens are preserved so a typo is visible during preview instead of silently disappearing.
 */
export function receiptTemplate(text:string, order:Order, settings:OutletSettings){
  const values:Record<string,string>={
    order_number:order.number,
    queue_number:order.queueNumber,
    terminal:order.terminalCode??'',
    cashier:order.cashierName,
    customer:order.customerName??'',
    table:order.tableName??'',
    order_type:order.type==='dine_in'?'Dine In':order.type==='takeaway'?'Bungkus':'Delivery',
    total:rupiahCompact(order.total),
    subtotal:rupiahCompact(order.subtotal),
    date:dateTimeId(order.createdAt),
    outlet:settings.outletName,
    brand:settings.brandName,
    phone:settings.phone,
    address:settings.address,
  }
  return String(text??'').replace(/\{([a-z_]+)\}/gi,(full,key:string)=>Object.prototype.hasOwnProperty.call(values,key.toLowerCase())?values[key.toLowerCase()]:full)
}

export function receiptTemplateLines(lines:string[],order:Order,settings:OutletSettings){return lines.map(line=>receiptTemplate(line,order,settings))}

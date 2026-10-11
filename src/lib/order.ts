import type { CartItem, Order, Payment, PaymentMethod } from '../types'

export const paymentLabels:Record<PaymentMethod,string>={cash:'Tunai',qris:'QRIS',transfer:'Transfer',card:'Kartu',other:'Lainnya'}

export function itemUnitPrice(item:CartItem){
  return item.price+(item.modifiers??[]).reduce((sum,m)=>sum+m.price,0)
}
export function itemLineTotal(item:CartItem){return itemUnitPrice(item)*item.qty}
export function orderPayments(order:Order):Payment[]{
  if(order.payments?.length)return order.payments
  return order.payment?[order.payment]:[]
}
export function paymentMethodAmount(order:Order,method:PaymentMethod){return orderPayments(order).filter(p=>p.method===method).reduce((s,p)=>s+p.amount,0)}
export function paymentSummary(order:Order){const payments=orderPayments(order);return payments.length?payments.map(p=>p.label).join(' + '):'-'}

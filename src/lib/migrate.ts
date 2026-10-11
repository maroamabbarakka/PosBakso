import { defaultPrinters, defaultRoles, emptyProductionData, normalizeSettings } from '../data/defaults'
import type { AppData, KitchenStation, KitchenStatus, Order, PrinterConfig } from '../types'
import { localDateKey } from './format'

export const CURRENT_SCHEMA_VERSION=4

function deriveStationStatus(order:Order):Order['stationStatus']{
  if(order.stationStatus)return order.stationStatus
  const legacy:KitchenStatus=order.kitchenStatus??'new';const stations=new Set<KitchenStation>()
  order.items.forEach(item=>{if(item.kitchenRoute==='kitchen'||item.kitchenRoute==='bar')stations.add(item.kitchenRoute)})
  const result:Order['stationStatus']={};stations.forEach(station=>{result[station]=legacy});return result
}

export function aggregateKitchenStatus(order:Order):KitchenStatus{
  const statuses=Object.values(deriveStationStatus(order)??{}) as KitchenStatus[]
  if(!statuses.length)return order.kitchenStatus??'served'
  if(statuses.every(x=>x==='served'))return'served'
  if(statuses.every(x=>x==='ready'||x==='served'))return'ready'
  if(statuses.some(x=>x==='preparing'||x==='ready'||x==='served'))return'preparing'
  return'new'
}

export function normalizeOrder(order:Order):Order{
  const rawStatus=String((order as unknown as {status?:string}).status??'held')
  const status:Order['status']=rawStatus==='preparing'||rawStatus==='ready' ? ((order.payment||(order.payments?.length??0)>0)?'paid':'held') : (['held','paid','void','refunded'].includes(rawStatus)?rawStatus as Order['status']:'held')
  const stationStatus=deriveStationStatus(order)
  return {...order,status,businessDate:order.businessDate??localDateKey(order.createdAt),voidDate:order.voidDate??(order.voidedAt?localDateKey(order.voidedAt):undefined),refundDate:order.refundDate??(order.refundedAt?localDateKey(order.refundedAt):undefined),stationStatus,kitchenStatus:aggregateKitchenStatus({...order,stationStatus})}
}

export function looksLikeDemoSnapshot(data:AppData){
  const demoOrders=data.orders.filter(o=>o.id.startsWith('ord-seed-')||o.id==='ord-held-1').length
  const demoShift=data.shifts.some(s=>s.id==='shift-seed')
  return demoOrders>=3&&demoShift
}

export function normalizeAppData(input:Partial<AppData>|null|undefined):AppData{
  const base=emptyProductionData();const data=input??{}
  const printers=(Array.isArray(data.printers)&&data.printers.length?data.printers:defaultPrinters).map((p:PrinterConfig)=>({...p,connected:false,copies:p.copies??1,characterSet:p.characterSet??'CP437',printWidthDots:p.printWidthDots??(p.paperWidth===58?384:576)}))
  return {
    ...base,...data,schemaVersion:CURRENT_SCHEMA_VERSION,
    products:Array.isArray(data.products)?data.products:[],ingredients:Array.isArray(data.ingredients)?data.ingredients:[],recipes:Array.isArray(data.recipes)?data.recipes:[],
    orders:Array.isArray(data.orders)?data.orders.map(normalizeOrder):[],shifts:Array.isArray(data.shifts)?data.shifts:[],cashMovements:Array.isArray(data.cashMovements)?data.cashMovements:[],
    users:Array.isArray(data.users)?data.users:[],roles:(Array.isArray(data.roles)&&data.roles.length?data.roles:defaultRoles).map(role=>role.key==='owner'?{...role,permissions:Array.from(new Set([...defaultRoles.find(r=>r.key==='owner')!.permissions,...role.permissions]))}:role),suppliers:Array.isArray(data.suppliers)?data.suppliers:[],purchases:Array.isArray(data.purchases)?data.purchases:[],
    stockMovements:Array.isArray(data.stockMovements)?data.stockMovements:[],printers,settings:normalizeSettings(data.settings),audit:Array.isArray(data.audit)?data.audit:[],
  }
}

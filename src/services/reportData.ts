import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { cloudSyncEnabled, db } from '../lib/firebase'
import { normalizeOrder } from '../lib/migrate'
import type { CashMovement, Order, Shift, StockMovement } from '../types'

type ReportResult={orders:Order[];source:'cloud'|'local';error?:string;cached?:boolean}
const CACHE_TTL_MS=5*60*1000
const cache=new Map<string,{at:number;orders:Order[]}>()

async function queryByField(field:'businessDate'|'refundDate'|'voidDate',from:string,to:string){
  if(!db)return[]
  const q=query(collection(db,'orders'),where(field,'>=',from),where(field,'<=',to),orderBy(field,'asc'))
  const snap=await getDocs(q)
  return snap.docs.map(d=>normalizeOrder({id:d.id,...d.data()} as Order))
}

function localRange(from:string,to:string,orders:Order[]){
  return orders.filter(o=>{const business=o.businessDate??'';const refund=o.refundDate??'';const voidDate=o.voidDate??'';return (business>=from&&business<=to)||(refund>=from&&refund<=to)||(voidDate>=from&&voidDate<=to)})
}

export function mergeReportOrders(base:Order[],incoming:Order[],from:string,to:string){
  const map=new Map(base.map(o=>[o.id,o]));localRange(from,to,incoming).forEach(o=>map.set(o.id,o));return [...map.values()]
}

export async function loadReportOrders(from:string,to:string,localOrders:Order[],options?:{force?:boolean}):Promise<ReportResult>{
  if(!cloudSyncEnabled||!db)return {orders:localRange(from,to,localOrders),source:'local'}
  const key=`${from}:${to}`;const cached=cache.get(key)
  if(!options?.force&&cached&&Date.now()-cached.at<CACHE_TTL_MS)return {orders:mergeReportOrders(cached.orders,localOrders,from,to),source:'cloud',cached:true}
  try{
    const [sales,refunds,voids]=await Promise.all([queryByField('businessDate',from,to),queryByField('refundDate',from,to),queryByField('voidDate',from,to)])
    const map=new Map<string,Order>();[...sales,...refunds,...voids].forEach(o=>map.set(o.id,o));const orders=mergeReportOrders([...map.values()],localOrders,from,to);cache.set(key,{at:Date.now(),orders})
    return {orders,source:'cloud'}
  }catch(error){
    const message=error instanceof Error?error.message:'Gagal memuat laporan cloud.'
    return {orders:localRange(from,to,localOrders),source:'local',error:message}
  }
}


type SupportData={shifts:Shift[];cashMovements:CashMovement[];stockMovements:StockMovement[]}
const supportCache=new Map<string,{at:number;data:SupportData}>()
function rangeIso(from:string,to:string){return {start:new Date(`${from}T00:00:00+08:00`).toISOString(),end:new Date(`${to}T23:59:59.999+08:00`).toISOString()}}
async function queryIsoCollection<T>(name:string,field:string,from:string,to:string){
  if(!db)return[] as T[];const {start,end}=rangeIso(from,to);const snap=await getDocs(query(collection(db,name),where(field,'>=',start),where(field,'<=',end),orderBy(field,'asc')));return snap.docs.map(d=>({id:d.id,...d.data()} as T))
}
function mergeById<T extends {id:string}>(base:T[],incoming:T[]){const map=new Map(base.map(x=>[x.id,x]));incoming.forEach(x=>map.set(x.id,x));return [...map.values()]}
function localSupport(from:string,to:string,local:SupportData):SupportData{const {start,end}=rangeIso(from,to);const within=(iso:string)=>iso>=start&&iso<=end;return {shifts:local.shifts.filter(x=>within(x.openedAt)),cashMovements:local.cashMovements.filter(x=>within(x.createdAt)),stockMovements:local.stockMovements.filter(x=>within(x.createdAt))}}
export function mergeReportSupport(base:SupportData,incoming:SupportData,from:string,to:string):SupportData{const scoped=localSupport(from,to,incoming);return {shifts:mergeById(base.shifts,scoped.shifts),cashMovements:mergeById(base.cashMovements,scoped.cashMovements),stockMovements:mergeById(base.stockMovements,scoped.stockMovements)}}
export async function loadReportSupport(from:string,to:string,local:SupportData,options?:{force?:boolean}):Promise<{data:SupportData;source:'cloud'|'local';error?:string;cached?:boolean}>{
  if(!cloudSyncEnabled||!db)return {data:localSupport(from,to,local),source:'local'}
  const key=`${from}:${to}`;const cached=supportCache.get(key);if(!options?.force&&cached&&Date.now()-cached.at<CACHE_TTL_MS)return {data:mergeReportSupport(cached.data,local,from,to),source:'cloud',cached:true}
  try{const [shifts,cashMovements,stockMovements]=await Promise.all([queryIsoCollection<Shift>('shifts','openedAt',from,to),queryIsoCollection<CashMovement>('cash_movements','createdAt',from,to),queryIsoCollection<StockMovement>('stock_movements','createdAt',from,to)]);const data=mergeReportSupport({shifts,cashMovements,stockMovements},local,from,to);supportCache.set(key,{at:Date.now(),data});return {data,source:'cloud'}}catch(error){return {data:localSupport(from,to,local),source:'local',error:error instanceof Error?error.message:'Gagal memuat data pendukung laporan.'}}
}

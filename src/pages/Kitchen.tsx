import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { usePosStore } from '../context/PosStore'
import { dateTimeId, timeId } from '../lib/format'
import { aggregateKitchenStatus, normalizeOrder } from '../lib/migrate'
import { playKitchenAlert } from '../lib/sound'
import type { KitchenStation, KitchenStatus, Order } from '../types'

const labels:Record<KitchenStatus,string>={new:'Baru',preparing:'Diproses',ready:'Siap',served:'Disajikan'}
const next:Record<Exclude<KitchenStatus,'served'>,KitchenStatus>={new:'preparing',preparing:'ready',ready:'served'}
type Station='all'|KitchenStation
function stationItems(order:Order,station:Station){return order.items.filter(i=>i.kitchenRoute!=='none'&&(station==='all'||i.kitchenRoute===station))}
function stationState(order:Order,station:Station):KitchenStatus{
  if(station==='all')return aggregateKitchenStatus(order)
  return order.stationStatus?.[station]??order.kitchenStatus??'new'
}

function getElapsedInfo(createdAt:string){
  const diff=Math.max(0,Math.floor((Date.now()-new Date(createdAt).getTime())/60000))
  if(diff<10)return{label:`${diff}m`,tone:'normal'}
  if(diff<20)return{label:`${diff}m`,tone:'warning'}
  return{label:`${diff}m!`,tone:'urgent'}
}

export function KitchenPage(){
  const {data,updateOrder}=usePosStore();const [station,setStation]=useState<Station>('kitchen')
  const [,setTick]=useState(0)
  const prevNewCount=useRef(0)

  useEffect(()=>{const id=window.setInterval(()=>setTick(t=>t+1),30000);return()=>window.clearInterval(id)},[])
  const active=useMemo(()=>data.orders.filter(o=>!['void','refunded'].includes(o.status)&&stationState(o,station)!=='served'&&stationItems(o,station).length).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),[data.orders,station])

  useEffect(()=>{
    const newCount=active.filter(o=>stationState(o,station)==='new').length
    if(newCount>prevNewCount.current){playKitchenAlert()}
    prevNewCount.current=newCount
  },[active,station])

  const groups:KitchenStatus[]=['new','preparing','ready']
  const change=(order:Order,status:KitchenStatus)=>{
    const current={...(order.stationStatus??{})}
    if(station==='all'){
      if(order.items.some(i=>i.kitchenRoute==='kitchen'))current.kitchen=status
      if(order.items.some(i=>i.kitchenRoute==='bar'))current.bar=status
    }else current[station]=status
    updateOrder(normalizeOrder({...order,stationStatus:current,updatedAt:new Date().toISOString()}))
  }
  return <div className="module-page kitchen-page"><div className="kds-header"><div><span className="eyebrow">KITCHEN DISPLAY SYSTEM</span><h2>{station==='bar'?'Station Minuman':station==='all'?'Semua Station':`Dapur ${data.settings.brandName}`}</h2><p>Progres Dapur dan Minuman dicatat terpisah agar satu station tidak menimpa station lain.</p></div><div className="kds-header-actions"><div className="segmented"><button className={station==='kitchen'?'active':''} onClick={()=>setStation('kitchen')}>Dapur</button><button className={station==='bar'?'active':''} onClick={()=>setStation('bar')}>Minuman</button><button className={station==='all'?'active':''} onClick={()=>setStation('all')}>Semua</button></div><div className="kds-live"><i/> LIVE • {active.length} order aktif</div></div></div><div className="kds-columns">{groups.map(status=><section className={`kds-column ${status}`} key={status}><header><span>{labels[status]}</span><b>{active.filter(o=>stationState(o,station)===status).length}</b></header><div className="kds-stack">{active.filter(o=>stationState(o,station)===status).map(order=><article className="kds-card" key={order.id}><div className="kds-card-head"><div><strong>{order.queueNumber}</strong><span>{order.type==='dine_in'?(order.tableName?`Meja ${order.tableName}`:'Dine In'):order.type==='takeaway'?'Bungkus':'Delivery'}</span></div><div className="kds-time-wrap"><time>{`${timeId(order.createdAt)} WITA`}</time><span className={`kds-timer ${getElapsedInfo(order.createdAt).tone}`}>{getElapsedInfo(order.createdAt).label}</span></div></div><div className="kds-items">{stationItems(order,station).map((i,index)=><div key={i.lineId??`${i.id}-${index}`}><b>{i.qty}×</b><span>{i.name}{i.modifiers?.map(m=><small key={m.id??m.name}>+ {m.name}</small>)}{i.note&&<small>{i.note}</small>}</span></div>)}</div>{order.note&&<div className="kds-note"><Icon name="info"/> {order.note}</div>}<div className="kds-meta">{order.number} • {order.cashierName}<br/>{dateTimeId(order.createdAt)}{station==='all'&&<><br/>Dapur: {labels[stationState(order,'kitchen')]} • Minuman: {labels[stationState(order,'bar')]}</>}</div><button className={`kds-action ${status}`} onClick={()=>change(order,next[status as Exclude<KitchenStatus,'served'>])}>{status==='new'?'Mulai Proses':status==='preparing'?'Tandai Siap':'Sudah Disajikan'} <Icon name="chevron"/></button></article>)}{!active.some(o=>stationState(o,station)===status)&&<div className="kds-empty"><Icon name="kitchen" size={30}/><span>Tidak ada pesanan</span></div>}</div></section>)}</div></div>
}

import { useEffect, useMemo, useState } from 'react'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { rupiahCompact, uid } from '../lib/format'
import { paymentLabels } from '../lib/order'
import { paymentsBalanced } from '../lib/domainMath'
import type { Payment, PaymentMethod } from '../types'

const methods:{id:PaymentMethod;label:string;icon:'money'|'card'|'wallet'}[]=[
  {id:'cash',label:'Tunai',icon:'money'},{id:'qris',label:'QRIS',icon:'card'},{id:'transfer',label:'Transfer',icon:'card'},{id:'card',label:'Kartu',icon:'card'},{id:'other',label:'Lainnya',icon:'wallet'}
]
type SplitRow={id:string;method:PaymentMethod;amount:number;reference:string}
export function PaymentModal({open,total,onClose,onConfirm}:{open:boolean;total:number;onClose:()=>void;onConfirm:(payments:Payment[])=>void}){
  const [mode,setMode]=useState<'single'|'split'>('single');const [method,setMethod]=useState<PaymentMethod>('cash');const [lockedTotal,setLockedTotal]=useState(total);const [tendered,setTendered]=useState(total);const [reference,setReference]=useState('');const [rows,setRows]=useState<SplitRow[]>([])
  useEffect(()=>{if(open){const amount=Math.max(0,total);setLockedTotal(amount);setMode('single');setMethod('cash');setTendered(amount);setReference('');setRows([{id:uid('pay'),method:'cash',amount:Math.ceil(amount/2),reference:''},{id:uid('pay'),method:'qris',amount:amount-Math.ceil(amount/2),reference:''}])}},[open])
  const selected=methods.find(m=>m.id===method)!;const change=Math.max(0,(method==='cash'?tendered:lockedTotal)-lockedTotal)
  const shortcuts=useMemo(()=>[lockedTotal,Math.ceil(lockedTotal/10000)*10000,Math.ceil(lockedTotal/50000)*50000,100000].filter((v,i,a)=>v>=lockedTotal&&a.indexOf(v)===i).slice(0,4),[lockedTotal])
  const splitPaid=rows.reduce((s,r)=>s+Math.max(0,r.amount),0);const remaining=lockedTotal-splitPaid;const splitBalanced=paymentsBalanced(lockedTotal,rows.map(r=>Math.max(0,r.amount)))
  const updateRow=(id:string,patch:Partial<SplitRow>)=>setRows(cur=>cur.map(r=>r.id===id?{...r,...patch}:r))
  const addRow=()=>setRows(cur=>[...cur,{id:uid('pay'),method:'cash',amount:Math.max(0,lockedTotal-cur.reduce((s,r)=>s+r.amount,0)),reference:''}])
  const handleNumpad = (val: string) => {
    if (val === 'C') {
      setTendered(0)
    } else if (val === 'PAS') {
      setTendered(lockedTotal)
    } else {
      const current = tendered === 0 ? '' : String(tendered)
      const nextStr = current + val
      if (nextStr.length <= 9) {
        setTendered(Number(nextStr) || 0)
      }
    }
  }

  const confirm=()=>{
    const paidAt=new Date().toISOString()
    if(lockedTotal<=0)return
    if(mode==='single'){onConfirm([{method,label:selected.label,amount:lockedTotal,tendered:method==='cash'?tendered:undefined,change:method==='cash'?change:undefined,reference:reference||undefined,paidAt}]);return}
    if(!splitBalanced||rows.some(r=>r.amount<=0))return
    onConfirm(rows.map(r=>({method:r.method,label:paymentLabels[r.method],amount:r.amount,reference:r.reference||undefined,paidAt})))
  }
  return <Modal open={open} onClose={onClose} title="Pembayaran" subtitle="Satu metode atau pembayaran gabungan" size="md">
    <div className="payment-total"><span>Total Tagihan</span><strong>{rupiahCompact(lockedTotal)}</strong></div>
    <div className="payment-mode"><button className={mode==='single'?'active':''} onClick={()=>setMode('single')}>Satu Metode</button><button className={mode==='split'?'active':''} onClick={()=>setMode('split')}>Pembayaran Gabungan</button></div>
    {mode==='single'?<>
      <div className="payment-methods">{methods.map(m=><button key={m.id} className={method===m.id?'active':''} onClick={()=>{setMethod(m.id);setTendered(total)}}><Icon name={m.icon}/><span>{m.label}</span>{method===m.id&&<Icon name="check" size={16}/>}</button>)}</div>
      {method==='cash'?<>
        <label className="field-label">Uang Diterima</label>
        <div className="money-input">
          <span>Rp</span>
          <input type="number" value={tendered||''} onChange={e=>setTendered(Number(e.target.value)||0)} placeholder="0"/>
        </div>
        <div className="cash-shortcuts">
          <button type="button" className="exact-cash" onClick={()=>setTendered(lockedTotal)}>Uang Pas</button>
          {shortcuts.filter(v=>v!==lockedTotal).map(v=><button type="button" key={v} onClick={()=>setTendered(v)}>{rupiahCompact(v)}</button>)}
        </div>
        <div className="change-box">
          <span>Kembalian</span>
          <strong>{rupiahCompact(change)}</strong>
        </div>
        <div className="touch-numpad" aria-label="Numpad sentuh kasir">
          <button type="button" onClick={()=>handleNumpad('1')}>1</button>
          <button type="button" onClick={()=>handleNumpad('2')}>2</button>
          <button type="button" onClick={()=>handleNumpad('3')}>3</button>
          <button type="button" onClick={()=>handleNumpad('4')}>4</button>
          <button type="button" onClick={()=>handleNumpad('5')}>5</button>
          <button type="button" onClick={()=>handleNumpad('6')}>6</button>
          <button type="button" onClick={()=>handleNumpad('7')}>7</button>
          <button type="button" onClick={()=>handleNumpad('8')}>8</button>
          <button type="button" onClick={()=>handleNumpad('9')}>9</button>
          <button type="button" className="numpad-action" onClick={()=>handleNumpad('C')}>C</button>
          <button type="button" onClick={()=>handleNumpad('0')}>0</button>
          <button type="button" onClick={()=>handleNumpad('000')}>000</button>
        </div>
      </>:<><label className="field-label">Referensi pembayaran <small>(opsional)</small></label><input className="text-input" value={reference} onChange={e=>setReference(e.target.value)} placeholder="No. referensi / catatan"/></>}
    </>:<>
      <div className="split-payment-list">{rows.map((r,index)=><div className="split-payment-row" key={r.id}><b>{index+1}</b><select value={r.method} onChange={e=>updateRow(r.id,{method:e.target.value as PaymentMethod})}>{methods.map(m=><option value={m.id} key={m.id}>{m.label}</option>)}</select><div className="split-amount"><span>Rp</span><input type="number" min="0" value={r.amount||''} onChange={e=>updateRow(r.id,{amount:Number(e.target.value)||0})}/></div><input className="split-reference" value={r.reference} onChange={e=>updateRow(r.id,{reference:e.target.value})} placeholder="Referensi"/><button className="icon-button" disabled={rows.length<=2} onClick={()=>setRows(cur=>cur.filter(x=>x.id!==r.id))}><Icon name="trash" size={16}/></button></div>)}</div>
      <button className="secondary small split-add" disabled={rows.length>=4} onClick={addRow}><Icon name="plus"/>Tambah Metode</button>
      <div className={`split-reconcile ${splitBalanced?'ok':'diff'}`}><span>Terbayar <b>{rupiahCompact(splitPaid)}</b></span><span>{remaining>=0?'Sisa':'Kelebihan'} <b>{rupiahCompact(Math.abs(remaining))}</b></span></div>
      <p className="payment-hint">Untuk pembayaran gabungan, nominal setiap metode adalah nilai yang dialokasikan ke transaksi. Kembalian tunai hanya dihitung pada mode satu metode.</p>
    </>}
    {lockedTotal<=0&&<div className="cart-validation" role="alert"><Icon name="alert"/><span>Total transaksi tidak valid. Tutup pembayaran dan periksa kembali item pesanan.</span></div>}
    <button className="primary full payment-confirm" disabled={lockedTotal<=0||(mode==='single'?(method==='cash'&&tendered<lockedTotal):(!splitBalanced||rows.some(r=>r.amount<=0)))} onClick={confirm}><Icon name="check"/>SELESAIKAN TRANSAKSI</button>
  </Modal>
}

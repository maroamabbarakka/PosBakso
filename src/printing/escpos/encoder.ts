import { IWARE_X58BT2_PROFILE } from '../profiles/iware-x58bt2'

type Raster={width:number;height:number;dataBase64:string}
type Payload=Record<string,any>
const ESC=0x1b,GS=0x1d
const ascii=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/•/g,'-').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7e\n]/g,'?')
const bytes=(s:string)=>Array.from(ascii(s),c=>c.charCodeAt(0))
const money=(n:unknown)=>`Rp ${Math.round(Number(n)||0).toLocaleString('id-ID')}`
const wrap=(value:unknown,width:number)=>{const out:string[]=[];for(const paragraph of ascii(value).split('\n')){let rest=paragraph.trim();while(rest.length>width){let at=rest.lastIndexOf(' ',width);if(at<1)at=width;out.push(rest.slice(0,at));rest=rest.slice(at).trim()}out.push(rest)}return out}
const columns=(left:string,right:string,width:number)=>{const r=ascii(right).slice(0,width);const l=ascii(left).slice(0,Math.max(0,width-r.length-1));return `${l}${' '.repeat(Math.max(1,width-l.length-r.length))}${r}`}
const fromBase64=(value:string)=>{const raw=atob(value.includes(',')?value.split(',').pop()!:value);return Array.from(raw,c=>c.charCodeAt(0))}

export function encodeEscPos(payload:Payload):Uint8Array{
  const width=Number(payload.paperWidth)===80?48:IWARE_X58BT2_PROFILE.columns
  const out:number[]=[];const add=(...v:number[])=>out.push(...v);const text=(s:string)=>add(...bytes(`${s}\n`));
  const align=(n:number)=>add(ESC,0x61,n);const bold=(on:boolean)=>add(ESC,0x45,on?1:0);const size=(n:number)=>add(GS,0x21,n)
  add(ESC,0x40);align(1)
  const raster=payload.logoRaster as Raster|null
  if(raster?.dataBase64){const w=Math.min(raster.width,IWARE_X58BT2_PROFILE.safeRasterWidthDots);const rowBytes=Math.ceil(w/8);const raw=fromBase64(raster.dataBase64);add(GS,0x76,0x30,0,w&255,(w>>8)&255,raster.height&255,(raster.height>>8)&255,...raw.slice(0,rowBytes*raster.height))}
  bold(true);text(payload.design?.headerTitle||payload.header?.brand||'STRUK');bold(false)
  for(const line of [payload.design?.headerSubtitle,...(payload.design?.headerLines??[]),payload.header?.address,payload.header?.phone].filter(Boolean))wrap(line,width).forEach(text)
  text('-'.repeat(width));align(0)
  bold(true);text(payload.design?.documentTitle||payload.stationLabel||'STRUK PEMBAYARAN');bold(false)
  text(`No: ${payload.order?.number??'-'}`);text(`Waktu: ${payload.order?.createdLabel??'-'}`);text(`Kasir: ${payload.order?.cashier??'-'}`);text('-'.repeat(width))
  for(const item of payload.items??[]){wrap(`${item.qty}x ${item.name}`,width).forEach(text);text(columns('',money(item.total),width));if(item.note)wrap(`  Catatan: ${item.note}`,width).forEach(text);for(const mod of item.modifiers??[])wrap(`  + ${mod.name}`,width).forEach(text)}
  text('-'.repeat(width));text(columns('Subtotal',money(payload.totals?.subtotal),width));if(payload.totals?.discount)text(columns('Diskon',`-${money(payload.totals.discount)}`,width));if(payload.totals?.tax)text(columns('Pajak',money(payload.totals.tax),width));if(payload.totals?.service)text(columns('Layanan',money(payload.totals.service),width));bold(true);size(0x10);text(columns('TOTAL',money(payload.totals?.total),width));size(0);bold(false)
  for(const pay of payload.payments??[])text(columns(pay.label||pay.method,money(pay.amount),width))
  align(1);for(const line of payload.design?.footerLines??[])wrap(line,width).forEach(text)
  if(payload.design?.showQr&&payload.design?.qrValue){const qr=bytes(payload.design.qrValue);add(GS,0x28,0x6b,0x04,0x00,0x31,0x41,0x32,0x00);add(GS,0x28,0x6b,0x03,0x00,0x31,0x43,0x05);add(GS,0x28,0x6b,0x03,0x00,0x31,0x45,0x31);const len=qr.length+3;add(GS,0x28,0x6b,len&255,(len>>8)&255,0x31,0x50,0x30,...qr);add(GS,0x28,0x6b,0x03,0x00,0x31,0x51,0x30);if(payload.design.qrLabel)text(payload.design.qrLabel)}
  const cash=(payload.payments??[]).some((p:any)=>p.method==='cash')
  if(payload.openDrawer&&(payload.drawerMode==='always'||payload.drawerMode!=='never'&&cash))add(ESC,0x70,0,50,100)
  add(ESC,0x64,Number(payload.design?.feedLines??4))
  if(payload.cutPaper)add(GS,0x56,0x42,0)
  return Uint8Array.from(out)
}

export function bytesToBase64(value:Uint8Array){let s='';value.forEach(v=>s+=String.fromCharCode(v));return btoa(s)}

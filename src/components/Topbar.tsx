import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { usePosStore } from '../context/PosStore'
import { timeId } from '../lib/format'
import { printerRuntimeStatus } from '../services/printer'

export function Topbar({title,subtitle,onMenu,onShiftClick}:{title:string;subtitle:string;onMenu:()=>void;onShiftClick?:()=>void}){
  const {online,pendingSync,syncFailures,cloudSyncEnabled,data,getOpenShift}=usePosStore();const shift=getOpenShift();const printer=data.printers.find(p=>p.type==='cashier');const [printerOnline,setPrinterOnline]=useState(false)
  useEffect(()=>{let active=true;if(!printer){setPrinterOnline(false);return}const check=()=>void printerRuntimeStatus(printer).then(s=>active&&setPrinterOnline(s.connected));check();const id=window.setInterval(check,15000);return()=>{active=false;window.clearInterval(id)}},[printer?.id,printer?.deviceAddress,printer?.deviceName,printer?.transport])
  const syncLabel=!online?'Internet Offline':syncFailures.length?`Cloud Error ${syncFailures.length}`:pendingSync?`${pendingSync} antrean cloud`:cloudSyncEnabled?'Cloud Tersinkron':'Data Lokal';const syncClass=!online||syncFailures.length?'offline':'online'
  return <header className="topbar"><div className="page-heading"><button className="menu-button" onClick={onMenu} aria-label="Buka navigasi"><Icon name="menu"/></button><div><h1>{title}</h1><p>{subtitle}</p></div></div><div className="top-status"><div className={`status-pill ${syncClass}`} title={syncFailures[0]?.lastError??''}><span className="dot"/>{syncLabel}</div><div className={`status-pill ${printerOnline?'printer-online':''}`}><Icon name="printer"/><span><b>{printerOnline?'Printer Terhubung':'Printer Offline'}</b><small>{printer?.deviceName||'Belum dipilih'} • {printer?.paperWidth??80}mm</small></span></div><button className="status-pill shift-pill" onClick={onShiftClick}><Icon name="shift"/><span><b>{shift?'Shift Aktif':'Shift Belum Dibuka'}</b><small>{shift?`Sejak ${timeId(shift.openedAt)} WITA`:'Buka shift untuk transaksi'}</small></span><Icon name="chevron" size={15}/></button></div></header>
}

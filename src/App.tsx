import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { LoginPage } from './pages/Login'
import { PublicReceiptPage } from './pages/PublicReceipt'
import { Icon, type IconName } from './components/Icon'
import { usePosStore } from './context/PosStore'
import type { NavKey, Order, Permission } from './types'

const CashierPage=lazy(()=>import('./pages/Cashier').then(module=>({default:module.CashierPage})))
const DashboardPage=lazy(()=>import('./pages/Dashboard').then(module=>({default:module.DashboardPage})))
const KitchenPage=lazy(()=>import('./pages/Kitchen').then(module=>({default:module.KitchenPage})))
const ReportsPage=lazy(()=>import('./pages/Reports').then(module=>({default:module.ReportsPage})))
const OrdersPage=lazy(()=>import('./pages/Orders').then(module=>({default:module.OrdersPage})))
const ProductsPage=lazy(()=>import('./pages/Products').then(module=>({default:module.ProductsPage})))
const InventoryPage=lazy(()=>import('./pages/Inventory').then(module=>({default:module.InventoryPage})))
const ShiftsPage=lazy(()=>import('./pages/Shifts').then(module=>({default:module.ShiftsPage})))
const UsersPage=lazy(()=>import('./pages/Users').then(module=>({default:module.UsersPage})))
const PrinterSettingsPage=lazy(()=>import('./pages/PrinterSettings').then(module=>({default:module.PrinterSettingsPage})))
const SettingsPage=lazy(()=>import('./pages/Settings').then(module=>({default:module.SettingsPage})))

const meta: Record<NavKey, {title:string; subtitle:string; permission?:Permission}> = {
  kasir:{title:'Kasir',subtitle:'Transaksi cepat untuk operasional harian',permission:'sale.create'},
  pesanan:{title:'Pesanan',subtitle:'Pantau dine-in, takeaway, delivery dan pesanan tersimpan',permission:'sale.create'},
  dapur:{title:'Dapur',subtitle:'Kitchen Display System • antrean produksi secara real-time',permission:'kitchen.view'},
  dashboard:{title:'Dashboard',subtitle:'Ringkasan penjualan dan performa bisnis Anda',permission:'report.view'},
  laporan:{title:'Laporan',subtitle:'Analisis penjualan, laba, shift dan inventory',permission:'report.view'},
  produk:{title:'Produk & Menu',subtitle:'Kelola menu, kategori, harga, HPP dan routing',permission:'product.view'},
  stok:{title:'Inventory',subtitle:'Stok bahan, resep, movement, waste dan pembelian',permission:'inventory.view'},
  shift:{title:'Shift Kasir',subtitle:'Kontrol kas awal, penerimaan dan selisih kas',permission:'shift.open'},
  pengguna:{title:'Pengguna',subtitle:'Role, permission dan audit aktivitas',permission:'user.manage'},
  printer:{title:'Printer',subtitle:'Konfigurasi printer kasir, dapur dan routing',permission:'printer.manage'},
  pengaturan:{title:'Pengaturan',subtitle:'Profil outlet, pajak, backup dan Firebase health',permission:'settings.manage'},
}

const navOrder:NavKey[]=['kasir','pesanan','dapur','dashboard','laporan','produk','stok','shift','pengguna','printer','pengaturan']

function MobileBottomNav({active,onNavigate,onMore}:{active:NavKey;onNavigate:(n:NavKey)=>void;onMore:()=>void}) {
  const {can}=usePosStore()
  const candidates:{key:NavKey;label:string;icon:IconName;permission:Permission}[]=[
    {key:'kasir',label:'Kasir',icon:'cashier',permission:'sale.create'},
    {key:'pesanan',label:'Pesanan',icon:'orders',permission:'sale.create'},
    {key:'dapur',label:'Dapur',icon:'kitchen',permission:'kitchen.view'},
    {key:'dashboard',label:'Dashboard',icon:'dashboard',permission:'report.view'},
    {key:'laporan',label:'Laporan',icon:'report',permission:'report.view'},
    {key:'produk',label:'Produk',icon:'products',permission:'product.view'},
    {key:'stok',label:'Stok',icon:'stock',permission:'inventory.view'},
  ]
  const items=candidates.filter(i=>can(i.permission)).slice(0,3)
  return <nav className="mobile-bottom-nav">{items.map(i=><button className={active===i.key?'active':''} key={i.key} onClick={()=>onNavigate(i.key)}><Icon name={i.icon}/><span>{i.label}</span></button>)}<button onClick={onMore} aria-label="Buka menu lainnya"><Icon name="more"/><span>Lainnya</span></button></nav>
}

export default function App(){
  const {currentUser,hydrated,can,data}=usePosStore()
  const [active,setActive]=useState<NavKey>('kasir')
  const [menuOpen,setMenuOpen]=useState(false)
  const [requestOpenShift,setRequestOpenShift]=useState(false)
  const [resumeOrder,setResumeOrder]=useState<Order|null>(null)
  const [reorderOrder,setReorderOrder]=useState<Order|null>(null)
  useEffect(()=>{if(!currentUser)return;const currentPermission=meta[active].permission;if(currentPermission&&!can(currentPermission)){const next=navOrder.find(k=>!meta[k].permission||can(meta[k].permission!));if(next)setActive(next)}},[currentUser,active,can])
  const page=useMemo(()=>{
    switch(active){
      case'kasir':return <CashierPage resumeOrder={resumeOrder} reorderOrder={reorderOrder} onResumeHandled={()=>setResumeOrder(null)} onReorderHandled={()=>setReorderOrder(null)} onOpenShift={()=>{setRequestOpenShift(true);setActive('shift')}}/>
      case'pesanan':return <OrdersPage onResume={order=>{setReorderOrder(null);setResumeOrder(order);setActive('kasir')}} onReorder={order=>{setResumeOrder(null);setReorderOrder(order);setActive('kasir')}}/>
      case'dapur':return <KitchenPage/>
      case'dashboard':return <DashboardPage/>
      case'laporan':return <ReportsPage/>
      case'produk':return <ProductsPage/>
      case'stok':return <InventoryPage/>
      case'shift':return <ShiftsPage openRequested={requestOpenShift} onHandled={()=>setRequestOpenShift(false)}/>
      case'pengguna':return <UsersPage/>
      case'printer':return <PrinterSettingsPage/>
      case'pengaturan':return <SettingsPage/>
      default:return null
    }
  },[active,requestOpenShift,resumeOrder,reorderOrder])
  if(location.pathname==='/nota')return <PublicReceiptPage/>
  if(!hydrated)return <div className="app-loading"><img src={data.settings.logoUrl||'/icon.svg'} alt=""/><strong>{data.settings.brandName||'POS'}</strong><span>Menyiapkan data lokal...</span></div>
  if(!currentUser)return <LoginPage/>
  return <div className="app-shell"><Sidebar active={active} onNavigate={setActive} open={menuOpen} onClose={()=>setMenuOpen(false)}/><main className="app-main"><Topbar title={meta[active].title} subtitle={meta[active].subtitle} onMenu={()=>setMenuOpen(true)} onShiftClick={()=>setActive('shift')}/><div className="page-content"><Suspense fallback={<div className="page-loading" role="status" aria-live="polite"><span/>Memuat modul…</div>}>{page}</Suspense></div></main><MobileBottomNav active={active} onNavigate={setActive} onMore={()=>setMenuOpen(true)}/></div>
}

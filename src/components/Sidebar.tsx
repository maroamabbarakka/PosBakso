import { Icon, type IconName } from './Icon'
import type { NavKey, Permission } from '../types'
import { usePosStore } from '../context/PosStore'

const primary: { key: NavKey; label: string; icon: IconName; permission?: Permission }[] = [
  { key:'kasir', label:'Kasir', icon:'cashier', permission:'sale.create' },
  { key:'pesanan', label:'Pesanan', icon:'orders', permission:'sale.create' },
  { key:'dapur', label:'Dapur', icon:'kitchen', permission:'kitchen.view' },
  { key:'dashboard', label:'Dashboard', icon:'dashboard', permission:'report.view' },
  { key:'laporan', label:'Laporan', icon:'report', permission:'report.view' },
  { key:'produk', label:'Produk/Menu', icon:'products', permission:'product.view' },
  { key:'stok', label:'Inventory', icon:'stock', permission:'inventory.view' },
  { key:'shift', label:'Shift', icon:'shift', permission:'shift.open' },
  { key:'pengguna', label:'Pengguna', icon:'users', permission:'user.manage' },
  { key:'printer', label:'Printer', icon:'printer', permission:'printer.manage' },
  { key:'pengaturan', label:'Pengaturan', icon:'settings', permission:'settings.manage' },
]

export function Sidebar({ active, onNavigate, open, onClose }: { active: NavKey; onNavigate: (key: NavKey) => void; open: boolean; onClose: () => void }) {
  const { currentUser, can, logout, data } = usePosStore()
  const visible = primary.filter(item => !item.permission || can(item.permission))
  return <>
    {open && <button className="sidebar-scrim" onClick={onClose} aria-label="Tutup navigasi" />}
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand-block">
        <img src={data.settings.logoUrl || '/icon.svg'} alt="" />
        <div><strong>{data.settings.brandName || 'POS'}</strong><span>{data.settings.outletName || 'Outlet'}</span></div>
        <button className="mobile-close" onClick={onClose}><Icon name="close" /></button>
      </div>
      <nav className="nav-list" aria-label="Navigasi utama">
        {visible.map(item => <button key={item.key} className={active === item.key ? 'active' : ''} onClick={() => { onNavigate(item.key); onClose() }}>
          <Icon name={item.icon} /> <span>{item.label}</span>
        </button>)}
      </nav>
      <div className="sidebar-profile">
        <div className="avatar">{currentUser?.avatarInitials ?? 'BU'}</div>
        <div><strong>{currentUser?.name ?? 'Pengguna'}</strong><span>{currentUser?.roleLabel ?? '-'}</span></div>
        <button className="icon-button" onClick={logout} aria-label="Keluar"><Icon name="logout" /></button>
      </div>
    </aside>
  </>
}

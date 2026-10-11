import type { SVGProps } from 'react'

export type IconName =
  | 'cashier'|'orders'|'history'|'products'|'stock'|'report'|'shift'|'users'|'printer'|'dashboard'
  | 'search'|'trash'|'save'|'card'|'calendar'|'chevron'|'menu'|'close'|'more'|'plus'|'minus'|'wifi'
  | 'receipt'|'wallet'|'alert'|'trend'|'settings'|'logout'|'download'|'sync'|'edit'|'check'|'lock'
  | 'money'|'kitchen'|'table'|'filter'|'info'|'user'|'power'|'box'|'clock'|'eye'

const paths: Record<IconName, string[]> = {
  cashier: ['M4 7h16v13H4z','M7 4h10v3H7z','M7 11h4v3H7z','M14 11h3M14 14h3'],
  orders: ['M6 3h12v18H6z','M9 7h6M9 11h6M9 15h4'],
  history: ['M12 8v5l3 2','M4.9 5.2A9 9 0 1 1 3 12','M3 4v5h5'],
  products: ['M3 7h18v13H3z','M7 7V4h10v3','M8 11h8'],
  stock: ['M4 7l8-4 8 4-8 4z','M4 7v10l8 4 8-4V7','M12 11v10'],
  report: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  shift: ['M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8','M9 12h6'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M22 21v-2a4 4 0 0 0-3-3.9','M16 3.1a4 4 0 0 1 0 7.8'],
  printer: ['M6 9V3h12v6','M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2','M6 14h12v7H6z'],
  dashboard: ['M3 3h7v7H3z','M14 3h7v4h-7z','M14 11h7v10h-7z','M3 14h7v7H3z'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16','M21 21l-4.35-4.35'],
  trash: ['M3 6h18','M8 6V4h8v2','M19 6l-1 15H6L5 6','M10 11v5M14 11v5'],
  save: ['M5 3h11l3 3v15H5z','M8 3v6h8V3','M8 15h8'],
  card: ['M2 6h20v12H2z','M2 10h20'],
  calendar: ['M4 5h16v16H4z','M8 3v4M16 3v4M4 9h16'],
  chevron: ['M9 18l6-6-6-6'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  close: ['M6 6l12 12M18 6L6 18'],
  more: ['M5 12h.01M12 12h.01M19 12h.01'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  wifi: ['M5 12.6a10 10 0 0 1 14 0','M8.5 16a5 5 0 0 1 7 0','M12 20h.01'],
  receipt: ['M6 2h12v20l-3-2-3 2-3-2-3 2z','M9 7h6M9 11h6M9 15h4'],
  wallet: ['M3 6h16v14H3z','M16 10h5v6h-5z','M3 6l3-3h11l2 3'],
  alert: ['M12 3l10 18H2z','M12 9v5M12 18h.01'],
  trend: ['M3 17l6-6 4 4 8-8','M15 7h6v6'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7','M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21H10v-.08a1.7 1.7 0 0 0-1.03-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.31l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.22.62.8 1 1.52 1H21v4h-.08c-.72 0-1.3.38-1.52 1z'],
  logout: ['M10 17l5-5-5-5','M15 12H3','M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5'],
  download: ['M12 3v12','M7 10l5 5 5-5','M5 21h14'],
  sync: ['M20 7h-5V2','M20 7a8 8 0 0 0-13.7-2.7L4 7','M4 17h5v5','M4 17a8 8 0 0 0 13.7 2.7L20 17'],
  edit: ['M12 20h9','M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z'],
  check: ['M20 6L9 17l-5-5'],
  lock: ['M5 11h14v10H5z','M8 11V7a4 4 0 0 1 8 0v4'],
  money: ['M3 6h18v12H3z','M7 10h.01M17 14h.01','M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6'],
  kitchen: ['M6 3v7a3 3 0 0 0 6 0V3','M9 13v8','M17 3v18','M17 3c3 2 4 5 2 8h-2'],
  table: ['M4 10h16','M6 10v10M18 10v10','M3 6h18v4H3z'],
  filter: ['M4 5h16l-6 7v6l-4 2v-8z'],
  info: ['M12 8h.01','M11 12h1v4h1','M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M4 21a8 8 0 0 1 16 0'],
  power: ['M12 2v10','M6.3 5.3a8 8 0 1 0 11.4 0'],
  box: ['M4 7l8-4 8 4-8 4z','M4 7v10l8 4 8-4V7'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20','M12 6v6l4 2'],
  eye: ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12','M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
}

export function Icon({ name, size = 19, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {paths[name].map((d, i) => <path d={d} key={i} />)}
  </svg>
}

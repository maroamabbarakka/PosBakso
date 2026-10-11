import type { AppData, OutletSettings, PrinterConfig, Permission, RoleDefinition } from '../types.ts'


const allPermissions: Permission[] = [
  'sale.create','sale.discount','sale.void','sale.refund','sale.reprint',
  'shift.open','shift.close','cash.move','product.view','product.manage',
  'inventory.view','inventory.adjust','inventory.purchase','report.view','report.profit',
  'user.manage','settings.manage','printer.manage','audit.view','kitchen.view','backup.restore',
]

export const defaultRoles: RoleDefinition[] = [
  { key:'owner', label:'Pemilik', permissions: allPermissions },
  { key:'manager', label:'Manajer', permissions: allPermissions.filter(p => !['settings.manage','backup.restore'].includes(p)) },
  { key:'supervisor', label:'Supervisor', permissions:['sale.create','sale.discount','sale.void','sale.refund','sale.reprint','shift.open','shift.close','cash.move','product.view','inventory.view','inventory.adjust','report.view','audit.view','kitchen.view'] },
  { key:'cashier', label:'Kasir', permissions:['sale.create','sale.reprint','shift.open','shift.close'] },
  { key:'kitchen', label:'Dapur', permissions:['kitchen.view'] },
  { key:'warehouse', label:'Gudang', permissions:['product.view','inventory.view','inventory.adjust','inventory.purchase'] },
]

export const defaultReceiptSettings: OutletSettings['receipt'] = {
  showLogo:true,
  logoUrl:'/icon.svg',
  logoAlignment:'center',
  logoWidthMm:28,
  rasterMode:'floyd_steinberg',
  rasterThreshold:150,
  headerTitle:'BAKSO UMUM',
  headerSubtitle:'KHAS MAKASSAR',
  documentTitle:'NOTA PEMBELIAN',
  headerLines:[],
  showAddress:true,
  showPhone:true,
  showQueueNumber:true,
  showCashier:true,
  showOrderType:true,
  showCustomer:true,
  showItemSku:false,
  showModifiers:true,
  showItemNotes:true,
  showOrderNote:true,
  showPaymentReference:true,
  showTaxBreakdown:true,
  density:'normal',
  footerLines:['Terima kasih atas kunjungan Anda'],
  showTagline:true,
  qrEnabled:false,
  qrLabel:'Scan untuk informasi kami',
  qrValue:'',
  qrSize:6,
  barcodeEnabled:false,
  barcodeSource:'order_number',
  barcodeHeight:72,
  copies:1,
  feedLines:4,
}

export const defaultOutletSettings: OutletSettings = {
  outletName:'Outlet Utama',
  brandName:'Bakso Umum Khas Makassar',
  tagline:'Lezatnya Selalu Dirindukan',
  address:'Makassar, Sulawesi Selatan',
  phone:'0812 4101 9444',
  footerReceipt:'Terima kasih atas kunjungan Anda',
  taxEnabled:false,
  taxPercent:0,
  serviceEnabled:false,
  servicePercent:0,
  currency:'IDR',
  queuePrefix:'A',
  receiptPrefix:'BU',
  logoUrl:'/icon.svg',
  tables:['A01','A02','A03','A04','A05','A06','B01','B02','B03','B04','B05','B06'],
  holdExpiryMinutes:120,
  receipt:defaultReceiptSettings,
}

export const defaultPrinters: PrinterConfig[] = [
  {id:'printer-cashier',name:'IWARE X58BT II - Kasir',type:'cashier',paperWidth:58,printWidthDots:384,transport:'auto',profileId:'iware-x58bt2',deviceName:'IWARE X58BT II',autoPrint:true,printLogo:true,cutPaper:false,openDrawer:true,drawerMode:'cash',routeCategories:[],connected:false,copies:1,characterSet:'CP437'},
  {id:'printer-kitchen',name:'Printer Dapur',type:'kitchen',paperWidth:58,printWidthDots:384,transport:'bluetooth',deviceName:'',autoPrint:true,printLogo:false,cutPaper:false,openDrawer:false,routeCategories:['Bakso','Mie','Paket'],connected:false,copies:1,characterSet:'CP437'},
  {id:'printer-bar',name:'Printer Minuman',type:'bar',paperWidth:58,printWidthDots:384,transport:'bluetooth',deviceName:'',autoPrint:false,printLogo:false,cutPaper:false,openDrawer:false,routeCategories:['Minuman'],connected:false,copies:1,characterSet:'CP437'},
]

export function emptyProductionData(): AppData {
  return {
    schemaVersion:4, products:[], ingredients:[], recipes:[], orders:[], shifts:[], cashMovements:[], users:[],
    roles:JSON.parse(JSON.stringify(defaultRoles)), suppliers:[], purchases:[], stockMovements:[],
    printers:JSON.parse(JSON.stringify(defaultPrinters)), settings:JSON.parse(JSON.stringify(defaultOutletSettings)), audit:[],
  }
}

export function normalizeSettings(settings?:Partial<OutletSettings>):OutletSettings{
  return {
    ...defaultOutletSettings,
    ...(settings??{}),
    tables:Array.isArray(settings?.tables)?settings!.tables:defaultOutletSettings.tables,
    receipt:{...defaultReceiptSettings,...(settings?.receipt??{}),logoUrl:settings?.receipt?.logoUrl??settings?.logoUrl??defaultReceiptSettings.logoUrl},
  }
}

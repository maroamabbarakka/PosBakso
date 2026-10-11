import type { AppData, RoleDefinition } from '../types'
import { defaultReceiptSettings, defaultRoles } from './defaults'

export const roles: RoleDefinition[] = defaultRoles

export const seedData: AppData = {
  schemaVersion:4,
  products: [
    { id:'bakso-umum',sku:'BU-001',name:'Bakso Umum',category:'Bakso',price:20000,cost:9400,image:'/products/bakso-umum.svg',stock:86,unit:'porsi',active:true,trackStock:true,kitchenRoute:'kitchen',modifierOptions:[{id:'mod-pedas',name:'Pedas',price:0},{id:'mod-no-sambal',name:'Tanpa Sambal',price:0},{id:'mod-pisah-kuah',name:'Pisah Kuah',price:0},{id:'mod-extra-bawang',name:'Extra Bawang',price:0,recipeItems:[{ingredientId:'ing-bawang',qty:.005}]}] },
    { id:'bakso-urat',sku:'BU-002',name:'Bakso Urat',category:'Bakso',price:25000,cost:12100,image:'/products/bakso-urat.svg',stock:14,unit:'porsi',active:true,trackStock:true,kitchenRoute:'kitchen',modifierOptions:[{id:'mod-pedas',name:'Pedas',price:0},{id:'mod-no-sambal',name:'Tanpa Sambal',price:0},{id:'mod-pisah-kuah',name:'Pisah Kuah',price:0},{id:'mod-extra-bawang',name:'Extra Bawang',price:0,recipeItems:[{ingredientId:'ing-bawang',qty:.005}]}] },
    { id:'mie-bakso',sku:'BU-003',name:'Mie Bakso',category:'Mie',price:22000,cost:10100,image:'/products/mie-bakso.svg',stock:63,unit:'porsi',active:true,trackStock:true,kitchenRoute:'kitchen',modifierOptions:[{id:'mod-pedas',name:'Pedas',price:0},{id:'mod-no-sambal',name:'Tanpa Sambal',price:0},{id:'mod-pisah-kuah',name:'Pisah Kuah',price:0},{id:'mod-extra-bawang',name:'Extra Bawang',price:0,recipeItems:[{ingredientId:'ing-bawang',qty:.005}]}] },
    { id:'bakso-telur',sku:'BU-004',name:'Bakso Telur',category:'Bakso',price:28000,cost:13400,image:'/products/bakso-telur.svg',stock:34,unit:'porsi',active:true,trackStock:true,kitchenRoute:'kitchen',modifierOptions:[{id:'mod-pedas',name:'Pedas',price:0},{id:'mod-no-sambal',name:'Tanpa Sambal',price:0},{id:'mod-pisah-kuah',name:'Pisah Kuah',price:0},{id:'mod-extra-bawang',name:'Extra Bawang',price:0,recipeItems:[{ingredientId:'ing-bawang',qty:.005}]}] },
    { id:'es-teh',sku:'MN-001',name:'Es Teh Manis',category:'Minuman',price:5000,cost:1400,image:'/products/es-teh.svg',stock:102,unit:'gelas',active:true,trackStock:true,kitchenRoute:'bar' },
    { id:'es-jeruk',sku:'MN-002',name:'Es Jeruk',category:'Minuman',price:7000,cost:2200,image:'/products/es-jeruk.svg',stock:51,unit:'gelas',active:true,trackStock:true,kitchenRoute:'bar' },
    { id:'kerupuk',sku:'CM-001',name:'Kerupuk',category:'Camilan',price:3000,cost:900,image:'/products/kerupuk.svg',stock:12,unit:'pcs',active:true,trackStock:true,kitchenRoute:'none' },
    { id:'paket-hemat',sku:'PK-001',name:'Paket Hemat',category:'Paket',price:32000,cost:12600,image:'/products/paket.svg',stock:28,unit:'paket',active:true,trackStock:true,kitchenRoute:'kitchen' },
  ],
  ingredients: [
    {id:'ing-bakso',name:'Bakso Sapi',sku:'ING-001',stock:2450,unit:'pcs',minStock:400,averageCost:850,active:true},
    {id:'ing-urat',name:'Bakso Urat',sku:'ING-002',stock:310,unit:'pcs',minStock:120,averageCost:1150,active:true},
    {id:'ing-mie',name:'Mie Kuning',sku:'ING-003',stock:18.5,unit:'kg',minStock:5,averageCost:18000,active:true},
    {id:'ing-bihun',name:'Bihun',sku:'ING-004',stock:9.2,unit:'kg',minStock:3,averageCost:22000,active:true},
    {id:'ing-kuah',name:'Bahan Kuah',sku:'ING-005',stock:72,unit:'liter',minStock:15,averageCost:9000,active:true},
    {id:'ing-bawang',name:'Bawang Goreng',sku:'ING-006',stock:2.4,unit:'kg',minStock:1.2,averageCost:78000,active:true},
    {id:'ing-teh',name:'Teh',sku:'ING-007',stock:10,unit:'pack',minStock:4,averageCost:17000,active:true},
    {id:'ing-jeruk',name:'Jeruk',sku:'ING-008',stock:4.2,unit:'kg',minStock:5,averageCost:28000,active:true},
    {id:'ing-kerupuk',name:'Kerupuk Mentah',sku:'ING-009',stock:3,unit:'pack',minStock:4,averageCost:25000,active:true},
    {id:'ing-telur',name:'Telur',sku:'ING-010',stock:48,unit:'butir',minStock:30,averageCost:2200,active:true},
  ],
  recipes: [
    {productId:'bakso-umum',items:[{ingredientId:'ing-bakso',qty:8},{ingredientId:'ing-mie',qty:.08},{ingredientId:'ing-bihun',qty:.05},{ingredientId:'ing-kuah',qty:.35},{ingredientId:'ing-bawang',qty:.005}]},
    {productId:'bakso-urat',items:[{ingredientId:'ing-bakso',qty:6},{ingredientId:'ing-urat',qty:1},{ingredientId:'ing-mie',qty:.08},{ingredientId:'ing-kuah',qty:.35},{ingredientId:'ing-bawang',qty:.005}]},
    {productId:'mie-bakso',items:[{ingredientId:'ing-bakso',qty:6},{ingredientId:'ing-mie',qty:.12},{ingredientId:'ing-kuah',qty:.32},{ingredientId:'ing-bawang',qty:.005}]},
    {productId:'bakso-telur',items:[{ingredientId:'ing-bakso',qty:6},{ingredientId:'ing-telur',qty:1},{ingredientId:'ing-mie',qty:.08},{ingredientId:'ing-kuah',qty:.35}]},
    {productId:'es-teh',items:[{ingredientId:'ing-teh',qty:.03}]},
    {productId:'es-jeruk',items:[{ingredientId:'ing-jeruk',qty:.12}]},
    {productId:'kerupuk',items:[{ingredientId:'ing-kerupuk',qty:.04}]},
    {productId:'paket-hemat',items:[{ingredientId:'ing-bakso',qty:8},{ingredientId:'ing-mie',qty:.08},{ingredientId:'ing-bihun',qty:.05},{ingredientId:'ing-kuah',qty:.35},{ingredientId:'ing-bawang',qty:.005},{ingredientId:'ing-teh',qty:.03}]},
  ],
  orders: [
    {id:'ord-seed-1',number:'BU-261011-00025',queueNumber:'A025',createdAt:'2026-10-11T10:15:00+08:00',updatedAt:'2026-10-11T10:15:00+08:00',cashierId:'usr-cashier',cashierName:'Dika Umum',shiftId:'shift-seed',type:'dine_in',tableName:'A03',status:'paid',kitchenStatus:'served',items:[{id:'bakso-umum',sku:'BU-001',name:'Bakso Umum',category:'Bakso',price:20000,cost:9400,image:'/products/bakso-umum.svg',active:true,qty:2},{id:'es-teh',sku:'MN-001',name:'Es Teh Manis',category:'Minuman',price:5000,cost:1400,image:'/products/es-teh.svg',active:true,qty:2}],subtotal:50000,discount:0,tax:0,service:0,total:50000,payment:{method:'cash',label:'Tunai',amount:50000,tendered:50000,change:0,paidAt:'2026-10-11T10:15:00+08:00'}},
    {id:'ord-seed-2',number:'BU-261011-00026',queueNumber:'A026',createdAt:'2026-10-11T11:42:00+08:00',updatedAt:'2026-10-11T11:42:00+08:00',cashierId:'usr-cashier',cashierName:'Dika Umum',shiftId:'shift-seed',type:'takeaway',status:'paid',kitchenStatus:'served',items:[{id:'bakso-urat',sku:'BU-002',name:'Bakso Urat',category:'Bakso',price:25000,cost:12100,image:'/products/bakso-urat.svg',active:true,qty:1},{id:'mie-bakso',sku:'BU-003',name:'Mie Bakso',category:'Mie',price:22000,cost:10100,image:'/products/mie-bakso.svg',active:true,qty:1}],subtotal:47000,discount:0,tax:0,service:0,total:47000,payment:{method:'qris',label:'QRIS',amount:47000,paidAt:'2026-10-11T11:42:00+08:00'}},
    {id:'ord-seed-3',number:'BU-261011-00027',queueNumber:'A027',createdAt:'2026-10-11T12:28:00+08:00',updatedAt:'2026-10-11T12:28:00+08:00',cashierId:'usr-cashier',cashierName:'Dika Umum',shiftId:'shift-seed',type:'dine_in',tableName:'A04',status:'paid',kitchenStatus:'preparing',items:[{id:'bakso-umum',sku:'BU-001',name:'Bakso Umum',category:'Bakso',price:20000,cost:9400,image:'/products/bakso-umum.svg',active:true,qty:1},{id:'es-teh',sku:'MN-001',name:'Es Teh Manis',category:'Minuman',price:5000,cost:1400,image:'/products/es-teh.svg',active:true,qty:2},{id:'kerupuk',sku:'CM-001',name:'Kerupuk',category:'Camilan',price:3000,cost:900,image:'/products/kerupuk.svg',active:true,qty:1}],subtotal:33000,discount:0,tax:0,service:0,total:33000,payment:{method:'cash',label:'Tunai',amount:33000,tendered:50000,change:17000,paidAt:'2026-10-11T12:28:00+08:00'}},
    {id:'ord-held-1',number:'BU-261011-H001',queueNumber:'A031',createdAt:'2026-10-11T12:36:00+08:00',updatedAt:'2026-10-11T12:36:00+08:00',cashierId:'usr-cashier',cashierName:'Dika Umum',shiftId:'shift-seed',type:'dine_in',tableName:'B02',status:'held',kitchenStatus:'new',items:[{id:'bakso-telur',sku:'BU-004',name:'Bakso Telur',category:'Bakso',price:28000,cost:13400,image:'/products/bakso-telur.svg',active:true,qty:2}],subtotal:56000,discount:0,tax:0,service:0,total:56000},
  ],
  shifts: [
    {id:'shift-seed',cashierId:'usr-cashier',cashierName:'Dika Umum',openedAt:'2026-10-11T07:00:00+08:00',openingCash:500000,status:'open'}
  ],
  cashMovements: [
    {id:'cash-seed-1',shiftId:'shift-seed',type:'out',amount:25000,note:'Beli gas',createdAt:'2026-10-11T09:10:00+08:00',userId:'usr-cashier',userName:'Dika Umum'}
  ],
  users: [
    {id:'usr-owner',name:'Pemilik Bakso Umum',email:'owner@baksoumum.local',role:'owner',roleLabel:'Pemilik',active:true,avatarInitials:'BU',pinHash:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'},
    {id:'usr-manager',name:'Andi Manager',email:'manager@baksoumum.local',role:'manager',roleLabel:'Manajer',active:true,avatarInitials:'AM',pinHash:'a1fb4e703a9ef1fa4936801721ff285a97ac85330856674412e054892afe6972'},
    {id:'usr-cashier',name:'Dika Umum',email:'kasir@baksoumum.local',role:'cashier',roleLabel:'Kasir Utama',active:true,avatarInitials:'DU',pinHash:'cc49091e6a3fa59a5d4f8f9d4a420ff47d7bfaabae08f666fe5d698712b1d326'},
    {id:'usr-kitchen',name:'Tim Dapur',email:'dapur@baksoumum.local',role:'kitchen',roleLabel:'Dapur',active:true,avatarInitials:'TD',pinHash:'0ffe1abd1a08215353c233d6e009613e95eec4253832a761af28ff37ac5a150c'},
  ],
  roles,
  suppliers:[
    {id:'sup-1',name:'UD Sumber Daging',phone:'0812 0000 0001',note:'Daging dan bakso',active:true},
    {id:'sup-2',name:'Toko Bahan Makassar',phone:'0812 0000 0002',note:'Bahan kering',active:true},
  ],
  purchases: [],
  stockMovements: [],
  printers: [
    {id:'printer-cashier',name:'IWARE X58BT II - Kasir',type:'cashier',paperWidth:58,printWidthDots:384,transport:'auto',profileId:'iware-x58bt2',deviceName:'IWARE X58BT II',autoPrint:true,printLogo:true,cutPaper:false,openDrawer:true,drawerMode:'cash',routeCategories:[],connected:false,copies:1,characterSet:'CP437'},
    {id:'printer-kitchen',name:'Printer Dapur',type:'kitchen',paperWidth:58,printWidthDots:384,transport:'bluetooth',deviceName:'Kitchen Printer',autoPrint:true,printLogo:false,cutPaper:false,openDrawer:false,routeCategories:['Bakso','Mie','Paket'],connected:false,copies:1,characterSet:'CP437'},
    {id:'printer-bar',name:'Printer Minuman',type:'bar',paperWidth:58,printWidthDots:384,transport:'bluetooth',deviceName:'',autoPrint:false,printLogo:false,cutPaper:false,openDrawer:false,routeCategories:['Minuman'],connected:false,copies:1,characterSet:'CP437'},
  ],
  settings: {
    outletName:'Outlet Utama',brandName:'Bakso Umum Khas Makassar',tagline:'Lezatnya Selalu Dirindukan',address:'Makassar, Sulawesi Selatan',phone:'0812 4101 9444',footerReceipt:'Terima kasih atas kunjungan Anda',taxEnabled:false,taxPercent:0,serviceEnabled:false,servicePercent:0,currency:'IDR',queuePrefix:'A',receiptPrefix:'BU',logoUrl:'/icon.svg',tables:['A01','A02','A03','A04','A05','A06','B01','B02','B03','B04','B05','B06'],holdExpiryMinutes:120,receipt:{...defaultReceiptSettings}
  },
  audit: [
    {id:'aud-1',createdAt:'2026-10-11T12:28:05+08:00',userId:'usr-cashier',userName:'Dika Umum',action:'sale.completed',entity:'order',entityId:'ord-seed-3',detail:'Menyelesaikan transaksi BU-261011-00027 • Rp33.000',severity:'info'},
    {id:'aud-2',createdAt:'2026-10-11T09:10:00+08:00',userId:'usr-cashier',userName:'Dika Umum',action:'cash.out',entity:'shift',entityId:'shift-seed',detail:'Kas keluar Rp25.000 • Beli gas',severity:'warning'},
  ],
}

export const categories = ['Semua','Bakso','Mie','Minuman','Camilan','Paket']

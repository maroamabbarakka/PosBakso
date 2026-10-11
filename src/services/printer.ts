import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Order, OutletSettings, PrintJob, PrinterConfig } from '../types'
import { itemLineTotal, itemUnitPrice } from '../lib/order'
import { createMonochromeRaster } from '../lib/receiptRaster'
import { prunePrintJobs, readPrintJobs, savePrintJob, updatePrintJob } from '../lib/localDb'
import { dateTimeId, uid } from '../lib/format'
import { receiptTemplate, receiptTemplateLines } from '../lib/receiptTemplate'

interface NativePrinterPlugin {
  testPrint(options:{payload:Record<string,unknown>}):Promise<unknown>
  printReceipt(options:{payload:Record<string,unknown>}):Promise<unknown>
  printKitchenTicket(options:{payload:Record<string,unknown>}):Promise<unknown>
  scanPrinters():Promise<{devices:{name:string;address:string}[]}>
  connect(options:{address:string}):Promise<{connected:boolean;name:string;address:string}>
  disconnect():Promise<void>
  getStatus():Promise<{connected:boolean;device:string;address:string}>
  requestPermissions():Promise<Record<string,string>>
}

const EscPosPrinter = registerPlugin<NativePrinterPlugin>('EscPosPrinter')
export function nativePrinterAvailable(){ return Capacitor.isNativePlatform() }

async function ensurePrinter(printer:PrinterConfig){
  if(!nativePrinterAvailable())return {ok:false,reason:'native-plugin-unavailable'} as const
  if(printer.transport!=='bluetooth')return {ok:false,reason:`transport-${printer.transport}-belum-diimplementasikan`} as const
  await EscPosPrinter.requestPermissions().catch(()=>({}))
  if(!printer.deviceAddress)return {ok:false,reason:'alamat-printer-belum-dipilih'} as const
  const status=await EscPosPrinter.getStatus().catch(()=>({connected:false,device:'',address:''}))
  if(status.connected&&status.address===printer.deviceAddress)return {ok:true,status} as const
  try{const result=await EscPosPrinter.connect({address:printer.deviceAddress});return result.connected?{ok:true,status:{connected:true,device:result.name,address:result.address}} as const:{ok:false,reason:'not-connected'} as const}catch(error){return {ok:false,reason:error instanceof Error?error.message:'not-connected'} as const}
}

export async function printerRuntimeStatus(printer:PrinterConfig){
  if(!nativePrinterAvailable()||printer.transport!=='bluetooth')return {connected:false,device:printer.deviceName??'',address:printer.deviceAddress??''}
  const status=await EscPosPrinter.getStatus().catch(()=>({connected:false,device:'',address:''}))
  return status.address===printer.deviceAddress?status:{connected:false,device:printer.deviceName??'',address:printer.deviceAddress??''}
}

export async function receiptPayload(order:Order,settings:OutletSettings,printer:PrinterConfig){
  const design=settings.receipt;let logoRaster=null
  if(printer.printLogo&&design.showLogo&&design.logoUrl){try{logoRaster=await createMonochromeRaster(design.logoUrl,design.logoWidthMm,printer.paperWidth,design.rasterMode,design.rasterThreshold,printer.printWidthDots)}catch{/* text receipt remains printable */}}
  const renderedDesign={
    ...design,
    headerTitle:receiptTemplate(design.headerTitle,order,settings),
    headerSubtitle:receiptTemplate(design.headerSubtitle,order,settings),
    documentTitle:receiptTemplate(design.documentTitle,order,settings),
    headerLines:receiptTemplateLines(design.headerLines,order,settings),
    footerLines:receiptTemplateLines(design.footerLines,order,settings),
    qrLabel:receiptTemplate(design.qrLabel,order,settings),
    qrValue:receiptTemplate(design.qrValue,order,settings),
  }
  return {
    paperWidth:printer.paperWidth,printWidthDots:printer.printWidthDots??(printer.paperWidth===58?384:576),cutPaper:printer.cutPaper,openDrawer:printer.openDrawer,copies:Math.max(1,printer.type==='cashier'?(design.copies??1):(printer.copies??1)),characterSet:printer.characterSet??'CP437',
    design:renderedDesign,logoRaster,
    header:{brand:settings.brandName,address:settings.address,phone:settings.phone,tagline:settings.tagline,outletName:settings.outletName},
    order:{number:order.number,queueNumber:order.queueNumber,terminalCode:order.terminalCode,createdAt:order.createdAt,createdLabel:dateTimeId(order.createdAt),cashier:order.cashierName,type:order.type,tableName:order.tableName,customerName:order.customerName,note:order.note},
    items:order.items.map(i=>({sku:i.sku,name:i.name,category:i.category,qty:i.qty,price:itemUnitPrice(i),total:itemLineTotal(i),note:i.note,kitchenRoute:i.kitchenRoute,modifiers:i.modifiers??[]})),
    totals:{subtotal:order.subtotal,discount:order.discount,tax:order.tax,service:order.service,total:order.total},payment:order.payment,payments:order.payments??(order.payment?[order.payment]:[]),
  }
}

async function executeJob(job:PrintJob,printer:PrinterConfig){
  const printing={...job,status:'printing' as const,attempts:job.attempts+1,updatedAt:new Date().toISOString(),lastError:undefined};await updatePrintJob(printing)
  try{
    const ensured=await ensurePrinter(printer);if(!ensured.ok)throw new Error(ensured.reason)
    if(job.kind==='receipt')await EscPosPrinter.printReceipt({payload:job.payload})
    else await EscPosPrinter.printKitchenTicket({payload:job.payload})
    const printed={...printing,status:'printed' as const,updatedAt:new Date().toISOString()};await updatePrintJob(printed);void prunePrintJobs();return {ok:true,job:printed}
  }catch(error){const failed={...printing,status:'failed' as const,updatedAt:new Date().toISOString(),lastError:error instanceof Error?error.message:String(error)};await updatePrintJob(failed);return {ok:false,reason:failed.lastError,job:failed}}
}

async function enqueueAndPrint(kind:PrintJob['kind'],order:Order,printer:PrinterConfig,payload:Record<string,unknown>){
  const now=new Date().toISOString();const job:PrintJob={id:uid('print'),printerId:printer.id,printerName:printer.name,kind,orderId:order.id,orderNumber:order.number,status:'pending',attempts:0,createdAt:now,updatedAt:now,payload};await savePrintJob(job);return executeJob(job,printer)
}

export async function autoPrintReceipt(order:Order,settings:OutletSettings,printer?:PrinterConfig){
  if(!printer?.autoPrint)return {ok:false,reason:'disabled'}
  const payload=await receiptPayload(order,settings,printer);return enqueueAndPrint('receipt',order,printer,payload)
}

export async function printReceiptNative(order:Order,settings:OutletSettings,printer:PrinterConfig){const payload=await receiptPayload(order,settings,printer);return enqueueAndPrint('receipt',order,printer,payload)}

export async function printKitchenNative(order:Order,settings:OutletSettings,printer?:PrinterConfig){
  if(!printer?.autoPrint)return {ok:false,reason:'disabled'}
  const payload=await receiptPayload(order,settings,printer);const station=printer.type==='bar'?'bar':'kitchen';(payload as Record<string,unknown>).stationLabel=station==='bar'?'ORDER MINUMAN':'ORDER DAPUR'
  const routes=printer.routeCategories;payload.items=payload.items.filter(i=>routes.length?routes.includes(i.category):i.kitchenRoute===station)
  if(!payload.items.length)return {ok:false,reason:'no-routed-items'}
  return enqueueAndPrint(station==='bar'?'bar':'kitchen',order,printer,payload as Record<string,unknown>)
}


export async function printKitchenDeltaNative(before:Order,after:Order,settings:OutletSettings,printer?:PrinterConfig){
  if(!printer?.autoPrint)return {ok:false,reason:'disabled'}
  const station=printer.type==='bar'?'bar':'kitchen';const routes=printer.routeCategories
  const routeMatch=(item:Order['items'][number])=>routes.length?routes.includes(item.category):item.kitchenRoute===station
  const key=(item:Order['items'][number])=>item.lineId??`${item.id}|${(item.modifiers??[]).map(m=>m.id??m.name).join(',')}|${item.note??''}`
  const oldMap=new Map(before.items.filter(routeMatch).map(i=>[key(i),i]));const newMap=new Map(after.items.filter(routeMatch).map(i=>[key(i),i]));const keys=new Set([...oldMap.keys(),...newMap.keys()])
  const changes:Array<Record<string,unknown>>=[]
  keys.forEach(k=>{const oldItem=oldMap.get(k),newItem=newMap.get(k);const delta=(newItem?.qty??0)-(oldItem?.qty??0);if(!delta)return;const source=newItem??oldItem!;changes.push({sku:source.sku,name:`${delta>0?'TAMBAH':'BATAL'} • ${source.name}`,category:source.category,qty:Math.abs(delta),price:itemUnitPrice(source),total:itemUnitPrice(source)*Math.abs(delta),note:source.note,kitchenRoute:source.kitchenRoute,modifiers:source.modifiers??[]})})
  if(!changes.length)return {ok:false,reason:'no-changes'}
  const payload=await receiptPayload(after,settings,printer);payload.items=changes as typeof payload.items;(payload as Record<string,unknown>).stationLabel=station==='bar'?'PERUBAHAN MINUMAN':'PERUBAHAN DAPUR';(payload as Record<string,unknown>).deltaTicket=true
  return enqueueAndPrint(station==='bar'?'bar':'kitchen',after,printer,payload as Record<string,unknown>)
}

export async function testNativePrint(printer:PrinterConfig,settings:OutletSettings){
  const ensured=await ensurePrinter(printer);if(!ensured.ok)return {ok:false,reason:ensured.reason}
  let logoRaster=null;const design=settings.receipt
  if(printer.printLogo&&design.showLogo&&design.logoUrl){try{logoRaster=await createMonochromeRaster(design.logoUrl,design.logoWidthMm,printer.paperWidth,design.rasterMode,design.rasterThreshold,printer.printWidthDots)}catch{/* calibration continues */}}
  await EscPosPrinter.testPrint({payload:{paperWidth:printer.paperWidth,printWidthDots:printer.printWidthDots??(printer.paperWidth===58?384:576),characterSet:printer.characterSet??'CP437',brand:settings.brandName,deviceName:printer.deviceName,logoRaster,cutPaper:printer.cutPaper,feedLines:design.feedLines}})
  return {ok:true}
}

export async function listPrintJobs(){return readPrintJobs()}
export async function retryPrintJob(job:PrintJob,printer:PrinterConfig){return executeJob({...job,status:'pending',updatedAt:new Date().toISOString()},printer)}
export async function scanNativePrinters(){ if(!nativePrinterAvailable())return []; await EscPosPrinter.requestPermissions(); return (await EscPosPrinter.scanPrinters()).devices }
export async function connectNativePrinter(address:string){ if(!nativePrinterAvailable())throw new Error('Native Android bridge tidak tersedia'); await EscPosPrinter.requestPermissions(); return EscPosPrinter.connect({address}) }
export async function disconnectNativePrinter(){ if(nativePrinterAvailable())await EscPosPrinter.disconnect() }
export async function nativePrinterStatus(){ if(!nativePrinterAvailable())return {connected:false,device:'',address:''}; return EscPosPrinter.getStatus() }

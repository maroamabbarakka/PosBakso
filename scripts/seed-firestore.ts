import { readFile } from 'node:fs/promises'
import { seedData } from '../src/data/seed.ts'

type Json = null | boolean | number | string | Json[] | { [key:string]: Json | undefined }
const state=JSON.parse(await readFile('.firebase-bootstrap-users.json','utf8'))
const env=Object.fromEntries((await readFile('.env','utf8')).split(/\r?\n/).filter(Boolean).filter(line=>!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}))
const owner=state.users.find((user:{role:string})=>user.role==='owner')
const cashier=state.users.find((user:{role:string})=>user.role==='cashier')
if(!owner||!cashier)throw new Error('Owner/Kasir production account not found')

async function request(url:string,options:RequestInit={}){
  const response=await fetch(url,options);const body=await response.json()
  if(!response.ok)throw new Error(body?.error?.message||JSON.stringify(body))
  return body
}
const login=await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.VITE_FIREBASE_API_KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:owner.email,password:owner.password,returnSecureToken:true})})
const base=`https://firestore.googleapis.com/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents`

function encode(value:Json):Record<string,unknown>{
  if(value===null)return {nullValue:null}
  if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}}
  if(typeof value==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v as Json)]))}}
  if(typeof value==='boolean')return {booleanValue:value}
  if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value}
  return {stringValue:value}
}
async function setDoc(collection:string,id:string,data:Record<string,unknown>){
  const fields=Object.fromEntries(Object.entries(data).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v as Json)]))
  await request(`${base}/${collection}/${encodeURIComponent(id)}`,{method:'PATCH',headers:{authorization:`Bearer ${login.idToken}`,'content-type':'application/json'},body:JSON.stringify({fields})})
}

const mappedOrders=seedData.orders.map(order=>({...order,cashierId:cashier.uid,cashierName:cashier.name,shiftId:'shift-seed'}))
const mappedShifts=seedData.shifts.map(shift=>({...shift,cashierId:cashier.uid,cashierName:cashier.name}))
const mappedCash=seedData.cashMovements.map(item=>({...item,userId:cashier.uid,userName:cashier.name}))
const mappedAudit=seedData.audit.map(item=>({...item,userId:cashier.uid,userName:cashier.name}))
const groups:[string,{id:string}[]][]=[
  ['products',seedData.products],['ingredients',seedData.ingredients],
  ['recipes',seedData.recipes.map(recipe=>({id:recipe.productId,...recipe}))],
  ['suppliers',seedData.suppliers],['printers',seedData.printers.map(printer=>({...printer,connected:false}))],
  ['orders',mappedOrders],['shifts',mappedShifts],['cash_movements',mappedCash],
  ['purchases',seedData.purchases],['stock_movements',seedData.stockMovements],['audit_logs',mappedAudit],
]
await setDoc('settings','outlet',seedData.settings as unknown as Record<string,unknown>)
let count=1
for(const [collection,items] of groups)for(const item of items){await setDoc(collection,item.id,item as unknown as Record<string,unknown>);count++}
console.log(`Seeded ${count} documents across ${groups.length+1} collections`)

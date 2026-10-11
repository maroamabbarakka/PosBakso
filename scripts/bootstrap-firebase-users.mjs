import { readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(Boolean).filter(line => !line.startsWith('#')).map(line => { const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)] }))
const apiKey = env.VITE_FIREBASE_API_KEY
const projectId = env.VITE_FIREBASE_PROJECT_ID
const output = '.firebase-bootstrap-users.json'
const specs = [
  ['owner','Pemilik Rhezeck','owner@rhezeckpos.com','Pemilik'],
  ['manager','Manager Rhezeck','manager@rhezeckpos.com','Manajer'],
  ['cashier','Kasir Rhezeck','kasir@rhezeckpos.com','Kasir'],
  ['kitchen','Dapur Rhezeck','dapur@rhezeckpos.com','Dapur'],
]
const permissions = {
  owner:['sale.create','sale.discount','sale.void','sale.refund','sale.reprint','shift.open','shift.close','cash.move','product.view','product.manage','inventory.view','inventory.adjust','inventory.purchase','report.view','report.profit','user.manage','settings.manage','printer.manage','audit.view','kitchen.view','backup.restore'],
  manager:['sale.create','sale.discount','sale.void','sale.refund','sale.reprint','shift.open','shift.close','cash.move','product.view','product.manage','inventory.view','inventory.adjust','inventory.purchase','report.view','report.profit','user.manage','printer.manage','audit.view','kitchen.view'],
  cashier:['sale.create','sale.reprint','shift.open','shift.close'],
  kitchen:['kitchen.view'],
}
const labels={owner:'Pemilik',manager:'Manajer',cashier:'Kasir',kitchen:'Dapur'}

async function request(url, options={}) {
  const response=await fetch(url,options)
  const body=await response.json()
  if(!response.ok) throw new Error(body?.error?.message || JSON.stringify(body))
  return body
}

if(process.argv[2]==='auth') {
  const users=[]
  for(const [role,name,email,roleLabel] of specs) {
    const password=randomBytes(12).toString('base64url')+'aA1!'
    const result=await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})})
    users.push({role,name,email,roleLabel,password,uid:result.localId,idToken:result.idToken})
  }
  await writeFile(output,JSON.stringify({projectId,users},null,2))
  console.log(JSON.stringify(users.map(({role,email,uid})=>({role,email,uid})),null,2))
} else if(process.argv[2]==='firestore') {
  const state=JSON.parse(await readFile(output,'utf8'))
  const owner=state.users.find(user=>user.role==='owner')
  const base=`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  const value=v=>Array.isArray(v)?{arrayValue:{values:v.map(x=>({stringValue:x}))}}:{stringValue:v}
  const setDoc=async(path,data)=>request(`${base}/${path}`,{method:'PATCH',headers:{authorization:`Bearer ${owner.idToken}`,'content-type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,typeof v==='boolean'?{booleanValue:v}:value(v)]))})})
  await setDoc(`users/${owner.uid}`,{name:owner.name,email:owner.email,role:'owner',roleLabel:owner.roleLabel,active:true,avatarInitials:'PR'})
  for(const [key,list] of Object.entries(permissions)) await setDoc(`roles/${key}`,{key,label:labels[key],permissions:list})
  for(const user of state.users.filter(user=>user.role!=='owner')) await setDoc(`users/${user.uid}`,{name:user.name,email:user.email,role:user.role,roleLabel:user.roleLabel,active:true,avatarInitials:user.name.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()})
  const safe={projectId,users:state.users.map(({idToken,...user})=>user)}
  await writeFile(output,JSON.stringify(safe,null,2))
  console.log('Profiles and roles created')
} else if(process.argv[2]==='verify') {
  const state=JSON.parse(await readFile(output,'utf8'))
  const base=`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
  for(const user of state.users) {
    const login=await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:user.email,password:user.password,returnSecureToken:true})})
    const profile=await request(`${base}/users/${user.uid}`,{headers:{authorization:`Bearer ${login.idToken}`}})
    console.log(`${user.role}: OK (${profile.fields.email.stringValue})`)
  }
} else {
  throw new Error('Use: node scripts/bootstrap-firebase-users.mjs auth|firestore|verify')
}

import { readFile } from 'node:fs/promises'

const credentials=JSON.parse(await readFile('.firebase-bootstrap-users.json','utf8'))
const env=Object.fromEntries((await readFile('.env','utf8')).split(/\r?\n/).filter(Boolean).filter(line=>!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}))
const base=`https://firestore.googleapis.com/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents`

async function login(user){
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.VITE_FIREBASE_API_KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:user.email,password:user.password,returnSecureToken:true})})
  if(!response.ok)throw new Error(`Login ${user.role} failed: ${response.status}`)
  return (await response.json()).idToken
}
async function check(role,path,expected){
  const user=credentials.users.find(item=>item.role===role);const token=await login(user)
  const response=await fetch(`${base}/${path}?pageSize=2`,{headers:{authorization:`Bearer ${token}`}})
  if(response.status!==expected)throw new Error(`${role} ${path}: expected ${expected}, got ${response.status} ${await response.text()}`)
  console.log(`${role.padEnd(7)} ${String(expected).padEnd(3)} ${path}`)
}

await check('owner','users',200)
await check('manager','users',200)
await check('cashier','products',200)
await check('cashier','users',403)
await check('kitchen','orders',200)
await check('kitchen','users',403)
console.log('Firebase Authentication + RBAC: PASS')

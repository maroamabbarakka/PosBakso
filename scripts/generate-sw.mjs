import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'

const root=new URL('../dist/',import.meta.url).pathname
async function walk(dir){
  const out=[]
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name)
    if(entry.isDirectory())out.push(...await walk(path))
    else if(entry.name!=='sw.js')out.push(path)
  }
  return out
}
const files=await walk(root)
const urls=files.map(file=>'/'+relative(root,file).split(sep).join('/')).filter(url=>!url.endsWith('.map'))
const hash=createHash('sha256')
for(const file of files.sort())hash.update(await readFile(file))
const version=hash.digest('hex').slice(0,12)
const source=`const CACHE='posbakso-shell-${version}';\nconst SHELL=${JSON.stringify(urls)};\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));\nself.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('posbakso-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==location.origin)return;const isNavigation=event.request.mode==='navigate';if(isNavigation){event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('/index.html',copy));return response}).catch(()=>caches.match('/index.html')));return}event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})))})\n`;
await writeFile(join(root,'sw.js'),source)
console.log(`Generated sw.js ${version} with ${urls.length} precached assets`)

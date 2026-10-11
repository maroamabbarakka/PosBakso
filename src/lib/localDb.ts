import type { AppData, PrintJob } from '../types'

const DB_NAME = 'posbakso-v2'
const DB_VERSION = 2
const SNAPSHOT_STORE = 'snapshots'
const QUEUE_STORE = 'syncQueue'
const DEAD_STORE = 'syncDeadLetters'
const PRINT_STORE = 'printJobs'

export interface SyncMutation {
  id: string
  batchId?: string
  collection: string
  docId: string
  op: 'set' | 'delete' | 'increment' | 'weightedPurchase'
  payload?: unknown
  createdAt: string
  attempts?: number
  lastError?: string
  nextRetryAt?: string
}

function supportsIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE)
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(DEAD_STORE)) db.createObjectStore(DEAD_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PRINT_STORE)) db.createObjectStore(PRINT_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function storePut<T>(store:string,value:T,key?:IDBValidKey){
  if(!supportsIndexedDb())return
  const db=await openDb()
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,'readwrite');const os=tx.objectStore(store);key===undefined?os.put(value):os.put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})
}
async function storeDelete(store:string,key:IDBValidKey){
  if(!supportsIndexedDb())return
  const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})
}
async function storeAll<T>(store:string):Promise<T[]>{
  if(!supportsIndexedDb())return[]
  try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).getAll();req.onsuccess=()=>resolve((req.result as T[])??[]);req.onerror=()=>reject(req.error)})}catch{return[]}
}

export async function loadSnapshot(): Promise<AppData | null> {
  if (!supportsIndexedDb()) return null
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly')
      const req = tx.objectStore(SNAPSHOT_STORE).get('app')
      req.onsuccess = () => resolve((req.result as AppData | undefined) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch { return null }
}

export async function saveSnapshot(data: AppData): Promise<void> {
  try { await storePut(SNAPSHOT_STORE,data,'app') } catch { /* POS remains usable in memory. */ }
}

export async function clearSnapshot():Promise<void>{ try{await storeDelete(SNAPSHOT_STORE,'app')}catch{/* noop */} }

export async function enqueueMutation(mutation: SyncMutation): Promise<void> {
  try { await storePut(QUEUE_STORE,{...mutation,attempts:mutation.attempts??0}) } catch { /* local snapshot remains source of truth */ }
}
export async function enqueueMutations(mutations:SyncMutation[]):Promise<void>{
  if(!supportsIndexedDb()||!mutations.length)return
  try{const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(QUEUE_STORE,'readwrite');const store=tx.objectStore(QUEUE_STORE);mutations.forEach(m=>store.put({...m,attempts:m.attempts??0}));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}catch{/* snapshot remains source of truth */}
}

export async function readSyncQueue(): Promise<SyncMutation[]> { return storeAll<SyncMutation>(QUEUE_STORE) }
export async function removeSyncMutation(id: string): Promise<void> { try{await storeDelete(QUEUE_STORE,id)}catch{/* retry later */} }
export async function updateSyncMutation(mutation:SyncMutation):Promise<void>{ try{await storePut(QUEUE_STORE,mutation)}catch{/* retry later */} }
export async function moveSyncMutationToDeadLetter(mutation:SyncMutation,error:string):Promise<void>{
  const failed={...mutation,lastError:error,attempts:(mutation.attempts??0)+1,nextRetryAt:undefined}
  try{await storePut(DEAD_STORE,failed);await storeDelete(QUEUE_STORE,mutation.id)}catch{/* leave queued if dead-letter write fails */}
}
export async function readDeadLetters():Promise<SyncMutation[]>{ return storeAll<SyncMutation>(DEAD_STORE) }
/** Removes legacy cloud mutations for data that is now intentionally device-local. */
export async function purgeLocalOnlyMutations(collections:string[]):Promise<void>{
  if(!supportsIndexedDb()||!collections.length)return
  const blocked=new Set(collections)
  try{
    const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction([QUEUE_STORE,DEAD_STORE],'readwrite');for(const name of [QUEUE_STORE,DEAD_STORE]){const store=tx.objectStore(name);const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const value=cursor.value as SyncMutation;if(blocked.has(value.collection))cursor.delete();cursor.continue()}}tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})
  }catch{/* A stale local-only mutation may remain visible until the next load. */}
}
export async function retryDeadLetter(id:string):Promise<void>{
  const items=await readDeadLetters();const item=items.find(x=>x.id===id);if(!item)return
  await enqueueMutation({...item,lastError:undefined,nextRetryAt:undefined});await storeDelete(DEAD_STORE,id)
}
export async function getPendingSyncCount() { return (await readSyncQueue()).length }
export async function getDeadLetterCount(){ return (await readDeadLetters()).length }

export async function savePrintJob(job:PrintJob):Promise<void>{ try{await storePut(PRINT_STORE,job)}catch{/* printing can still proceed */} }
export async function readPrintJobs():Promise<PrintJob[]>{ return (await storeAll<PrintJob>(PRINT_STORE)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)) }
export async function removePrintJob(id:string):Promise<void>{ try{await storeDelete(PRINT_STORE,id)}catch{/* noop */} }
export async function updatePrintJob(job:PrintJob):Promise<void>{ try{await storePut(PRINT_STORE,job)}catch{/* noop */} }


export async function prunePrintJobs(maxPrinted=250,olderThanDays=30):Promise<void>{
  const jobs=await readPrintJobs();const cutoff=Date.now()-olderThanDays*86400000;let kept=0
  for(const job of jobs){
    if(job.status!=='printed')continue
    const old=new Date(job.updatedAt||job.createdAt).getTime()<cutoff
    kept+=1
    if(old||kept>maxPrinted)await removePrintJob(job.id)
  }
}

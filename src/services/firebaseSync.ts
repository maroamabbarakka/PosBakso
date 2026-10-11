import { deleteDoc, doc, increment, runTransaction, setDoc, writeBatch } from 'firebase/firestore'
import { auth, db, cloudSyncEnabled } from '../lib/firebase'
import {
  moveSyncMutationToDeadLetter, readSyncQueue, removeSyncMutation, updateSyncMutation,
  type SyncMutation,
} from '../lib/localDb'

let syncing = false
const MAX_ATTEMPTS = 5

function errorText(error:unknown){
  if(error instanceof Error)return error.message
  return String(error??'Unknown sync error')
}
function errorCode(error:unknown){
  return typeof error==='object'&&error!==null&&'code' in error?String((error as {code?:unknown}).code??''):''
}
function isTransient(error:unknown){
  const code=errorCode(error)
  return ['unavailable','deadline-exceeded','resource-exhausted','aborted','internal','unknown'].some(x=>code.includes(x))
}

async function applySingle(mutation:SyncMutation){
  if(!db)throw new Error('Firestore belum tersedia')
  const ref=doc(db,mutation.collection,mutation.docId)
  if(mutation.op==='delete'){await deleteDoc(ref);return}
  if(mutation.op==='weightedPurchase'){
    const source=(mutation.payload??{}) as Record<string,unknown>;const qty=Number(source.qty??0);const unitCost=Number(source.unitCost??0);await runTransaction(db,async tx=>{const snap=await tx.get(ref);const current=snap.exists()?snap.data():{};const stock=Number(current.stock??0);const cost=Number(current.averageCost??0);const nextStock=stock+qty;const averageCost=nextStock!==0?Math.round(((stock*cost)+(qty*unitCost))/nextStock):unitCost;tx.set(ref,{stock:nextStock,averageCost,updatedAt:source.updatedAt??new Date().toISOString()},{merge:true})});return
  }
  if(mutation.op==='increment'){
    const source=(mutation.payload??{}) as Record<string,unknown>;const patch:Record<string,unknown>={...((source.__set as Record<string,unknown>|undefined)??{})}
    Object.entries(source).forEach(([key,value])=>{if(key!=='__set')patch[key]=typeof value==='number'?increment(value):value})
    await setDoc(ref,patch,{merge:true});return
  }
  await setDoc(ref,mutation.payload as Record<string,unknown>,{merge:true})
}

async function applyBatch(group:SyncMutation[]){
  if(!db)throw new Error('Firestore belum tersedia')
  if(group.length===1&&!group[0].batchId){await applySingle(group[0]);return}
  const batchId=group[0].batchId
  if(batchId){
    // Idempotent domain commit: a replay after app/network crash must never apply stock/cash increments twice.
    const markerRef=doc(db,'sync_events',batchId)
    await runTransaction(db,async tx=>{
      const marker=await tx.get(markerRef)
      if(marker.exists())return
      const weighted=new Map<string,{stock:number;averageCost:number}>()
      for(const mutation of group.filter(m=>m.op==='weightedPurchase')){
        const ref=doc(db,mutation.collection,mutation.docId);const snap=await tx.get(ref);const value=snap.exists()?snap.data():{};weighted.set(`${mutation.collection}/${mutation.docId}`,{stock:Number(value.stock??0),averageCost:Number(value.averageCost??0)})
      }
      for(const mutation of group){
        const ref=doc(db,mutation.collection,mutation.docId)
        if(mutation.op==='delete'){tx.delete(ref);continue}
        if(mutation.op==='weightedPurchase'){
          const source=(mutation.payload??{}) as Record<string,unknown>;const weightedKey=`${mutation.collection}/${mutation.docId}`;const current=weighted.get(weightedKey)??{stock:0,averageCost:0};const qty=Number(source.qty??0);const unitCost=Number(source.unitCost??0);const nextStock=current.stock+qty;const averageCost=nextStock!==0?Math.round(((current.stock*current.averageCost)+(qty*unitCost))/nextStock):unitCost;tx.set(ref,{stock:nextStock,averageCost,updatedAt:source.updatedAt??mutation.createdAt},{merge:true});weighted.set(weightedKey,{stock:nextStock,averageCost});continue
        }
        if(mutation.op==='increment'){
          const source=(mutation.payload??{}) as Record<string,unknown>;const patch:Record<string,unknown>={...((source.__set as Record<string,unknown>|undefined)??{})}
          Object.entries(source).forEach(([key,value])=>{if(key!=='__set')patch[key]=typeof value==='number'?increment(value):value})
          tx.set(ref,patch,{merge:true});continue
        }
        tx.set(ref,mutation.payload as Record<string,unknown>,{merge:true})
      }
      tx.set(markerRef,{userId:auth?.currentUser?.uid??'unknown',createdAt:group[0].createdAt,mutationCount:group.length,terminal:'posbakso-v2'})
    })
    return
  }
  const batch=writeBatch(db)
  for(const mutation of group){
    const ref=doc(db,mutation.collection,mutation.docId)
    if(mutation.op==='delete'){batch.delete(ref);continue}
    if(mutation.op==='weightedPurchase')throw new Error('weightedPurchase wajib menggunakan idempotent transaction batch')
    if(mutation.op==='increment'){
      const source=(mutation.payload??{}) as Record<string,unknown>;const patch:Record<string,unknown>={...((source.__set as Record<string,unknown>|undefined)??{})}
      Object.entries(source).forEach(([key,value])=>{if(key!=='__set')patch[key]=typeof value==='number'?increment(value):value})
      batch.set(ref,patch,{merge:true});continue
    }
    batch.set(ref,mutation.payload as Record<string,unknown>,{merge:true})
  }
  await batch.commit()
}

function groupQueue(queue:SyncMutation[]){
  const groups:SyncMutation[][]=[];const byBatch=new Map<string,SyncMutation[]>()
  for(const mutation of queue.sort((a,b)=>a.createdAt.localeCompare(b.createdAt))){
    if(!mutation.batchId){groups.push([mutation]);continue}
    const found=byBatch.get(mutation.batchId)
    if(found)found.push(mutation)
    else{const group=[mutation];byBatch.set(mutation.batchId,group);groups.push(group)}
  }
  return groups
}

export async function flushFirebaseQueue(): Promise<{ synced: number; pending: number; failed:number }> {
  if (syncing || !cloudSyncEnabled || !db || !navigator.onLine) {
    const pending = (await readSyncQueue()).length
    return { synced: 0, pending, failed:0 }
  }
  syncing = true
  let synced = 0;let failed=0
  try {
    const groups=groupQueue(await readSyncQueue())
    for(const group of groups){
      const retryAt=group.map(x=>x.nextRetryAt).filter(Boolean).sort()[0]
      if(retryAt&&new Date(retryAt).getTime()>Date.now())continue
      try{
        await applyBatch(group)
        await Promise.all(group.map(m=>removeSyncMutation(m.id)))
        synced+=group.length
      }catch(error){
        const message=errorText(error);const attempts=Math.max(...group.map(m=>m.attempts??0))+1
        if(!isTransient(error)||attempts>=MAX_ATTEMPTS){
          await Promise.all(group.map(m=>moveSyncMutationToDeadLetter({...m,attempts:attempts-1},message)))
          failed+=group.length
          continue
        }
        const delay=Math.min(60_000,1000*Math.pow(2,attempts))
        const nextRetryAt=new Date(Date.now()+delay).toISOString()
        await Promise.all(group.map(m=>updateSyncMutation({...m,attempts,lastError:message,nextRetryAt})))
        // A transient connectivity/service error is likely systemic. Keep later work queued.
        break
      }
    }
    const pending=(await readSyncQueue()).length
    return {synced,pending,failed}
  } finally { syncing=false }
}

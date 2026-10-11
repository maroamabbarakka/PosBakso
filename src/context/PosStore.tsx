import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { seedData } from '../data/seed'
import { emptyProductionData, normalizeSettings } from '../data/defaults'
import { looksLikeDemoSnapshot, normalizeAppData, normalizeOrder } from '../lib/migrate'
import { enqueueMutation, enqueueMutations, getPendingSyncCount, loadSnapshot, readDeadLetters, readSyncQueue, retryDeadLetter, saveSnapshot, type SyncMutation } from '../lib/localDb'
import { flushFirebaseQueue } from '../services/firebaseSync'
import { uid } from '../lib/format'
import { paymentMethodAmount } from '../lib/order'
import { weightedAverageCost } from '../lib/domainMath'
import { auth, cloudSyncEnabled, db, demoMode } from '../lib/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import type {
  AppData, AuditEvent, CashMovement, Ingredient, Order, Permission, PrinterConfig,
  Product, Purchase, Recipe, RoleDefinition, Shift, StockMovement, Supplier, UserProfile,
} from '../types'

interface StoreContextValue {
  data: AppData
  hydrated: boolean
  currentUser: UserProfile | null
  online: boolean
  pendingSync: number
  syncFailures: SyncMutation[]
  syncNow: () => Promise<void>
  retryFailedSync: (id: string) => Promise<void>
  demoMode: boolean
  cloudSyncEnabled: boolean
  loginWithPin: (userId: string, pin: string) => Promise<boolean>
  loginWithEmail: (email: string, password: string) => Promise<{ok:boolean;message?:string}>
  logout: () => void
  can: (permission: Permission) => boolean
  getOpenShift: () => Shift | undefined
  saveOrder: (order: Order) => void
  updateOrder: (order: Order) => void
  voidOrder: (orderId: string, reason: string) => void
  refundOrder: (orderId: string, reason: string) => void
  openShift: (openingCash: number) => Shift | null
  closeShift: (actualCash: number, note?: string) => void
  addCashMovement: (type: 'in' | 'out', amount: number, note: string) => void
  upsertProduct: (product: Product) => void
  upsertIngredient: (ingredient: Ingredient) => void
  upsertRecipe: (recipe: Recipe) => void
  upsertSupplier: (supplier: Supplier) => void
  updateRole: (role: RoleDefinition) => void
  toggleProduct: (id: string) => void
  adjustStock: (ingredientId: string, delta: number, type: StockMovement['type'], note: string) => void
  receivePurchase: (purchase: Purchase) => void
  upsertUser: (user: UserProfile) => void
  toggleUser: (id: string) => void
  updatePrinter: (printer: PrinterConfig) => void
  updateSettings: (settings: AppData['settings']) => void
  addAudit: (action: string, entity: string, detail: string, severity?: AuditEvent['severity'], entityId?: string) => void
  seedCloudMasterData: () => Promise<number>
  restoreData: (snapshot: AppData) => Promise<boolean>
  resetDemo: () => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)

function cloneSeed(): AppData {
  return JSON.parse(JSON.stringify(seedData)) as AppData
}

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('')
}

async function readCollection<T>(name: string, max = 200, orderField?: string): Promise<T[]> {
  if (!db) return []
  const ref = collection(db, name)
  const q = orderField ? query(ref, orderBy(orderField, 'desc'), limit(max)) : query(ref, limit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id:d.id, ...d.data() } as T))
}

export function PosStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => demoMode ? cloneSeed() : emptyProductionData())
  const [hydrated, setHydrated] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => sessionStorage.getItem('posbakso.currentUser'))
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pendingSync, setPendingSync] = useState(0)
  const [syncFailures, setSyncFailures] = useState<SyncMutation[]>([])
  const printerSyncTimers=useRef<Record<string,number>>({})
  const persistTimer = useRef<number | null>(null)

  const currentUser = useMemo(() => data.users.find(u => u.id === currentUserId && u.active) ?? null, [data.users, currentUserId])
  const currentRole = useMemo(() => data.roles.find(r => r.key === currentUser?.role), [data.roles, currentUser?.role])

  const can = useCallback((permission: Permission) => Boolean(currentRole?.permissions.includes(permission)), [currentRole])

  useEffect(() => {
    let active = true
    loadSnapshot().then(snapshot => {
      if (!active) return
      if (snapshot && (demoMode || !looksLikeDemoSnapshot(snapshot))) setData(normalizeAppData(snapshot))
      else if (!demoMode) setData(emptyProductionData())
      setHydrated(true)
      getPendingSyncCount().then(setPendingSync)
      readDeadLetters().then(setSyncFailures)
    })
    return () => { active = false }
  }, [])

  const syncNow = useCallback(async () => {
    const result = await flushFirebaseQueue()
    setPendingSync(result.pending)
    setSyncFailures(await readDeadLetters())
  }, [])

  const retryFailedSync = useCallback(async (id:string) => {
    await retryDeadLetter(id)
    setSyncFailures(await readDeadLetters())
    setPendingSync(await getPendingSyncCount())
    await syncNow()
  }, [syncNow])

  useEffect(() => {
    if (!cloudSyncEnabled || !auth || !db) return
    return onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) {
        setCurrentUserId(null)
        sessionStorage.removeItem('posbakso.currentUser')
        return
      }
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (!snap.exists()) {
          await signOut(auth)
          return
        }
        const profile = { ...(snap.data() as UserProfile), id: firebaseUser.uid }
        if (!profile.active) {
          await signOut(auth)
          return
        }
        setData(prev => ({ ...prev, users: prev.users.some(u=>u.id===profile.id) ? prev.users.map(u=>u.id===profile.id?profile:u) : [profile,...prev.users] }))
        setCurrentUserId(profile.id)
        sessionStorage.setItem('posbakso.currentUser', profile.id)
        const privileged = ['owner','manager','supervisor'].includes(profile.role)
        const userAdmin = ['owner','manager'].includes(profile.role)
        const inventoryAccess = privileged || profile.role === 'warehouse'
        const results = await Promise.allSettled([
          getDoc(doc(db, 'settings', 'outlet')),
          readCollection<Product>('products', 300),
          readCollection<Ingredient>('ingredients', 300),
          readCollection<AppData['recipes'][number]>('recipes', 300),
          readCollection<Order>('orders', 200, 'createdAt'),
          readCollection<Shift>('shifts', 100, 'openedAt'),
          readCollection<PrinterConfig>('printers', 20),
          readCollection<RoleDefinition>('roles', 20),
          userAdmin ? readCollection<UserProfile>('users', 100) : Promise.resolve([]),
          inventoryAccess ? readCollection<AppData['suppliers'][number]>('suppliers', 100) : Promise.resolve([]),
          inventoryAccess ? readCollection<Purchase>('purchases', 100, 'createdAt') : Promise.resolve([]),
          privileged ? readCollection<AuditEvent>('audit_logs', 150, 'createdAt') : Promise.resolve([]),
          readCollection<CashMovement>('cash_movements', 150, 'createdAt'),
          readCollection<StockMovement>('stock_movements', 200, 'createdAt'),
        ])
        setData(prev => {
          const val = <T,>(index:number, fallback:T):T => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<T>).value : fallback
          const settingsSnap = val(0, null as Awaited<ReturnType<typeof getDoc>> | null)
          const remotePrinters=val(6, [] as PrinterConfig[])
          const remoteRoles=val(7, [] as RoleDefinition[])
          return {
            ...prev,
            settings:settingsSnap?.exists() ? normalizeSettings(settingsSnap.data() as Partial<AppData['settings']>) : prev.settings,
            products:val(1, [] as Product[]),
            ingredients:val(2, [] as Ingredient[]),
            recipes:val(3, [] as AppData['recipes']),
            orders:val(4, [] as Order[]).map(normalizeOrder),
            shifts:val(5, [] as Shift[]),
            printers:remotePrinters.length?remotePrinters:prev.printers,
            roles:remoteRoles.length?remoteRoles:prev.roles,
            users:userAdmin ? val(8, [] as UserProfile[]) : prev.users,
            suppliers:val(9, [] as AppData['suppliers']),
            purchases:val(10, [] as Purchase[]),
            audit:val(11, [] as AuditEvent[]),
            cashMovements:val(12, [] as CashMovement[]),
            stockMovements:val(13, [] as StockMovement[]),
          }
        })
        void syncNow()
      } catch {
        // Keep the app locked if the profile cannot be verified.
      }
    })
  }, [syncNow])

  useEffect(() => {
    if (!cloudSyncEnabled || !db || !currentUserId) return
    const unsubs:Array<()=>void>=[]
    const permissions=currentRole?.permissions??[]
    const hasAny=(required:Permission[])=>required.some(permission=>permissions.includes(permission))
    const mergeCollection=<T extends {id:string}>(current:T[],remote:T[],pendingIds:Set<string>)=>{
      const map=new Map(current.map(item=>[item.id,item]))
      remote.forEach(item=>{if(!pendingIds.has(item.id))map.set(item.id,item)})
      return [...map.values()]
    }
    const pendingFor=async(collectionName:string)=>{const queue=await readSyncQueue();return queue.filter(m=>m.collection===collectionName)}
    const noopError=()=>{/* permission/network errors are surfaced by sync health; one listener must not break others. */}

    unsubs.push(onSnapshot(doc(db,'users',currentUserId),snap=>{
      if(!snap.exists()||snap.data().active!==true){setCurrentUserId(null);sessionStorage.removeItem('posbakso.currentUser');if(auth)void signOut(auth);return}
      const profile={id:snap.id,...snap.data()} as UserProfile
      setData(prev=>({...prev,users:prev.users.some(u=>u.id===profile.id)?prev.users.map(u=>u.id===profile.id?profile:u):[profile,...prev.users]}))
    },noopError))
    unsubs.push(onSnapshot(query(collection(db,'roles'),limit(30)),snap=>{
      const remote=snap.docs.map(d=>({key:d.id,...d.data()} as RoleDefinition));if(remote.length)setData(prev=>({...prev,roles:remote}))
    },noopError))

    if(hasAny(['sale.create','sale.reprint','sale.void','sale.refund','kitchen.view','report.view'])) unsubs.push(onSnapshot(query(collection(db,'orders'),orderBy('updatedAt','desc'),limit(500)),async snap=>{
      const pending=await pendingFor('orders');const pendingIds=new Set(pending.map(m=>m.docId));const remote=snap.docs.map(d=>normalizeOrder({id:d.id,...d.data()} as Order))
      setData(prev=>({...prev,orders:mergeCollection(prev.orders,remote,pendingIds).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}))
    },noopError))
    unsubs.push(onSnapshot(query(collection(db,'ingredients'),limit(500)),async snap=>{
      const pending=await pendingFor('ingredients');const pendingSets=new Set(pending.filter(m=>m.op==='set').map(m=>m.docId));const deltas=new Map<string,number>()
      pending.filter(m=>m.op==='increment').forEach(m=>{const stock=Number((m.payload as Record<string,unknown>|undefined)?.stock??0);deltas.set(m.docId,(deltas.get(m.docId)??0)+stock)})
      const remote=snap.docs.map(d=>{const value={id:d.id,...d.data()} as Ingredient;return {...value,stock:value.stock+(deltas.get(value.id)??0)}})
      setData(prev=>({...prev,ingredients:mergeCollection(prev.ingredients,remote,pendingSets)}))
    },noopError))
    unsubs.push(onSnapshot(query(collection(db,'products'),limit(500)),async snap=>{const pending=new Set((await pendingFor('products')).map(m=>m.docId));const remote=snap.docs.map(d=>({id:d.id,...d.data()} as Product));setData(prev=>({...prev,products:mergeCollection(prev.products,remote,pending)}))},noopError))
    unsubs.push(onSnapshot(query(collection(db,'recipes'),limit(500)),async snap=>{const pending=new Set((await pendingFor('recipes')).map(m=>m.docId));const remote=snap.docs.map(d=>({productId:d.id,...d.data()} as Recipe));setData(prev=>({...prev,recipes:mergeCollection(prev.recipes.map(r=>({id:r.productId,...r})),remote.map(r=>({id:r.productId,...r})),pending).map(({id:_id,...r})=>r as Recipe)}))},noopError))
    unsubs.push(onSnapshot(doc(db,'settings','outlet'),snap=>{if(snap.exists())setData(prev=>({...prev,settings:normalizeSettings(snap.data() as Partial<AppData['settings']>)}))},noopError))
    unsubs.push(onSnapshot(query(collection(db,'printers'),limit(30)),async snap=>{const pending=new Set((await pendingFor('printers')).map(m=>m.docId));const remote=snap.docs.map(d=>({id:d.id,...d.data(),connected:false} as PrinterConfig));setData(prev=>({...prev,printers:mergeCollection(prev.printers,remote,pending)}))},noopError))
    if(hasAny(['shift.open','shift.close','report.view'])) unsubs.push(onSnapshot(query(collection(db,'shifts'),orderBy('openedAt','desc'),limit(200)),async snap=>{const pending=new Set((await pendingFor('shifts')).map(m=>m.docId));const remote=snap.docs.map(d=>({id:d.id,...d.data()} as Shift));setData(prev=>({...prev,shifts:mergeCollection(prev.shifts,remote,pending)}))},noopError))
    return()=>unsubs.forEach(unsub=>unsub())
  },[currentRole,currentUserId])

  useEffect(() => {
    if (!hydrated) return
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => saveSnapshot(data), 180)
    return () => { if (persistTimer.current) window.clearTimeout(persistTimer.current) }
  }, [data, hydrated])

  useEffect(() => {
    const onOnline = () => { setOnline(true); void syncNow() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const interval = window.setInterval(() => { if (navigator.onLine) void syncNow() }, 60_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(interval)
    }
  }, [syncNow])

  const queueDoc = useCallback((collection: string, docId: string, payload: unknown, op: 'set' | 'delete' = 'set') => {
    if (!cloudSyncEnabled) return
    const mutation = { id:uid('sync'), collection, docId, op, payload, createdAt:new Date().toISOString() }
    void enqueueMutation(mutation).then(() => getPendingSyncCount().then(setPendingSync))
  }, [])

  const queueBatch = useCallback(async (items: Array<Omit<SyncMutation,'id'|'batchId'|'createdAt'>>) => {
    if (!cloudSyncEnabled || !items.length) return
    const batchId=uid('batch');const now=new Date().toISOString()
    const mutations:SyncMutation[]=items.map(item=>({...item,id:uid('sync'),batchId,createdAt:now}))
    await enqueueMutations(mutations);setPendingSync(await getPendingSyncCount())
  }, [])

  const buildAuditEvent = useCallback((action: string, entity: string, detail: string, severity: AuditEvent['severity'] = 'info', entityId?: string):AuditEvent => ({
    id:uid('audit'), createdAt:new Date().toISOString(), userId:currentUser?.id ?? 'system', userName:currentUser?.name ?? 'System', action, entity, entityId, detail, severity,
  }), [currentUser])

  const addAudit = useCallback((action: string, entity: string, detail: string, severity: AuditEvent['severity'] = 'info', entityId?: string) => {
    const event=buildAuditEvent(action,entity,detail,severity,entityId)
    setData(prev => ({ ...prev, audit:[event, ...prev.audit].slice(0,1000) }))
    queueDoc('audit_logs', event.id, event)
  }, [buildAuditEvent, queueDoc])

  const loginWithPin = useCallback(async (userId: string, pin: string) => {
    const user = data.users.find(u => u.id === userId && u.active)
    if (!user?.pinHash) return false
    const hash = await sha256(pin)
    if (hash !== user.pinHash) return false
    setCurrentUserId(user.id)
    sessionStorage.setItem('posbakso.currentUser', user.id)
    const updated = { ...user, lastLoginAt:new Date().toISOString() }
    setData(prev => ({ ...prev, users:prev.users.map(u => u.id === user.id ? updated : u) }))
    queueDoc('users', user.id, { ...updated, pinHash: undefined })
    return true
  }, [data.users, queueDoc])

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (!cloudSyncEnabled || !auth || !db) return { ok:false, message:'Firebase Authentication belum dikonfigurasi.' }
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
      const snap = await getDoc(doc(db, 'users', credential.user.uid))
      if (!snap.exists()) {
        await signOut(auth)
        return { ok:false, message:'Profil pengguna belum dibuat di Firestore.' }
      }
      const profile = { ...(snap.data() as UserProfile), id:credential.user.uid }
      if (!profile.active) {
        await signOut(auth)
        return { ok:false, message:'Akun dinonaktifkan.' }
      }
      setData(prev => ({ ...prev, users:prev.users.some(u=>u.id===profile.id)?prev.users.map(u=>u.id===profile.id?profile:u):[profile,...prev.users] }))
      setCurrentUserId(profile.id)
      sessionStorage.setItem('posbakso.currentUser', profile.id)
      void syncNow()
      return { ok:true }
    } catch {
      return { ok:false, message:'Email atau password tidak valid, atau koneksi Firebase belum tersedia.' }
    }
  }, [syncNow])

  const logout = useCallback(() => {
    sessionStorage.removeItem('posbakso.currentUser')
    setCurrentUserId(null)
    if (cloudSyncEnabled && auth) void signOut(auth)
  }, [])

  const getOpenShift = useCallback(() => {
    if (!currentUser) return undefined
    return data.shifts.find(s => s.cashierId === currentUser.id && s.status === 'open')
  }, [currentUser, data.shifts])

  const orderConsumption = useCallback((prev:AppData, order:Order)=>{
    const map=new Map<string,number>()
    order.items.forEach(line=>{
      const recipe=prev.recipes.find(r=>r.productId===line.id)
      recipe?.items.forEach(ri=>map.set(ri.ingredientId,(map.get(ri.ingredientId)??0)+(ri.qty*line.qty)))
      line.modifiers?.forEach(mod=>mod.recipeItems?.forEach(ri=>map.set(ri.ingredientId,(map.get(ri.ingredientId)??0)+(ri.qty*line.qty))))
    })
    return map
  },[])

  const applyConsumptionDelta = useCallback((prev:AppData, deltas:Map<string,number>, order:Order, note:string) => {
    const ingredients=[...prev.ingredients];const movements:StockMovement[]=[];const stockDeltas:{ingredientId:string;delta:number}[]=[]
    deltas.forEach((consumptionDelta,ingredientId)=>{
      if(Math.abs(consumptionDelta)<0.000001)return
      const index=ingredients.findIndex(i=>i.id===ingredientId);if(index<0)return
      const ingredient=ingredients[index]
      // Positive consumption reduces stock; negative consumption returns stock. Negative stock is explicit and auditable,
      // never silently clamped, so offline sales are not lost and stock exceptions remain visible.
      const stockDelta=-consumptionDelta;const nextStock=ingredient.stock+stockDelta
      ingredients[index]={...ingredient,stock:nextStock,updatedAt:new Date().toISOString()}
      const movement:StockMovement={
        id:uid('stock'),ingredientId:ingredient.id,type:stockDelta<0?'sale':'return',qty:stockDelta,before:ingredient.stock,after:nextStock,unit:ingredient.unit,
        unitCostSnapshot:ingredient.averageCost,note,reference:order.number,userId:currentUser?.id??order.cashierId,userName:currentUser?.name??order.cashierName,createdAt:new Date().toISOString(),
      }
      movements.push(movement);stockDeltas.push({ingredientId,delta:stockDelta})
    })
    return {ingredients,movements,stockDeltas}
  },[currentUser])

  const saveOrder = useCallback((order: Order) => {
    const existing = data.orders.find(o=>o.id===order.id)
    const isCommittedStatus=['held','paid'].includes(order.status)
    const shouldCommitInventory=isCommittedStatus && !(existing?.inventoryCommitted||order.inventoryCommitted)
    const shouldReconcileInventory=Boolean(existing?.inventoryCommitted&&isCommittedStatus)
    const effective:Order=normalizeOrder(shouldCommitInventory?{...order,inventoryCommitted:true}:{...order,inventoryCommitted:order.inventoryCommitted??existing?.inventoryCommitted??false})
    let stockResult:{ingredients:Ingredient[];movements:StockMovement[];stockDeltas:{ingredientId:string;delta:number}[]} | null=null
    if(shouldCommitInventory) stockResult=applyConsumptionDelta(data,orderConsumption(data,effective),effective,`Penjualan ${effective.number}`)
    else if(shouldReconcileInventory&&existing){const oldUse=orderConsumption(data,existing);const newUse=orderConsumption(data,effective);const ids=new Set([...oldUse.keys(),...newUse.keys()]);const delta=new Map<string,number>();ids.forEach(id=>delta.set(id,(newUse.get(id)??0)-(oldUse.get(id)??0)));stockResult=applyConsumptionDelta(data,delta,effective,`Perubahan pesanan ${effective.number}`)}
    const auditEvent=buildAuditEvent(effective.status==='paid'?'sale.completed':existing?'order.updated':'order.held','order',`${effective.status==='paid'?'Menyelesaikan':existing?'Memperbarui':'Menyimpan'} ${effective.number} • ${effective.total}`,'info',effective.id)
    setData(prev=>{const baseOrders=existing?prev.orders.map(o=>o.id===effective.id?effective:o):[effective,...prev.orders];const base={...prev,orders:baseOrders,audit:[auditEvent,...prev.audit].slice(0,1000)};return stockResult?{...base,ingredients:stockResult.ingredients,stockMovements:[...stockResult.movements,...prev.stockMovements]}:base})
    const batch:Array<Omit<SyncMutation,'id'|'batchId'|'createdAt'>>=[{collection:'orders',docId:effective.id,op:'set',payload:effective},{collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent}]
    if(stockResult){const stockAt=new Date().toISOString();stockResult.stockDeltas.forEach(x=>batch.push({collection:'ingredients',docId:x.ingredientId,op:'increment',payload:{stock:x.delta,updatedAt:stockAt}}));stockResult.movements.forEach(m=>batch.push({collection:'stock_movements',docId:m.id,op:'set',payload:m}))}
    queueBatch(batch)
  },[applyConsumptionDelta,buildAuditEvent,data,orderConsumption,queueBatch])

  const updateOrder = useCallback((order: Order) => {
    const previous = data.orders.find(o=>o.id===order.id);const normalized=normalizeOrder(order)
    const stationChanged=JSON.stringify(previous?.stationStatus??{})!==JSON.stringify(normalized.stationStatus??{})
    const changed=Boolean(stationChanged||previous?.kitchenStatus!==normalized.kitchenStatus)
    const auditEvent=changed?buildAuditEvent('kitchen.status','order',`${normalized.number} • Produksi ${JSON.stringify(previous?.stationStatus??{})} → ${JSON.stringify(normalized.stationStatus??{})}`,'info',normalized.id):null
    setData(prev => ({ ...prev, orders:prev.orders.map(o => o.id === order.id ? normalized : o), audit:auditEvent?[auditEvent,...prev.audit].slice(0,1000):prev.audit }))
    const batch:Array<Omit<SyncMutation,'id'|'batchId'|'createdAt'>>=[{collection:'orders',docId:normalized.id,op:'set',payload:normalized}]
    if(auditEvent)batch.push({collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent})
    queueBatch(batch)
  }, [buildAuditEvent, data.orders, queueBatch])

  const reverseOrderInventory=(prev:AppData,order:Order,note:string)=>{
    const consumption=orderConsumption(prev,order);const reverse=new Map<string,number>();consumption.forEach((qty,id)=>reverse.set(id,-qty));return applyConsumptionDelta(prev,reverse,order,note)
  }

  const voidOrder = useCallback((orderId: string, reason: string) => {
    const order = data.orders.find(o => o.id === orderId);if (!order || order.status === 'void' || order.status === 'refunded') return
    const now=new Date().toISOString();const shift=getOpenShift();const updated:Order=normalizeOrder({ ...order,status:'void',voidReason:reason,voidedAt:now,voidDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar'}).format(new Date(now)),reversalShiftId:shift?.id,updatedAt:now })
    const cashRefund=paymentMethodAmount(order,'cash');const cashReverse:CashMovement|undefined=cashRefund>0&&shift&&currentUser?{id:uid('cash'),shiftId:shift.id,type:'out',amount:cashRefund,note:`Void ${order.number}`,createdAt:now,userId:currentUser.id,userName:currentUser.name}:undefined
    const reversed=(order.inventoryCommitted||order.status==='paid')?reverseOrderInventory(data,order,`Pengembalian stok • Void ${order.number}`):null
    const auditEvent=buildAuditEvent('sale.void','order',`Void ${order.number} • ${reason}`,'critical',orderId)
    setData(prev=>({...prev,orders:prev.orders.map(o=>o.id===orderId?updated:o),ingredients:reversed?.ingredients??prev.ingredients,stockMovements:reversed?[...reversed.movements,...prev.stockMovements]:prev.stockMovements,cashMovements:cashReverse?[cashReverse,...prev.cashMovements]:prev.cashMovements,audit:[auditEvent,...prev.audit].slice(0,1000)}))
    const batch:Array<Omit<SyncMutation,'id'|'batchId'|'createdAt'>>=[{collection:'orders',docId:updated.id,op:'set',payload:updated},{collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent}]
    reversed?.stockDeltas.forEach(x=>batch.push({collection:'ingredients',docId:x.ingredientId,op:'increment',payload:{stock:x.delta,updatedAt:now}}));reversed?.movements.forEach(m=>batch.push({collection:'stock_movements',docId:m.id,op:'set',payload:m}));if(cashReverse)batch.push({collection:'cash_movements',docId:cashReverse.id,op:'set',payload:cashReverse});queueBatch(batch)
  },[buildAuditEvent,currentUser,data,getOpenShift,orderConsumption,applyConsumptionDelta,queueBatch])

  const refundOrder = useCallback((orderId: string, reason: string) => {
    const order=data.orders.find(o=>o.id===orderId);if(!order||order.status==='void'||order.status==='refunded')return
    const now=new Date().toISOString();const shift=getOpenShift();const updated:Order=normalizeOrder({...order,status:'refunded',refundReason:reason,refundedAt:now,refundDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar'}).format(new Date(now)),reversalShiftId:shift?.id,updatedAt:now})
    const cashRefund=paymentMethodAmount(order,'cash');const cashReverse:CashMovement|undefined=cashRefund>0&&shift&&currentUser?{id:uid('cash'),shiftId:shift.id,type:'out',amount:cashRefund,note:`Refund ${order.number}`,createdAt:now,userId:currentUser.id,userName:currentUser.name}:undefined
    const reversed=(order.inventoryCommitted||order.status==='paid')?reverseOrderInventory(data,order,`Pengembalian stok • Refund ${order.number}`):null
    const auditEvent=buildAuditEvent('sale.refund','order',`Refund ${order.number} • ${reason}`,'critical',orderId)
    setData(prev=>({...prev,orders:prev.orders.map(o=>o.id===orderId?updated:o),ingredients:reversed?.ingredients??prev.ingredients,stockMovements:reversed?[...reversed.movements,...prev.stockMovements]:prev.stockMovements,cashMovements:cashReverse?[cashReverse,...prev.cashMovements]:prev.cashMovements,audit:[auditEvent,...prev.audit].slice(0,1000)}))
    const batch:Array<Omit<SyncMutation,'id'|'batchId'|'createdAt'>>=[{collection:'orders',docId:updated.id,op:'set',payload:updated},{collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent}]
    reversed?.stockDeltas.forEach(x=>batch.push({collection:'ingredients',docId:x.ingredientId,op:'increment',payload:{stock:x.delta,updatedAt:now}}));reversed?.movements.forEach(m=>batch.push({collection:'stock_movements',docId:m.id,op:'set',payload:m}));if(cashReverse)batch.push({collection:'cash_movements',docId:cashReverse.id,op:'set',payload:cashReverse});queueBatch(batch)
  },[buildAuditEvent,currentUser,data,getOpenShift,orderConsumption,applyConsumptionDelta,queueBatch])

  const openShift = useCallback((openingCash: number) => {
    if (!currentUser || getOpenShift()) return null
    const shift: Shift = { id:uid('shift'),cashierId:currentUser.id,cashierName:currentUser.name,openedAt:new Date().toISOString(),openingCash,status:'open' }
    const auditEvent=buildAuditEvent('shift.open','shift',`Membuka shift dengan kas awal ${openingCash}`,'info',shift.id)
    setData(prev => ({ ...prev, shifts:[shift, ...prev.shifts],audit:[auditEvent,...prev.audit].slice(0,1000) }))
    queueBatch([{collection:'shifts',docId:shift.id,op:'set',payload:shift},{collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent}])
    return shift
  }, [buildAuditEvent, currentUser, getOpenShift, queueBatch])

  const closeShift = useCallback((actualCash: number, note?: string) => {
    const shift = getOpenShift()
    if (!shift) return
    const updated: Shift = { ...shift, actualClosingCash:actualCash, closedAt:new Date().toISOString(), status:'closed', note }
    const auditEvent=buildAuditEvent('shift.close','shift',`Menutup shift • kas aktual ${actualCash}`,'warning',shift.id)
    setData(prev => ({ ...prev, shifts:prev.shifts.map(s => s.id === shift.id ? updated : s),audit:[auditEvent,...prev.audit].slice(0,1000) }))
    queueBatch([{collection:'shifts',docId:updated.id,op:'set',payload:updated},{collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent}])
  }, [buildAuditEvent, getOpenShift, queueBatch])

  const addCashMovement = useCallback((type: 'in' | 'out', amount: number, note: string) => {
    const shift = getOpenShift()
    if (!shift || !currentUser || amount <= 0) return
    const movement: CashMovement = {id:uid('cash'),shiftId:shift.id,type,amount,note,createdAt:new Date().toISOString(),userId:currentUser.id,userName:currentUser.name}
    const auditEvent=buildAuditEvent(`cash.${type}`,'shift',`${type === 'in' ? 'Kas masuk' : 'Kas keluar'} ${amount} • ${note}`,'warning',shift.id)
    setData(prev => ({ ...prev, cashMovements:[movement, ...prev.cashMovements],audit:[auditEvent,...prev.audit].slice(0,1000) }))
    queueBatch([{collection:'cash_movements',docId:movement.id,op:'set',payload:movement},{collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent}])
  }, [buildAuditEvent, currentUser, getOpenShift, queueBatch])

  const upsertProduct = useCallback((product: Product) => {
    setData(prev => ({ ...prev, products:prev.products.some(p=>p.id===product.id) ? prev.products.map(p=>p.id===product.id?product:p) : [product,...prev.products] }))
    queueDoc('products', product.id, product)
    addAudit('product.save', 'product', `Menyimpan produk ${product.name}`, 'info', product.id)
  }, [addAudit, queueDoc])


  const upsertIngredient = useCallback((ingredient: Ingredient) => {
    const existing=data.ingredients.find(i=>i.id===ingredient.id)
    const safe:Ingredient=existing?{...ingredient,stock:existing.stock,averageCost:existing.averageCost,updatedAt:new Date().toISOString()}:{...ingredient,stock:ingredient.stock||0,updatedAt:new Date().toISOString()}
    setData(prev => ({ ...prev, ingredients:prev.ingredients.some(i=>i.id===safe.id) ? prev.ingredients.map(i=>i.id===safe.id?safe:i) : [safe,...prev.ingredients] }))
    queueDoc('ingredients', safe.id, safe)
    addAudit('ingredient.save', 'ingredient', `Menyimpan master bahan ${safe.name} (stok/HPP hanya melalui movement)`, 'info', safe.id)
  }, [addAudit, data.ingredients, queueDoc])

  const upsertRecipe = useCallback((recipe: Recipe) => {
    const calculatedCost = Math.round(recipe.items.reduce((sum,item)=>sum+(data.ingredients.find(i=>i.id===item.ingredientId)?.averageCost??0)*item.qty,0))
    const currentProduct=data.products.find(p=>p.id===recipe.productId)
    const updatedProduct=currentProduct?{...currentProduct,cost:calculatedCost}:undefined
    setData(prev => ({
      ...prev,
      recipes:prev.recipes.some(r=>r.productId===recipe.productId) ? prev.recipes.map(r=>r.productId===recipe.productId?recipe:r) : [recipe,...prev.recipes],
      products:updatedProduct?prev.products.map(p=>p.id===updatedProduct.id?updatedProduct:p):prev.products,
    }))
    const mutations:Array<Omit<SyncMutation,'id'|'batchId'|'createdAt'>>=[{collection:'recipes',docId:recipe.productId,op:'set',payload:recipe}]
    if(updatedProduct)mutations.push({collection:'products',docId:updatedProduct.id,op:'set',payload:updatedProduct})
    queueBatch(mutations)
    addAudit('recipe.save', 'recipe', `Memperbarui resep/BOM ${currentProduct?.name??recipe.productId}`, 'info', recipe.productId)
  }, [addAudit, data.ingredients, data.products, queueBatch])

  const upsertSupplier = useCallback((supplier: Supplier) => {
    setData(prev => ({...prev, suppliers:prev.suppliers.some(s=>s.id===supplier.id)?prev.suppliers.map(s=>s.id===supplier.id?supplier:s):[supplier,...prev.suppliers]}))
    queueDoc('suppliers', supplier.id, supplier)
    addAudit('supplier.save','supplier',`Menyimpan supplier ${supplier.name}`,'info',supplier.id)
  },[addAudit,queueDoc])

  const updateRole = useCallback((role: RoleDefinition) => {
    setData(prev=>({...prev,roles:prev.roles.map(r=>r.key===role.key?role:r)}))
    queueDoc('roles', role.key, role)
    addAudit('role.permissions','role',`Memperbarui permission ${role.label}`,'critical',role.key)
  },[addAudit,queueDoc])

  const toggleProduct = useCallback((id: string) => {
    const product = data.products.find(p=>p.id===id)
    if (!product) return
    upsertProduct({ ...product, active:!product.active })
  }, [data.products, upsertProduct])

  const adjustStock = useCallback((ingredientId: string, delta: number, type: StockMovement['type'], note: string) => {
    const ingredient=data.ingredients.find(i=>i.id===ingredientId);if(!ingredient||!currentUser||!delta)return
    const now=new Date().toISOString();const updated:Ingredient={...ingredient,stock:ingredient.stock+delta,updatedAt:now}
    const movement:StockMovement={id:uid('stock'),ingredientId,type,qty:delta,before:ingredient.stock,after:updated.stock,unit:ingredient.unit,unitCostSnapshot:ingredient.averageCost,note,userId:currentUser.id,userName:currentUser.name,createdAt:now}
    const auditEvent=buildAuditEvent(`stock.${type}`,'ingredient',`${ingredient.name}: ${delta>0?'+':''}${delta} ${ingredient.unit} • ${note}`,type==='waste'?'warning':'info',ingredient.id)
    setData(prev=>({...prev,ingredients:prev.ingredients.map(i=>i.id===ingredientId?updated:i),stockMovements:[movement,...prev.stockMovements],audit:[auditEvent,...prev.audit].slice(0,1000)}))
    queueBatch([{collection:'ingredients',docId:updated.id,op:'increment',payload:{stock:delta,updatedAt:now}},{collection:'stock_movements',docId:movement.id,op:'set',payload:movement},{collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent}])
  },[buildAuditEvent,currentUser,data.ingredients,queueBatch])

  const receivePurchase = useCallback((purchase: Purchase) => {
    if(!currentUser)return
    const received={...purchase,status:'received' as const};const now=received.createdAt||new Date().toISOString();const ingredients=[...data.ingredients];const movements:StockMovement[]=[];const batch:Array<Omit<SyncMutation,'id'|'batchId'|'createdAt'>>=[]
    received.items.forEach(item=>{const idx=ingredients.findIndex(i=>i.id===item.ingredientId);if(idx<0)return;const ingredient=ingredients[idx];const nextStock=ingredient.stock+item.qty;const weightedCost=weightedAverageCost(ingredient.stock,ingredient.averageCost,item.qty,item.unitCost);const next={...ingredient,stock:nextStock,averageCost:weightedCost,updatedAt:now};ingredients[idx]=next;const movement:StockMovement={id:uid('stock'),ingredientId:item.ingredientId,type:'purchase',qty:item.qty,before:ingredient.stock,after:next.stock,unit:item.unit,unitCostSnapshot:item.unitCost,note:`Pembelian ${received.number}`,reference:received.number,userId:currentUser.id,userName:currentUser.name,createdAt:now};movements.push(movement);batch.push({collection:'ingredients',docId:next.id,op:'weightedPurchase',payload:{qty:item.qty,unitCost:item.unitCost,updatedAt:now}},{collection:'stock_movements',docId:movement.id,op:'set',payload:movement})
    })
    const products=data.products.map(product=>{const recipe=data.recipes.find(r=>r.productId===product.id);if(!recipe?.items.length)return product;const cost=Math.round(recipe.items.reduce((sum,item)=>sum+(ingredients.find(i=>i.id===item.ingredientId)?.averageCost??0)*item.qty,0));const updated={...product,cost};if(updated.cost!==product.cost)batch.push({collection:'products',docId:updated.id,op:'set',payload:updated});return updated})
    const auditEvent=buildAuditEvent('purchase.receive','purchase',`Menerima pembelian ${received.number}`,'info',received.id)
    setData(prev=>({...prev,purchases:[received,...prev.purchases],ingredients,products,stockMovements:[...movements,...prev.stockMovements],audit:[auditEvent,...prev.audit].slice(0,1000)}));batch.unshift({collection:'purchases',docId:received.id,op:'set',payload:received});batch.push({collection:'audit_logs',docId:auditEvent.id,op:'set',payload:auditEvent});queueBatch(batch)
  },[buildAuditEvent,currentUser,data.ingredients,data.products,data.recipes,queueBatch])

  const upsertUser = useCallback((user: UserProfile) => {
    setData(prev => ({ ...prev, users:prev.users.some(u=>u.id===user.id) ? prev.users.map(u=>u.id===user.id?user:u) : [user,...prev.users] }))
    const { pinHash: _pinHash, ...cloudUser } = user
    queueDoc('users', user.id, cloudUser)
    addAudit('user.save', 'user', `Menyimpan pengguna ${user.name}`, 'warning', user.id)
  }, [addAudit, queueDoc])

  const toggleUser = useCallback((id: string) => {
    const user = data.users.find(u=>u.id===id)
    if (!user || user.role === 'owner') return
    upsertUser({ ...user, active:!user.active })
  }, [data.users, upsertUser])

  const updatePrinter = useCallback((printer: PrinterConfig) => {
    const safe={...printer,connected:false}
    setData(prev => ({ ...prev, printers:prev.printers.some(p=>p.id===safe.id) ? prev.printers.map(p=>p.id===safe.id?safe:p) : [safe,...prev.printers] }))
    if(printerSyncTimers.current[safe.id])window.clearTimeout(printerSyncTimers.current[safe.id])
    printerSyncTimers.current[safe.id]=window.setTimeout(()=>{
      queueDoc('printers',safe.id,safe)
      addAudit('printer.save','printer',`Memperbarui konfigurasi ${safe.name}`,'info',safe.id)
      delete printerSyncTimers.current[safe.id]
    },700)
  }, [addAudit, queueDoc])

  const updateSettings = useCallback((settings: AppData['settings']) => {
    setData(prev => ({ ...prev, settings }))
    queueDoc('settings', 'outlet', settings)
    addAudit('settings.save', 'settings', 'Memperbarui profil dan konfigurasi outlet', 'warning', 'outlet')
  }, [addAudit, queueDoc])

  const seedCloudMasterData = useCallback(async () => {
    if (!cloudSyncEnabled) return 0
    // Bootstrap roles first. Firestore permissions depend on role documents, while role writes are owner-bootstrap-safe.
    const now=new Date().toISOString();const roleMutations=data.roles.map(item=>({id:uid('sync'),collection:'roles',docId:item.key,op:'set' as const,payload:item,createdAt:now}))
    await enqueueMutations(roleMutations);setPendingSync(await getPendingSyncCount());await syncNow()
    const rest:SyncMutation[]=[
      {id:uid('sync'),collection:'settings',docId:'outlet',op:'set',payload:data.settings,createdAt:now},
      ...data.products.map(item=>({id:uid('sync'),collection:'products',docId:item.id,op:'set' as const,payload:item,createdAt:now})),
      ...data.ingredients.map(item=>({id:uid('sync'),collection:'ingredients',docId:item.id,op:'set' as const,payload:item,createdAt:now})),
      ...data.recipes.map(item=>({id:uid('sync'),collection:'recipes',docId:item.productId,op:'set' as const,payload:item,createdAt:now})),
      ...data.printers.map(item=>({id:uid('sync'),collection:'printers',docId:item.id,op:'set' as const,payload:{...item,connected:false},createdAt:now})),
      ...data.suppliers.map(item=>({id:uid('sync'),collection:'suppliers',docId:item.id,op:'set' as const,payload:item,createdAt:now})),
    ]
    await enqueueMutations(rest);setPendingSync(await getPendingSyncCount());await syncNow();return roleMutations.length+rest.length
  }, [data, syncNow])

  const restoreData = useCallback(async (snapshot: AppData) => {
    const valid=snapshot&&Array.isArray(snapshot.products)&&Array.isArray(snapshot.orders)&&Array.isArray(snapshot.users)&&Array.isArray(snapshot.ingredients)&&Boolean(snapshot.settings)
    if(!valid||(!demoMode&&looksLikeDemoSnapshot(snapshot)))return false
    const normalized=normalizeAppData(snapshot);setData(normalized);await saveSnapshot(normalized)
    // Spark-safe disaster recovery: Owner may merge a backup back into Firestore without Admin SDK/Functions.
    // We intentionally do NOT delete cloud documents missing from the backup; destructive replace is too risky for an offline POS.
    if(cloudSyncEnabled&&currentUser?.role==='owner'&&can('backup.restore')){
      const stripPin=(u:UserProfile)=>{const {pinHash:_pinHash,...safe}=u;return safe}
      const mutations:Array<Omit<SyncMutation,'id'|'batchId'|'createdAt'>>=[
        {collection:'settings',docId:'outlet',op:'set',payload:normalized.settings},
        ...normalized.roles.map(x=>({collection:'roles',docId:x.key,op:'set' as const,payload:x})),
        ...normalized.users.map(x=>({collection:'users',docId:x.id,op:'set' as const,payload:stripPin(x)})),
        ...normalized.products.map(x=>({collection:'products',docId:x.id,op:'set' as const,payload:x})),
        ...normalized.ingredients.map(x=>({collection:'ingredients',docId:x.id,op:'set' as const,payload:x})),
        ...normalized.recipes.map(x=>({collection:'recipes',docId:x.productId,op:'set' as const,payload:x})),
        ...normalized.suppliers.map(x=>({collection:'suppliers',docId:x.id,op:'set' as const,payload:x})),
        ...normalized.purchases.map(x=>({collection:'purchases',docId:x.id,op:'set' as const,payload:x})),
        ...normalized.orders.map(x=>({collection:'orders',docId:x.id,op:'set' as const,payload:x})),
        ...normalized.shifts.map(x=>({collection:'shifts',docId:x.id,op:'set' as const,payload:x})),
        ...normalized.cashMovements.map(x=>({collection:'cash_movements',docId:x.id,op:'set' as const,payload:x})),
        ...normalized.stockMovements.map(x=>({collection:'stock_movements',docId:x.id,op:'set' as const,payload:x})),
        ...normalized.printers.map(x=>({collection:'printers',docId:x.id,op:'set' as const,payload:{...x,connected:false}})),
        ...normalized.audit.map(x=>({collection:'audit_logs',docId:x.id,op:'set' as const,payload:x})),
      ]
      for(let i=0;i<mutations.length;i+=200)await queueBatch(mutations.slice(i,i+200))
      await syncNow()
    }
    return true
  }, [can,currentUser?.role,queueBatch,syncNow])

  const resetDemo = useCallback(async () => {
    if(!demoMode)return
    const fresh=normalizeAppData(cloneSeed());setData(fresh);await saveSnapshot(fresh)
  }, [])

  const value = useMemo<StoreContextValue>(() => ({
    data,hydrated,currentUser,online,pendingSync,syncFailures,syncNow,retryFailedSync,demoMode,cloudSyncEnabled,loginWithPin,loginWithEmail,logout,can,getOpenShift,saveOrder,updateOrder,voidOrder,refundOrder,
    openShift,closeShift,addCashMovement,upsertProduct,upsertIngredient,upsertRecipe,upsertSupplier,updateRole,toggleProduct,adjustStock,receivePurchase,upsertUser,toggleUser,updatePrinter,updateSettings,addAudit,seedCloudMasterData,restoreData,resetDemo,
  }), [data,hydrated,currentUser,online,pendingSync,syncFailures,syncNow,retryFailedSync,demoMode,cloudSyncEnabled,loginWithPin,loginWithEmail,logout,can,getOpenShift,saveOrder,updateOrder,voidOrder,refundOrder,openShift,closeShift,addCashMovement,upsertProduct,upsertIngredient,upsertRecipe,upsertSupplier,updateRole,toggleProduct,adjustStock,receivePurchase,upsertUser,toggleUser,updatePrinter,updateSettings,addAudit,seedCloudMasterData,restoreData,resetDemo])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function usePosStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('usePosStore must be used inside PosStoreProvider')
  return context
}

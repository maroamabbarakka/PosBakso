import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { seedData } from '../data/seed'
import { emptyProductionData, normalizeSettings } from '../data/defaults'
import { looksLikeDemoSnapshot, normalizeAppData, normalizeOrder } from '../lib/migrate'
import {
  enqueueMutation,
  enqueueMutations,
  getPendingSyncCount,
  loadSnapshot,
  purgeLocalOnlyMutations,
  readDeadLetters,
  readSyncQueue,
  retryDeadLetter,
  saveSnapshot,
  type SyncMutation,
} from '../lib/localDb'
import { flushFirebaseQueue } from '../services/firebaseSync'
import { uid } from '../lib/format'
import { auth, cloudSyncEnabled, db, demoMode } from '../lib/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import type {
  AppData,
  AuditEvent,
  CashMovement,
  Ingredient,
  Order,
  Permission,
  PrinterConfig,
  Product,
  Purchase,
  Recipe,
  RoleDefinition,
  Shift,
  StockMovement,
  Supplier,
  UserProfile,
} from '../types'
import { CommandExecutor } from '../application/CommandExecutor'
import {
  reduceAdjustStock,
  reduceReceivePurchase,
  reduceRefundOrder,
  reduceSaveOrder,
  reduceUpdateOrder,
  reduceVoidOrder,
  reduceOpenShift,
  reduceCloseShift,
  reduceAddCashMovement,
} from '../domain/salesReducers'
import { recoverPrintJobs } from '../services/printer'

class PendingMutationIndex {
  private byCollection = new Map<string, Map<string, SyncMutation[]>>()

  rebuild(items: SyncMutation[]) {
    this.byCollection.clear()
    for (const item of items) {
      let docs = this.byCollection.get(item.collection)
      if (!docs) {
        docs = new Map()
        this.byCollection.set(item.collection, docs)
      }
      const list = docs.get(item.docId) ?? []
      list.push(item)
      docs.set(item.docId, list)
    }
  }

  add(items: SyncMutation[]) {
    for (const item of items) {
      let docs = this.byCollection.get(item.collection)
      if (!docs) {
        docs = new Map()
        this.byCollection.set(item.collection, docs)
      }
      const list = docs.get(item.docId) ?? []
      list.push(item)
      docs.set(item.docId, list)
    }
  }

  getPendingIds(collectionName: string): Set<string> {
    const docs = this.byCollection.get(collectionName)
    return docs ? new Set(docs.keys()) : new Set()
  }

  getPendingFor(collectionName: string): SyncMutation[] {
    const docs = this.byCollection.get(collectionName)
    if (!docs) return []
    const out: SyncMutation[] = []
    docs.forEach(list => out.push(...list))
    return out
  }
}

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
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>
  logout: () => void
  can: (permission: Permission) => boolean
  getOpenShift: () => Shift | undefined
  saveOrder: (order: Order) => Promise<void>
  updateOrder: (order: Order) => Promise<void>
  voidOrder: (orderId: string, reason: string) => Promise<void>
  refundOrder: (orderId: string, reason: string) => Promise<void>
  openShift: (openingCash: number) => Promise<Shift | null>
  closeShift: (actualCash: number, note?: string) => Promise<void>
  addCashMovement: (type: 'in' | 'out', amount: number, note: string) => Promise<void>
  upsertProduct: (product: Product) => void
  upsertIngredient: (ingredient: Ingredient) => void
  upsertRecipe: (recipe: Recipe) => void
  upsertSupplier: (supplier: Supplier) => void
  updateRole: (role: RoleDefinition) => void
  toggleProduct: (id: string) => void
  adjustStock: (ingredientId: string, delta: number, type: StockMovement['type'], note: string) => Promise<void>
  receivePurchase: (purchase: Purchase) => Promise<void>
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
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function readCollection<T>(name: string, max = 200, orderField?: string): Promise<T[]> {
  if (!db) return []
  const ref = collection(db, name)
  const q = orderField ? query(ref, orderBy(orderField, 'desc'), limit(max)) : query(ref, limit(max))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as T))
}

export function PosStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => (demoMode ? cloneSeed() : emptyProductionData()))
  const [hydrated, setHydrated] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => sessionStorage.getItem('posbakso.currentUser'))
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [pendingSync, setPendingSync] = useState(0)
  const [syncFailures, setSyncFailures] = useState<SyncMutation[]>([])
  const persistTimer = useRef<number | null>(null)

  const dataRef = useRef(data)
  dataRef.current = data

  const pendingIndexRef = useRef(new PendingMutationIndex())

  const commandExecutor = useMemo(
    () =>
      new CommandExecutor(dataRef.current, next => {
        dataRef.current = next
        setData(next)
      }),
    []
  )

  const updateStoreData = useCallback(
    (updater: AppData | ((prev: AppData) => AppData)) => {
      setData(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        dataRef.current = next
        commandExecutor.setCanonicalState(next)
        return next
      })
    },
    [commandExecutor]
  )

  const currentUser = useMemo(
    () => data.users.find(u => u.id === currentUserId && u.active) ?? null,
    [data.users, currentUserId]
  )
  const currentRole = useMemo(() => data.roles.find(r => r.key === currentUser?.role), [data.roles, currentUser?.role])
  const permissionKey = currentRole?.permissions.join('|') ?? ''

  const can = useCallback(
    (permission: Permission) => Boolean(currentRole?.permissions.includes(permission)),
    [currentRole]
  )

  useEffect(() => {
    let active = true
    loadSnapshot().then(async snapshot => {
      if (!active) return
      if (snapshot && (demoMode || !looksLikeDemoSnapshot(snapshot))) updateStoreData(normalizeAppData(snapshot))
      else if (!demoMode) updateStoreData(emptyProductionData())
      setHydrated(true)
      await purgeLocalOnlyMutations(['printers'])
      const queue = await readSyncQueue()
      pendingIndexRef.current.rebuild(queue)
      setPendingSync(queue.length)
      setSyncFailures(await readDeadLetters())
      void recoverPrintJobs()
    })
    return () => {
      active = false
    }
  }, [])

  const syncNow = useCallback(async () => {
    const result = await flushFirebaseQueue()
    const queue = await readSyncQueue()
    pendingIndexRef.current.rebuild(queue)
    setPendingSync(result.pending)
    setSyncFailures(await readDeadLetters())
  }, [])

  const retryFailedSync = useCallback(
    async (id: string) => {
      await retryDeadLetter(id)
      setSyncFailures(await readDeadLetters())
      setPendingSync(await getPendingSyncCount())
      await syncNow()
    },
    [syncNow]
  )

  useEffect(() => {
    if (!cloudSyncEnabled || !auth || !db) return
    const activeAuth = auth
    const activeDb = db
    return onAuthStateChanged(activeAuth, async firebaseUser => {
      if (!firebaseUser) {
        setCurrentUserId(null)
        sessionStorage.removeItem('posbakso.currentUser')
        return
      }
      try {
        const snap = await getDoc(doc(activeDb, 'users', firebaseUser.uid))
        if (!snap.exists()) {
          await signOut(activeAuth)
          return
        }
        const profile = { ...(snap.data() as UserProfile), id: firebaseUser.uid }
        if (!profile.active) {
          await signOut(activeAuth)
          return
        }
        updateStoreData(prev => ({
          ...prev,
          users: prev.users.some(u => u.id === profile.id)
            ? prev.users.map(u => (u.id === profile.id ? profile : u))
            : [profile, ...prev.users],
        }))
        setCurrentUserId(profile.id)
        sessionStorage.setItem('posbakso.currentUser', profile.id)
        const privileged = ['owner', 'manager', 'supervisor'].includes(profile.role)
        const userAdmin = ['owner', 'manager'].includes(profile.role)
        const inventoryAccess = privileged || profile.role === 'warehouse'
        const results = await Promise.allSettled([
          getDoc(doc(activeDb, 'settings', 'outlet')),
          readCollection<Product>('products', 300),
          readCollection<Ingredient>('ingredients', 300),
          readCollection<AppData['recipes'][number]>('recipes', 300),
          readCollection<Order>('orders', 200, 'createdAt'),
          readCollection<Shift>('shifts', 100, 'openedAt'),
          Promise.resolve([] as PrinterConfig[]), // Printer bindings are local per device.
          readCollection<RoleDefinition>('roles', 20),
          userAdmin ? readCollection<UserProfile>('users', 100) : Promise.resolve([]),
          inventoryAccess ? readCollection<AppData['suppliers'][number]>('suppliers', 100) : Promise.resolve([]),
          inventoryAccess ? readCollection<Purchase>('purchases', 100, 'createdAt') : Promise.resolve([]),
          privileged ? readCollection<AuditEvent>('audit_logs', 150, 'createdAt') : Promise.resolve([]),
          readCollection<CashMovement>('cash_movements', 150, 'createdAt'),
          readCollection<StockMovement>('stock_movements', 200, 'createdAt'),
        ])
        updateStoreData(prev => {
          const val = <T,>(index: number, fallback: T): T =>
            results[index].status === 'fulfilled'
              ? (results[index] as PromiseFulfilledResult<T>).value
              : fallback
          const settingsSnap = results[0].status === 'fulfilled' ? results[0].value : null
          const remoteRoles = val(7, [] as RoleDefinition[])
          return {
            ...prev,
            settings: settingsSnap?.exists()
              ? normalizeSettings(settingsSnap.data() as Partial<AppData['settings']>)
              : prev.settings,
            products: val(1, [] as Product[]),
            ingredients: val(2, [] as Ingredient[]),
            recipes: val(3, [] as AppData['recipes']),
            orders: val(4, [] as Order[]).map(normalizeOrder),
            shifts: val(5, [] as Shift[]),
            printers: prev.printers,
            roles: remoteRoles.length ? remoteRoles : prev.roles,
            users: userAdmin ? val(8, [] as UserProfile[]) : prev.users,
            suppliers: val(9, [] as AppData['suppliers']),
            purchases: val(10, [] as Purchase[]),
            audit: val(11, [] as AuditEvent[]),
            cashMovements: val(12, [] as CashMovement[]),
            stockMovements: val(13, [] as StockMovement[]),
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
    const unsubs: Array<() => void> = []
    const permissions = permissionKey ? (permissionKey.split('|') as Permission[]) : []
    const hasAny = (required: Permission[]) => required.some(permission => permissions.includes(permission))
    const mergeCollection = <T extends { id: string }>(current: T[], remote: T[], pendingIds: Set<string>) => {
      const map = new Map(current.map(item => [item.id, item]))
      remote.forEach(item => {
        if (!pendingIds.has(item.id)) map.set(item.id, item)
      })
      return [...map.values()]
    }
    const noopError = () => {
      /* permission/network errors are surfaced by sync health; one listener must not break others. */
    }

    unsubs.push(
      onSnapshot(
        doc(db, 'users', currentUserId),
        snap => {
          if (!snap.exists() || snap.data().active !== true) {
            setCurrentUserId(null)
            sessionStorage.removeItem('posbakso.currentUser')
            if (auth) void signOut(auth)
            return
          }
          const profile = { id: snap.id, ...snap.data() } as UserProfile
          updateStoreData(prev => ({
            ...prev,
            users: prev.users.some(u => u.id === profile.id)
              ? prev.users.map(u => (u.id === profile.id ? profile : u))
              : [profile, ...prev.users],
          }))
        },
        noopError
      )
    )
    unsubs.push(
      onSnapshot(
        query(collection(db, 'roles'), limit(30)),
        snap => {
          const remote = snap.docs.map(d => ({ key: d.id, ...d.data() } as RoleDefinition))
          if (remote.length) updateStoreData(prev => ({ ...prev, roles: remote }))
        },
        noopError
      )
    )

    if (hasAny(['sale.create', 'sale.reprint', 'sale.void', 'sale.refund', 'kitchen.view', 'report.view'])) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), orderBy('updatedAt', 'desc'), limit(500)),
          snap => {
            const pendingIds = pendingIndexRef.current.getPendingIds('orders')
            const remote = snap.docs.map(d => normalizeOrder({ id: d.id, ...d.data() } as Order))
            updateStoreData(prev => ({
              ...prev,
              orders: mergeCollection(prev.orders, remote, pendingIds).sort((a, b) =>
                b.updatedAt.localeCompare(a.updatedAt)
              ),
            }))
          },
          noopError
        )
      )
    }

    unsubs.push(
      onSnapshot(
        query(collection(db, 'ingredients'), limit(500)),
        snap => {
          const pending = pendingIndexRef.current.getPendingFor('ingredients')
          const pendingSets = new Set(pending.filter(m => m.op === 'set').map(m => m.docId))
          const deltas = new Map<string, number>()
          pending
            .filter(m => m.op === 'increment')
            .forEach(m => {
              const stock = Number((m.payload as Record<string, unknown> | undefined)?.stock ?? 0)
              deltas.set(m.docId, (deltas.get(m.docId) ?? 0) + stock)
            })
          const remote = snap.docs.map(d => {
            const value = { id: d.id, ...d.data() } as Ingredient
            return { ...value, stock: value.stock + (deltas.get(value.id) ?? 0) }
          })
          updateStoreData(prev => ({
            ...prev,
            ingredients: mergeCollection(prev.ingredients, remote, pendingSets),
          }))
        },
        noopError
      )
    )

    unsubs.push(
      onSnapshot(
        query(collection(db, 'products'), limit(500)),
        snap => {
          const pending = pendingIndexRef.current.getPendingIds('products')
          const remote = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))
          updateStoreData(prev => ({ ...prev, products: mergeCollection(prev.products, remote, pending) }))
        },
        noopError
      )
    )

    unsubs.push(
      onSnapshot(
        query(collection(db, 'recipes'), limit(500)),
        snap => {
          const pending = pendingIndexRef.current.getPendingIds('recipes')
          const remote = snap.docs.map(d => ({ productId: d.id, ...d.data() } as Recipe))
          updateStoreData(prev => ({
            ...prev,
            recipes: mergeCollection(
              prev.recipes.map(r => ({ id: r.productId, ...r })),
              remote.map(r => ({ id: r.productId, ...r })),
              pending
            ).map(({ id: _id, ...r }) => r as Recipe),
          }))
        },
        noopError
      )
    )

    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'outlet'),
        snap => {
          if (snap.exists()) {
            updateStoreData(prev => ({
              ...prev,
              settings: normalizeSettings(snap.data() as Partial<AppData['settings']>),
            }))
          }
        },
        noopError
      )
    )

    if (hasAny(['shift.open', 'shift.close', 'report.view'])) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'shifts'), orderBy('openedAt', 'desc'), limit(200)),
          snap => {
            const pending = pendingIndexRef.current.getPendingIds('shifts')
            const remote = snap.docs.map(d => ({ id: d.id, ...d.data() } as Shift))
            updateStoreData(prev => ({ ...prev, shifts: mergeCollection(prev.shifts, remote, pending) }))
          },
          noopError
        )
      )
    }

    return () => unsubs.forEach(unsub => unsub())
  }, [currentUserId, permissionKey])

  useEffect(() => {
    if (!hydrated) return
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => saveSnapshot(data), 180)
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
    }
  }, [data, hydrated])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      void syncNow()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const interval = window.setInterval(() => {
      if (navigator.onLine) void syncNow()
    }, 60_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(interval)
    }
  }, [syncNow])

  const queueDoc = useCallback((collectionName: string, docId: string, payload: unknown, op: 'set' | 'delete' = 'set') => {
    if (!cloudSyncEnabled) return
    const mutation: SyncMutation = {
      id: uid('sync'),
      collection: collectionName,
      docId,
      op,
      payload,
      createdAt: new Date().toISOString(),
    }
    pendingIndexRef.current.add([mutation])
    void enqueueMutation(mutation).then(() => getPendingSyncCount().then(setPendingSync))
  }, [])

  const queueBatch = useCallback(async (items: Array<Omit<SyncMutation, 'id' | 'batchId' | 'createdAt'>>) => {
    if (!cloudSyncEnabled || !items.length) return
    const batchId = uid('batch')
    const now = new Date().toISOString()
    const mutations: SyncMutation[] = items.map(item => ({ ...item, id: uid('sync'), batchId, createdAt: now }))
    pendingIndexRef.current.add(mutations)
    await enqueueMutations(mutations)
    setPendingSync(await getPendingSyncCount())
  }, [])

  const buildAuditEvent = useCallback(
    (action: string, entity: string, detail: string, severity: AuditEvent['severity'] = 'info', entityId?: string): AuditEvent => ({
      id: uid('audit'),
      createdAt: new Date().toISOString(),
      userId: currentUser?.id ?? 'system',
      userName: currentUser?.name ?? 'System',
      action,
      entity,
      entityId,
      detail,
      severity,
    }),
    [currentUser]
  )

  const addAudit = useCallback(
    (action: string, entity: string, detail: string, severity: AuditEvent['severity'] = 'info', entityId?: string) => {
      const event = buildAuditEvent(action, entity, detail, severity, entityId)
      updateStoreData(prev => ({ ...prev, audit: [event, ...prev.audit].slice(0, 1000) }))
      queueDoc('audit_logs', event.id, event)
    },
    [buildAuditEvent, queueDoc, updateStoreData]
  )

  const loginWithPin = useCallback(
    async (userId: string, pin: string) => {
      const user = data.users.find(u => u.id === userId && u.active)
      if (!user?.pinHash) return false
      const hash = await sha256(pin)
      if (hash !== user.pinHash) return false
      setCurrentUserId(user.id)
      sessionStorage.setItem('posbakso.currentUser', user.id)
      const updated = { ...user, lastLoginAt: new Date().toISOString() }
      updateStoreData(prev => ({ ...prev, users: prev.users.map(u => (u.id === user.id ? updated : u)) }))
      queueDoc('users', user.id, { ...updated, pinHash: undefined })
      return true
    },
    [data.users, queueDoc, updateStoreData]
  )

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!cloudSyncEnabled || !auth || !db) return { ok: false, message: 'Firebase Authentication belum dikonfigurasi.' }
      try {
        const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
        const snap = await getDoc(doc(db, 'users', credential.user.uid))
        if (!snap.exists()) {
          await signOut(auth)
          return { ok: false, message: 'Profil pengguna belum dibuat di Firestore.' }
        }
        const profile = { ...(snap.data() as UserProfile), id: credential.user.uid }
        if (!profile.active) {
          await signOut(auth)
          return { ok: false, message: 'Akun dinonaktifkan.' }
        }
        updateStoreData(prev => ({
          ...prev,
          users: prev.users.some(u => u.id === profile.id)
            ? prev.users.map(u => (u.id === profile.id ? profile : u))
            : [profile, ...prev.users],
        }))
        setCurrentUserId(profile.id)
        sessionStorage.setItem('posbakso.currentUser', profile.id)
        void syncNow()
        return { ok: true }
      } catch {
        return { ok: false, message: 'Email atau password tidak valid, atau koneksi Firebase belum tersedia.' }
      }
    },
    [syncNow]
  )

  const logout = useCallback(() => {
    sessionStorage.removeItem('posbakso.currentUser')
    setCurrentUserId(null)
    if (cloudSyncEnabled && auth) void signOut(auth)
  }, [])

  const getOpenShift = useCallback(() => {
    if (!currentUser) return undefined
    return data.shifts.find(s => s.cashierId === currentUser.id && s.status === 'open')
  }, [currentUser, data.shifts])

  const saveOrder = useCallback(
    async (order: Order): Promise<void> => {
      await commandExecutor.run(current => {
        const result = reduceSaveOrder(current, order, currentUser)
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
        }
      })
      void syncNow()
    },
    [commandExecutor, currentUser, syncNow]
  )

  const updateOrder = useCallback(
    async (order: Order): Promise<void> => {
      await commandExecutor.run(current => {
        const result = reduceUpdateOrder(current, order, currentUser)
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
        }
      })
      void syncNow()
    },
    [commandExecutor, currentUser, syncNow]
  )

  const voidOrder = useCallback(
    async (orderId: string, reason: string): Promise<void> => {
      await commandExecutor.run(current => {
        const shift = current.shifts.find(s => s.cashierId === currentUser?.id && s.status === 'open')
        const result = reduceVoidOrder(current, orderId, reason, currentUser, shift)
        if (!result) return { nextState: current, mutations: [] }
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
        }
      })
      void syncNow()
    },
    [commandExecutor, currentUser, syncNow]
  )

  const refundOrder = useCallback(
    async (orderId: string, reason: string): Promise<void> => {
      await commandExecutor.run(current => {
        const shift = current.shifts.find(s => s.cashierId === currentUser?.id && s.status === 'open')
        const result = reduceRefundOrder(current, orderId, reason, currentUser, shift)
        if (!result) return { nextState: current, mutations: [] }
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
        }
      })
      void syncNow()
    },
    [commandExecutor, currentUser, syncNow]
  )

  const openShift = useCallback(
    async (openingCash: number): Promise<Shift | null> => {
      const shift = await commandExecutor.run(current => {
        const result = reduceOpenShift(current, openingCash, currentUser)
        if (!result.value) return { nextState: current, mutations: [], value: null }
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
          value: result.value,
        }
      })
      void syncNow()
      return shift
    },
    [commandExecutor, currentUser, syncNow]
  )

  const closeShift = useCallback(
    async (actualCash: number, note?: string): Promise<void> => {
      await commandExecutor.run(current => {
        const result = reduceCloseShift(current, actualCash, note, currentUser)
        if (!result.value) return { nextState: current, mutations: [], value: null }
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
          value: result.value,
        }
      })
      void syncNow()
    },
    [commandExecutor, currentUser, syncNow]
  )

  const addCashMovement = useCallback(
    async (type: 'in' | 'out', amount: number, note: string): Promise<void> => {
      await commandExecutor.run(current => {
        const result = reduceAddCashMovement(current, type, amount, note, currentUser)
        if (!result.value) return { nextState: current, mutations: [], value: null }
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
          value: result.value,
        }
      })
      void syncNow()
    },
    [commandExecutor, currentUser, syncNow]
  )

  const upsertProduct = useCallback(
    (product: Product) => {
      updateStoreData(prev => ({
        ...prev,
        products: prev.products.some(p => p.id === product.id)
          ? prev.products.map(p => (p.id === product.id ? product : p))
          : [product, ...prev.products],
      }))
      queueDoc('products', product.id, product)
      addAudit('product.save', 'product', `Menyimpan produk ${product.name}`, 'info', product.id)
    },
    [addAudit, queueDoc, updateStoreData]
  )

  const upsertIngredient = useCallback(
    (ingredient: Ingredient) => {
      const existing = data.ingredients.find(i => i.id === ingredient.id)
      const safe: Ingredient = existing
        ? { ...ingredient, stock: existing.stock, averageCost: existing.averageCost, updatedAt: new Date().toISOString() }
        : { ...ingredient, stock: ingredient.stock || 0, updatedAt: new Date().toISOString() }
      updateStoreData(prev => ({
        ...prev,
        ingredients: prev.ingredients.some(i => i.id === safe.id)
          ? prev.ingredients.map(i => (i.id === safe.id ? safe : i))
          : [safe, ...prev.ingredients],
      }))
      queueDoc('ingredients', safe.id, safe)
      addAudit('ingredient.save', 'ingredient', `Menyimpan master bahan ${safe.name} (stok/HPP hanya melalui movement)`, 'info', safe.id)
    },
    [addAudit, data.ingredients, queueDoc, updateStoreData]
  )

  const upsertRecipe = useCallback(
    (recipe: Recipe) => {
      const calculatedCost = Math.round(
        recipe.items.reduce((sum, item) => sum + (data.ingredients.find(i => i.id === item.ingredientId)?.averageCost ?? 0) * item.qty, 0)
      )
      const currentProduct = data.products.find(p => p.id === recipe.productId)
      const updatedProduct = currentProduct ? { ...currentProduct, cost: calculatedCost } : undefined
      updateStoreData(prev => ({
        ...prev,
        recipes: prev.recipes.some(r => r.productId === recipe.productId)
          ? prev.recipes.map(r => (r.productId === recipe.productId ? recipe : r))
          : [recipe, ...prev.recipes],
        products: updatedProduct ? prev.products.map(p => (p.id === updatedProduct.id ? updatedProduct : p)) : prev.products,
      }))
      const mutations: Array<Omit<SyncMutation, 'id' | 'batchId' | 'createdAt'>> = [
        { collection: 'recipes', docId: recipe.productId, op: 'set', payload: recipe },
      ]
      if (updatedProduct) mutations.push({ collection: 'products', docId: updatedProduct.id, op: 'set', payload: updatedProduct })
      void queueBatch(mutations)
      addAudit('recipe.save', 'recipe', `Memperbarui resep/BOM ${currentProduct?.name ?? recipe.productId}`, 'info', recipe.productId)
    },
    [addAudit, data.ingredients, data.products, queueBatch, updateStoreData]
  )

  const upsertSupplier = useCallback(
    (supplier: Supplier) => {
      updateStoreData(prev => ({
        ...prev,
        suppliers: prev.suppliers.some(s => s.id === supplier.id)
          ? prev.suppliers.map(s => (s.id === supplier.id ? supplier : s))
          : [supplier, ...prev.suppliers],
      }))
      queueDoc('suppliers', supplier.id, supplier)
      addAudit('supplier.save', 'supplier', `Menyimpan supplier ${supplier.name}`, 'info', supplier.id)
    },
    [addAudit, queueDoc, updateStoreData]
  )

  const updateRole = useCallback(
    (role: RoleDefinition) => {
      updateStoreData(prev => ({ ...prev, roles: prev.roles.map(r => (r.key === role.key ? role : r)) }))
      queueDoc('roles', role.key, role)
      addAudit('role.permissions', 'role', `Memperbarui permission ${role.label}`, 'critical', role.key)
    },
    [addAudit, queueDoc, updateStoreData]
  )

  const toggleProduct = useCallback(
    (id: string) => {
      const product = data.products.find(p => p.id === id)
      if (!product) return
      upsertProduct({ ...product, active: !product.active })
    },
    [data.products, upsertProduct]
  )

  const adjustStock = useCallback(
    async (ingredientId: string, delta: number, type: StockMovement['type'], note: string): Promise<void> => {
      await commandExecutor.run(current => {
        const result = reduceAdjustStock(current, ingredientId, delta, type, note, currentUser)
        if (!result) return { nextState: current, mutations: [] }
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
        }
      })
      void syncNow()
    },
    [commandExecutor, currentUser, syncNow]
  )

  const receivePurchase = useCallback(
    async (purchase: Purchase): Promise<void> => {
      await commandExecutor.run(current => {
        const result = reduceReceivePurchase(current, purchase, currentUser)
        if (!result) return { nextState: current, mutations: [] }
        pendingIndexRef.current.add(result.mutations)
        return {
          nextState: result.nextState,
          mutations: result.mutations,
        }
      })
      void syncNow()
    },
    [commandExecutor, currentUser, syncNow]
  )

  const upsertUser = useCallback(
    (user: UserProfile) => {
      updateStoreData(prev => ({
        ...prev,
        users: prev.users.some(u => u.id === user.id) ? prev.users.map(u => (u.id === user.id ? user : u)) : [user, ...prev.users],
      }))
      const { pinHash: _pinHash, ...cloudUser } = user
      queueDoc('users', user.id, cloudUser)
      addAudit('user.save', 'user', `Menyimpan pengguna ${user.name}`, 'warning', user.id)
    },
    [addAudit, queueDoc, updateStoreData]
  )

  const toggleUser = useCallback(
    (id: string) => {
      const user = data.users.find(u => u.id === id)
      if (!user || user.role === 'owner') return
      upsertUser({ ...user, active: !user.active })
    },
    [data.users, upsertUser]
  )

  const updatePrinter = useCallback((printer: PrinterConfig) => {
    const safe = { ...printer, connected: false }
    updateStoreData(prev => ({
      ...prev,
      printers: prev.printers.some(p => p.id === safe.id)
        ? prev.printers.map(p => (p.id === safe.id ? safe : p))
        : [safe, ...prev.printers],
    }))
  }, [updateStoreData])

  const updateSettings = useCallback(
    (settings: AppData['settings']) => {
      updateStoreData(prev => ({ ...prev, settings }))
      queueDoc('settings', 'outlet', settings)
      addAudit('settings.save', 'settings', 'Memperbarui profil dan konfigurasi outlet', 'warning', 'outlet')
    },
    [addAudit, queueDoc, updateStoreData]
  )

  const seedCloudMasterData = useCallback(async () => {
    if (!cloudSyncEnabled) return 0
    const now = new Date().toISOString()
    const roleMutations = data.roles.map(item => ({
      id: uid('sync'),
      collection: 'roles',
      docId: item.key,
      op: 'set' as const,
      payload: item,
      createdAt: now,
    }))
    pendingIndexRef.current.add(roleMutations)
    await enqueueMutations(roleMutations)
    setPendingSync(await getPendingSyncCount())
    await syncNow()
    const rest: SyncMutation[] = [
      { id: uid('sync'), collection: 'settings', docId: 'outlet', op: 'set', payload: data.settings, createdAt: now },
      ...data.products.map(item => ({
        id: uid('sync'),
        collection: 'products',
        docId: item.id,
        op: 'set' as const,
        payload: item,
        createdAt: now,
      })),
      ...data.ingredients.map(item => ({
        id: uid('sync'),
        collection: 'ingredients',
        docId: item.id,
        op: 'set' as const,
        payload: item,
        createdAt: now,
      })),
      ...data.recipes.map(item => ({
        id: uid('sync'),
        collection: 'recipes',
        docId: item.productId,
        op: 'set' as const,
        payload: item,
        createdAt: now,
      })),
      ...data.suppliers.map(item => ({
        id: uid('sync'),
        collection: 'suppliers',
        docId: item.id,
        op: 'set' as const,
        payload: item,
        createdAt: now,
      })),
    ]
    pendingIndexRef.current.add(rest)
    await enqueueMutations(rest)
    setPendingSync(await getPendingSyncCount())
    await syncNow()
    return roleMutations.length + rest.length
  }, [data, syncNow])

  const restoreData = useCallback(
    async (snapshot: AppData) => {
      const valid =
        snapshot &&
        Array.isArray(snapshot.products) &&
        Array.isArray(snapshot.orders) &&
        Array.isArray(snapshot.users) &&
        Array.isArray(snapshot.ingredients) &&
        Boolean(snapshot.settings)
      if (!valid || (!demoMode && looksLikeDemoSnapshot(snapshot))) return false
      const normalized = normalizeAppData(snapshot)
      updateStoreData(normalized)
      await saveSnapshot(normalized)
      if (cloudSyncEnabled && currentUser?.role === 'owner' && can('backup.restore')) {
        const stripPin = (u: UserProfile) => {
          const { pinHash: _pinHash, ...safe } = u
          return safe
        }
        const mutations: Array<Omit<SyncMutation, 'id' | 'batchId' | 'createdAt'>> = [
          { collection: 'settings', docId: 'outlet', op: 'set', payload: normalized.settings },
          ...normalized.roles.map(x => ({ collection: 'roles', docId: x.key, op: 'set' as const, payload: x })),
          ...normalized.users.map(x => ({ collection: 'users', docId: x.id, op: 'set' as const, payload: stripPin(x) })),
          ...normalized.products.map(x => ({ collection: 'products', docId: x.id, op: 'set' as const, payload: x })),
          ...normalized.ingredients.map(x => ({ collection: 'ingredients', docId: x.id, op: 'set' as const, payload: x })),
          ...normalized.recipes.map(x => ({ collection: 'recipes', docId: x.productId, op: 'set' as const, payload: x })),
          ...normalized.suppliers.map(x => ({ collection: 'suppliers', docId: x.id, op: 'set' as const, payload: x })),
          ...normalized.purchases.map(x => ({ collection: 'purchases', docId: x.id, op: 'set' as const, payload: x })),
          ...normalized.orders.map(x => ({ collection: 'orders', docId: x.id, op: 'set' as const, payload: x })),
          ...normalized.shifts.map(x => ({ collection: 'shifts', docId: x.id, op: 'set' as const, payload: x })),
          ...normalized.cashMovements.map(x => ({ collection: 'cash_movements', docId: x.id, op: 'set' as const, payload: x })),
          ...normalized.stockMovements.map(x => ({ collection: 'stock_movements', docId: x.id, op: 'set' as const, payload: x })),
          ...normalized.audit.map(x => ({ collection: 'audit_logs', docId: x.id, op: 'set' as const, payload: x })),
        ]
        for (let i = 0; i < mutations.length; i += 200) await queueBatch(mutations.slice(i, i + 200))
        await syncNow()
      }
      return true
    },
    [can, currentUser?.role, queueBatch, syncNow, updateStoreData]
  )

  const resetDemo = useCallback(async () => {
    if (!demoMode) return
    const fresh = normalizeAppData(cloneSeed())
    updateStoreData(fresh)
    await saveSnapshot(fresh)
  }, [updateStoreData])

  const value = useMemo<StoreContextValue>(
    () => ({
      data,
      hydrated,
      currentUser,
      online,
      pendingSync,
      syncFailures,
      syncNow,
      retryFailedSync,
      demoMode,
      cloudSyncEnabled,
      loginWithPin,
      loginWithEmail,
      logout,
      can,
      getOpenShift,
      saveOrder,
      updateOrder,
      voidOrder,
      refundOrder,
      openShift,
      closeShift,
      addCashMovement,
      upsertProduct,
      upsertIngredient,
      upsertRecipe,
      upsertSupplier,
      updateRole,
      toggleProduct,
      adjustStock,
      receivePurchase,
      upsertUser,
      toggleUser,
      updatePrinter,
      updateSettings,
      addAudit,
      seedCloudMasterData,
      restoreData,
      resetDemo,
    }),
    [
      data,
      hydrated,
      currentUser,
      online,
      pendingSync,
      syncFailures,
      syncNow,
      retryFailedSync,
      demoMode,
      cloudSyncEnabled,
      loginWithPin,
      loginWithEmail,
      logout,
      can,
      getOpenShift,
      saveOrder,
      updateOrder,
      voidOrder,
      refundOrder,
      openShift,
      closeShift,
      addCashMovement,
      upsertProduct,
      upsertIngredient,
      upsertRecipe,
      upsertSupplier,
      updateRole,
      toggleProduct,
      adjustStock,
      receivePurchase,
      upsertUser,
      toggleUser,
      updatePrinter,
      updateSettings,
      addAudit,
      seedCloudMasterData,
      restoreData,
      resetDemo,
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function usePosStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error('usePosStore must be used inside PosStoreProvider')
  return context
}

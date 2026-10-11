import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseReady = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
export const demoMode = String(import.meta.env.VITE_DEMO_MODE ?? 'true').toLowerCase() !== 'false'
export const cloudSyncEnabled = firebaseReady && !demoMode

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null

if (firebaseReady) {
  app = getApps()[0] ?? initializeApp(config)
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager:persistentMultipleTabManager() }) })
  } catch {
    db = getFirestore(app)
  }
  auth = getAuth(app)
}

export { app, db, auth }

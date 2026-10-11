// Konfigurasi dan Inisialisasi Firebase SDK
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  setDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from "firebase/firestore";

// Konfigurasi Firebase dari Rhezeck POS
export const firebaseConfig = {
  apiKey: "AIzaSyDgmQ5S2ooocSj--DZVmamtJVuklAW_8kg",
  authDomain: "rhezeckpos.firebaseapp.com",
  projectId: "rhezeckpos",
  storageBucket: "rhezeckpos.firebasestorage.app",
  messagingSenderId: "818281968848",
  appId: "1:818281968848:web:8c1bd370f203c38e0ddad5"
};

// Inisialisasi Firebase App
export const app = initializeApp(firebaseConfig);

// Inisialisasi Cloud Firestore
export const db = getFirestore(app);

// State status koneksi cloud
export let isCloudConnected = false;
let cloudListeners = [];

export function subscribeCloudStatus(listener) {
  cloudListeners.push(listener);
  listener(isCloudConnected);
  return () => {
    cloudListeners = cloudListeners.filter(l => l !== listener);
  };
}

function updateCloudStatus(status) {
  isCloudConnected = status;
  cloudListeners.forEach(listener => listener(status));
}

// Uji coba koneksi Firestore dengan timeout
export async function testFirestoreConnection() {
  try {
    const colRef = collection(db, "_healthcheck");
    // Gunakan query sederhana dengan batasan
    await getDocs(colRef);
    updateCloudStatus(true);
    return true;
  } catch (error) {
    console.warn("Koneksi Firestore tidak dapat dihubungi atau aturan akses dibatasi, beralih ke penyimpanan lokal:", error.message);
    updateCloudStatus(false);
    return false;
  }
}

// Helper penyimpanan lokal cadangan
const LOCAL_KEYS = {
  MENUS: 'rhezeck_pos_menus',
  ORDERS: 'rhezeck_pos_orders',
  SETTINGS: 'rhezeck_pos_settings',
  TABLES: 'rhezeck_pos_tables'
};

// =======================
// SERVIS MENU
// =======================
export async function fetchMenusFromCloudOrLocal(defaultMenus = []) {
  try {
    const colRef = collection(db, "menus");
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      const items = [];
      snapshot.forEach(docSnap => items.push({ id: docSnap.id, ...docSnap.data() }));
      localStorage.setItem(LOCAL_KEYS.MENUS, JSON.stringify(items));
      updateCloudStatus(true);
      return items;
    }
  } catch (e) {
    console.warn("Gagal memuat menu dari Cloud Firestore, menggunakan data lokal:", e.message);
    updateCloudStatus(false);
  }

  // Fallback ke LocalStorage atau Default Menu
  const local = localStorage.getItem(LOCAL_KEYS.MENUS);
  if (local) {
    try {
      return JSON.parse(local);
    } catch (_) {}
  }

  // Simpan data awal ke local
  localStorage.setItem(LOCAL_KEYS.MENUS, JSON.stringify(defaultMenus));
  return defaultMenus;
}

export async function saveMenuToCloudOrLocal(menuItem) {
  let savedItem = { ...menuItem };
  
  // Coba simpan ke Firestore jika ada koneksi
  try {
    if (menuItem.id && !menuItem.id.startsWith('local_')) {
      const docRef = doc(db, "menus", menuItem.id);
      await setDoc(docRef, menuItem, { merge: true });
      updateCloudStatus(true);
    } else {
      const colRef = collection(db, "menus");
      const docRef = await addDoc(colRef, { ...menuItem, createdAt: serverTimestamp() });
      savedItem.id = docRef.id;
      updateCloudStatus(true);
    }
  } catch (e) {
    console.warn("Simpan menu ke cloud gagal, menyimpan lokal:", e.message);
    updateCloudStatus(false);
    if (!savedItem.id) {
      savedItem.id = 'local_' + Date.now();
    }
  }

  // Sinkronkan ke local storage
  const current = JSON.parse(localStorage.getItem(LOCAL_KEYS.MENUS) || '[]');
  const idx = current.findIndex(m => m.id === savedItem.id);
  if (idx >= 0) {
    current[idx] = savedItem;
  } else {
    current.push(savedItem);
  }
  localStorage.setItem(LOCAL_KEYS.MENUS, JSON.stringify(current));
  return savedItem;
}

export async function deleteMenuFromCloudOrLocal(menuId) {
  try {
    if (!menuId.startsWith('local_')) {
      await deleteDoc(doc(db, "menus", menuId));
      updateCloudStatus(true);
    }
  } catch (e) {
    console.warn("Hapus menu di cloud gagal, menghapus lokal saja:", e.message);
    updateCloudStatus(false);
  }

  const current = JSON.parse(localStorage.getItem(LOCAL_KEYS.MENUS) || '[]');
  const updated = current.filter(m => m.id !== menuId);
  localStorage.setItem(LOCAL_KEYS.MENUS, JSON.stringify(updated));
  return true;
}

// =======================
// SERVIS TRANSAKSI / PESANAN
// =======================
export async function fetchOrdersFromCloudOrLocal() {
  try {
    const colRef = collection(db, "orders");
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const orders = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        orders.push({
          id: docSnap.id,
          ...data,
          // Tangani timestamp Firestore
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
        });
      });
      localStorage.setItem(LOCAL_KEYS.ORDERS, JSON.stringify(orders));
      updateCloudStatus(true);
      return orders;
    }
  } catch (e) {
    console.warn("Gagal memuat pesanan dari cloud:", e.message);
    updateCloudStatus(false);
  }

  const local = localStorage.getItem(LOCAL_KEYS.ORDERS);
  return local ? JSON.parse(local) : [];
}

export async function saveOrderToCloudOrLocal(order) {
  const orderData = {
    ...order,
    createdAt: new Date().toISOString()
  };

  try {
    const colRef = collection(db, "orders");
    const docRef = await addDoc(colRef, {
      ...orderData,
      firestoreTimestamp: serverTimestamp()
    });
    orderData.id = docRef.id;
    updateCloudStatus(true);
  } catch (e) {
    console.warn("Simpan order ke cloud gagal, simpan ke lokal:", e.message);
    updateCloudStatus(false);
    if (!orderData.id) {
      orderData.id = 'ORD-' + Date.now();
    }
  }

  const current = JSON.parse(localStorage.getItem(LOCAL_KEYS.ORDERS) || '[]');
  current.unshift(orderData);
  localStorage.setItem(LOCAL_KEYS.ORDERS, JSON.stringify(current));
  return orderData;
}

export async function updateOrderStatus(orderId, status) {
  try {
    if (!orderId.startsWith('ORD-')) {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, { status: status });
      updateCloudStatus(true);
    }
  } catch (e) {
    console.warn("Gagal update status pesanan di cloud:", e.message);
    updateCloudStatus(false);
  }

  const current = JSON.parse(localStorage.getItem(LOCAL_KEYS.ORDERS) || '[]');
  const idx = current.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    current[idx].status = status;
    localStorage.setItem(LOCAL_KEYS.ORDERS, JSON.stringify(current));
  }
}

// =======================
// SERVIS PENGATURAN TOKO
// =======================
export function getSavedSettings(defaultSettings) {
  const local = localStorage.getItem(LOCAL_KEYS.SETTINGS);
  if (local) {
    try {
      return { ...defaultSettings, ...JSON.parse(local) };
    } catch (_) {}
  }
  return defaultSettings;
}

export async function saveSettings(settings) {
  localStorage.setItem(LOCAL_KEYS.SETTINGS, JSON.stringify(settings));
  try {
    const docRef = doc(db, "settings", "general");
    await setDoc(docRef, settings, { merge: true });
    updateCloudStatus(true);
  } catch (e) {
    console.warn("Gagal simpan pengaturan ke cloud:", e.message);
    updateCloudStatus(false);
  }
}

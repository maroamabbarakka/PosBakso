// State Management Terpusat untuk Rhezeck POS Bakso

import { 
  DEFAULT_MENUS, 
  DEFAULT_TABLES, 
  DEFAULT_SETTINGS 
} from './data/defaultMenu.js';
import { 
  fetchMenusFromCloudOrLocal, 
  saveMenuToCloudOrLocal, 
  deleteMenuFromCloudOrLocal,
  fetchOrdersFromCloudOrLocal,
  saveOrderToCloudOrLocal,
  updateOrderStatus as updateFirebaseOrderStatus,
  getSavedSettings,
  saveSettings as persistSettings,
  testFirestoreConnection,
  subscribeCloudStatus
} from './firebase.js';
import { playBeep, playRemove, playSuccess } from './audio.js';

// State global
export const state = {
  currentTab: 'pos', // 'pos' | 'orders' | 'tables' | 'menu' | 'reports' | 'settings'
  searchQuery: '',
  selectedCategory: 'all',
  
  // Data Master
  menus: [],
  tables: [...DEFAULT_TABLES],
  orders: [],
  settings: { ...DEFAULT_SETTINGS },
  
  // Keranjang Kasir Aktif
  cart: {
    items: [], // { id, menuId, name, price, qty, notes, spicyLevel }
    orderType: 'dine_in', // 'dine_in' | 'takeaway' | 'delivery'
    tableNumber: 1,
    customerName: '',
    discountType: 'percent', // 'percent' | 'nominal'
    discountValue: 0,
    paymentMethod: 'cash', // 'cash' | 'qris' | 'debit'
    cashGiven: 0,
    notes: ''
  },
  
  // State UI
  isCheckoutModalOpen: false,
  isReceiptModalOpen: false,
  currentReceiptOrder: null,
  isEditMenuModalOpen: false,
  editingMenu: null,
  isCloudOnline: false,
  isDarkMode: localStorage.getItem('pos_dark_mode') === 'true'
};

// Event listeners untuk reaktivitas
const listeners = [];

export function subscribeState(listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

export function notifyStateChange() {
  listeners.forEach(fn => fn(state));
}

// Inisialisasi awal Store
export async function initStore() {
  // Ambil pengaturan
  state.settings = getSavedSettings(DEFAULT_SETTINGS);
  
  // Periksa tema gelap
  if (state.isDarkMode) {
    document.documentElement.classList.add('dark');
  }

  // Subscribe status cloud
  subscribeCloudStatus(status => {
    state.isCloudOnline = status;
    notifyStateChange();
  });

  // Uji koneksi Firestore
  testFirestoreConnection();

  // Muat Menu
  state.menus = await fetchMenusFromCloudOrLocal(DEFAULT_MENUS);
  
  // Muat Meja dari local
  const savedTables = localStorage.getItem('rhezeck_pos_tables');
  if (savedTables) {
    try {
      state.tables = JSON.parse(savedTables);
    } catch (_) {}
  }

  // Muat Orders
  state.orders = await fetchOrdersFromCloudOrLocal();

  notifyStateChange();
}

// ==========================
// AKSI KERANJANG KASIR (CART)
// ==========================

export function addToCart(menuItem, options = {}) {
  const existingIndex = state.cart.items.findIndex(item => 
    item.menuId === menuItem.id && 
    (item.notes || '') === (options.notes || '')
  );

  if (existingIndex > -1) {
    state.cart.items[existingIndex].qty += 1;
  } else {
    state.cart.items.push({
      cartItemId: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      menuId: menuItem.id,
      code: menuItem.code,
      name: menuItem.name,
      price: menuItem.price,
      cost: menuItem.cost || 0,
      image: menuItem.image || '',
      qty: 1,
      notes: options.notes || '',
      spicyLevel: options.spicyLevel || (menuItem.isSpicy ? 'Sedang' : 'Normal')
    });
  }

  playBeep();
  notifyStateChange();
}

export function updateCartQty(cartItemId, delta) {
  const itemIndex = state.cart.items.findIndex(i => i.cartItemId === cartItemId);
  if (itemIndex === -1) return;

  const newQty = state.cart.items[itemIndex].qty + delta;
  if (newQty <= 0) {
    state.cart.items.splice(itemIndex, 1);
    playRemove();
  } else {
    state.cart.items[itemIndex].qty = newQty;
    if (delta > 0) playBeep();
    else playRemove();
  }
  notifyStateChange();
}

export function updateCartItemNotes(cartItemId, notes) {
  const item = state.cart.items.find(i => i.cartItemId === cartItemId);
  if (item) {
    item.notes = notes;
    notifyStateChange();
  }
}

export function removeCartItem(cartItemId) {
  state.cart.items = state.cart.items.filter(i => i.cartItemId !== cartItemId);
  playRemove();
  notifyStateChange();
}

export function clearCart() {
  state.cart.items = [];
  state.cart.discountValue = 0;
  state.cart.customerName = '';
  state.cart.cashGiven = 0;
  state.cart.notes = '';
  notifyStateChange();
}

export function setCartOrderType(type) {
  state.cart.orderType = type;
  notifyStateChange();
}

export function setCartTableNumber(tableNum) {
  state.cart.tableNumber = parseInt(tableNum, 10);
  notifyStateChange();
}

export function setCartCustomerName(name) {
  state.cart.customerName = name;
  notifyStateChange();
}

export function setCartDiscount(type, val) {
  state.cart.discountType = type;
  state.cart.discountValue = Math.max(0, Number(val) || 0);
  notifyStateChange();
}

// Perhitungan Nilai Keranjang
export function getCartTotals() {
  const subtotal = state.cart.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  let discountAmount = 0;
  if (state.cart.discountType === 'percent') {
    discountAmount = Math.round((subtotal * Math.min(100, state.cart.discountValue)) / 100);
  } else {
    discountAmount = Math.min(subtotal, state.cart.discountValue);
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = state.settings.taxEnabled 
    ? Math.round((taxableAmount * state.settings.taxPercent) / 100) 
    : 0;

  const grandTotal = taxableAmount + taxAmount;
  const cashGiven = state.cart.cashGiven || 0;
  const change = Math.max(0, cashGiven - grandTotal);
  const isSufficient = cashGiven >= grandTotal;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    grandTotal,
    cashGiven,
    change,
    isSufficient,
    totalQty: state.cart.items.reduce((sum, item) => sum + item.qty, 0)
  };
}

// Selesaikan Pembayaran Transaksi
export async function completeOrder(paymentDetails = {}) {
  const totals = getCartTotals();
  if (state.cart.items.length === 0) return null;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `BK-${dateStr}-${randomSuffix}`;

  const newOrder = {
    orderNumber,
    items: [...state.cart.items],
    orderType: state.cart.orderType,
    tableNumber: state.cart.orderType === 'dine_in' ? state.cart.tableNumber : null,
    customerName: state.cart.customerName || 'Pelanggan',
    cashierName: state.settings.cashierName || 'Kasir',
    paymentMethod: paymentDetails.method || state.cart.paymentMethod,
    cashGiven: paymentDetails.cashGiven || totals.cashGiven,
    change: paymentDetails.change !== undefined ? paymentDetails.change : totals.change,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    discountType: state.cart.discountType,
    discountValue: state.cart.discountValue,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
    totalQty: totals.totalQty,
    status: 'paid', // 'paid' | 'completed' | 'cancelled'
    notes: state.cart.notes || '',
    createdAt: now.toISOString()
  };

  // Simpan ke database / local
  const savedOrder = await saveOrderToCloudOrLocal(newOrder);
  state.orders.unshift(savedOrder);

  // Update status meja jika dine in
  if (newOrder.orderType === 'dine_in' && newOrder.tableNumber) {
    const table = state.tables.find(t => t.number === newOrder.tableNumber);
    if (table) {
      table.status = 'occupied';
      table.orderId = savedOrder.id;
      table.totalAmount = newOrder.grandTotal;
      table.occupiedSince = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem('rhezeck_pos_tables', JSON.stringify(state.tables));
    }
  }

  // Kurangi stok menu jika dilacak
  state.cart.items.forEach(cItem => {
    const menu = state.menus.find(m => m.id === cItem.menuId);
    if (menu && menu.stock !== undefined) {
      menu.stock = Math.max(0, menu.stock - cItem.qty);
      saveMenuToCloudOrLocal(menu);
    }
  });

  playSuccess();
  clearCart();

  // Buka Modal Struk untuk order ini
  state.currentReceiptOrder = savedOrder;
  state.isReceiptModalOpen = true;
  state.isCheckoutModalOpen = false;

  notifyStateChange();
  return savedOrder;
}

// Bersihkan meja selesai makan
export function clearTable(tableNumber) {
  const table = state.tables.find(t => t.number === tableNumber);
  if (table) {
    table.status = 'empty';
    table.orderId = null;
    table.totalAmount = 0;
    table.occupiedSince = null;
    localStorage.setItem('rhezeck_pos_tables', JSON.stringify(state.tables));
    notifyStateChange();
  }
}

// Beralih Tab
export function setActiveTab(tab) {
  state.currentTab = tab;
  notifyStateChange();
}

// Toggle Tema Gelap
export function toggleDarkMode() {
  state.isDarkMode = !state.isDarkMode;
  if (state.isDarkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('pos_dark_mode', state.isDarkMode ? 'true' : 'false');
  notifyStateChange();
}

// Kelola Menu CRUD
export async function addOrUpdateMenu(menuData) {
  const saved = await saveMenuToCloudOrLocal(menuData);
  const idx = state.menus.findIndex(m => m.id === saved.id);
  if (idx > -1) {
    state.menus[idx] = saved;
  } else {
    state.menus.push(saved);
  }
  notifyStateChange();
  return saved;
}

export async function deleteMenu(menuId) {
  await deleteMenuFromCloudOrLocal(menuId);
  state.menus = state.menus.filter(m => m.id !== menuId);
  notifyStateChange();
}

// Simpan Pengaturan
export async function updateSettings(newSettings) {
  state.settings = { ...state.settings, ...newSettings };
  await persistSettings(state.settings);
  notifyStateChange();
}

// Update Status Pesanan (Lunas / Batal)
export async function updateOrderStatus(orderId, status) {
  await updateFirebaseOrderStatus(orderId, status);
  const order = state.orders.find(o => o.id === orderId);
  if (order) {
    order.status = status;
  }
  notifyStateChange();
}


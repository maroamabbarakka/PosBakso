// Komponen Tampilan Kasir (POS View)

import { 
  state, 
  addToCart, 
  updateCartQty, 
  removeCartItem, 
  clearCart, 
  setCartOrderType, 
  setCartTableNumber, 
  setCartCustomerName,
  setCartDiscount,
  getCartTotals
} from '../store.js';
import { MENU_CATEGORIES } from '../data/defaultMenu.js';

export function renderPosView() {
  const totals = getCartTotals();
  
  // Filter menu berdasarkan kategori & pencarian
  const filteredMenus = state.menus.filter(item => {
    if (!item.isActive) return false;
    const matchCat = state.selectedCategory === 'all' || item.category === state.selectedCategory;
    const q = state.searchQuery.toLowerCase().trim();
    const matchQuery = !q || 
      item.name.toLowerCase().includes(q) || 
      (item.code && item.code.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q));
    return matchCat && matchQuery;
  });

  return `
    <div class="pos-layout">
      <!-- KOLOM KIRI: KATALOG MENU -->
      <section class="pos-menu-catalog">
        <div class="catalog-header-bar">
          <div class="catalog-search-row">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input 
                type="text" 
                class="search-input" 
                id="pos-search-input" 
                placeholder="Cari menu bakso, minuman, atau kode (BK-01)..."
                value="${escapeHtml(state.searchQuery)}"
              />
            </div>
          </div>

          <!-- Kategori Tabs -->
          <div class="category-chips-list">
            ${MENU_CATEGORIES.map(cat => `
              <button 
                class="category-chip ${state.selectedCategory === cat.id ? 'active' : ''}" 
                data-category="${cat.id}">
                <span>${cat.icon}</span> ${cat.name}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Grid Menu Cards -->
        <div class="menu-grid-container">
          ${filteredMenus.length === 0 ? `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🍲</div>
              <p>Menu tidak ditemukan untuk kata kunci tersebut.</p>
            </div>
          ` : filteredMenus.map(menu => `
            <div class="menu-card" data-menu-id="${menu.id}">
              <div class="menu-card-img-wrapper">
                ${menu.image ? `
                  <img src="${menu.image}" alt="${escapeHtml(menu.name)}" class="menu-card-img" loading="lazy" />
                ` : `
                  <div class="menu-card-placeholder">
                    ${menu.category === 'minuman' ? '🥤' : (menu.category === 'topping' ? '🥟' : '🍲')}
                  </div>
                `}
                <div class="menu-badge-container">
                  ${menu.isBestSeller ? `<span class="badge-tag bestseller">⭐ Favorit</span>` : ''}
                  ${menu.isSpicy ? `<span class="badge-tag spicy">🌶️ Pedas</span>` : ''}
                </div>
              </div>

              <div class="menu-card-body">
                <span class="menu-card-code">${escapeHtml(menu.code || 'MENU')}</span>
                <h3 class="menu-card-title">${escapeHtml(menu.name)}</h3>
                <p class="menu-card-desc">${escapeHtml(menu.description || '')}</p>
                
                <div class="menu-card-footer">
                  <span class="menu-card-price">${formatRupiah(menu.price)}</span>
                  <button class="menu-add-btn" title="Tambah ke keranjang" data-add-id="${menu.id}">+</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- KOLOM KANAN: PANEL BILLING & KERANJANG -->
      <aside class="pos-billing-panel">
        <div class="billing-header">
          <div class="billing-title-row">
            <h2><span>🛒</span> Pesanan Kasir</h2>
            ${state.cart.items.length > 0 ? `
              <button class="clear-cart-btn" id="btn-clear-cart">Reset</button>
            ` : ''}
          </div>

          <!-- Tipe Order: Dine In / Takeaway / Delivery -->
          <div class="order-type-selector">
            <button class="type-btn ${state.cart.orderType === 'dine_in' ? 'active' : ''}" data-type="dine_in">
              Makan Sini
            </button>
            <button class="type-btn ${state.cart.orderType === 'takeaway' ? 'active' : ''}" data-type="takeaway">
              Bungkus
            </button>
            <button class="type-btn ${state.cart.orderType === 'delivery' ? 'active' : ''}" data-type="delivery">
              Kirim
            </button>
          </div>

          <!-- Meta Meja & Pelanggan -->
          <div class="order-meta-row">
            ${state.cart.orderType === 'dine_in' ? `
              <select class="order-meta-select" id="cart-table-select" title="Pilih Nomor Meja">
                ${state.tables.map(t => `
                  <option value="${t.number}" ${state.cart.tableNumber === t.number ? 'selected' : ''}>
                    Meja ${t.number} ${t.status === 'occupied' ? '(Terisi)' : ''}
                  </option>
                `).join('')}
              </select>
            ` : ''}
            <input 
              type="text" 
              class="order-meta-input" 
              id="cart-customer-name" 
              placeholder="Nama Pemesan (Opsional)..."
              value="${escapeHtml(state.cart.customerName)}"
            />
          </div>
        </div>

        <!-- Daftar Item Keranjang -->
        <div class="cart-items-container">
          ${state.cart.items.length === 0 ? `
            <div class="cart-empty-state">
              <div class="icon">🛒</div>
              <p>Keranjang masih kosong</p>
              <small>Klik menu di samping untuk menambahkan</small>
            </div>
          ` : state.cart.items.map(item => `
            <div class="cart-item-card" data-cart-id="${item.cartItemId}">
              <div class="cart-item-main">
                <div class="cart-item-info">
                  <div class="cart-item-name">${escapeHtml(item.name)}</div>
                  <div class="cart-item-unit-price">${formatRupiah(item.price)} x ${item.qty}</div>
                  ${item.notes ? `
                    <div style="font-size: 0.72rem; color: var(--primary); margin-top: 2px;">
                      📝 "${escapeHtml(item.notes)}"
                    </div>
                  ` : ''}
                </div>
                <div class="cart-item-subtotal">
                  ${formatRupiah(item.price * item.qty)}
                </div>
              </div>

              <div class="cart-item-controls">
                <div class="qty-counter">
                  <button class="qty-btn" data-qty-dec="${item.cartItemId}">-</button>
                  <span class="qty-val">${item.qty}</span>
                  <button class="qty-btn" data-qty-inc="${item.cartItemId}">+</button>
                </div>
                <button class="cart-item-notes-btn" data-add-note="${item.cartItemId}">
                  ${item.notes ? 'Ubah Catatan' : '+ Catatan'}
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Ringkasan & Tombol Bayar -->
        <div class="billing-summary-footer">
          <div class="summary-row">
            <span>Subtotal (${totals.totalQty} item)</span>
            <span>${formatRupiah(totals.subtotal)}</span>
          </div>

          <!-- Diskon -->
          <div class="summary-row" style="align-items: center;">
            <span style="display: flex; align-items: center; gap: 4px;">
              Diskon
              <select id="discount-type-select" style="font-size: 0.72rem; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--border-color);">
                <option value="percent" ${state.cart.discountType === 'percent' ? 'selected' : ''}>%</option>
                <option value="nominal" ${state.cart.discountType === 'nominal' ? 'selected' : ''}>Rp</option>
              </select>
            </span>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input 
                type="number" 
                id="discount-val-input" 
                value="${state.cart.discountValue || 0}" 
                min="0"
                style="width: 60px; text-align: right; padding: 2px 4px; font-size: 0.75rem; border: 1px solid var(--border-color); border-radius: 4px;"
              />
              <span style="color: var(--primary); font-weight: 700;">-${formatRupiah(totals.discountAmount)}</span>
            </div>
          </div>

          ${state.settings.taxEnabled ? `
            <div class="summary-row">
              <span>Pajak Resto (${state.settings.taxPercent}%)</span>
              <span>+${formatRupiah(totals.taxAmount)}</span>
            </div>
          ` : ''}

          <div class="summary-row total-row">
            <span>Total Tagihan</span>
            <span class="grand-total-val">${formatRupiah(totals.grandTotal)}</span>
          </div>

          <button 
            class="checkout-btn" 
            id="btn-open-checkout"
            ${state.cart.items.length === 0 ? 'disabled' : ''}>
            <span>⚡</span> BAYAR SEKARANG (${formatRupiah(totals.grandTotal)})
          </button>
        </div>
      </aside>
    </div>
  `;
}

export function initPosViewEvents() {
  // Input search
  const searchInput = document.getElementById('pos-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      // Re-render konten katalog saja untuk performa lancar
      const container = document.querySelector('.menu-grid-container');
      if (container) {
        const filteredMenus = state.menus.filter(item => {
          if (!item.isActive) return false;
          const matchCat = state.selectedCategory === 'all' || item.category === state.selectedCategory;
          const q = state.searchQuery.toLowerCase().trim();
          return matchCat && (!q || item.name.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q)));
        });
        container.innerHTML = filteredMenus.map(menu => renderMenuCardHtml(menu)).join('');
        bindMenuCardClicks();
      }
    });
  }

  // Filter Kategori Chips
  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.selectedCategory = chip.dataset.category;
      document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      
      const searchInput = document.getElementById('pos-search-input');
      const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const container = document.querySelector('.menu-grid-container');
      if (container) {
        const filtered = state.menus.filter(item => {
          if (!item.isActive) return false;
          const matchCat = state.selectedCategory === 'all' || item.category === state.selectedCategory;
          return matchCat && (!q || item.name.toLowerCase().includes(q) || (item.code && item.code.toLowerCase().includes(q)));
        });
        container.innerHTML = filtered.map(menu => renderMenuCardHtml(menu)).join('');
        bindMenuCardClicks();
      }
    });
  });

  // Klik Menu Card atau Tombol Tambah
  bindMenuCardClicks();

  // Reset Cart
  const clearBtn = document.getElementById('btn-clear-cart');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Yakin ingin mengosongkan keranjang?')) {
        clearCart();
      }
    });
  }

  // Tipe Order Buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setCartOrderType(btn.dataset.type);
    });
  });

  // Meja Select
  const tableSelect = document.getElementById('cart-table-select');
  if (tableSelect) {
    tableSelect.addEventListener('change', (e) => {
      setCartTableNumber(e.target.value);
    });
  }

  // Customer Name
  const custNameInput = document.getElementById('cart-customer-name');
  if (custNameInput) {
    custNameInput.addEventListener('input', (e) => {
      setCartCustomerName(e.target.value);
    });
  }

  // Diskon inputs
  const discType = document.getElementById('discount-type-select');
  const discVal = document.getElementById('discount-val-input');
  if (discType && discVal) {
    discType.addEventListener('change', () => {
      setCartDiscount(discType.value, discVal.value);
    });
    discVal.addEventListener('change', () => {
      setCartDiscount(discType.value, discVal.value);
    });
  }

  // Qty Increment / Decrement
  document.querySelectorAll('[data-qty-inc]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateCartQty(btn.dataset.qtyInc, 1);
    });
  });
  document.querySelectorAll('[data-qty-dec]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateCartQty(btn.dataset.qtyDec, -1);
    });
  });

  // Catatan Khusus Item
  document.querySelectorAll('[data-add-note]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cartItemId = btn.dataset.addNote;
      const item = state.cart.items.find(i => i.cartItemId === cartItemId);
      if (!item) return;
      const note = prompt(`Tambahkan catatan untuk ${item.name} (contoh: Kuah pedas, Tanpa bawang, Bihun saja):`, item.notes || '');
      if (note !== null) {
        item.notes = note;
        const noteBtn = btn;
        noteBtn.textContent = note ? 'Ubah Catatan' : '+ Catatan';
        // Trigger update
        clearCart; // trigger
      }
    });
  });

  // Tombol Buka Checkout Modal
  const checkoutBtn = document.getElementById('btn-open-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      state.isCheckoutModalOpen = true;
      const modal = document.getElementById('checkout-modal');
      if (modal) modal.classList.add('active');
    });
  }
}

function bindMenuCardClicks() {
  document.querySelectorAll('.menu-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const menuId = card.dataset.menuId;
      const menu = state.menus.find(m => m.id === menuId);
      if (menu) addToCart(menu);
    });
  });
}

function renderMenuCardHtml(menu) {
  return `
    <div class="menu-card" data-menu-id="${menu.id}">
      <div class="menu-card-img-wrapper">
        ${menu.image ? `
          <img src="${menu.image}" alt="${escapeHtml(menu.name)}" class="menu-card-img" loading="lazy" />
        ` : `
          <div class="menu-card-placeholder">
            ${menu.category === 'minuman' ? '🥤' : (menu.category === 'topping' ? '🥟' : '🍲')}
          </div>
        `}
        <div class="menu-badge-container">
          ${menu.isBestSeller ? `<span class="badge-tag bestseller">⭐ Favorit</span>` : ''}
          ${menu.isSpicy ? `<span class="badge-tag spicy">🌶️ Pedas</span>` : ''}
        </div>
      </div>

      <div class="menu-card-body">
        <span class="menu-card-code">${escapeHtml(menu.code || 'MENU')}</span>
        <h3 class="menu-card-title">${escapeHtml(menu.name)}</h3>
        <p class="menu-card-desc">${escapeHtml(menu.description || '')}</p>
        
        <div class="menu-card-footer">
          <span class="menu-card-price">${formatRupiah(menu.price)}</span>
          <button class="menu-add-btn" title="Tambah ke keranjang" data-add-id="${menu.id}">+</button>
        </div>
      </div>
    </div>
  `;
}

export function formatRupiah(val) {
  return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Komponen Pengelolaan Menu (CRUD Menu & Stok)

import { state, addOrUpdateMenu, deleteMenu } from '../store.js';
import { formatRupiah } from './posView.js';

let activeCategoryFilter = 'all';

export function renderMenuManagerView() {
  const filtered = state.menus.filter(m => {
    if (activeCategoryFilter === 'all') return true;
    return m.category === activeCategoryFilter;
  });

  return `
    <div class="content-pane-container">
      <div class="pane-header-title">
        <div>
          <h2>Katalog & Manajemen Menu</h2>
          <p>Tambah menu baru, atur harga jual, kelola stok, dan varian bakso</p>
        </div>
        <button class="checkout-btn" id="btn-add-new-menu" style="width: auto; padding: 0.6rem 1.25rem;">
          <span>➕</span> Tambah Menu Baru
        </button>
      </div>

      <!-- Tabel Daftar Menu -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Kode</th>
              <th>Nama Menu</th>
              <th>Kategori</th>
              <th>Harga Jual</th>
              <th>Harga Modal</th>
              <th>Stok</th>
              <th>Status</th>
              <th style="text-align: right;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(menu => `
              <tr>
                <td>
                  <div style="width: 44px; height: 44px; border-radius: 8px; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center;">
                    ${menu.image ? `
                      <img src="${menu.image}" style="width: 100%; height: 100%; object-fit: cover;" />
                    ` : `
                      <span style="font-size: 1.3rem;">${menu.category === 'minuman' ? '🥤' : '🍲'}</span>
                    `}
                  </div>
                </td>
                <td style="font-weight: 700; color: var(--text-muted);">${escapeHtml(menu.code || '-')}</td>
                <td>
                  <div style="font-weight: 700;">${escapeHtml(menu.name)}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                    ${escapeHtml(menu.description || '')}
                  </div>
                </td>
                <td style="text-transform: capitalize;">${escapeHtml(menu.category)}</td>
                <td style="font-weight: 800; color: var(--primary);">${formatRupiah(menu.price)}</td>
                <td style="color: var(--text-muted);">${formatRupiah(menu.cost || 0)}</td>
                <td>
                  <span style="font-weight: 700; ${menu.stock <= 5 ? 'color: var(--danger);' : ''}">
                    ${menu.stock || 0}
                  </span>
                </td>
                <td>
                  <span style="padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; ${menu.isActive ? 'background: var(--success-light); color: var(--success);' : 'background: #fee2e2; color: #dc2626;'}">
                    ${menu.isActive ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button class="quick-cash-btn" style="padding: 4px 8px;" data-edit-menu="${menu.id}">
                    ✏️ Edit
                  </button>
                  <button class="quick-cash-btn" style="padding: 4px 8px; color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" data-delete-menu="${menu.id}">
                    🗑️
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Modal Form Tambah / Edit Menu -->
      <div class="modal-overlay ${state.isEditMenuModalOpen ? 'active' : ''}" id="menu-form-modal">
        <div class="modal-card" style="max-width: 480px;">
          <div class="modal-header">
            <h3><span>🍲</span> ${state.editingMenu ? 'Edit Menu Bakso' : 'Tambah Menu Baru'}</h3>
            <button class="modal-close-btn" id="close-menu-form-modal">&times;</button>
          </div>
          <form id="menu-edit-form" class="modal-body">
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Nama Menu</label>
              <input type="text" id="form-menu-name" class="order-meta-input" style="width: 100%;" required placeholder="Contoh: Bakso Urat Beranak" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Kode Menu</label>
                <input type="text" id="form-menu-code" class="order-meta-input" style="width: 100%;" placeholder="Contoh: BK-08" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Kategori</label>
                <select id="form-menu-category" class="order-meta-input" style="width: 100%;">
                  <option value="bakso">Bakso Kuah</option>
                  <option value="paket">Paket Komplit</option>
                  <option value="topping">Topping & Pelengkap</option>
                  <option value="minuman">Minuman</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Harga Jual (Rp)</label>
                <input type="number" id="form-menu-price" class="order-meta-input" style="width: 100%;" required step="1000" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Harga Modal (Rp)</label>
                <input type="number" id="form-menu-cost" class="order-meta-input" style="width: 100%;" step="1000" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Stok Tersedia</label>
                <input type="number" id="form-menu-stock" class="order-meta-input" style="width: 100%;" value="50" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">URL Foto Menu</label>
                <input type="text" id="form-menu-image" class="order-meta-input" style="width: 100%;" placeholder="/images/bakso_urat.jpg" />
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Deskripsi Menu</label>
              <textarea id="form-menu-desc" class="order-meta-input" style="width: 100%; min-height: 60px;" placeholder="Isi daging, mie, kuah gurih..."></textarea>
            </div>

            <div style="display: flex; gap: 1rem; align-items: center;">
              <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; cursor: pointer;">
                <input type="checkbox" id="form-menu-bestseller" /> Menu Favorit (Best Seller)
              </label>
              <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; cursor: pointer;">
                <input type="checkbox" id="form-menu-spicy" /> Rasa Pedas
              </label>
            </div>

            <button type="submit" class="checkout-btn" style="margin-top: 0.5rem;">
              <span>💾</span> Simpan Menu
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function initMenuManagerViewEvents() {
  // Tombol Tambah Menu Baru
  const addBtn = document.getElementById('btn-add-new-menu');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      state.editingMenu = null;
      state.isEditMenuModalOpen = true;
      openMenuModal();
    });
  }

  // Tutup Modal Form
  const closeBtn = document.getElementById('close-menu-form-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      state.isEditMenuModalOpen = false;
      const modal = document.getElementById('menu-form-modal');
      if (modal) modal.classList.remove('active');
    });
  }

  // Edit Menu
  document.querySelectorAll('[data-edit-menu]').forEach(btn => {
    btn.addEventListener('click', () => {
      const menuId = btn.dataset.editMenu;
      const menu = state.menus.find(m => m.id === menuId);
      if (menu) {
        state.editingMenu = menu;
        state.isEditMenuModalOpen = true;
        openMenuModal(menu);
      }
    });
  });

  // Hapus Menu
  document.querySelectorAll('[data-delete-menu]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const menuId = btn.dataset.deleteMenu;
      if (confirm('Hapus menu ini dari katalog?')) {
        await deleteMenu(menuId);
        const pane = document.getElementById('view-menu');
        if (pane) {
          pane.innerHTML = renderMenuManagerView();
          initMenuManagerViewEvents();
        }
      }
    });
  });

  // Submit Form
  const form = document.getElementById('menu-edit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('form-menu-name').value;
      const code = document.getElementById('form-menu-code').value;
      const category = document.getElementById('form-menu-category').value;
      const price = Number(document.getElementById('form-menu-price').value);
      const cost = Number(document.getElementById('form-menu-cost').value);
      const stock = Number(document.getElementById('form-menu-stock').value);
      const image = document.getElementById('form-menu-image').value;
      const description = document.getElementById('form-menu-desc').value;
      const isBestSeller = document.getElementById('form-menu-bestseller').checked;
      const isSpicy = document.getElementById('form-menu-spicy').checked;

      const payload = {
        id: state.editingMenu ? state.editingMenu.id : undefined,
        name,
        code,
        category,
        price,
        cost,
        stock,
        image,
        description,
        isBestSeller,
        isSpicy,
        isActive: true
      };

      await addOrUpdateMenu(payload);
      state.isEditMenuModalOpen = false;
      const modal = document.getElementById('menu-form-modal');
      if (modal) modal.classList.remove('active');

      const pane = document.getElementById('view-menu');
      if (pane) {
        pane.innerHTML = renderMenuManagerView();
        initMenuManagerViewEvents();
      }
    });
  }
}

function openMenuModal(menu = null) {
  const modal = document.getElementById('menu-form-modal');
  if (!modal) return;
  modal.classList.add('active');

  document.getElementById('form-menu-name').value = menu ? menu.name : '';
  document.getElementById('form-menu-code').value = menu ? menu.code : '';
  document.getElementById('form-menu-category').value = menu ? menu.category : 'bakso';
  document.getElementById('form-menu-price').value = menu ? menu.price : '';
  document.getElementById('form-menu-cost').value = menu ? (menu.cost || '') : '';
  document.getElementById('form-menu-stock').value = menu ? (menu.stock !== undefined ? menu.stock : 50) : 50;
  document.getElementById('form-menu-image').value = menu ? (menu.image || '') : '';
  document.getElementById('form-menu-desc').value = menu ? (menu.description || '') : '';
  document.getElementById('form-menu-bestseller').checked = menu ? !!menu.isBestSeller : false;
  document.getElementById('form-menu-spicy').checked = menu ? !!menu.isSpicy : false;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

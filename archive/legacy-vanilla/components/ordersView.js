// Komponen Riwayat Pesanan & Transaksi

import { state, updateOrderStatus } from '../store.js';
import { formatRupiah } from './posView.js';
import { renderReceiptModal, initReceiptModalEvents } from './receiptModal.js';

let orderStatusFilter = 'all';

export function renderOrdersView() {
  const filteredOrders = state.orders.filter(order => {
    if (orderStatusFilter === 'all') return true;
    return order.status === orderStatusFilter;
  });

  const totalOmzet = state.orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

  return `
    <div class="content-pane-container">
      <div class="pane-header-title">
        <div>
          <h2>Riwayat Pesanan & Transaksi</h2>
          <p>Daftar seluruh nota penjualan yang tercatat di sistem kasir & cloud</p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="filter-order-status" class="order-meta-input" style="padding: 0.5rem 0.75rem;">
            <option value="all" ${orderStatusFilter === 'all' ? 'selected' : ''}>Semua Status</option>
            <option value="paid" ${orderStatusFilter === 'paid' ? 'selected' : ''}>Lunas / Sukses</option>
            <option value="cancelled" ${orderStatusFilter === 'cancelled' ? 'selected' : ''}>Dibatalkan</option>
          </select>
        </div>
      </div>

      <!-- Ringkasan Singkat -->
      <div class="stats-cards-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background: var(--primary-light); color: var(--primary);">🧾</div>
          <div>
            <div class="stat-val">${state.orders.length}</div>
            <div class="stat-label">Total Transaksi</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: var(--success-light); color: var(--success);">💰</div>
          <div>
            <div class="stat-val">${formatRupiah(totalOmzet)}</div>
            <div class="stat-label">Total Omzet Penjualan</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: var(--accent-amber-light); color: var(--accent-amber);">🍲</div>
          <div>
            <div class="stat-val">
              ${state.orders.reduce((sum, o) => sum + (o.totalQty || 0), 0)} Porsi
            </div>
            <div class="stat-label">Menu Terjual</div>
          </div>
        </div>
      </div>

      <!-- Tabel Daftar Transaksi -->
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>No. Nota</th>
              <th>Waktu Transaksi</th>
              <th>Tipe Order</th>
              <th>Pelanggan</th>
              <th>Item Pesanan</th>
              <th>Metode Bayar</th>
              <th>Total</th>
              <th>Status</th>
              <th style="text-align: right;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${filteredOrders.length === 0 ? `
              <tr>
                <td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                  Belum ada data transaksi yang tercatat.
                </td>
              </tr>
            ` : filteredOrders.map(order => `
              <tr>
                <td style="font-weight: 700;">${order.orderNumber}</td>
                <td>${new Date(order.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>
                  ${order.orderType === 'dine_in' ? `
                    <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 0.75rem;">
                      Meja ${order.tableNumber || '-'}
                    </span>
                  ` : (order.orderType === 'takeaway' ? `
                    <span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 0.75rem;">
                      Bungkus
                    </span>
                  ` : `
                    <span style="background: #f3e8ff; color: #6b21a8; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 0.75rem;">
                      Delivery
                    </span>
                  `)}
                </td>
                <td>${escapeHtml(order.customerName || '-')}</td>
                <td>
                  <div style="max-width: 260px; font-size: 0.8rem; line-height: 1.3;">
                    ${order.items.map(it => `${it.name} (x${it.qty})`).join(', ')}
                  </div>
                </td>
                <td style="text-transform: uppercase; font-weight: 600; font-size: 0.78rem;">
                  ${order.paymentMethod || 'TUNAI'}
                </td>
                <td style="font-weight: 800; color: var(--primary);">
                  ${formatRupiah(order.grandTotal)}
                </td>
                <td>
                  ${order.status === 'cancelled' ? `
                    <span style="color: var(--danger); font-weight: 700; font-size: 0.78rem;">Batal</span>
                  ` : `
                    <span style="color: var(--success); font-weight: 700; font-size: 0.78rem;">✓ Lunas</span>
                  `}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button 
                    class="quick-cash-btn" 
                    style="padding: 4px 10px; font-size: 0.75rem;" 
                    data-reprint-order="${order.id}">
                    🖨️ Struk
                  </button>
                  ${order.status !== 'cancelled' ? `
                    <button 
                      class="quick-cash-btn" 
                      style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.3);" 
                      data-cancel-order="${order.id}" 
                      title="Batalkan Nota">
                      ✕
                    </button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function initOrdersViewEvents() {
  const statusSelect = document.getElementById('filter-order-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      orderStatusFilter = e.target.value;
      const pane = document.getElementById('view-orders');
      if (pane) {
        pane.innerHTML = renderOrdersView();
        initOrdersViewEvents();
      }
    });
  }

  // Cetak Ulang Struk
  document.querySelectorAll('[data-reprint-order]').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.reprintOrder;
      const order = state.orders.find(o => o.id === orderId);
      if (order) {
        state.currentReceiptOrder = order;
        state.isReceiptModalOpen = true;
        const receiptContainer = document.getElementById('receipt-modal-container');
        if (receiptContainer) {
          receiptContainer.innerHTML = renderReceiptModal();
          initReceiptModalEvents();
        }
      }
    });
  });

  // Batalkan Order
  document.querySelectorAll('[data-cancel-order]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.cancelOrder;
      if (confirm('Apakah Anda yakin ingin membatalkan transaksi ini?')) {
        await updateOrderStatus(orderId, 'cancelled');
        const pane = document.getElementById('view-orders');
        if (pane) {
          pane.innerHTML = renderOrdersView();
          initOrdersViewEvents();
        }
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

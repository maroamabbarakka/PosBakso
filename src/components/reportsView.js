// Komponen Laporan Penjualan & Analytics Bisnis (Reports View)

import { state } from '../store.js';
import { formatRupiah } from './posView.js';

export function renderReportsView() {
  const validOrders = state.orders.filter(o => o.status !== 'cancelled');
  
  // Total Omzet
  const totalOmzet = validOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  
  // Total Modal Estimasi & Laba Bersih
  let totalCost = 0;
  validOrders.forEach(o => {
    (o.items || []).forEach(it => {
      totalCost += (it.cost || 0) * (it.qty || 1);
    });
  });
  const estimatedProfit = Math.max(0, totalOmzet - totalCost);

  // Rata-rata per transaksi
  const avgOrderValue = validOrders.length > 0 ? Math.round(totalOmzet / validOrders.length) : 0;

  // Analisis Item Terlaris
  const itemMap = {};
  validOrders.forEach(o => {
    (o.items || []).forEach(it => {
      if (!itemMap[it.name]) {
        itemMap[it.name] = { name: it.name, qty: 0, revenue: 0 };
      }
      itemMap[it.name].qty += it.qty;
      itemMap[it.name].revenue += (it.price * it.qty);
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

  // Analisis Metode Pembayaran
  const paymentMethods = {
    cash: { label: 'Tunai (Cash)', count: 0, total: 0 },
    qris: { label: 'QRIS Instan', count: 0, total: 0 },
    debit: { label: 'Kartu / Debit', count: 0, total: 0 }
  };
  validOrders.forEach(o => {
    const method = o.paymentMethod || 'cash';
    if (!paymentMethods[method]) {
      paymentMethods[method] = { label: method.toUpperCase(), count: 0, total: 0 };
    }
    paymentMethods[method].count += 1;
    paymentMethods[method].total += (o.grandTotal || 0);
  });

  return `
    <div class="content-pane-container">
      <div class="pane-header-title">
        <div>
          <h2>Laporan & Analisis Penjualan</h2>
          <p>Ringkasan performa finansial warung bakso dan produk terlaris</p>
        </div>
        <button class="checkout-btn" id="btn-export-csv" style="width: auto; padding: 0.6rem 1.25rem; background: #059669;">
          <span>📥</span> Unduh Laporan CSV
        </button>
      </div>

      <!-- Kartu Metrik Utama -->
      <div class="stats-cards-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background: var(--success-light); color: var(--success);">💵</div>
          <div>
            <div class="stat-val">${formatRupiah(totalOmzet)}</div>
            <div class="stat-label">Total Pendapatan (Omzet)</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #e0e7ff; color: #4338ca;">📈</div>
          <div>
            <div class="stat-val">${formatRupiah(estimatedProfit)}</div>
            <div class="stat-label">Estimasi Keuntungan Bersih</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: var(--primary-light); color: var(--primary);">🧾</div>
          <div>
            <div class="stat-val">${validOrders.length}</div>
            <div class="stat-label">Jumlah Transaksi Selesai</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: var(--accent-amber-light); color: var(--accent-amber);">🏷️</div>
          <div>
            <div class="stat-val">${formatRupiah(avgOrderValue)}</div>
            <div class="stat-label">Rata-rata Nilai Nota (AOV)</div>
          </div>
        </div>
      </div>

      <!-- Grid Laporan Item Terlaris & Metode Bayar -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
        <!-- Item Terlaris -->
        <div class="data-table-wrapper">
          <div style="padding: 1rem 1.25rem; font-weight: 800; font-size: 1rem; border-bottom: 1px solid var(--border-color); background: var(--bg-subtle);">
            ⭐ Menu Bakso & Minuman Paling Laris
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Peringkat</th>
                <th>Nama Menu</th>
                <th>Porsi Terjual</th>
                <th style="text-align: right;">Total Nilai</th>
              </tr>
            </thead>
            <tbody>
              ${topItems.length === 0 ? `
                <tr><td colspan="4" style="text-align: center; padding: 2rem;">Belum ada data penjualan</td></tr>
              ` : topItems.map((item, idx) => `
                <tr>
                  <td style="font-weight: 700;">#${idx + 1}</td>
                  <td style="font-weight: 700;">${escapeHtml(item.name)}</td>
                  <td>${item.qty} Porsi</td>
                  <td style="text-align: right; font-weight: 800; color: var(--primary);">
                    ${formatRupiah(item.revenue)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Rincian Metode Bayar -->
        <div class="data-table-wrapper">
          <div style="padding: 1rem 1.25rem; font-weight: 800; font-size: 1rem; border-bottom: 1px solid var(--border-color); background: var(--bg-subtle);">
            💳 Metode Pembayaran
          </div>
          <div style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">
            ${Object.values(paymentMethods).map(pm => `
              <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 0.2rem;">
                  <span>${pm.label}</span>
                  <span>${pm.count}x</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted);">
                  <span>Nominal</span>
                  <span style="font-weight: 800; color: var(--primary);">${formatRupiah(pm.total)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initReportsViewEvents() {
  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportOrdersToCsv();
    });
  }
}

function exportOrdersToCsv() {
  const validOrders = state.orders.filter(o => o.status !== 'cancelled');
  if (validOrders.length === 0) {
    alert('Belum ada transaksi untuk diekspor!');
    return;
  }

  const headers = ['No Nota', 'Waktu', 'Tipe Order', 'Meja', 'Pelanggan', 'Metode Bayar', 'Subtotal', 'Diskon', 'Pajak', 'Grand Total', 'Status'];
  const rows = validOrders.map(o => [
    `"${o.orderNumber}"`,
    `"${new Date(o.createdAt).toLocaleString('id-ID')}"`,
    `"${o.orderType}"`,
    `"${o.tableNumber || ''}"`,
    `"${o.customerName || ''}"`,
    `"${o.paymentMethod || 'cash'}"`,
    o.subtotal || 0,
    o.discountAmount || 0,
    o.taxAmount || 0,
    o.grandTotal || 0,
    `"${o.status}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-pos-bakso-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

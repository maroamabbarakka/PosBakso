// Komponen Manajemen Meja Dine-In (Tables View)

import { state, clearTable, setCartOrderType, setCartTableNumber, setActiveTab } from '../store.js';
import { formatRupiah } from './posView.js';

export function renderTablesView() {
  const occupiedCount = state.tables.filter(t => t.status === 'occupied').length;
  const emptyCount = state.tables.length - occupiedCount;

  return `
    <div class="content-pane-container">
      <div class="pane-header-title">
        <div>
          <h2>Denah Meja Restoran</h2>
          <p>Pantau keterisian meja dine-in, status makan, dan billing kasir</p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <div style="font-size: 0.82rem; font-weight: 700; background: var(--success-light); color: var(--success); padding: 0.4rem 0.8rem; border-radius: var(--radius-full);">
            ● ${emptyCount} Meja Kosong
          </div>
          <div style="font-size: 0.82rem; font-weight: 700; background: var(--primary-light); color: var(--primary); padding: 0.4rem 0.8rem; border-radius: var(--radius-full);">
            ● ${occupiedCount} Meja Terisi
          </div>
        </div>
      </div>

      <!-- Grid Meja -->
      <div class="tables-grid">
        ${state.tables.map(table => {
          const isOccupied = table.status === 'occupied';
          return `
            <div class="table-card ${table.status}" data-table-number="${table.number}">
              <div class="table-num-badge">
                ${table.number}
              </div>

              <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 0.2rem;">
                Meja ${table.number}
              </div>

              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                Kapasitas: ${table.capacity} Kursi
              </div>

              ${isOccupied ? `
                <div style="background: rgba(220, 38, 38, 0.1); color: var(--primary); font-size: 0.72rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; margin-bottom: 0.75rem; width: 100%;">
                  Terisi sejak ${table.occupiedSince || 'Baru'}<br/>
                  ${table.totalAmount ? formatRupiah(table.totalAmount) : 'Aktif'}
                </div>
                <div style="display: flex; gap: 0.35rem; width: 100%;">
                  <button 
                    class="quick-cash-btn" 
                    style="flex: 1; padding: 4px; font-size: 0.72rem; color: var(--success);"
                    data-clear-table="${table.number}">
                    Kosongkan
                  </button>
                </div>
              ` : `
                <div style="background: rgba(16, 185, 129, 0.1); color: var(--success); font-size: 0.72rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; margin-bottom: 0.75rem; width: 100%;">
                  Tersedia
                </div>
                <button 
                  class="quick-cash-btn" 
                  style="width: 100%; padding: 6px; font-size: 0.75rem; border-color: var(--primary); color: var(--primary);"
                  data-order-table="${table.number}">
                  + Buka Pesanan
                </button>
              `}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function initTablesViewEvents() {
  // Tombol Buka Pesanan di Meja
  document.querySelectorAll('[data-order-table]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const num = parseInt(btn.dataset.orderTable, 10);
      setCartOrderType('dine_in');
      setCartTableNumber(num);
      setActiveTab('pos');
    });
  });

  // Tombol Kosongkan Meja
  document.querySelectorAll('[data-clear-table]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const num = parseInt(btn.dataset.clearTable, 10);
      if (confirm(`Kosongkan Meja ${num}?`)) {
        clearTable(num);
        const pane = document.getElementById('view-tables');
        if (pane) {
          pane.innerHTML = renderTablesView();
          initTablesViewEvents();
        }
      }
    });
  });
}

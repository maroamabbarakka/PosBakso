// Komponen Navbar Atas & Status Bar

import { state, setActiveTab, toggleDarkMode } from '../store.js';

export function renderNavbar() {
  const isOnline = state.isCloudOnline;
  
  return `
    <header class="top-header">
      <div class="brand-section">
        <div class="brand-logo-icon">🍲</div>
        <div class="brand-text">
          <h1>
            ${escapeHtml(state.settings.shopName || 'Rhezeck Bakso')}
            <span class="brand-badge">POS Cloud</span>
          </h1>
          <div class="brand-tagline">${escapeHtml(state.settings.tagline || 'Spesialis Bakso Kuah Gurih Berkaldu')}</div>
        </div>
      </div>

      <nav class="nav-tabs" role="tablist">
        <button class="nav-tab-btn ${state.currentTab === 'pos' ? 'active' : ''}" data-tab="pos">
          <span>🛒</span> Kasir (POS)
        </button>
        <button class="nav-tab-btn ${state.currentTab === 'orders' ? 'active' : ''}" data-tab="orders">
          <span>📋</span> Pesanan & Riwayat
        </button>
        <button class="nav-tab-btn ${state.currentTab === 'tables' ? 'active' : ''}" data-tab="tables">
          <span>🪑</span> Meja
        </button>
        <button class="nav-tab-btn ${state.currentTab === 'menu' ? 'active' : ''}" data-tab="menu">
          <span>🍲</span> Kelola Menu
        </button>
        <button class="nav-tab-btn ${state.currentTab === 'reports' ? 'active' : ''}" data-tab="reports">
          <span>📊</span> Laporan
        </button>
        <button class="nav-tab-btn ${state.currentTab === 'settings' ? 'active' : ''}" data-tab="settings">
          <span>⚙️</span> Pengaturan
        </button>
      </nav>

      <div class="header-actions">
        <div class="cloud-status-badge ${isOnline ? '' : 'offline'}" title="${isOnline ? 'Terhubung ke Firebase Firestore' : 'Mode Offline / LocalStorage Aktif'}">
          <span class="status-dot"></span>
          <span>${isOnline ? 'Cloud Firestore' : 'Mode Lokal'}</span>
        </div>

        <div class="clock-display" id="live-clock">
          ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        <button class="theme-toggle-btn" id="theme-toggle-btn" title="Ubah Tema Gelap / Terang">
          ${state.isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  `;
}

export function initNavbarEvents() {
  // Nav Tab Click
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = btn.dataset.tab;
      if (tab) setActiveTab(tab);
    });
  });

  // Dark mode toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      toggleDarkMode();
    });
  }

  // Jam Realtime
  if (!window._clockInterval) {
    window._clockInterval = setInterval(() => {
      const clockEl = document.getElementById('live-clock');
      if (clockEl) {
        clockEl.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }, 1000);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Entry Point Utama Aplikasi Rhezeck POS Bakso

import './style.css';
import { state, initStore, subscribeState } from './store.js';
import { renderNavbar, initNavbarEvents } from './components/navbar.js';
import { renderPosView, initPosViewEvents } from './components/posView.js';
import { renderOrdersView, initOrdersViewEvents } from './components/ordersView.js';
import { renderTablesView, initTablesViewEvents } from './components/tablesView.js';
import { renderMenuManagerView, initMenuManagerViewEvents } from './components/menuManagerView.js';
import { renderReportsView, initReportsViewEvents } from './components/reportsView.js';
import { renderSettingsView, initSettingsViewEvents } from './components/settingsView.js';
import { renderCheckoutModal, initCheckoutModalEvents } from './components/checkoutModal.js';
import { renderReceiptModal, initReceiptModalEvents } from './components/receiptModal.js';

const appEl = document.getElementById('app');
const checkoutModalContainer = document.getElementById('checkout-modal-container');
const receiptModalContainer = document.getElementById('receipt-modal-container');

function renderApp() {
  if (!appEl) return;

  appEl.innerHTML = `
    ${renderNavbar()}
    <main class="main-workspace">
      <!-- PANE 1: POS KASIR -->
      <div class="view-pane ${state.currentTab === 'pos' ? 'active' : ''}" id="view-pos">
        ${renderPosView()}
      </div>

      <!-- PANE 2: ORDERS -->
      <div class="view-pane ${state.currentTab === 'orders' ? 'active' : ''}" id="view-orders">
        ${renderOrdersView()}
      </div>

      <!-- PANE 3: TABLES -->
      <div class="view-pane ${state.currentTab === 'tables' ? 'active' : ''}" id="view-tables">
        ${renderTablesView()}
      </div>

      <!-- PANE 4: MENU MANAGER -->
      <div class="view-pane ${state.currentTab === 'menu' ? 'active' : ''}" id="view-menu">
        ${renderMenuManagerView()}
      </div>

      <!-- PANE 5: REPORTS -->
      <div class="view-pane ${state.currentTab === 'reports' ? 'active' : ''}" id="view-reports">
        ${renderReportsView()}
      </div>

      <!-- PANE 6: SETTINGS -->
      <div class="view-pane ${state.currentTab === 'settings' ? 'active' : ''}" id="view-settings">
        ${renderSettingsView()}
      </div>
    </main>
  `;

  // Render Modals
  if (checkoutModalContainer) {
    checkoutModalContainer.innerHTML = renderCheckoutModal();
  }
  if (receiptModalContainer) {
    receiptModalContainer.innerHTML = renderReceiptModal();
  }

  // Bind All Events
  initNavbarEvents();
  initPosViewEvents();
  initOrdersViewEvents();
  initTablesViewEvents();
  initMenuManagerViewEvents();
  initReportsViewEvents();
  initSettingsViewEvents();
  initCheckoutModalEvents();
  initReceiptModalEvents();
}

// Inisialisasi awal aplikasi
async function bootstrap() {
  await initStore();
  renderApp();

  // Re-render otomatis saat ada perubahan state
  subscribeState(() => {
    renderApp();
  });
}

bootstrap();

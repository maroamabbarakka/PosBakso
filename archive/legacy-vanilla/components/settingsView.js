// Komponen Pengaturan Toko & Konfigurasi Kasir (Settings View)

import { state, updateSettings } from '../store.js';
import { firebaseConfig } from '../firebase.js';

export function renderSettingsView() {
  const s = state.settings;

  return `
    <div class="content-pane-container">
      <div class="pane-header-title">
        <div>
          <h2>Pengaturan Toko & Sistem POS</h2>
          <p>Konfigurasi profil resto bakso, format struk printer kasir, dan integrasi cloud</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
        <!-- Form Pengaturan -->
        <form id="settings-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- Kartu Profil Toko -->
          <div class="data-table-wrapper" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
            <h3 style="font-size: 1.05rem; font-weight: 800; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              🏬 Profil Warung Bakso
            </h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Nama Resto / Usaha</label>
                <input type="text" id="set-shop-name" class="order-meta-input" style="width: 100%;" value="${escapeHtml(s.shopName || '')}" required />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Slogan / Tagline</label>
                <input type="text" id="set-tagline" class="order-meta-input" style="width: 100%;" value="${escapeHtml(s.tagline || '')}" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Nomor Telepon / WhatsApp</label>
                <input type="text" id="set-phone" class="order-meta-input" style="width: 100%;" value="${escapeHtml(s.phone || '')}" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Nama Kasir Bertugas</label>
                <input type="text" id="set-cashier-name" class="order-meta-input" style="width: 100%;" value="${escapeHtml(s.cashierName || '')}" />
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Alamat Lengkap</label>
              <textarea id="set-address" class="order-meta-input" style="width: 100%; min-height: 60px;">${escapeHtml(s.address || '')}</textarea>
            </div>
          </div>

          <!-- Kartu Struk & Pajak -->
          <div class="data-table-wrapper" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
            <h3 style="font-size: 1.05rem; font-weight: 800; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              🖨️ Pengaturan Printer & Struk Kasir
            </h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Ukuran Kertas Thermal</label>
                <select id="set-paper-size" class="order-meta-input" style="width: 100%;">
                  <option value="58mm" ${s.receiptPaperSize === '58mm' ? 'selected' : ''}>Thermal 58mm (Kecil Standar)</option>
                  <option value="80mm" ${s.receiptPaperSize === '80mm' ? 'selected' : ''}>Thermal 80mm (Besar Resto)</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Pajak Resto (PB1 / PPN)</label>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 4px;">
                  <input type="checkbox" id="set-tax-enabled" ${s.taxEnabled ? 'checked' : ''} />
                  <span style="font-size: 0.82rem;">Aktifkan</span>
                  <input type="number" id="set-tax-percent" class="order-meta-input" style="width: 70px;" value="${s.taxPercent || 10}" />
                  <span style="font-size: 0.82rem;">%</span>
                </div>
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Catatan Kaki Struk (Pesan Ramah)</label>
              <textarea id="set-receipt-footer" class="order-meta-input" style="width: 100%; min-height: 60px;">${escapeHtml(s.receiptFooter || '')}</textarea>
            </div>
          </div>

          <!-- Pengaturan QRIS Toko -->
          <div class="data-table-wrapper" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
            <h3 style="font-size: 1.05rem; font-weight: 800; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              📱 QRIS Pembayaran Digital
            </h3>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">Nama Merchant QRIS</label>
                <input type="text" id="set-qris-name" class="order-meta-input" style="width: 100%;" value="${escapeHtml(s.qrisMerchantName || '')}" />
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.3rem;">NMID QRIS</label>
                <input type="text" id="set-qris-nmid" class="order-meta-input" style="width: 100%;" value="${escapeHtml(s.qrisNmid || '')}" />
              </div>
            </div>
          </div>

          <button type="submit" class="checkout-btn" style="width: 100%; padding: 0.85rem;">
            <span>💾</span> Simpan Seluruh Pengaturan
          </button>
        </form>

        <!-- Kartu Info Firebase Cloud -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div class="data-table-wrapper" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
            <h3 style="font-size: 1.05rem; font-weight: 800; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
              ☁️ Firebase Cloud Backend
            </h3>
            <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.5;">
              Aplikasi ini terhubung langsung ke project Firebase Anda:
            </div>

            <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.78rem; font-family: monospace; display: flex; flex-direction: column; gap: 0.4rem;">
              <div><strong>Project ID:</strong> ${firebaseConfig.projectId}</div>
              <div><strong>Auth Domain:</strong> ${firebaseConfig.authDomain}</div>
              <div><strong>App ID:</strong> ${firebaseConfig.appId}</div>
              <div><strong>Status:</strong> ${state.isCloudOnline ? '🟢 Cloud Firestore Aktif' : '🟡 Offline Mode (Lokal)'}</div>
            </div>

            <div style="font-size: 0.78rem; color: var(--text-muted);">
              Data transaksi, menu, dan pengaturan disinkronkan secara otomatis saat terhubung ke internet.
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initSettingsViewEvents() {
  const form = document.getElementById('settings-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const payload = {
        shopName: document.getElementById('set-shop-name').value,
        tagline: document.getElementById('set-tagline').value,
        phone: document.getElementById('set-phone').value,
        cashierName: document.getElementById('set-cashier-name').value,
        address: document.getElementById('set-address').value,
        receiptPaperSize: document.getElementById('set-paper-size').value,
        taxEnabled: document.getElementById('set-tax-enabled').checked,
        taxPercent: Number(document.getElementById('set-tax-percent').value) || 10,
        receiptFooter: document.getElementById('set-receipt-footer').value,
        qrisMerchantName: document.getElementById('set-qris-name').value,
        qrisNmid: document.getElementById('set-qris-nmid').value
      };

      await updateSettings(payload);
      alert('Pengaturan toko berhasil disimpan!');
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

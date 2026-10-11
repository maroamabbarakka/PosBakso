// Modal Pembayaran & Checkout Kasir

import { state, getCartTotals, completeOrder } from '../store.js';
import { formatRupiah } from './posView.js';

let selectedMethod = 'cash';
let inputCashAmount = 0;

export function renderCheckoutModal() {
  const totals = getCartTotals();
  const grandTotal = totals.grandTotal;
  
  if (inputCashAmount === 0 || inputCashAmount < grandTotal) {
    // Default uang pas jika belum disetel
    inputCashAmount = grandTotal;
  }

  const change = Math.max(0, inputCashAmount - grandTotal);
  const isSufficient = selectedMethod !== 'cash' || inputCashAmount >= grandTotal;

  // Tombol pecahan uang cepat yang masuk akal
  const quickButtons = [
    { label: 'Uang Pas', val: grandTotal },
    { label: 'Rp 20.000', val: 20000 },
    { label: 'Rp 50.000', val: 50000 },
    { label: 'Rp 100.000', val: 100000 },
    { label: 'Rp 200.000', val: 200000 },
    { label: 'Rp 500.000', val: 500000 }
  ].filter(b => b.val >= grandTotal || b.label === 'Uang Pas');

  return `
    <div class="modal-overlay ${state.isCheckoutModalOpen ? 'active' : ''}" id="checkout-modal">
      <div class="modal-card">
        <div class="modal-header">
          <h3><span>💳</span> Pembayaran Pesanan</h3>
          <button class="modal-close-btn" id="close-checkout-modal">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Total Tagihan Utama -->
          <div style="background: var(--bg-subtle); padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Total Yang Harus Dibayar</div>
              <div style="font-size: 1.6rem; font-weight: 800; color: var(--primary); letter-spacing: -0.02em;">
                ${formatRupiah(grandTotal)}
              </div>
            </div>
            <div style="text-align: right; font-size: 0.8rem; color: var(--text-muted);">
              <div>${state.cart.orderType === 'dine_in' ? `Meja ${state.cart.tableNumber}` : 'Bungkus / Takeaway'}</div>
              <div>${totals.totalQty} Porsi Menu</div>
            </div>
          </div>

          <!-- Pilihan Metode Pembayaran -->
          <div>
            <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem;">
              Metode Pembayaran
            </label>
            <div class="payment-tabs">
              <button class="pay-tab-btn ${selectedMethod === 'cash' ? 'active' : ''}" data-pay-method="cash">
                <span style="font-size: 1.3rem;">💵</span> Tunai (Cash)
              </button>
              <button class="pay-tab-btn ${selectedMethod === 'qris' ? 'active' : ''}" data-pay-method="qris">
                <span style="font-size: 1.3rem;">📱</span> QRIS Instan
              </button>
              <button class="pay-tab-btn ${selectedMethod === 'debit' ? 'active' : ''}" data-pay-method="debit">
                <span style="font-size: 1.3rem;">💳</span> Kartu / Transfer
              </button>
            </div>
          </div>

          <!-- KONTEN KHUSUS METODE TUNAI -->
          ${selectedMethod === 'cash' ? `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.4rem;">
                  Jumlah Uang Diterima
                </label>
                <input 
                  type="number" 
                  class="input-money-field" 
                  id="cash-amount-input" 
                  value="${inputCashAmount}" 
                  step="1000"
                />
              </div>

              <!-- Tombol Cepat Pecahan Uang -->
              <div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.35rem; font-weight: 600;">
                  Pilihan Cepat Nominal:
                </div>
                <div class="quick-cash-grid">
                  ${quickButtons.map(btn => `
                    <button class="quick-cash-btn" data-nominal="${btn.val}">${btn.label}</button>
                  `).join('')}
                </div>
              </div>

              <!-- Kotak Kembalian -->
              <div class="kembalian-display-box ${inputCashAmount < grandTotal ? 'kurang' : ''}">
                <div class="label">
                  ${inputCashAmount < grandTotal ? '⚠️ Uang Masih Kurang' : 'Kembalian'}
                </div>
                <div class="val">
                  ${inputCashAmount < grandTotal ? formatRupiah(grandTotal - inputCashAmount) : formatRupiah(change)}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- KONTEN KHUSUS METODE QRIS -->
          ${selectedMethod === 'qris' ? `
            <div class="qris-box">
              <div style="font-weight: 800; font-size: 1.1rem; color: #b91c1c; margin-bottom: 0.3rem;">
                QRIS NASIONAL
              </div>
              <div style="font-size: 0.78rem; color: #475569; margin-bottom: 0.8rem;">
                Scan dengan GoPay, OVO, Dana, BCA, Livin', ShopeePay dll.
              </div>

              <!-- Mock QR Code SVG -->
              <div class="qris-qr-img">
                <svg width="140" height="140" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- QR Pattern SVG yang realistis -->
                  <rect width="100" height="100" fill="white"/>
                  <rect x="10" y="10" width="28" height="28" fill="black"/>
                  <rect x="14" y="14" width="20" height="20" fill="white"/>
                  <rect x="18" y="18" width="12" height="12" fill="black"/>
                  <rect x="62" y="10" width="28" height="28" fill="black"/>
                  <rect x="66" y="14" width="20" height="20" fill="white"/>
                  <rect x="70" y="18" width="12" height="12" fill="black"/>
                  <rect x="10" y="62" width="28" height="28" fill="black"/>
                  <rect x="14" y="66" width="20" height="20" fill="white"/>
                  <rect x="18" y="70" width="12" height="12" fill="black"/>
                  <!-- Data Dots -->
                  <rect x="44" y="12" width="6" height="6" fill="black"/>
                  <rect x="44" y="24" width="6" height="6" fill="black"/>
                  <rect x="52" y="18" width="6" height="6" fill="black"/>
                  <rect x="12" y="44" width="6" height="6" fill="black"/>
                  <rect x="24" y="44" width="6" height="6" fill="black"/>
                  <rect x="32" y="52" width="6" height="6" fill="black"/>
                  <rect x="44" y="44" width="12" height="12" fill="#b91c1c"/>
                  <rect x="62" y="44" width="6" height="6" fill="black"/>
                  <rect x="74" y="52" width="6" height="6" fill="black"/>
                  <rect x="44" y="62" width="6" height="6" fill="black"/>
                  <rect x="52" y="74" width="6" height="6" fill="black"/>
                  <rect x="68" y="68" width="10" height="10" fill="black"/>
                  <rect x="80" y="80" width="8" height="8" fill="black"/>
                </svg>
              </div>

              <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a;">
                ${state.settings.qrisMerchantName || 'RHEZECK POS BAKSO'}
              </div>
              <div style="font-size: 0.75rem; color: #64748b;">
                NMID: ${state.settings.qrisNmid || 'ID1020030405060'}
              </div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #dc2626; margin-top: 0.5rem;">
                ${formatRupiah(grandTotal)}
              </div>
            </div>
          ` : ''}

          <!-- KONTEN KHUSUS KARTU / TRANSFER -->
          ${selectedMethod === 'debit' ? `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">
                  Pilih Bank / Mesin EDC
                </label>
                <select id="debit-bank-select" class="order-meta-input" style="width: 100%;">
                  <option value="BCA">BCA (Debit / QR)</option>
                  <option value="Mandiri">Bank Mandiri</option>
                  <option value="BRI">BRI</option>
                  <option value="BNI">BNI</option>
                  <option value="Transfer">Transfer Bank / M-Banking</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.35rem;">
                  Nomor Referensi / Approval Code (Opsional)
                </label>
                <input type="text" id="debit-ref-input" class="order-meta-input" style="width: 100%;" placeholder="Contoh: REF98765432" />
              </div>
            </div>
          ` : ''}

          <!-- Tombol Final Konfirmasi -->
          <button 
            class="checkout-btn" 
            id="btn-confirm-payment"
            ${!isSufficient ? 'disabled' : ''}>
            <span>✅</span> Selesaikan & Cetak Struk (${formatRupiah(grandTotal)})
          </button>
        </div>
      </div>
    </div>
  `;
}

export function initCheckoutModalEvents() {
  const closeBtn = document.getElementById('close-checkout-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      state.isCheckoutModalOpen = false;
      const modal = document.getElementById('checkout-modal');
      if (modal) modal.classList.remove('active');
    });
  }

  // Ganti metode pembayaran
  document.querySelectorAll('.pay-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMethod = btn.dataset.payMethod;
      const totals = getCartTotals();
      if (selectedMethod === 'cash') {
        inputCashAmount = totals.grandTotal;
      }
      refreshModalBody();
    });
  });

  // Input jumlah uang
  const cashInput = document.getElementById('cash-amount-input');
  if (cashInput) {
    cashInput.addEventListener('input', (e) => {
      inputCashAmount = Number(e.target.value) || 0;
      updateKembalianUi();
    });
  }

  // Tombol Cepat Pecahan
  document.querySelectorAll('.quick-cash-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inputCashAmount = Number(btn.dataset.nominal) || 0;
      const input = document.getElementById('cash-amount-input');
      if (input) input.value = inputCashAmount;
      updateKembalianUi();
    });
  });

  // Tombol Selesaikan Transaksi
  const confirmBtn = document.getElementById('btn-confirm-payment');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const totals = getCartTotals();
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span>⏳</span> Memproses Transaksi...';

      const paymentDetails = {
        method: selectedMethod,
        cashGiven: selectedMethod === 'cash' ? inputCashAmount : totals.grandTotal,
        change: selectedMethod === 'cash' ? Math.max(0, inputCashAmount - totals.grandTotal) : 0
      };

      await completeOrder(paymentDetails);
    });
  }
}

function updateKembalianUi() {
  const totals = getCartTotals();
  const grandTotal = totals.grandTotal;
  const changeBox = document.querySelector('.kembalian-display-box');
  const confirmBtn = document.getElementById('btn-confirm-payment');

  if (changeBox) {
    const isKurang = inputCashAmount < grandTotal;
    changeBox.className = `kembalian-display-box ${isKurang ? 'kurang' : ''}`;
    changeBox.innerHTML = `
      <div class="label">${isKurang ? '⚠️ Uang Masih Kurang' : 'Kembalian'}</div>
      <div class="val">${isKurang ? formatRupiah(grandTotal - inputCashAmount) : formatRupiah(inputCashAmount - grandTotal)}</div>
    `;
  }

  if (confirmBtn) {
    confirmBtn.disabled = inputCashAmount < grandTotal;
  }
}

function refreshModalBody() {
  // Re-render konten modal
  const container = document.getElementById('checkout-modal-container');
  if (container) {
    container.innerHTML = renderCheckoutModal();
    initCheckoutModalEvents();
  }
}

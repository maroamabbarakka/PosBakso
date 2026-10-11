// Modal Cetak & Preview Struk Thermal (58mm / 80mm)

import { state } from '../store.js';
import { formatRupiah } from './posView.js';

export function renderReceiptModal() {
  const order = state.currentReceiptOrder;
  if (!order) return '';

  const settings = state.settings;
  const is58mm = (settings.receiptPaperSize || '58mm') === '58mm';

  return `
    <div class="modal-overlay ${state.isReceiptModalOpen ? 'active' : ''}" id="receipt-modal">
      <div class="modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <h3><span>🧾</span> Struk Pembayaran Sukses</h3>
          <button class="modal-close-btn" id="close-receipt-modal">&times;</button>
        </div>

        <div class="modal-body" style="align-items: center;">
          <!-- Wrapper Kertas Struk Thermal -->
          <div class="receipt-paper-wrapper">
            <div class="receipt-thermal" id="printable-receipt" style="width: ${is58mm ? '280px' : '340px'};">
              <div class="shop-title">${escapeHtml(settings.shopName || 'RHEZECK BAKSO')}</div>
              <div class="shop-sub">
                ${escapeHtml(settings.address || 'Jl. Raya Kuliner No. 88')}<br/>
                Telp: ${escapeHtml(settings.phone || '0812-3456-7890')}
              </div>

              <div class="divider-double"></div>

              <div class="meta-line">
                <span>No. Nota:</span>
                <span>${order.orderNumber}</span>
              </div>
              <div class="meta-line">
                <span>Waktu:</span>
                <span>${new Date(order.createdAt).toLocaleString('id-ID')}</span>
              </div>
              <div class="meta-line">
                <span>Kasir:</span>
                <span>${escapeHtml(order.cashierName || 'Kasir 1')}</span>
              </div>
              <div class="meta-line">
                <span>Tipe:</span>
                <span>${order.orderType === 'dine_in' ? `Dine-In (Meja ${order.tableNumber})` : (order.orderType === 'takeaway' ? 'Bungkus (Take Away)' : 'Delivery')}</span>
              </div>
              ${order.customerName && order.customerName !== 'Pelanggan' ? `
                <div class="meta-line">
                  <span>Pelanggan:</span>
                  <span>${escapeHtml(order.customerName)}</span>
                </div>
              ` : ''}

              <div class="divider-dashed"></div>

              <!-- Item List -->
              ${order.items.map(item => `
                <div class="item-line">
                  <div class="item-row">
                    <span style="font-weight: bold;">${escapeHtml(item.name)}</span>
                    <span>${formatRupiah(item.price * item.qty)}</span>
                  </div>
                  <div class="item-calc">
                    ${item.qty} x ${formatRupiah(item.price)}
                    ${item.notes ? ` <i>[${escapeHtml(item.notes)}]</i>` : ''}
                  </div>
                </div>
              `).join('')}

              <div class="divider-dashed"></div>

              <!-- Rincian Biaya -->
              <div class="meta-line">
                <span>Subtotal:</span>
                <span>${formatRupiah(order.subtotal)}</span>
              </div>
              ${order.discountAmount > 0 ? `
                <div class="meta-line">
                  <span>Diskon:</span>
                  <span>-${formatRupiah(order.discountAmount)}</span>
                </div>
              ` : ''}
              ${order.taxAmount > 0 ? `
                <div class="meta-line">
                  <span>Pajak (PB1):</span>
                  <span>+${formatRupiah(order.taxAmount)}</span>
                </div>
              ` : ''}

              <div class="divider-double"></div>

              <div class="total-line grand-total">
                <span>TOTAL:</span>
                <span>${formatRupiah(order.grandTotal)}</span>
              </div>

              <div class="divider-dashed"></div>

              <div class="meta-line">
                <span>Metode Bayar:</span>
                <span>${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'TUNAI'}</span>
              </div>
              ${order.paymentMethod === 'cash' ? `
                <div class="meta-line">
                  <span>Tunai Diterima:</span>
                  <span>${formatRupiah(order.cashGiven)}</span>
                </div>
                <div class="meta-line" style="font-weight: bold;">
                  <span>Kembalian:</span>
                  <span>${formatRupiah(order.change)}</span>
                </div>
              ` : ''}

              <div class="footer-text">
                ${escapeHtml(settings.receiptFooter || 'Terima kasih atas kunjungannya!\nSelamat menikmati sajian Bakso kami.')}
              </div>
            </div>
          </div>

          <!-- Tombol Aksi Struk -->
          <div style="display: flex; gap: 0.5rem; width: 100%; margin-top: 0.5rem;">
            <button class="checkout-btn" id="btn-print-receipt" style="flex: 1; padding: 0.75rem;">
              <span>🖨️</span> Cetak Struk
            </button>
            <button class="checkout-btn" id="btn-share-whatsapp" style="flex: 1; padding: 0.75rem; background: #16a34a;">
              <span>💬</span> Kirim WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initReceiptModalEvents() {
  const closeBtn = document.getElementById('close-receipt-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      state.isReceiptModalOpen = false;
      const modal = document.getElementById('receipt-modal');
      if (modal) modal.classList.remove('active');
    });
  }

  // Tombol Cetak Langsung (Thermal Printer)
  const printBtn = document.getElementById('btn-print-receipt');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Tombol Kirim WhatsApp
  const waBtn = document.getElementById('btn-share-whatsapp');
  if (waBtn) {
    waBtn.addEventListener('click', () => {
      const order = state.currentReceiptOrder;
      if (!order) return;
      
      const phone = prompt('Masukkan nomor WhatsApp pelanggan (contoh: 081234567890):');
      if (!phone) return;

      const cleanPhone = phone.replace(/^0/, '62').replace(/[^0-9]/g, '');
      const lines = [
        `*${state.settings.shopName || 'RHEZECK BAKSO'}*`,
        `No. Nota: ${order.orderNumber}`,
        `Waktu: ${new Date(order.createdAt).toLocaleString('id-ID')}`,
        `Tipe: ${order.orderType === 'dine_in' ? `Dine-In (Meja ${order.tableNumber})` : 'Bungkus / Takeaway'}`,
        `--------------------------`,
        ...order.items.map(it => `• ${it.name} x${it.qty} = ${formatRupiah(it.price * it.qty)}`),
        `--------------------------`,
        `*TOTAL: ${formatRupiah(order.grandTotal)}*`,
        `Metode: ${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'TUNAI'}`,
        ``,
        `Terima kasih sudah menikmati hidangan Bakso kami! 🍲`
      ];

      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines.join('\n'))}`;
      window.open(url, '_blank');
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

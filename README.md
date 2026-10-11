# Bakso Umum Khas Makassar — POS V2

Aplikasi Point of Sale full-custom untuk **Bakso Umum Khas Makassar**, dengan UI/UX yang mengikuti mockup yang disepakati: kasir desktop/tablet, pengalaman mobile touch-first, dashboard manager, Kitchen Display System (KDS), inventory berbasis resep, laporan operasional dan profit, serta struk thermal yang konsisten.

> Prinsip arsitektur: **Firebase Spark-safe**. Aplikasi tidak membutuhkan Cloud Functions, Cloud Storage, atau Firebase App Hosting dan tidak memiliki alur yang meminta upgrade ke Blaze.

## Fitur utama

### Kasir
- Grid menu responsif, pencarian SKU/nama, kategori, indikator stok/habis.
- Dine In, Take Away, dan Delivery.
- Manajemen meja; meja aktif otomatis ditandai terpakai.
- Nama pelanggan untuk Take Away/Delivery.
- Cart, qty, modifier/topping dan catatan per item, catatan pesanan, diskon berbasis permission, pajak/service opsional.
- Hold/Save Order → buka kembali → lanjutkan → bayar.
- Pembayaran Tunai, QRIS, Transfer, Kartu, dan Lainnya.
- Pembayaran gabungan/split tender (mis. Tunai + QRIS) dengan rekonsiliasi metode pembayaran.
- Shortcut uang tunai dan kembalian otomatis.
- Shift wajib sebelum menerima pembayaran.
- Nomor transaksi dan nomor antrean otomatis.
- Auto-print customer receipt dan kitchen ticket sesuai konfigurasi printer.

### Pesanan & Dapur
- Riwayat order, pencarian, filter status, detail transaksi.
- Reprint struk dan kitchen ticket.
- Void/refund dengan alasan, permission, audit log, reversal kas, dan pengembalian stok resep.
- KDS: **Baru → Diproses → Siap → Disajikan**.
- Status pembayaran dan status dapur dipisahkan sehingga order lunas tetap muncul di dapur sampai disajikan.

### Produk, resep, dan inventory
- Master produk: harga jual, HPP, margin, kategori, SKU, status, routing dapur.
- Master bahan baku: stok, satuan, minimum stock, average cost.
- Resep/BOM per produk dengan HPP otomatis dari bahan.
- Pengurangan bahan otomatis saat order dikomit.
- Stock Movement ledger: pembelian, penjualan, adjustment, waste, opname, return.
- Waste dan stock opname dengan audit trail.
- Supplier.
- Pembelian multi-item; penerimaan stok dan weighted average cost.
- Recalculate HPP produk setelah perubahan resep/harga bahan.

### Shift dan kas
- Buka shift dengan kas awal.
- Cash In / Cash Out.
- Expected cash vs actual cash.
- Selisih kas per shift.
- Refund/void tunai dicatat sebagai reversal kas pada shift yang aktif.

### Laporan profesional
- Filter Hari Ini, 7 Hari, 30 Hari, atau rentang custom.
- Gross Sales, Net Sales, refund, HPP, gross profit, average transaction.
- Sales per produk dan margin.
- Payment mix.
- Laporan shift expected vs actual.
- Nilai inventory dan waste cost.
- Menu Engineering: **Star / Plowhorse / Puzzle / Dog**.
- Export CSV transaksi.

### User bertingkat & keamanan
- Owner, Manager, Supervisor, Kasir, Dapur, Gudang.
- Permission granular (`sale.*`, `inventory.*`, `report.*`, `user.manage`, dan lain-lain).
- Role/permission dapat dikelola Owner.
- Manager tidak dapat membuat atau mengubah akun menjadi Owner.
- Audit Log untuk tindakan sensitif.
- Firestore Rules berbasis profil user dan role.

### Printer & Designer Struk
- Preview/cetak browser untuk pengembangan/fallback.
- Android Capacitor native bridge untuk Bluetooth Classic/SPP ESC/POS.
- Scan paired device, connect, runtime socket status, auto reconnect, test print dan persistent print-job retry.
- 58 mm / 80 mm dengan **printable head 384/512/576 dots atau nilai custom kelipatan 8**.
- Designer struk: logo, posisi/lebar logo, threshold/dithering, judul/subjudul, judul dokumen, header/footer multi-baris, visibility fields, QR, CODE128, copies dan feed.
- Logo dicetak raster monokrom 1-bit; QR/CODE128 memakai command native ESC/POS.
- Printer kasir, dapur, dan minuman + routing kategori.
- Customer receipt, Kitchen Order Ticket, dan delta ticket edit pesanan berbeda format.

### Offline & Firebase Spark
- IndexedDB sebagai snapshot lokal dan mutation queue.
- UI/transaksi tetap dapat bekerja ketika internet putus.
- Firestore Web SDK persistent cache.
- Queue sinkronisasi dicoba ulang ketika koneksi kembali.
- Firebase Authentication Email/Password untuk mode produksi.
- Firebase Hosting + Firestore + Authentication saja.
- Foto/ikon menu berupa asset statis lokal/Hosting, bukan Cloud Storage.

## Stack

- React 19 + TypeScript
- Vite
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- IndexedDB
- Capacitor 8 (Android)
- Native Kotlin ESC/POS bridge

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Type-check dan build produksi:

```bash
npm run typecheck
npm run build
```

Preview build:

```bash
npm run preview
```

## Mode demo

Secara default `.env.example` menggunakan mode demo. Akun demo terdapat pada seed data aplikasi:

| Role | User | PIN |
|---|---|---:|
| Owner | Pemilik | `1234` |
| Manager | Manager | `2468` |
| Kasir | Dika | `3579` |
| Dapur | Dapur | `1111` |

Mode demo menyimpan data di perangkat dan tidak memerlukan Firebase.

## Firebase Spark production

Salin `.env.example` menjadi `.env.local` lalu isi konfigurasi Firebase Web App dan ubah:

```env
VITE_DEMO_MODE=false
```

Panduan lengkap: [`docs/FIREBASE-SPARK-SETUP.md`](docs/FIREBASE-SPARK-SETUP.md).

Layanan yang digunakan:
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting

Layanan yang **sengaja tidak digunakan**:
- Cloud Functions
- Cloud Storage
- Firebase App Hosting

Dengan demikian source ini tidak memiliki dependensi fitur yang memaksa upgrade billing ke Blaze.

## Android Bluetooth ESC/POS

Panduan Android: [`docs/ANDROID-BLUETOOTH.md`](docs/ANDROID-BLUETOOTH.md).

SOP kalibrasi grafis/struk: [`docs/PRINTING-PRODUCTION.md`](docs/PRINTING-PRODUCTION.md).

Project menyertakan template plugin Kotlin di `native/android/`. Setelah Capacitor membuat folder Android, copy plugin tersebut ke project Android lalu uji dengan printer fisik.

## Struktur data utama

- `settings`
- `users`
- `roles`
- `products`
- `ingredients`
- `recipes`
- `suppliers`
- `purchases`
- `orders`
- `shifts`
- `cash_movements`
- `stock_movements`
- `printers`
- `audit_logs`

## Design source of truth

UI harus tetap mengikuti mockup Bakso Umum yang telah disepakati (`docs/mockup-reference.png`). Jangan mengganti dengan template admin generik. Design system menggunakan merah Bakso Umum, background off-white, white surfaces, charcoal text, spacing dan radius konsisten, serta responsive behavior yang memang berubah pada mobile—not sekadar mengecilkan desktop.

## Quality gate sebelum operasional

Gunakan [`docs/PRODUCTION-CHECKLIST.md`](docs/PRODUCTION-CHECKLIST.md) untuk pengujian kasir, offline sync, inventory, laporan, role/security, dan printer fisik sebelum go-live.

Rekaman validasi source saat ini: [`docs/VALIDATION.md`](docs/VALIDATION.md).

## Catatan arsitektur Spark-only

Karena tidak memakai trusted server/Cloud Functions, beberapa operasi lintas dokumen (misalnya order + inventory movement) dilakukan oleh authenticated client lalu disinkronkan. Firestore Rules membatasi role dan field semaksimal mungkin, tetapi untuk skenario **banyak terminal kasir yang melakukan transaksi inventory secara bersamaan dengan throughput tinggi**, dibutuhkan pengujian concurrency khusus. Untuk satu/few-terminal warung, arsitektur ini sengaja memprioritaskan Spark-only, offline-first, dan biaya nol Firebase.


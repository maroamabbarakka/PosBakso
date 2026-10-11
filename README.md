# Bakso Umum Khas Makassar — POS V2

Aplikasi Point of Sale full-custom untuk **Bakso Umum Khas Makassar**, dengan UI/UX yang mengikuti mockup yang disepakati: kasir desktop/tablet, pengalaman mobile touch-first, dashboard manager, Kitchen Display System (KDS), inventory berbasis resep, laporan operasional dan profit, serta struk thermal yang konsisten.

> Prinsip arsitektur: **Firebase Spark-safe**. Aplikasi tidak membutuhkan Cloud Functions, Cloud Storage, atau Firebase App Hosting dan tidak memiliki alur yang meminta upgrade ke Blaze.

## Fitur utama

### Kasir & Ergonomi Sentuh Cepat
- Grid menu responsif, pencarian SKU/nama, kategori, indikator stok/habis.
- **Keyboard Hotkeys**: `F2` (Pencarian Menu cepat), `F4` (Simpan / Tahan Pesanan), `F9` (Buka Pembayaran), `Esc` (Batal / Bersihkan).
- **Virtual Touch Numpad**: Numpad sentuh kasir (1–9, 0, 000, C) langsung di layar modal pembayaran tanpa tergantung keyboard virtual OS.
- **Tombol Uang Pas Instan**: Satu sentuhan langsung melunasi tanpa input manual, ditambah nominal lembaran uang rupiah.
- **Web Audio Micro-Feedback**: Konfirmasi suara sintetis Web Audio API (suara add-to-cart lembut dan chime sukses lunas).
- Dine In, Take Away, dan Delivery.
- Manajemen meja; meja aktif otomatis ditandai terpakai.
- Nama pelanggan untuk Take Away/Delivery.
- Cart, qty besar ramah sentuh, modifier/topping dan catatan per item, catatan pesanan, diskon berbasis permission, pajak/service opsional.
- Hold/Save Order → buka kembali → lanjutkan → bayar.
- Pembayaran Tunai, QRIS, Transfer, Kartu, dan Lainnya.
- Pembayaran gabungan/split tender (mis. Tunai + QRIS) dengan rekonsiliasi metode pembayaran.
- Shift wajib sebelum menerima pembayaran.
- Nomor transaksi dan nomor antrean otomatis.
- Auto-print customer receipt dan kitchen ticket sesuai konfigurasi printer.

### Pesanan & Dapur (Kitchen Display System - KDS)
- Riwayat order, pencarian, filter status, detail transaksi.
- Reprint struk dan kitchen ticket.
- Void/refund dengan alasan, permission, audit log, reversal kas, dan pengembalian stok resep.
- KDS: **Baru → Diproses → Siap → Disajikan**.
- **Elapsed Time Badge Dinamis**: Indikator durasi antrean dapur dengan kode warna urgensi (Hijau <10 mnt, Oranye 10–20 mnt, Merah mendesak >20 mnt).
- **Audio Bell Alert**: Bunyi lonceng otomatis saat ada tiket pesanan baru masuk ke dapur.
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

### Printer & Designer Struk (Multi-Device & Modern Transports)
- **Multi-Transport Support**:
  - **Android Native (Capacitor)**: Bluetooth Classic RFCOMM (SPP) dengan *Zero-Click Auto-Reconnect* saat printer portabel bangun dari mode sleep/standby.
  - **Android Browser (Chrome PWA)**: *Web Bluetooth API* (`navigator.bluetooth`) GATT BLE cetak langsung dari browser tanpa PDF print dialog sistem.
  - **Windows / PC Desktop (Chrome/Edge)**: *Web Serial API* (`navigator.serial`) via USB Thermal atau Virtual Bluetooth COM port tanpa server bridge background.
  - **Windows Spooler Bridge**: Port 18181 untuk browser legacy (Firefox) atau jaringan lokal.
  - **Browser Web Fallback**: Print preview modal dengan kalibrasi CSS `@page` 80mm/58mm.
- **Safe Chunking & Flow Control**: Pengiriman data ESC/POS dengan kontrol chunk 100–128 byte dan jeda mikro untuk mencegah buffer overrun pada printer thermal portabel berbiaya terjangkau.
- **Ukuran Kertas & Head Dots**: 58 mm / 80 mm dengan **printable head 384/512/576 dots atau nilai custom kelipatan 8**.
- **Designer Struk**: Logo raster 1-bit, threshold/dithering, header/footer kustom, QR native, barcode CODE128, copies dan feed.
- **Routing Dapur & Minuman**: Struk kasir, Kitchen Order Ticket (KOT), dan delta ticket saat edit pesanan terpisah otomatis.
- **Print Job Queue Persisten**: Antrean cetak tersimpan di IndexedDB dengan fitur Retry manual jika printer kehabisan kertas.

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


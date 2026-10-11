# Printing Production Guide — PosBakso

Dokumen ini adalah **source of truth** untuk konfigurasi struk pelanggan, Kitchen Order Ticket (KOT), logo/grafis, dan printer thermal ESC/POS pada perangkat produksi.

## 1. Prinsip desain cetak

PosBakso tidak mencetak screenshot browser ke printer Bluetooth. Jalur Android menggunakan perintah ESC/POS native:

- teks → byte sesuai codepage printer;
- logo → raster monokrom 1-bit (`GS v 0`);
- QR → perintah QR native printer;
- barcode → CODE128 native;
- cut → perintah cutter ESC/POS bila diaktifkan;
- cash drawer → pulse hanya pada copy pertama;
- KOT → layout khusus dapur/bar dengan antrean besar.

Dengan model ini, hasil print lebih tajam, cepat, dan konsisten dibanding mencetak canvas/screenshot penuh.

## 2. Custom branding struk

Semua opsi berikut dikelola dari **Pengaturan → Designer Struk**:

- logo struk;
- posisi logo: kiri/tengah/kanan;
- lebar logo;
- mode raster: Floyd–Steinberg / threshold;
- nilai threshold hitam-putih;
- judul header;
- subjudul header;
- judul dokumen, misalnya `NOTA PEMBELIAN`, `RECEIPT`, atau nama custom;
- baris header tambahan;
- alamat;
- telepon/WhatsApp;
- nomor antrean;
- kasir;
- tipe order/meja;
- pelanggan;
- SKU item;
- modifier/topping;
- catatan item;
- catatan order;
- referensi pembayaran;
- rincian pajak/service;
- tagline;
- footer multi-baris;
- QR Code + label + ukuran modul;
- CODE128 + sumber nomor transaksi/antrean + tinggi;
- jumlah copy;
- jumlah feed akhir.

### Template dinamis

Token berikut dapat digunakan pada judul/header/footer/QR:

- `{order_number}`
- `{queue_number}`
- `{terminal}`
- `{cashier}`
- `{customer}`
- `{table}`
- `{order_type}`
- `{total}`
- `{subtotal}`
- `{date}`
- `{outlet}`
- `{brand}`
- `{phone}`
- `{address}`

Token yang tidak dikenali **tidak dihapus diam-diam**; token tetap terlihat pada preview agar typo mudah ditemukan sebelum go-live.

## 3. Logo: sumber yang direkomendasikan

Urutan yang direkomendasikan:

1. upload logo langsung dari Designer Struk;
2. aset lokal `/icon.svg`;
3. URL eksternal hanya jika benar-benar CORS-compatible.

Upload logo diproses di client dan disimpan sebagai data image teroptimasi pada settings, sehingga tetap **Firebase Spark-safe** dan tidak membutuhkan Cloud Storage.

### Rekomendasi file logo

- PNG/SVG/WebP dengan latar transparan atau putih;
- logo sederhana dengan kontras kuat;
- hindari gradient tipis yang sangat halus;
- hindari teks sangat kecil di dalam logo;
- target visual 1–2 warna bila memungkinkan.

## 4. Printable dots: parameter paling penting

Label `58 mm` atau `80 mm` **tidak cukup** untuk menjamin lebar grafis. Printer thermal berbeda dapat mempunyai lebar head berbeda.

Nilai umum:

| Kertas | Nilai awal | Variasi umum |
|---|---:|---:|
| 58 mm | **384 dots** | 360/384 |
| 80 mm | **576 dots** | 512/576 |

PosBakso menyediakan parameter **Print Head / Printable Dots** per printer. Nilai harus kelipatan 8.

### Cara kalibrasi

1. Pair printer pada Android Settings.
2. Buka **Printer → Scan Bluetooth → Hubungkan**.
3. Pilih ukuran kertas.
4. Masukkan nilai awal 384 (58 mm) atau 576 (80 mm).
5. Tekan **Test Print**.
6. Printer mencetak raster full-width dengan marker 0%, 25%, 50%, 75%, 100%.
7. Jika sisi kanan terpotong, kurangi `printWidthDots` bertahap **8 dots**.
8. Jika area cetak terlihat terlalu sempit dan masih tersedia margin hardware, naikkan bertahap 8 dots.
9. Simpan ketika marker 0% dan 100% sama-sama terlihat tanpa clipping.

**Jangan mengubah ukuran logo untuk memperbaiki clipping head.** Kalibrasikan `printWidthDots` terlebih dahulu, baru atur logo.

## 5. Rekomendasi logo per kertas

| Kertas | Printable dots | Lebar logo awal | Mode raster |
|---|---:|---:|---|
| 58 mm | 384 | 22–28 mm | threshold untuk logo solid |
| 80 mm 512 dots | 512 | 26–34 mm | threshold/Floyd–Steinberg |
| 80 mm 576 dots | 576 | 28–38 mm | threshold/Floyd–Steinberg |

Jika logo banyak detail/warna, gunakan **Floyd–Steinberg**. Jika logo solid hitam/merah dengan bentuk tegas, **threshold** biasanya lebih bersih.

### Threshold

Mulai dari **150**. Kemudian:

- logo terlalu hitam/menyatu → turunkan/naikkan sesuai karakter file dan printer setelah test;
- garis tipis hilang → gunakan dithering atau sesuaikan threshold;
- thermal paper berkualitas rendah dapat memerlukan pengaturan berbeda.

Selalu tentukan nilai berdasarkan **hasil print fisik**, bukan monitor.

## 6. QR Code

QR dicetak menggunakan perintah native printer, bukan sebagai gambar screenshot.

Rekomendasi awal:

- 58 mm: module size **4–5**;
- 80 mm: module size **5–6**;
- jangan gunakan URL yang sangat panjang bila tidak perlu;
- beri ruang putih di sekitar QR;
- uji minimal dengan 2 ponsel berbeda.

Acceptance: QR harus dapat dipindai dari struk aktual dalam ≤2 detik pada pencahayaan normal.

## 7. CODE128

Barcode menggunakan CODE128 native.

- sumber: nomor transaksi atau nomor antrean;
- tinggi awal: **72 dots**;
- rentang aplikasi: 40–120 dots;
- karakter non-ASCII disanitasi oleh bridge;
- gunakan nomor transaksi ASCII untuk reliabilitas terbaik.

Acceptance: barcode terbaca oleh scanner yang akan dipakai outlet.

## 8. Codepage dan karakter

Pilihan aplikasi:

- CP437
- CP850
- CP858
- Windows-1252

Printer clone ESC/POS dapat memetakan nomor codepage berbeda. Karena itu **Test Print adalah acceptance gate**.

Uji minimal:

`Rp 25.000 - Makassar - Aa Bb Cc 1234567890`

Bila simbol/karakter tertentu salah, coba codepage lain dan simpan per printer.

## 9. 58 mm vs 80 mm

Layout text dihitung dari `printWidthDots`, bukan hanya label ukuran kertas. Nama menu, modifier, note, header dan footer akan di-wrap agar tidak keluar head.

Preview browser mengikuti 58/80 mm untuk kebutuhan desain, sedangkan hasil fisik Bluetooth mengikuti **actual printable dots**.

## 10. Copy, cut, feed, cash drawer

- `copies`: 1–5;
- `feedLines`: 1–10;
- `cutPaper`: aktifkan hanya jika printer mempunyai cutter;
- `openDrawer`: pulse drawer hanya pada copy pertama agar laci tidak terbuka berulang saat cetak multiple copy.

Printer tanpa cutter sebaiknya memakai `cutPaper = false`.

## 11. Print Job Queue

Cetak transaksi bukan fire-and-forget.

Setiap pekerjaan cetak disimpan lokal dengan status:

`pending → printing → printed`

atau:

`pending → printing → failed → retry`

Informasi yang tersimpan:

- printer tujuan;
- jenis job (receipt/kitchen/bar);
- order;
- jumlah attempt;
- error terakhir;
- payload cetak.

Job berhasil lama dipangkas otomatis agar IndexedDB tidak terus membesar.

## 12. KOT Dapur/Minuman

KOT berbeda dari customer receipt:

- nomor antrean dibuat besar;
- station Dapur dan Minuman terpisah;
- routing kategori mengikuti printer;
- modifier dan catatan item ikut dicetak;
- edit held order menghasilkan **delta ticket** `TAMBAH` / `BATAL`, bukan full duplicate ticket.

Uji routing dengan minimal satu order yang berisi makanan + minuman.

## 13. Matriks acceptance printer

Isi tabel ini untuk setiap printer fisik sebelum go-live:

| Item | Printer Kasir | Printer Dapur | Printer Minuman |
|---|---|---|---|
| Model |  |  |  |
| MAC Bluetooth |  |  |  |
| Kertas |  |  |  |
| Printable dots |  |  |  |
| Codepage |  |  |  |
| Cutter |  |  |  |
| Drawer |  |  |  |
| Test raster lulus | ☐ | ☐ | ☐ |
| Logo presisi | ☐ | n/a | n/a |
| QR terbaca | ☐ | n/a | n/a |
| Barcode terbaca | ☐ | n/a | n/a |
| Text wrap lulus | ☐ | ☐ | ☐ |
| Reconnect lulus | ☐ | ☐ | ☐ |
| Retry job lulus | ☐ | ☐ | ☐ |

## 14. Acceptance final

Printer baru boleh diberi status **siap produksi** bila seluruh kondisi ini terpenuhi:

- test raster tidak clipping;
- alignment logo sesuai preview;
- nominal kanan tidak terpotong;
- header/footer custom tercetak lengkap;
- modifier/note panjang ter-wrap;
- QR/barcode dapat dibaca;
- codepage benar;
- reconnect berhasil setelah app restart;
- paper out / printer off menghasilkan failed print job;
- setelah printer hidup, Retry menghasilkan satu copy yang benar;
- cut/drawer hanya berjalan bila fitur diaktifkan.

Tidak ada konfigurasi universal yang dapat menjamin 100% printer clone ESC/POS tanpa test fisik. Karena itu PosBakso menyediakan kalibrasi head dan test raster sebagai bagian wajib deployment.

# PosBakso — Audit Remediation Register

Tanggal baseline audit: **11 Oktober 2026**  
Versi remediation: **V2 RC2 / schema 4**

Dokumen ini memetakan temuan audit teknis awal ke implementasi saat ini. Status `RESOLVED` berarti source telah diperbaiki dan lolos static QA/internal checks. Status `UAT-GATE` berarti desain/source sudah diperkeras tetapi masih membutuhkan test Firebase/Android/perangkat fisik sebelum production sign-off. `ACCEPTED` berarti merupakan trade-off yang disengaja pada batas **Firebase Spark + offline-first + tanpa backend berbayar**.

## Critical / P0

| ID | Temuan awal | Status | Remediation |
|---|---|---|---|
| C-01 | Demo seed dapat muncul di production kosong | **RESOLVED** | Production memakai `emptyProductionData()`. Snapshot seed lama dideteksi/ditolak di production. Default system roles/printer dipisah dari demo business data. |
| C-02 | Tidak ada realtime inbound sync | **RESOLVED / UAT-GATE** | `onSnapshot` untuk user, role, order operasional, ingredient, product, recipe, settings, printer, shift. Report besar memakai range query khusus. Uji dua perangkat wajib. |
| C-03 | Stock write absolut rawan lost update | **RESOLVED / UAT-GATE** | Penjualan/adjustment memakai delta `increment`; purchase memakai `weightedPurchase` transaction. Pending delta digabung ke realtime snapshot lokal. |
| C-04 | Business effects tidak atomik | **RESOLVED / UAT-GATE** | Order + stock delta + movement + reversal cash + audit dikelompokkan per `batchId`; sync cloud menggunakan Firestore transaction. |
| C-05 | Poison mutation menghentikan seluruh queue | **RESOLVED** | exponential retry untuk transient error, dead-letter untuk non-transient/max attempts, manual Retry pada Sync Health. |
| C-06 | Nomor transaksi dapat duplikat | **RESOLVED** | nomor offline-safe mengandung tanggal + terminal code + sequence lokal; UUID tetap primary id. |
| C-07 | Laporan terbatas 200 order | **RESOLVED** | laporan menggunakan range query `businessDate/refundDate/voidDate`; shift/cash/stock support juga range-query; cache 5 menit + manual refresh. |
| C-08 | Permission UI berbeda dengan Rules | **RESOLVED / UAT-GATE** | Rules membaca `roles/{role}` permissions; action sensitif divalidasi server-side. Emulator test matrix tetap wajib. |
| C-09 | Firestore Rules terlalu longgar | **RESOLVED / UAT-GATE** | field-level invariants, immutable order identity, money arithmetic, discount permission, kitchen allowed fields, shift close fields, deny-all fallback. |
| C-10 | Dapur/Minuman berbagi satu status | **RESOLVED** | `stationStatus.kitchen/bar`, aggregate `kitchenStatus`, KDS station-specific. |
| C-11 | Stock clamp 0 merusak ledger | **RESOLVED** | stock delta matematika dipertahankan termasuk stok negatif; exception terlihat dan auditable. |

## High / P1

| ID | Status | Catatan |
|---|---|---|
| H-01 Financial semantics Net Sales/Tax/Service | **RESOLVED** | Net Item Sales, tax/service, Total Collected, COGS, Gross Profit dipisahkan. |
| H-02 Diskon order tidak dialokasikan ke produk | **RESOLVED** | alokasi diskon proporsional per line untuk product profitability/menu engineering. |
| H-03 HPP hanya tersembunyi di UI | **ACCEPTED LIMITATION** | report UI dibatasi `report.profit`, tetapi Spark/offline client masih membutuhkan cost data untuk HPP/inventory yang akurat. Kerahasiaan HPP absolut membutuhkan trusted backend/pemisahan cost service; tidak diklaim oleh RC ini. |
| H-04 Helper report data terpotong | **RESOLVED** | full range report support untuk shift/cash/stock, cache Spark-aware. |
| H-05 Bootstrap cloud kosong dapat menghapus default config | **RESOLVED** | default roles/printers dipertahankan jika remote empty; bootstrap menulis roles terlebih dahulu. |
| H-06 PIN lokal tersimpan di business object | **RESOLVED FOR PRODUCTION** | production login Firebase Auth; backup disanitasi (`pinHash` tidak diekspor/cloud restore). PIN demo hanya mode demo. |
| H-07 Restore hanya lokal | **RESOLVED / UAT-GATE** | Owner `backup.restore` dapat melakukan cloud **merge** Spark-safe. Firebase Auth sengaja tidak dipulihkan otomatis. |
| H-08 Held order menahan stok tanpa batas | **RESOLVED BY POLICY** | `holdExpiresAt`, stale warning, cancel hold melepas stok. Tidak auto-cancel untuk menghindari pembatalan order yang sedang disiapkan dapur tanpa keputusan manusia. |
| H-09 Print fire-and-forget | **RESOLVED / UAT-GATE** | persistent print jobs, status pending/printing/printed/failed, error, retry. |
| H-10 Printer connected dari cached setting | **RESOLVED** | Topbar/Printer page membaca native socket runtime status. |
| H-11 USB/network dipilih tetapi tidak implemented | **RESOLVED** | UI production hanya menawarkan Bluetooth SPP dan Browser/System Print. |
| H-12 Logo/drawer belum dieksekusi native | **RESOLVED / UAT-GATE** | 1-bit raster `GS v 0`; cash drawer pulse optional; QR/CODE128 native. |
| H-13 Kitchen selalu cut | **RESOLVED** | cut mengikuti config printer. |
| H-14 Bluetooth blocking I/O di main thread | **RESOLVED / UAT-GATE** | Kotlin single-thread executor. |
| H-15 Satu socket multi-printer | **MITIGATED / UAT-GATE** | target MAC per job + auto reconnect/switch. Stress-test station switching wajib; high-volume LAN bukan scope RC. |
| H-16 TrackStock tanpa BOM | **RESOLVED** | fail-safe tidak bisa dijual sampai BOM tersedia. |
| H-17 Modifier tidak punya BOM | **RESOLVED** | modifier recipe items editable dan ikut stock consumption. |
| H-18 Master ingredient dapat mengubah stok/HPP langsung | **RESOLVED** | existing stock/averageCost dipertahankan; perubahan stok melalui movement/purchase. |
| H-19 Waste memakai cost saat ini | **RESOLVED** | `unitCostSnapshot` pada movement. |
| H-20 Cash movement permission drift | **RESOLVED** | UI + rules memakai `cash.move`. |
| H-21 Custom role tidak benar-benar enforce server | **RESOLVED / UAT-GATE** | Rules membaca permission role; `backup.restore` Owner-only. |

## Medium / polish

Sudah ditutup dalam RC2:

- backup tidak menyertakan PIN lokal;
- Topbar menampilkan sync error/pending/offline secara nyata;
- write konfigurasi printer di-debounce;
- supplier & pembelian multi-item tersedia;
- product stock manual tidak menjadi sumber stock untuk product ber-BOM;
- modifier BOM editor tersedia;
- global Error Boundary + recovery screen;
- build membuat precache Service Worker dari asset hash aktual;
- PWA PNG 192/512 + maskable icon;
- mobile nav selalu memiliki **Lainnya**;
- brand/logo/outlet di shell mengikuti settings;
- tombol scanner palsu dihapus;
- Modal memiliki Escape/focus trap/ARIA dasar;
- static QA + domain math tests + GitHub quality workflow.

Masih merupakan **release scope / accepted limitation**, bukan bug P0:

1. **Split bill per item/equal dan partial refund** belum dimasukkan. RC mendukung split tender (Tunai+QRIS/dll). Menambah partial refund membutuhkan ledger per line/reversal yang lebih besar dan tidak dipaksakan menjelang release.
2. **Supervisor PIN override** tidak dipaksakan. Aksi sensitif memerlukan sesi user yang memang memiliki permission. Ini lebih aman daripada menyimpan PIN approval yang dapat di-bruteforce offline.
3. **Device clock** tetap menjadi business timestamp saat benar-benar offline. `sync_events` memberi jejak commit cloud, tetapi tidak dapat mengganti fakta waktu offline tanpa koneksi.
4. **App Check** direkomendasikan setelah domain/deployment Firebase final dan provider dipilih; tidak dijadikan dependency agar tidak mengganggu Spark/offline bootstrap.
5. `PosStore.tsx` masih besar. Ini technical debt modularisasi, bukan blocker integritas transaksi RC2.
6. HPP cost confidentiality absolut tidak dijanjikan karena trade-off Spark-only/offline sebagaimana H-03.

## Printing remediation

Receipt/printing mendapat hardening khusus:

- custom logo upload client-side tanpa Firebase Storage;
- logo alignment + width;
- actual printable head dots 384/512/576/custom;
- Floyd–Steinberg/threshold raster;
- configurable threshold;
- custom header title/subtitle/document title/header lines/footer lines;
- token dynamic receipt;
- field visibility toggles;
- custom QR content/label/module size;
- CODE128 source/height;
- copies/feed/cutter/drawer;
- native codepage command;
- text wrapping untuk item/note/header/footer;
- full-width test calibration raster 0–100%;
- delta KOT `TAMBAH/BATAL` untuk edit held order;
- persistent print job + Retry;
- precise SOP: `docs/PRINTING-PRODUCTION.md`.

## Sign-off rule

Source **tidak boleh disebut production-signed-off** sebelum semua gate berikut lulus:

1. `npm install`, `npm run qa`, `npm run test:domain`, `npm run typecheck`, `npm run build` di workstation internet-enabled.
2. Firestore Rules Emulator matrix semua role.
3. Dua terminal kasir concurrency test + KDS realtime.
4. Crash/retry idempotency test (tidak double stock).
5. Android Studio Gradle compile native plugin.
6. Test printer fisik untuk setiap model: raster/calibration/logo/QR/barcode/cut/drawer/reconnect/retry.
7. 1 hari parallel-run/UAT dengan pencatatan pembanding manual sebelum cutover penuh.

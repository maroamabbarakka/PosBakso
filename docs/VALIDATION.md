# PosBakso V2 RC2 — Validation Record

Tanggal: **11 Oktober 2026**  
Status source: **Feature-complete Release Candidate / UAT-ready**  
Status production sign-off: **PENDING environment & physical gates**

## Static/internal validation yang benar-benar dijalankan

- **41 file TS/TSX** diparse menggunakan TypeScript compiler API: **0 parse error**.
- Semantic internal check dengan stub library eksternal: **0 error non-contextual**; callback contextual typing dari stub tidak dianggap pengganti real `npm run typecheck`.
- CSS brace balance: valid.
- JSON parse: `package.json`, `firebase.json`, `firestore.indexes.json`, `capacitor.config.json`, PWA manifest valid.
- `node scripts/qa.mjs`: **46 checks PASS** pada pemeriksaan terakhir sebelum dokumentasi; script akan dijalankan ulang saat packaging.
- `npm run test:domain`: **6/6 tests PASS**:
  - net base/tax/service;
  - discount clamp;
  - weighted average cost;
  - negative stock ledger;
  - proportional discount allocation;
  - split tender balance.
- Firebase paid-service scan: tidak ada import/use Cloud Functions atau Cloud Storage.
- PWA icon PNG 192/512 + maskable generated.
- receipt native source memuat raster logo, QR, CODE128, calibration raster, cutter/drawer controls.

## Yang tidak bisa divalidasi penuh di runtime ini

### 1. Dependency install + production Vite build
Registry npm tidak dapat dijangkau dari runtime ini (`ENETUNREACH`). Oleh karena itu `node_modules` dan `package-lock.json` belum dapat dibuat di sini.

**Gate workstation:**

```bash
npm install
npm run qa
npm run test:domain
npm run typecheck
npm run build
```

Dependency pada `package.json` telah dipin ke versi exact untuk mengurangi drift sampai lockfile pertama berhasil dibuat. Setelah `npm install` sukses, **commit `package-lock.json`**.

### 2. Firebase Rules Emulator
Rules sudah diperkeras, tetapi harus diuji dengan Emulator/Auth mock untuk Owner, Manager, Supervisor, Cashier, Kitchen, Warehouse.

### 3. Android native compile
Source Kotlin tersedia tetapi Android SDK/Gradle/Capacitor classes tidak tersedia di runtime ini. `kotlinc` standalone bukan validator Android plugin yang sah karena dependency Android/Capacitor tidak tersedia.

### 4. Printer thermal fisik
Tidak mungkin memvalidasi clipping head, codepage clone, darkness thermal, QR scanning, cutter, drawer, paper-out dan reconnect tanpa model printer nyata.

## Reliability changes yang divalidasi secara source

### Cloud sync
- idempotent `sync_events/{batchId}`;
- Firestore transaction untuk domain batch;
- atomic stock increment;
- weighted purchase server transaction;
- retry/backoff/dead-letter;
- realtime inbound listeners;
- pending local delta overlay;
- terminal-safe numbering.

### Reporting
- full date-range order query;
- full date-range shift/cash/stock support query;
- Spark-aware 5 minute cache;
- manual Cloud Refresh;
- Net Item Sales terpisah Tax/Service;
- discount allocated to product;
- COGS/refund reversal;
- waste `unitCostSnapshot`.

### Printing
- custom receipt designer;
- exact printable dots;
- raster logo 1-bit;
- QR native;
- CODE128 native;
- test calibration raster;
- persistent print job/retry;
- station KOT and delta ticket.

## Known accepted limitations

Lihat `docs/AUDIT-REMEDIATION.md`. Tidak ada known Critical/P0 source finding dari audit awal yang sengaja dibiarkan terbuka, tetapi beberapa perbaikan berstatus **UAT-GATE** karena baru dapat dibuktikan dengan environment nyata.

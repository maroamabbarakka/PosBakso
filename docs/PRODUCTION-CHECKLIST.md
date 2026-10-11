# Production Checklist — Bakso Umum POS RC2

Checklist ini **harus** diselesaikan sebelum transaksi riil.

## A. Workstation build gate

- [ ] Node 22 tersedia.
- [ ] `npm install` sukses.
- [ ] `package-lock.json` terbentuk dan di-commit.
- [ ] `npm run qa` PASS.
- [ ] `npm run test:domain` PASS.
- [ ] `npm run typecheck` PASS.
- [ ] `npm run build` PASS.
- [ ] `dist/sw.js` generated oleh `scripts/generate-sw.mjs`.
- [ ] PWA install desktop/Android berhasil.
- [ ] Reload offline setelah first install berhasil membuka app shell.

## B. Firebase Spark gate

- [ ] Plan tetap **Spark**.
- [ ] Authentication Email/Password aktif.
- [ ] Firestore aktif.
- [ ] Hosting aktif bila digunakan.
- [ ] Cloud Functions **tidak digunakan**.
- [ ] Cloud Storage **tidak digunakan**.
- [ ] App Hosting **tidak digunakan**.
- [ ] `.env.local` berisi config web project yang benar.
- [ ] Owner Auth user dibuat.
- [ ] `users/{ownerUid}` dibuat dengan `role=owner`, `active=true`.
- [ ] Login Owner berhasil.
- [ ] **Inisialisasi Master Data Cloud** dijalankan; role ditulis lebih dahulu.
- [ ] Firestore Rules + indexes deploy sukses.

## C. Rules permission matrix

Uji Emulator/project staging:

- [ ] Cashier create held/paid order miliknya.
- [ ] Cashier tidak bisa discount jika tanpa `sale.discount`.
- [ ] Cashier tidak bisa refund/void tanpa permission.
- [ ] Kitchen hanya dapat mengubah station status/updatedAt.
- [ ] Kitchen tidak dapat mengubah total/item/cashier.
- [ ] Warehouse dapat adjustment/purchase sesuai permission.
- [ ] Manager non-owner tidak dapat memberikan `backup.restore`.
- [ ] Owner dapat role/settings/printer/backup restore.
- [ ] Order money arithmetic palsu ditolak Rules.
- [ ] Mutasi di luar field allow-list ditolak.
- [ ] unknown collection ditolak deny-all fallback.

## D. Multi-device / concurrency gate

Gunakan minimal Kasir A + Kasir B + Tablet Dapur:

- [ ] Order A tampil di KDS B tanpa reload.
- [ ] Order B tampil di Manager/KDS tanpa reload.
- [ ] Dua kasir menjual ingredient sama bersamaan → stock akhir benar.
- [ ] Sequence order berbeda karena terminal code.
- [ ] Matikan internet A → transaksi tetap berhasil lokal.
- [ ] Hidupkan internet → queue flush.
- [ ] Simulasikan retry batch yang sama → stock **tidak double decrement**.
- [ ] Satu mutation invalid masuk dead-letter; mutation berikutnya tetap dapat diproses.
- [ ] Sync Error terlihat pada Topbar/Settings.
- [ ] Retry dead-letter berhasil setelah sebab diperbaiki.

## E. Shift/cash gate

- [ ] Open shift sebelum sale.
- [ ] Cash movement hanya muncul untuk user dengan `cash.move`.
- [ ] Split tender cash + QRIS menghasilkan cash expected benar.
- [ ] Refund cash menghasilkan cash-out reversal.
- [ ] Close shift hanya field penutupan yang berubah.
- [ ] expected vs actual + selisih cocok dengan hitung manual.

## F. Inventory/HPP gate

- [ ] Semua product `trackStock` mempunyai BOM.
- [ ] Modifier stock-affecting mempunyai BOM.
- [ ] Sale mengurangi bahan sebagai delta.
- [ ] Edit held order menghasilkan hanya delta baru.
- [ ] Void/refund mengembalikan ingredient tepat.
- [ ] Negative stock terlihat, tidak silently clamp.
- [ ] Purchase concurrent menghasilkan weighted average cost benar.
- [ ] Stock adjustment/waste/opname mempunyai movement.
- [ ] Waste cost memakai snapshot cost.
- [ ] laporan HPP manual sample cocok.

## G. Receipt Designer gate

- [ ] Nama brand/outlet benar.
- [ ] Logo custom upload berhasil.
- [ ] Judul/subjudul/document title benar.
- [ ] Header/footer multi-baris benar.
- [ ] Token `{order_number}`, `{queue_number}`, `{cashier}`, `{total}` diuji.
- [ ] Field visibility sesuai kebutuhan.
- [ ] Tax/service breakdown sesuai kebijakan outlet.
- [ ] QR value/label benar.
- [ ] Barcode source benar.
- [ ] Jumlah copy/feed sesuai.

## H. Printer fisik — WAJIB per model

Ikuti `docs/PRINTING-PRODUCTION.md`.

- [ ] Android pairing berhasil.
- [ ] Scan Bluetooth menemukan device.
- [ ] Runtime socket status benar.
- [ ] Test Print keluar.
- [ ] Printable dots dikalibrasi (384/512/576/custom).
- [ ] Raster 0–100% tidak clipping.
- [ ] Logo presisi/center sesuai setting.
- [ ] nominal kanan tidak terpotong.
- [ ] text note panjang wrap.
- [ ] codepage benar.
- [ ] QR dapat discan.
- [ ] CODE128 dapat discan.
- [ ] cut bekerja hanya bila aktif.
- [ ] drawer pulse hanya bila aktif dan satu kali untuk multi-copy.
- [ ] paper-out/offline menghasilkan failed print job.
- [ ] Retry setelah printer online menghasilkan struk yang benar.
- [ ] printer switching Kasir → Dapur → Minuman lulus stress test.
- [ ] edit held order menghasilkan `TAMBAH/BATAL`, tidak full duplicate ticket.

## I. Reporting gate

Bandingkan minimal 20 transaksi fixture/manual:

- [ ] Gross Item Sales.
- [ ] Discount.
- [ ] Net Item Sales.
- [ ] Tax collected.
- [ ] Service collected.
- [ ] Total Collected.
- [ ] HPP.
- [ ] Gross Profit.
- [ ] Refund pada hari berbeda.
- [ ] Void.
- [ ] payment mix.
- [ ] product discount allocation.
- [ ] shift expected/actual.
- [ ] waste cost.
- [ ] 7/30-day cloud report lengkap, bukan hanya operational listener window.

## J. Backup / recovery gate

- [ ] Backup JSON tidak mengandung `pinHash`.
- [ ] restore lokal staging berhasil.
- [ ] Owner cloud merge staging berhasil.
- [ ] pending sync kembali 0.
- [ ] cloud docs sample cocok backup.
- [ ] dijelaskan bahwa Firebase Authentication tidak direstore otomatis.
- [ ] restore tidak menghapus cloud docs ekstra tanpa keputusan manual.

## K. Cutover

- [ ] Training Kasir.
- [ ] Training Supervisor/Manager.
- [ ] Training Dapur/Minuman.
- [ ] SOP paper-out/printer-off.
- [ ] SOP sync error.
- [ ] SOP void/refund.
- [ ] SOP closing shift.
- [ ] Backup pertama tersimpan di dua lokasi.
- [ ] parallel-run 1 hari dengan pembanding manual.
- [ ] selisih omzet/stok/cash diselesaikan sebelum full cutover.

**Go-live hanya jika seluruh item critical pada A–J lulus.**

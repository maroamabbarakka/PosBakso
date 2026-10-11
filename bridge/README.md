# POS Bakso Windows Print Bridge

1. Instal driver Windows untuk IWARE X58BT II dan pastikan test page Windows berhasil.
2. Jalankan `npm run bridge` dari folder aplikasi. Jangan tutup terminal selama POS digunakan.
3. Di Pengaturan Printer POS, isi kode pairing enam digit yang tampil di terminal, pilih printer Windows, lalu jalankan Test Print.

Bridge hanya mendengarkan `127.0.0.1`, membatasi origin web POS, memakai bearer token lokal, dan menolak pengiriman ulang `jobId` yang sama. Token/state lokal berada di `bridge/.bridge-state.json` dan tidak boleh dimasukkan ke Git.

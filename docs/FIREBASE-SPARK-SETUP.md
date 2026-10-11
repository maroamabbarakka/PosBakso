# Firebase Spark Setup — Bakso Umum POS

Dokumen ini menjaga deployment tetap pada **Firebase Spark** dan tidak memperkenalkan layanan yang meminta billing/Blaze.

## 1. Layanan yang diizinkan

Gunakan hanya:

- **Firebase Authentication** — Email/Password.
- **Cloud Firestore** — database/sync cloud.
- **Firebase Hosting** — hosting hasil build statis.

Jangan aktifkan sebagai dependensi aplikasi:

- Cloud Functions
- Cloud Storage
- Firebase App Hosting
- Extension yang mensyaratkan billing

Foto produk, logo, dan icon ditempatkan di `public/` lalu dilayani sebagai asset Firebase Hosting.

## 2. Buat project Firebase

1. Firebase Console → Add project.
2. Biarkan project pada paket **Spark**.
3. Tambahkan **Web App**.
4. Salin konfigurasi web (`apiKey`, `authDomain`, `projectId`, `appId`).
5. Jangan memasang billing account untuk kebutuhan aplikasi ini.

## 3. Environment

Copy:

```bash
cp .env.example .env.local
```

Isi:

```env
VITE_DEMO_MODE=false
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

Konfigurasi Web Firebase bukan server secret; keamanan data berasal dari Authentication + Firestore Rules. Jangan menaruh service-account/Admin SDK key pada aplikasi client.

## 4. Authentication

Firebase Console → Authentication → Sign-in method → aktifkan **Email/Password**.

Aplikasi produksi tidak membuat akun Authentication melalui Admin SDK karena project sengaja tidak memakai trusted backend/Cloud Functions. Pembuatan akun dilakukan manual oleh Owner/Admin Firebase Console:

1. Authentication → Users → Add user.
2. Catat UID.
3. Buat profil Firestore pada `users/{UID}`.

Contoh profil Owner pertama:

```json
{
  "id": "FIREBASE_AUTH_UID",
  "name": "Pemilik",
  "email": "owner@example.com",
  "role": "owner",
  "roleLabel": "Pemilik",
  "active": true,
  "avatarInitials": "BU"
}
```

**Penting:** document ID harus sama dengan Firebase Authentication UID.

Setelah Owner bisa login, data master dapat di-bootstrap dari menu Pengaturan sesuai UI yang tersedia.

## 5. Firestore

Buat Firestore Database. Untuk production gunakan region terdekat yang sesuai kebutuhan operasional dan kebijakan data Anda.

Deploy rules dan indexes dari repo:

```bash
firebase login
firebase use --add
firebase deploy --only firestore
```

Rules utama ada di `firestore.rules`.

### Model akses

- Owner: semua permission aplikasi.
- Manager: operasional luas, tetapi tidak dapat membuat/mengubah user menjadi Owner.
- Supervisor: transaksi sensitif, inventory tertentu, laporan.
- Kasir: transaksi/shift sesuai permission.
- Dapur: hanya workflow KDS pada order.
- Gudang: inventory/purchase.

Owner role hanya dapat dikelola Owner.

## 6. Hosting

Install Firebase CLI bila belum ada lalu:

```bash
npm install
npm run build
firebase deploy --only hosting
```

`firebase.json` menunjuk ke `dist/` dan menggunakan SPA rewrite.

## 7. Offline-first

Aplikasi menggunakan dua lapisan lokal:

1. Firestore persistent client cache.
2. IndexedDB snapshot + mutation queue aplikasi.

Saat internet putus, transaksi tetap berada pada perangkat. Indicator sync menampilkan antrean pending dan aplikasi mencoba sinkron kembali ketika jaringan pulih.

Sebelum go-live, wajib melakukan skenario pengujian offline pada `PRODUCTION-CHECKLIST.md`.

## 8. Spark-safe design

Aplikasi tidak menjalankan:

- server-side report generation;
- scheduled Cloud Functions;
- server image upload;
- Cloud Storage upload;
- server webhook Firebase berbayar.

Laporan dihitung client-side dari data yang sudah disinkronkan. Export CSV/backup JSON juga dibuat client-side.

## 9. Asset foto produk

Simpan asset terkompresi di:

```text
public/products/
```

Referensi produk cukup berupa path seperti:

```text
/products/bakso-umum.webp
```

Hindari gambar berukuran besar untuk menghemat transfer Hosting dan mempercepat POS.

## 10. Bootstrap production yang aman

Urutan yang disarankan:

1. Deploy Firestore Rules.
2. Aktifkan Email/Password.
3. Buat Auth user Owner.
4. Buat `users/{UID}` Owner.
5. Isi `.env.local`, build, deploy Hosting.
6. Login sebagai Owner.
7. Review Role & Permission.
8. Isi profil outlet, meja, pajak/service, printer.
9. Isi produk, bahan, resep, supplier.
10. Lakukan stock opname awal.
11. Test shift → transaksi → dapur → struk → tutup shift.
12. Test offline/reconnect.
13. Backup JSON pertama sebelum go-live.

## 11. Catatan keamanan arsitektur tanpa backend

Tanpa Cloud Functions/Admin SDK, operasi multi-document dijalankan oleh authenticated client. Firestore Rules membatasi siapa yang dapat menulis koleksi/field, tetapi Rules tidak menggantikan trusted server untuk invariant bisnis lintas banyak dokumen.

Karena itu:
- hanya instal aplikasi pada perangkat operasional terpercaya;
- jangan berikan akun Firebase kepada pihak yang tidak berkepentingan;
- audit role secara berkala;
- Manager tidak boleh digunakan untuk menaikkan akun menjadi Owner; Owner dikelola oleh Owner;
- review Audit Log, stock adjustment, void/refund, dan selisih shift;
- lakukan backup rutin.

# Android Bluetooth ESC/POS — Bakso Umum POS

POS browser/PWA menyediakan preview/system print. Untuk koneksi langsung ke printer thermal **Bluetooth Classic/SPP**, PosBakso menggunakan APK Android berbasis Capacitor + plugin Kotlin lokal.

## Source native yang sudah tersedia

- `src/services/printer.ts` — bridge TypeScript, connection truth, print jobs, auto reconnect, test print, receipt/KOT.
- `native/android/com/maroamabbarakka/posbakso/EscPosPrinterPlugin.kt` — plugin Capacitor Kotlin.
- `native/android/com/maroamabbarakka/posbakso/MainActivity.kt` — registrasi plugin.
- `native/android/AndroidManifest.permissions.xml` — permission Bluetooth yang harus digabungkan ke manifest generated Android.

## Generate Android project

Di workstation yang mempunyai akses npm:

```bash
npm install
npm run qa
npm run typecheck
npm run build
npx cap add android
```

Setelah `android/` terbentuk:

1. Salin `native/android/com/maroamabbarakka/posbakso/EscPosPrinterPlugin.kt` ke:
   `android/app/src/main/java/com/maroamabbarakka/posbakso/EscPosPrinterPlugin.kt`
2. Gunakan isi `native/android/com/maroamabbarakka/posbakso/MainActivity.kt` pada MainActivity generated.
3. Gabungkan permission dari `native/android/AndroidManifest.permissions.xml` ke `<manifest>` di `android/app/src/main/AndroidManifest.xml`.
4. Jalankan:

```bash
npm run android:sync
npm run android:open
```

5. Dari Android Studio jalankan **Build > Make Project** lalu `assembleDebug`/`assembleRelease` sesuai kebutuhan.

> Folder Android generated tidak diklaim sudah terkompilasi dari runtime penyusunan source ini karena Android SDK/Gradle/Capacitor JAR tidak tersedia di runtime tersebut. Build Android Studio pada workstation target adalah release gate wajib.

## Permission

Manifest fragment:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
```

Plugin mendeklarasikan alias `bluetoothConnect` dan `bluetoothScan`. Client meminta permission sebelum scan/connect.

## Pairing dan koneksi

1. Pair printer dari **Android Settings → Bluetooth** terlebih dahulu.
2. PosBakso → **Printer → Scan Bluetooth**.
3. Pilih printer paired.
4. Hubungkan.
5. Jalankan Test Print.
6. Kalibrasikan printable dots.

Bridge menyimpan alamat perangkat pada konfigurasi printer dan melakukan reconnect ke printer tujuan saat job berikutnya membutuhkan perangkat tersebut.

## Kemampuan native

- Bluetooth Classic RFCOMM/SPP;
- ESC/POS init;
- selectable codepage;
- 58/80 mm;
- actual printable dots;
- alignment;
- bold/double-size;
- wrap text;
- raster logo monokrom;
- QR native;
- CODE128 native;
- feed;
- cutter optional;
- cash drawer pulse optional;
- multiple copy;
- KOT Dapur/Bar;
- full-width calibration raster;
- blocking Bluetooth I/O dijalankan melalui single-thread executor, bukan UI thread.

## Transport yang benar-benar didukung

Produksi saat ini:

- **Bluetooth Classic/SPP:** ya.
- **Browser/System Print:** ya, untuk preview/fallback.
- USB native: belum ditawarkan UI produksi.
- LAN native: belum ditawarkan UI produksi.

UI sengaja tidak menjanjikan USB/LAN sebelum transport tersebut benar-benar diimplementasikan.

## Multi-printer

Konfigurasi menyimpan MAC per printer. Bridge memakai satu socket aktif dan otomatis berpindah ke target ketika urutan job membutuhkan printer lain.

Untuk trafik sangat tinggi, lakukan stress test pergantian Kasir → Dapur → Minuman. Jika volume outlet berkembang jauh lebih besar, LAN per station dapat menjadi upgrade arsitektur di masa depan tanpa mengubah Firebase plan.

## Kalibrasi grafis

Gunakan [`PRINTING-PRODUCTION.md`](PRINTING-PRODUCTION.md). Jangan menganggap semua printer 80 mm mempunyai 576 dots; sebagian clone menggunakan 512 dots.

## Tidak bergantung Firebase berbayar

Printer native bekerja lokal dan tidak menggunakan Cloud Functions, Cloud Storage, maupun Firebase App Hosting. Struk tetap dapat dicetak saat internet putus selama order tersimpan lokal dan printer terhubung.

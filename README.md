# PIXCRAFT Studio 3.0

Studio gambar portfolio R_HMT, meneruskan source pengguna dengan React + TypeScript + Vite. **Credit by r_hmt ofc.** Tidak memerlukan database backend atau pengaturan region.

## Deploy Vercel

1. Ekstrak ZIP ke repository. Root Directory harus berisi `package.json`, `vercel.json`, `api/`, `server/`, `src/` dan `public/`.
2. Framework **Vite**, build **npm run build**, output **dist**, Node **22.x** (sudah ditentukan di package.json).
3. Untuk layanan iLoveAPI, isi dua ENV berikut lalu deploy/redeploy:

| ENV | Isi |
| --- | --- |
| ILOVEAPI_PUBLIC_KEY | Public key proyek iLoveAPI |
| ILOVEAPI_SECRET_KEY | Secret key proyek yang sama |

Alat browser bekerja tanpa ENV. Tanpa kedua key, endpoint server menyediakan **Basic engine** (Sharp): pembesaran biasa dan penghapusan latar sederhana, bukan model AI. UI menjelaskan mesin yang digunakan. Jika provider dikonfigurasi lalu gagal, kegagalan ditampilkan tanpa diam-diam beralih mesin. Jangan memberi prefix `VITE_` pada key.

Tidak perlu memilih region, Redis, signing secret tambahan, atau login aplikasi. Key/kuota provider dan deployment live harus diverifikasi dengan akun pemilik; paket ini belum dipublikasikan ke Vercel.

## Fitur

- Landing responsif, animasi ringan, SVG lokal, reduced motion, tema terang/gelap, ID/EN dan halaman About R_HMT.
- Studio kosong yang disengaja: pilih, drop atau paste gambar; contoh hanya dibuka melalui tindakan contoh yang eksplisit.
- Koleksi multi-gambar dengan thumbnail, tambah/ganti terpisah, pemilihan batch, undo/redo dan compare original/langkah sebelumnya.
- Compress target KB, Resize, Convert, Crop, Rotate/Flip, color correction, Watermark, Latar dan Overlay di browser.
- Color correction berkelompok, looks, preset pribadi dan copy/paste style. Overlay bawaan/custom dapat diurutkan dan dimatikan.
- **Composer 2–5 frame**: template, divider, rasio/dimensi kanvas, Fill/Fit, pan/zoom, jarak/margin/border/radius, style dan pemrosesan server khusus frame.
- Ekspor gambar aktif, pilihan atau semua ke ZIP; Composer mengekspor kanvas pada dimensi yang dipilih.
- Resep batch, impor/ekspor JSON tervalidasi, workspace tersimpan, autosave/recovery serta migrasi proyek lama.
- Alat lokal dapat dibuka offline setelah aplikasi dan aset selesai dicache.

## Kontrak gambar

Sumber asli tetap disimpan. Edit menyimpan parameter; preview kecil tidak pernah menjadi sumber ekspor. Render final memakai sumber dan parameter aktif, kemudian melakukan encoding sekali pada keluaran. Compress/Convert merupakan kebijakan output, sehingga edit berikutnya tidak mengambil JPEG/WebP hasil kompres sebagai master baru. Hasil HD/Remove BG menjadi checkpoint sumber baru tanpa menghapus original.

Target KB adalah **batas maksimum**, bukan janji ukuran tepat. PNG kadang memerlukan dimensi lebih kecil. Pengurangan dimensi harus diizinkan pengguna; kegagalan mempertahankan hasil valid terakhir.

## Lokal dan pengujian

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Buka http://localhost:3000. Dev menyediakan UI dan API. `npm run preview` hanya frontend.

```bash
npm run test:all
npm run capture
```

`test:all` menjalankan unit/API, build TypeScript/Vite, bundling empat fungsi Vercel, regresi UI dan tes PRD. Chromium Linux disediakan dependency development; gunakan `PIXCRAFT_TEST_CHROMIUM=/path/to/chromium` pada platform lain. Detail bukti dan batas pengujian ada di [hasil tes](docs/TEST-RESULTS.md).

## Batas operasional

| Bagian | Batas |
| --- | --- |
| Input lokal | JPEG/PNG/WebP statis, 50 MiB, 64 MP |
| Koleksi | 12 gambar; anggaran blob sumber/versi 150 MiB |
| Riwayat | 50 entri per gambar/Composer, original dipertahankan |
| Composer | 2–5 frame; maksimum kanvas 8000 × 8000 |
| Input endpoint server | 3 MB; batas gambar/hasil 64 MP |
| Respons gambar server | 4 MB |
| Resep | 20 tersimpan, maksimal 8 langkah |
| Overlay | 5 lapisan |

Batas adalah plafon validasi, bukan jaminan semua ponsel mampu memproses ukuran maksimum. Batch berurutan mengurangi tekanan memori. Autosave menunggu 800 ms setelah perubahan; ekspor/simpan sebelum menutup tab untuk pekerjaan penting.

## Dokumentasi

- [Deployment](docs/DEPLOYMENT.md)
- [Arsitektur dan pengembangan](docs/ARCHITECTURE.md)
- [Migrasi](docs/MIGRATION.md)
- [Pemetaan PRD](docs/PRD-ACCEPTANCE.md)
- [Validasi provider live](docs/AI-ACCEPTANCE.md)
- [Privasi](docs/PRIVACY.md)
- [Changelog](docs/CHANGELOG.md)
- [Aset dan lisensi](docs/ASSETS-LICENSES.md)

Tidak ada login, billing atau kuota per pengguna. Jika provider diaktifkan pada situs publik, pengunjung dapat memakai kredit akun tersebut.

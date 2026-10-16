# Hasil pengujian — Pixcraft 3.0

Tanggal: 7 Oktober 2026. Source diperbarui dari ZIP pengguna; tidak dibuat ulang.

## Hasil aktual

| Pemeriksaan | Hasil |
| --- | --- |
| npm ci pada baseline | Berhasil, lockfile dipertahankan |
| Unit, state, layout, API, keamanan input dan resep | 14/14 lolos |
| TypeScript dan Vite production build | Lolos |
| Builder Vercel | 4/4 fungsi berhasil, termasuk dependensi Sharp |
| Regresi browser tests/ui.mjs | 18/18 lolos |
| PRD tests/v3.mjs | 17/17 lolos |
| Raster Composer | 55 kombinasi jumlah/template/rasio tanpa piksel celah pada gap=0 |
| ZIP batch | CRC/integritas lolos; dua gambar dan laporan JSON |
| Browser runtime errors | Tidak ada pada kedua suite |

Bukti: qa/unit-results.txt, qa/ui-results.json, qa/v3-results.json, qa/vercel-builder.json. Screenshot produksi menggunakan aset arsitektur berada di qa/screenshots/preview-*. Screenshot lainnya menggunakan fixture terukur.

## Cakupan

Regresi: landing/tema/bahasa, empty entry tanpa picker/sample otomatis, target KB dan alpha, resize→compress, compare original/langkah sebelumnya, batch/resep, ZIP, background/crop/rotate/CC/watermark, kegagalan target, recipe JSON, tambah/ganti gambar, simpan/reload, responsive, reduced motion, provider simulasi→HD→Remove BG→compress, offline reload dan edit lokal.

PRD: sumber penuh 3000×2000 tetap utuh setelah preview 500 px, policy WebP tetap setelah CC, alpha, overlay disable, cancel, checkpoint v1, 2–5 frame seluruh template/rasio, impor lima gambar independen, satu gesture CC=satu undo, scope batch/failed job, flyout mobile dengan posisi pseudo-element aktual, layout/rasio/style per frame, ekspor 2160×2700, HD pada satu dari dua instance sumber yang sama, gesture touch pinch vs divider, recovery Composer, migrasi IndexedDB v1, kuota gagal tanpa kehilangan pekerjaan di memori, About/fallback avatar/link, reduced motion.

Viewport editor/landing: 360/480/768/1024/1440 dan landscape 844×390. Flyout: 360/375/390/412/480. Composer: 360/375/390/412/480/768/1024/1440 serta landscape. Touch menggunakan input CDP, bukan sekadar event mouse.

## Temuan yang diperbaiki

- Baseline berhenti setelah 13 skenario karena tindakan server masih aktif ketika backend tidak tersedia. Regresi v3 meloloskan seluruh 18 skenario.
- Rotasi meninggalkan transform canvas sehingga watermark berikutnya tidak terlihat; state context kini dipulihkan.
- Divider bersarang memiliki area sentuh yang bertabrakan; endpoint area sentuh dipangkas.
- CSS desktop menimpa panah flyout mobile; urutan stylesheet diperbaiki dan tes memeriksa posisi panah yang benar-benar dirender.
- Aturan reduced-motion lama membuat input transparan pada demo compare terlihat; override opacity kini dibatasi pada konten animasi dan diverifikasi oleh tes.
- Basic engine menyimpan job dalam Map proses; kini mengembalikan hasil langsung agar aman lintas invocation serverless.
- Hasil yang gagal tidak lagi menghalangi ekspor versi valid terakhir.

## Batas verifikasi dan lingkungan

Node 24.19.0, Chromium 153, Linux. Konfigurasi deployment Node 22.x diperiksa melalui build/builder; runtime Node 22 live belum dijalankan. Browser bundle Chromium sempat gagal diekstrak akibat chown lingkungan uji. Bundle yang sama diekstrak tanpa perubahan kepemilikan, font runtime dipasang, lalu kedua suite browser dijalankan ulang sampai lolos. Ini bukan perubahan dependency aplikasi.

Panggilan iLoveAPI menggunakan mock; Basic engine diuji langsung. Key, kuota, kualitas hasil iLoveAPI dan deployment akun Vercel belum diuji live. Lihat AI-ACCEPTANCE.md.

Viewport/touch disimulasikan pada Chromium; Android/iOS fisik, Safari, dan ponsel RAM rendah belum diuji. Batas 64 MP bukan jaminan semua perangkat mampu mengekspornya. Tidak ada klaim semua browser atau seluruh kemungkinan input telah teruji. Offline memerlukan kunjungan/cache awal; proses server membutuhkan koneksi. Autosave 800 ms masih dapat kehilangan perubahan terakhir pada penutupan mendadak.

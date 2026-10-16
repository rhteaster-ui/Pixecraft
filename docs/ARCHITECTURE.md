# Arsitektur Pixcraft 3.0

Source pengguna dipertahankan dan dikembangkan. React/TypeScript/Vite, adapter provider, endpoint kompatibilitas, tema dan aset tetap digunakan. Tidak ada database backend atau layanan region baru.

## Peta source

| Modul | Tanggung jawab |
| --- | --- |
| src/StudioApp.tsx | Route landing/studio/about, mode, recovery, dialog dan ekspor |
| src/studio/useStudio.ts | Koleksi, operasi, batch, versi dan pembatalan |
| src/studio/document.ts | State gambar, operasi logis, migrasi dan checkpoint |
| src/studio/render.ts | Render sumber penuh, geometry/style/overlay/output |
| src/document.worker.ts | Render worker dan pembatalan pekerjaan |
| src/studio/layout.ts | Split tree, template, koordinat/pixel frame dan Fill/Fit |
| src/studio/useComposer.ts | Draft gesture dan riwayat Composer |
| src/components/Composer.tsx | Kanvas, touch/pinch, divider dan pengaturan frame |
| src/components/ColorControls.tsx | Color correction, looks, preset dan overlay |
| src/components/EditorParts.tsx | Stage/crop/compare dan alat single image |
| src/components/Landing.tsx / About.tsx | Landing dan identitas portfolio |
| src/storage.ts | IndexedDB v2, workspace dan proyek legacy |
| src/studio/recipeValidation.ts | Validasi JSON resep dengan Zod, dimuat saat diperlukan |
| src/studio/zip.ts | ZIP, nama aman dan laporan ekspor |
| src/engine.ts / header.ts | Decode, validasi, encoding target dan alat kompatibilitas |
| src/api.ts | Klien backend, direct response atau polling provider |
| api/ai.ts / server/provider.ts | Basic engine Sharp / adapter iLoveAPI |
| server/core.ts | Guard method/origin, payload dan signing |
| api/images.ts / server/images.ts | API kompatibilitas |
| server.ts | Dev UI/API tanpa Vercel CLI |
| public/sw.js / vite.config.ts | Cache shell dan build |
| src/portfolio.css | Penambahan UI v3; dimuat setelah styles.css dan studio.css |

## Render dan state

Original dipertahankan. Setiap versi menyimpan state logis: sumber, geometry, style, overlay dan output policy. Urutan render: sumber → geometry → color correction → watermark → overlay → encoder. Preview dibatasi terpisah; ekspor merender sumber penuh. Pencarian kualitas target KB boleh mencoba beberapa encoding dari master render yang sama, bukan dari generasi lossy sebelumnya.

Compress/Convert mengubah output policy. Edit berikutnya memakai sumber dan parameter, mempertahankan policy. Resize target yang diizinkan menjadi perubahan geometry eksplisit. AI memproses hasil aktif dan membuat checkpoint baru. State lama tetap tersedia melalui undo/original.

Satu gesture slider/drag menjadi satu entri history. Maksimal 50 entri; original dipertahankan. Batch berurutan dan resep atomik per gambar; kegagalan tidak menghapus versi valid. Ekspor dapat menyertakan versi valid item gagal dengan peringatan dan laporan ZIP. Worker dihentikan saat cancel; provider yang sudah menerima task dapat tetap berjalan.

## Composer

Setiap frame menyimpan snapshot sumber/style independen. Fill/Fit, pan, zoom, CC, overlay dan hasil server hanya memengaruhi frame sasaran. Split tree dinormalisasi; batas pembagi menjaga frame tidak runtuh. Piksel memakai endpoint pembulatan bersama untuk menghindari celah 1 px. Margin, gap, border dan radius diterapkan terpisah. Gesture Content dan Layout dipisahkan, termasuk touch/pinch.

Hanya satu Composer aktif per workspace; beberapa workspace dapat disimpan. Ini bukan kanvas bebas dengan objek tak terbatas.

## Penyimpanan dan perluasan

IndexedDB v2 menambah store workspaces tanpa menghapus projects lama. Autosave setelah 800 ms, recovery ditawarkan eksplisit. Detail ada pada MIGRATION.md. Recipe/preset/theme memakai localStorage.

Untuk menambah alat, perbarui types/default, registry/i18n, kontrol, operasi di document.ts, serta render.ts. Pertahankan kontrak sumber penuh, snapshot immutable dan output policy. Tambahkan verifikasi perilaku penting pada tests/document.test.ts atau tests/v3.mjs. Recipe JSON mengecualikan blob logo/custom overlay; gunakan workspace untuk menyimpan aset tersebut.

Untuk template Composer baru, perluas layout.ts tanpa menduplikasi logika piksel pada UI. Branding portfolio R_HMT bukan sistem white-label/reseller. Dekorasi berupa SVG lokal; motion menghormati reduced motion.

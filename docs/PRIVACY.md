# Privasi

Compress, Resize, Convert, Crop, Rotate, color correction, Watermark, Latar, Overlay dan Composer diproses di browser. Memilih alat lokal tidak mengunggah foto ke server.

Workspace otomatis disimpan ke IndexedDB setelah jeda 800 ms; Simpan proyek menyimpan workspace secara manual. Recovery menawarkan pemulihan, bukan membuka foto diam-diam. Resep, preset dan preferensi bahasa/tema memakai localStorage. Data tidak tersinkron antarperangkat dan dapat hilang saat data situs dibersihkan atau kuota browser habis. Kegagalan simpan ditampilkan agar pengguna tetap dapat mengekspor.

HD Enhance dan Remove Background mengirim input aktif setelah konfirmasi: ke endpoint Basic engine jika tanpa key, atau melalui server ke iLoveAPI jika provider dikonfigurasi. Key tetap di ENV server. Hasil server pada Composer hanya mengubah frame sasaran. Ketentuan hosting/provider berlaku; tidak ada janji zero-retention. Pembatalan UI tidak menjamin task provider/kredit dibatalkan.

Halaman About memuat avatar publik dari rhmt.biz.id dengan fallback lokal dan tanpa mengirim foto pengguna. Tidak ada analytics, iklan, OAuth, billing atau history cloud. Cache Storage hanya menyimpan shell/aset publik; API dan foto pribadi tidak masuk cache service worker.

Dengan provider aktif, pengunjung dapat menggunakan kredit akun pemilik; versi ini tidak memiliki gate login atau kuota per pengguna.

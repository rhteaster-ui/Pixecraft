# Pengecekan provider setelah deploy

Tes otomatis memeriksa Basic engine langsung dan alur provider menggunakan respons simulasi. iLoveAPI live belum diuji karena key/kuota pemilik tidak disertakan.

1. Set ILOVEAPI_PUBLIC_KEY dan ILOVEAPI_SECRET_KEY, deploy/redeploy.
2. Buka /api/health; configured dan ai harus true. Ini belum membuktikan key/kuota sah.
3. Upload JPEG/PNG/WebP <3 MB, pilih HD Enhance 2×, Terapkan lalu konfirmasi. Periksa dimensi hasil.
4. Pada hasil yang sama, jalankan Remove Background. Periksa transparansi dan dimensi HD sebagai input.
5. Kompres hasil ke WebP target KB. Unduh dan periksa ukuran, dimensi serta alpha. JPEG memakai dasar putih.
6. Di Composer, pakai satu gambar pada dua frame. Jalankan HD/Remove BG hanya pada satu frame; yang lain dan original koleksi harus tetap.
7. Periksa error key salah, kredit habis, input >3 MB atau hasil >4 MB. Versi valid terakhir harus tetap bisa diekspor.
8. Hapus kedua key lalu redeploy untuk memeriksa label Basic engine. Hasil basic tidak boleh dilabeli hasil model AI.

Area input/hasil maksimal 64 MP, dan output server maksimal 4 MB. Perkecil input/multiplier jika melewati batas. Pembatalan UI menghentikan penantian/commit; task terkirim dapat tetap mengonsumsi kredit.

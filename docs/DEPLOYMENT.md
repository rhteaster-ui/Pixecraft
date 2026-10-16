# Deploy Vercel

Source tetap React + Vite dengan empat API serverless. Root Directory harus berisi package.json; bukan hanya folder dist. Gunakan npm ci, framework Vite, build npm run build, output dist, Node 22.x.

## ENV

Hanya ILOVEAPI_PUBLIC_KEY dan ILOVEAPI_SECRET_KEY untuk mengaktifkan provider. Tidak ada region wajib, Redis, password aplikasi atau signing secret tambahan. Jangan memakai prefix VITE_ pada key. Setelah mengubah ENV, redeploy.

PIXCRAFT_SITE_URL opsional untuk canonical/OG domain kustom. Jika kosong, build memakai domain Vercel yang tersedia. Frontend memakai endpoint relatif /api/....

Tanpa key, alat lokal tetap berjalan dan endpoint server menyediakan Basic engine Sharp. Itu pembesaran biasa/penghapusan latar sederhana; bukan pengganti kualitas AI. Tanpa backend (misalnya Vite preview) atau ketika offline, tindakan server dinonaktifkan.

/api/health: configured menunjukkan dua key tersedia; ai menunjukkan endpoint pemrosesan tersedia. Pemeriksaan ini tidak membuktikan key sah, kuota tersedia, atau kualitas hasil provider.

## Serverless

Basic engine mengembalikan gambar pada respons yang sama; tidak menyimpan job pada Map proses yang bisa hilang antar invocation. Provider memakai signed ticket, polling dan download. Function maksimum 60 detik. Input dibatasi 3 MB sebelum base64, respons gambar 4 MB untuk memberi ruang terhadap batas payload Vercel.

Rujukan: https://vercel.com/docs/functions/limitations

## Troubleshooting

| Gejala | Tindakan |
| --- | --- |
| package.json tidak ditemukan | Perbaiki Root Directory |
| API 404 | Sertakan api/ dan server/ |
| Proses server nonaktif | Periksa koneksi/backend; preview Vite tidak melayani API |
| Basic engine muncul | Isi kedua key untuk memakai provider lalu redeploy |
| PROVIDER_AUTH | Periksa key berasal dari proyek yang sama |
| Provider menolak task | Periksa kuota dan dukungan alat akun |
| FILE_LIMIT / AI_INPUT_LIMIT | Kompres/resize input hingga ≤3 MB |
| OUTPUT_LIMIT | Kurangi dimensi atau multiplier |
| TARGET_UNREACHABLE | Naikkan target, ganti format, atau izinkan resize |
| Tampilan lama | Muat ulang; cache shell memiliki versi berdasarkan build |

npm run dev menyediakan UI/API di port 3000. npm run verify:vercel memverifikasi bundling fungsi menggunakan builder resmi tanpa login/deploy. Paket ini belum diterbitkan ke akun Vercel pemilik. Jalankan checklist AI-ACCEPTANCE setelah deployment untuk verifikasi integrasi live.

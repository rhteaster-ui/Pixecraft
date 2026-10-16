# Migrasi v2 → v3

Pembaruan meneruskan ZIP pengguna. React/Vite, dependency yang ada dan dua ENV provider tetap dipakai; tidak ada setup region atau layanan baru.

IndexedDB versi 2 menambah store workspaces dan mempertahankan store projects lama. Gunakan origin/domain browser yang sama untuk mengakses data lama. Migrasi dibaca ke memori saat proyek lama dibuka; tidak menghapus proyek legacy. Simpan ulang untuk membuat workspace v3.

Versi lama berisi raster hasil edit. Parameter yang dahulu telah dibakar ke piksel tidak dapat direkonstruksi, sehingga setiap raster menjadi checkpoint valid. Original dan tampilan versi lama dipertahankan. Edit v3 selanjutnya menggunakan state logis.

Workspace v3 mencakup koleksi, versi, mode dan Composer. Autosave setelah 800 ms menawarkan recovery saat aplikasi dibuka lagi. Penutupan mendadak sebelum simpan selesai dapat kehilangan perubahan terbaru. Pesan storage/quota menyarankan ekspor; editor tetap dapat digunakan.

Cache shell berganti mengikuti hash build. Reload setelah deploy. Tidak ada migrasi backend. v3 tidak dirancang untuk dibuka oleh editor v2; ekspor hasil penting sebelum downgrade.

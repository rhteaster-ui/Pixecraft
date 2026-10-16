# Pemetaan PRD v3 — Portfolio Edition

Acuan: Pixcraft-PRD-Final.pdf, 7 Oktober 2026. Tabel ini memetakan area rilis ke implementasi dan bukti; tidak menggantikan batas verifikasi pada TEST-RESULTS.md.

| Area PRD | Implementasi | Bukti |
| --- | --- | --- |
| Source-first/no rewrite | React/Vite, desain, aset, adapter dan alat lama diteruskan | Regresi 18 skenario; CHANGELOG/ARCHITECTURE |
| Entry/empty Studio | CTA Masuk Studio, koleksi kosong, picker/drop/paste, Saved | UI + PRD empty/import tests |
| State/scope | Original, operasi logis, policy output, job terpisah | Unit document + PRD five-image isolation |
| Existing tools/batch | Crop/resize/convert/rotate/background/watermark/recipe | UI regression + API tests |
| CC/looks/overlay | Parameter per target, grouped controls, gesture undo, preset/copy | PRD CC + worker alpha/overlay |
| Composer | 2–5 frame, split templates, rasio, Fill/Fit, pan/pinch, spacing/style | 55 raster combinations + touch/layout tests |
| Frame quality/server action | Quality warning dan explicit per-frame variant | PRD duplicate-source frame HD isolation |
| History/Compare | Undo/redo, original reset, compare explicit-only | Unit state + UI/PRD compare/history |
| Persistence | IDB v2, legacy checkpoints, autosave/recovery/quota handling | PRD migration/recovery/quota |
| Export | Sumber penuh, dimensi persis, alpha, policy, last-valid hasil gagal | PRD 3000×2000 + 2160×2700 + UI ZIP |
| Mobile | Dock/sheet compact, dynamic downward flyout, dedicated divider hit area | Viewport matrix + pseudo geometry + touch |
| About | R_HMT, rhmt.biz.id, avatar/fallback, empat sosial | PRD direct route/fallback/links |
| Motion/offline | Ambient/demo motion, reduced motion, cached local tools | PRD reduced motion + UI offline |
| Vercel | Empat fungsi, direct Basic response, dua key opsional provider | Builder 4/4 + API tests |

## Catatan pengiriman

- Tidak ada deployment live atau key provider yang digunakan dalam sesi ini. Keduanya memerlukan verifikasi setelah pemilik mengisi ENV.
- Pengujian physical-device/low-memory belum dilakukan; error render eksplisit, tanpa diam-diam mengecilkan hasil.
- Migrasi menjaga piksel dan original v1; parameter yang sudah dibakar ke raster v1 tidak bisa dipulihkan.
- Clipboard bergantung izin/dukungan browser; picker dan drop memakai pipeline validasi yang sama.
- Tidak ditambahkan login, billing, cloud history atau sistem white-label.

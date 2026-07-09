# Beriyu — Kopi & Dapur (PWA Pemesanan Makanan)

Aplikasi web/PWA pemesanan makanan Cafe Beriyu. Mobile-first, ada sisi publik
(katalog + keranjang + checkout WhatsApp) dan dashboard admin (kelola menu,
harga, promo, upload foto). Database **Supabase**, hosting **Vercel**.

## Struktur folder

```
beriyu-app/
├─ public/                 ← yang di-host (root web)
│  ├─ index.html           ← halaman utama
│  ├─ manifest.webmanifest ← konfigurasi PWA
│  ├─ sw.js                ← service worker (offline)
│  ├─ icons/               ← ikon aplikasi
│  ├─ css/style.css        ← semua gaya tampilan
│  └─ js/
│     ├─ config.js         ← ★ EDIT: nomor WA + kredensial Supabase
│     ├─ db.js             ← koneksi & query Supabase
│     ├─ whatsapp.js       ← susun & kirim pesan WhatsApp
│     └─ app.js            ← logika utama
├─ supabase/schema.sql     ← skema database (jalankan di Supabase)
├─ vercel.json             ← konfigurasi hosting
├─ package.json
└─ README.md
```

## 1. Buka & jalankan lokal (VSCode)

1. Buka folder `beriyu-app` di VSCode.
2. Cara termudah: pasang ekstensi **Live Server**, klik kanan
   `public/index.html` → **Open with Live Server**.
   Atau lewat terminal:
   ```bash
   npm run dev      # menjalankan npx serve public
   ```
3. Tanpa konfigurasi apa pun, app langsung jalan dalam **mode demo**
   (data contoh, tidak tersimpan). Banner kuning menandakan mode demo.

## 2. Setel nomor WhatsApp Beriyu

Buka `public/js/config.js`, ganti `WA_NUMBER` dengan nomor kafe dalam
format internasional tanpa `+`/spasi:

```
0812-3456-7890  →  6281234567890
```

Saat pelanggan checkout, aplikasi membuka WhatsApp berisi rincian pesanan
(menu, jumlah, total, alamat) yang otomatis terkirim ke nomor ini.

## 3. Siapkan Supabase (database)

1. Buat akun di https://supabase.com → **New project**.
2. Setelah project jadi, buka **SQL Editor** → **New query**, tempel isi
   `supabase/schema.sql`, klik **Run**. Ini membuat tabel `menu`, `promo`,
   `pesanan`, aturan keamanan (RLS), bucket foto, dan data contoh.
3. Buka **Project Settings → API**, salin **Project URL** dan **anon public key**.
4. Tempel ke `public/js/config.js`:
   ```js
   export const SUPABASE = {
     URL: 'https://xxxx.supabase.co',
     ANON_KEY: 'eyJhbGci...',
     BUCKET: 'menu-foto',
   };
   ```
5. Refresh app — banner demo hilang, data kini dari Supabase.

### Login admin
Skema memakai RLS: publik hanya bisa **membaca** menu/promo dan **membuat**
pesanan; **mengubah** menu/promo & upload foto butuh user login. Dashboard
admin login pakai email + password Supabase Auth (bukan PIN).
- Buat user admin di **Authentication → Users → Add user** (email + password).
- Login di tab **Admin** pakai email/password itu.

## 4. Deploy ke Vercel

**Opsi A — lewat GitHub (disarankan):**
1. Push folder ini ke repo GitHub.
2. https://vercel.com → **Add New → Project** → import repo.
3. Framework preset: **Other**. Output/root sudah diatur oleh `vercel.json`
   (menyajikan folder `public`). Klik **Deploy**.

**Opsi B — lewat CLI:**
```bash
npm i -g vercel
vercel          # ikuti prompt
vercel --prod   # rilis ke produksi
```

Setelah live, buka di HP → menu browser → **Add to Home Screen** untuk
memasang sebagai aplikasi.

## Catatan
- Foto menu diunggah admin ke Supabase Storage (bucket `menu-foto`, publik).
- Voucher bawaan: `SORE20` (diskon 20%), `ONGKIRGRATIS` (gratis ongkir min. Rp50rb).
  Voucher lain yang dibuat admin tampil sebagai info promo.
- Semua teks & warna mudah diubah di `config.js` dan `css/style.css`.

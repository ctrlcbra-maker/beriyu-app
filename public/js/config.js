// ============================================================
//  KONFIGURASI CAFE BERIYU  —  edit bagian ini saja
// ============================================================

export const CONFIG = {
  // --- Nomor WhatsApp Cafe Beriyu (format internasional, tanpa + atau spasi) ---
  // Contoh Indonesia: 0812-3456-7890  ->  6281234567890
  WA_NUMBER: '6285117411123',        // <-- nomor asli Cafe Beriyu

  // --- Nama & jam operasional (tampil di header) ---
  NAMA_KAFE: 'Beriyu',
  JAM_BUKA: 'Buka · 08–22',

  // --- Ongkir & minimal gratis ongkir ---
  ONGKIR: 8000,
  MIN_GRATIS_ONGKIR: 50000,
};

// ============================================================
//  SUPABASE  —  isi dari Project Settings > API di dashboard Supabase
// ============================================================
export const SUPABASE = {
  URL: 'https://jcidmqblsapijqlbsfnf.supabase.co',
  ANON_KEY: 'sb_publishable_GP7qxGkO0qtGwxbW9kmX5A_swKI9Kn4',
  BUCKET: 'menu-foto',                        // nama storage bucket untuk foto menu
};

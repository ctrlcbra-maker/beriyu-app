// ============================================================
//  DB.JS  —  semua komunikasi dengan Supabase
//  Jika Supabase belum dikonfigurasi, otomatis pakai data contoh (mode demo).
// ============================================================
import { SUPABASE } from './config.js';

// Supabase JS di-load via CDN di index.html -> window.supabase
let sb = null;
export let MODE_DEMO = true;

export function initSupabase() {
  const configured = SUPABASE.URL && !SUPABASE.URL.includes('xxxxxxxx')
    && SUPABASE.ANON_KEY && !SUPABASE.ANON_KEY.includes('GANTI');
  if (configured && window.supabase) {
    sb = window.supabase.createClient(SUPABASE.URL, SUPABASE.ANON_KEY);
    MODE_DEMO = false;
    console.log('[Beriyu] Supabase aktif.');
  } else {
    MODE_DEMO = true;
    console.warn('[Beriyu] Mode DEMO — isi kredensial di js/config.js untuk pakai Supabase.');
  }
  return !MODE_DEMO;
}

// ---------- Data contoh untuk mode demo ----------
const DEMO_MENU = [
  {id:1,nama:'Kopi Susu Beriyu',kat:'Kopi',harga:22000,promo:0,desk:'Espresso, susu segar, gula aren cair. Signature kami.',emoji:'☕',foto_url:null,aktif:true},
  {id:2,nama:'Americano Panas',kat:'Kopi',harga:18000,promo:0,desk:'Dua shot espresso, air panas. Pahitnya pas.',emoji:'☕',foto_url:null,aktif:true},
  {id:3,nama:'Es Cokelat Klasik',kat:'Non-Kopi',harga:20000,promo:16000,desk:'Cokelat pekat, susu, es batu. Manisnya lembut.',emoji:'🥤',foto_url:null,aktif:true},
  {id:4,nama:'Matcha Latte',kat:'Non-Kopi',harga:25000,promo:0,desk:'Matcha grade premium dengan susu creamy.',emoji:'🍵',foto_url:null,aktif:true},
  {id:5,nama:'Nasi Ayam Bakar Madu',kat:'Makanan Berat',harga:32000,promo:0,desk:'Ayam bakar bumbu madu, nasi hangat, lalapan, sambal.',emoji:'🍗',foto_url:null,aktif:true},
  {id:6,nama:'Mie Goreng Beriyu',kat:'Makanan Berat',harga:26000,promo:22000,desk:'Mie goreng telur, ayam suwir, kerupuk. Porsi mengenyangkan.',emoji:'🍜',foto_url:null,aktif:true},
  {id:7,nama:'Kentang Goreng',kat:'Camilan',harga:18000,promo:0,desk:'Kentang renyah, saus keju atau sambal.',emoji:'🍟',foto_url:null,aktif:true},
  {id:8,nama:'Pisang Cokelat Keju',kat:'Camilan',harga:16000,promo:0,desk:'Pisang goreng crispy, lelehan cokelat, taburan keju.',emoji:'🍌',foto_url:null,aktif:false},
];
const DEMO_PROMO = [
  {id:1,judul:'Diskon Sore',sub:'Potongan 20% jam 15–18',kode:'SORE20',aktif:true},
  {id:2,judul:'Gratis Ongkir',sub:'Min. belanja Rp50rb',kode:'ONGKIRGRATIS',aktif:true},
];

// ============================================================
//  MENU
// ============================================================
export async function getMenu() {
  if (MODE_DEMO) return structuredClone(DEMO_MENU);
  const { data, error } = await sb.from('menu').select('*').order('id');
  if (error) { console.error(error); return []; }
  return data;
}

export async function tambahMenu(m) {
  if (MODE_DEMO) { m.id = Date.now(); DEMO_MENU.push(m); return m; }
  const { data, error } = await sb.from('menu').insert(m).select().single();
  if (error) throw error;
  return data;
}

export async function updateMenu(id, patch) {
  if (MODE_DEMO) { Object.assign(DEMO_MENU.find(x=>x.id===id), patch); return; }
  const { error } = await sb.from('menu').update(patch).eq('id', id);
  if (error) throw error;
}

export async function hapusMenu(id) {
  if (MODE_DEMO) { const i=DEMO_MENU.findIndex(x=>x.id===id); if(i>-1)DEMO_MENU.splice(i,1); return; }
  const { error } = await sb.from('menu').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
//  PROMO
// ============================================================
export async function getPromo() {
  if (MODE_DEMO) return structuredClone(DEMO_PROMO);
  const { data, error } = await sb.from('promo').select('*').order('id');
  if (error) { console.error(error); return []; }
  return data;
}

export async function tambahPromo(p) {
  if (MODE_DEMO) { p.id = Date.now(); DEMO_PROMO.push(p); return p; }
  const { data, error } = await sb.from('promo').insert(p).select().single();
  if (error) throw error;
  return data;
}

export async function updatePromo(id, patch) {
  if (MODE_DEMO) { Object.assign(DEMO_PROMO.find(x=>x.id===id), patch); return; }
  const { error } = await sb.from('promo').update(patch).eq('id', id);
  if (error) throw error;
}

export async function hapusPromo(id) {
  if (MODE_DEMO) { const i=DEMO_PROMO.findIndex(x=>x.id===id); if(i>-1)DEMO_PROMO.splice(i,1); return; }
  const { error } = await sb.from('promo').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
//  UPLOAD FOTO  ->  Supabase Storage
//  Return: URL publik gambar
// ============================================================
export async function uploadFoto(file) {
  if (MODE_DEMO) return URL.createObjectURL(file); // preview lokal saja
  const nama = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi,'_')}`;
  const { error } = await sb.storage.from(SUPABASE.BUCKET).upload(nama, file, { upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(SUPABASE.BUCKET).getPublicUrl(nama);
  return data.publicUrl;
}

// ============================================================
//  PESANAN
// ============================================================
const STATUS_FLOW = ['Diproses', 'Disiapkan', 'Siap', 'Selesai'];
export { STATUS_FLOW };

const DEMO_PESANAN = [];

export async function simpanPesanan(order) {
  if (MODE_DEMO) { const row = { ...order, id: Date.now() }; DEMO_PESANAN.unshift(row); return row; }
  // tidak pakai .select() — publik tidak diberi izin SELECT ke tabel pesanan (lihat schema.sql),
  // dan RETURNING pada insert ikut tunduk pada policy SELECT itu; kalau dipaksa, seluruh insert
  // ditolak & di-rollback oleh RLS meski WITH CHECK insert-nya sendiri lolos.
  const { error } = await sb.from('pesanan').insert(order);
  if (error) throw error;
  return order;
}

// ---------- admin: lihat & ubah status pesanan ----------
export async function getPesanan() {
  if (MODE_DEMO) return structuredClone(DEMO_PESANAN);
  const { data, error } = await sb.from('pesanan').select('*').order('waktu', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

export async function ubahStatusPesanan(id, status) {
  if (MODE_DEMO) { const p = DEMO_PESANAN.find(x => x.id === id); if (p) p.status = status; return; }
  const { error } = await sb.from('pesanan').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updatePesanan(id, patch) {
  if (MODE_DEMO) { const p = DEMO_PESANAN.find(x => x.id === id); if (p) Object.assign(p, patch); return; }
  const { error } = await sb.from('pesanan').update(patch).eq('id', id);
  if (error) throw error;
}

export async function hapusPesanan(id) {
  if (MODE_DEMO) { const idx = DEMO_PESANAN.findIndex(x => x.id === id); if (idx > -1) DEMO_PESANAN.splice(idx, 1); return; }
  const { error } = await sb.from('pesanan').delete().eq('id', id);
  if (error) throw error;
}

// hapus histori pesanan lebih dari 30 hari (fallback client-side; utamanya
// dijalankan otomatis oleh pg_cron di database, lihat schema.sql)
export async function hapusPesananLama() {
  const batas = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (MODE_DEMO) {
    for (let i = DEMO_PESANAN.length - 1; i >= 0; i--) {
      if (new Date(DEMO_PESANAN[i].waktu).getTime() < batas) DEMO_PESANAN.splice(i, 1);
    }
    return;
  }
  const { error } = await sb.from('pesanan').delete().lt('waktu', new Date(batas).toISOString());
  if (error) console.error(error);
}

// ---------- publik: cek status pesanan sendiri (kode + no. HP) ----------
export async function cekStatusPesanan(kode, hp) {
  if (MODE_DEMO) {
    const p = DEMO_PESANAN.find(x => x.kode === kode && x.hp === hp);
    return p ? { status: p.status, waktu: p.waktu } : null;
  }
  const { data, error } = await sb.rpc('cek_status_pesanan', { p_kode: kode, p_hp: hp });
  if (error) { console.error(error); return null; }
  return data && data[0] ? data[0] : null;
}

// ============================================================
//  AUTH ADMIN (opsional — email/password Supabase)
// ============================================================
export async function loginAdmin(email, password) {
  if (MODE_DEMO) throw new Error('demo');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function logoutAdmin() {
  if (!MODE_DEMO && sb) await sb.auth.signOut();
}
export async function cekSesi() {
  if (MODE_DEMO || !sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

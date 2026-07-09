// ============================================================
//  WHATSAPP.JS  —  susun pesan checkout & buka chat WA Beriyu
// ============================================================
import { CONFIG } from './config.js';

const rp = n => 'Rp ' + Number(n).toLocaleString('id-ID');

// order = {kode, items:[{nama,qty,harga}], subtotal, diskon, ongkir, total, metode, nama, hp, alamat, catatan}
export function pesanKeWhatsApp(order) {
  const L = [];
  L.push(`*Pesanan Baru — ${CONFIG.NAMA_KAFE}*`);
  L.push(`Kode: *${order.kode}*`);
  L.push('');
  L.push('*Rincian:*');
  order.items.forEach(i => {
    L.push(`• ${i.qty}× ${i.nama} — ${rp(i.harga * i.qty)}`);
  });
  L.push('');
  L.push(`Subtotal: ${rp(order.subtotal)}`);
  if (order.diskon > 0) L.push(`Diskon: -${rp(order.diskon)}`);
  L.push(`Ongkir: ${order.ongkir ? rp(order.ongkir) : 'Gratis'}`);
  L.push(`*Total: ${rp(order.total)}*`);
  L.push('');
  L.push(`*Metode:* ${order.metode === 'antar' ? 'Diantar 🛵' : 'Ambil di kafe 🏃'}`);
  L.push(`*Nama:* ${order.nama}`);
  if (order.hp) L.push(`*WhatsApp:* ${order.hp}`);
  if (order.metode === 'antar' && order.alamat) L.push(`*Alamat:* ${order.alamat}`);
  if (order.catatan) L.push(`*Catatan:* ${order.catatan}`);
  L.push('');
  L.push('_Dikirim otomatis dari aplikasi pesan Beriyu._');

  const teks = encodeURIComponent(L.join('\n'));
  const url = `https://wa.me/${CONFIG.WA_NUMBER}?text=${teks}`;

  // buka tab baru (di mobile langsung ke aplikasi WhatsApp)
  window.open(url, '_blank');
  return url;
}

// ubah nomor lokal (0812...) jadi format internasional (62812...) untuk link wa.me
function normalisasiNomor(hp) {
  let n = (hp || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (!n.startsWith('62')) n = '62' + n;
  return n;
}

// order = {kode, nama} — pemesan minta batalkan pesanan lewat WA ke kafe
export function batalkanKeWhatsApp(order, alasan) {
  const L = [];
  L.push(`*Permintaan Batalkan Pesanan — ${CONFIG.NAMA_KAFE}*`);
  L.push(`Kode: *${order.kode}*`);
  L.push(`Nama: ${order.nama}`);
  if (alasan) L.push(`Alasan: ${alasan}`);
  L.push('');
  L.push('Mohon dibatalkan ya, terima kasih 🙏');

  const teks = encodeURIComponent(L.join('\n'));
  const url = `https://wa.me/${CONFIG.WA_NUMBER}?text=${teks}`;
  window.open(url, '_blank');
  return url;
}

// order = {kode, nama, hp} — kafe beritahu pemesan bahwa pesanannya dibatalkan
export function beritahuBatalKeWhatsApp(order, alasan) {
  const L = [];
  L.push(`*Pesanan Dibatalkan — ${CONFIG.NAMA_KAFE}*`);
  L.push(`Kode: *${order.kode}*`);
  L.push(`Halo ${order.nama}, mohon maaf pesananmu terpaksa kami batalkan.`);
  if (alasan) L.push(`Alasan: ${alasan}`);
  L.push('');
  L.push('Mohon maaf atas ketidaknyamanannya 🙏');

  const teks = encodeURIComponent(L.join('\n'));
  const url = `https://wa.me/${normalisasiNomor(order.hp)}?text=${teks}`;
  window.open(url, '_blank');
  return url;
}

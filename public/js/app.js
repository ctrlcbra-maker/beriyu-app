// ============================================================
//  APP.JS  —  logika utama Beriyu
// ============================================================
import { CONFIG } from './config.js';
import * as DB from './db.js';
import { pesanKeWhatsApp, batalkanKeWhatsApp, beritahuBatalKeWhatsApp, tolakKeWhatsApp } from './whatsapp.js';

const KATEGORI = ['Semua','Kopi','Non-Kopi','Makanan Berat','Camilan'];
const EMOJI_OPS = ['☕','🍵','🥤','🧋','🍗','🍜','🍛','🍟','🍌','🧁','🥐','🍰'];
const RIWAYAT_KEY = 'beriyu_riwayat';

let MENU = [], PROMO = [], PESANAN_ADMIN = [];
let cart = {}, metode = 'antar', voucherAktif = null, riwayat = [], katAktif = 'Semua';
let dashDari = null, dashSampai = null;
let settings = { ongkir: CONFIG.ONGKIR, minGratisOngkir: CONFIG.MIN_GRATIS_ONGKIR };
let kasirItems = [], kasirMetode = 'antar', kasirBayarMetode = 'tunai', kasirTunaiBayar = '', kasirCatatan = '';
let pesananInterval = null;

function mulaiPollingPesanan(){
  if(pesananInterval) return;
  pesananInterval = setInterval(()=>{
    if(document.visibilityState==='visible' && !$('adminPanel').classList.contains('hidden')) refreshPesananAdmin();
  }, 30000);
}
function hentikanPollingPesanan(){
  clearInterval(pesananInterval);
  pesananInterval = null;
}
let detailQty = 1, detailId = null, editId = null, tmpFoto = null, tmpKat = 'Kopi', tmpFotoFile = null;

const rp = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const $ = id => document.getElementById(id);
const hargaFinal = m => (m.promo && m.promo > 0) ? m.promo : m.harga;
const normalizeStatus = s => String(s || '').trim().toLowerCase();
const formatStatus = s => {
  switch (normalizeStatus(s)) {
    case 'diproses': return 'Diproses';
    case 'disiapkan': return 'Disiapkan';
    case 'siap': return 'Siap';
    case 'selesai': return 'Selesai';
    case 'ditolak': return 'Ditolak';
    case 'dibatalkan': return 'Dibatalkan';
    default: return String(s || '-');
  }
};

function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1800);}

function muatRiwayatLokal(){
  try{
    const raw=localStorage.getItem(RIWAYAT_KEY);
    const batas=Date.now()-30*24*60*60*1000;
    riwayat=raw?JSON.parse(raw).filter(o=>new Date(o.waktu).getTime()>=batas):[];
    simpanRiwayatLokal();
  }catch(e){riwayat=[];}
}
function simpanRiwayatLokal(){try{localStorage.setItem(RIWAYAT_KEY,JSON.stringify(riwayat));}catch(e){}}
function loadSettings(){
  try{
    const raw = localStorage.getItem('beriyu_settings');
    if (raw){
      const stored = JSON.parse(raw);
      settings.ongkir = Number(stored.ongkir) || CONFIG.ONGKIR;
      settings.minGratisOngkir = Number(stored.minGratisOngkir) || CONFIG.MIN_GRATIS_ONGKIR;
    }
  }catch(e){ }
}
function saveSettings(){
  try{ localStorage.setItem('beriyu_settings', JSON.stringify(settings)); }catch(e){}
}
function renderOngkirSettings(){
  const el = $('admOngkirArea'); if(!el) return;
  el.innerHTML = `
    <div class="kasir-panel">
      <div class="section-title">Setelan ongkir</div>
      <div class="f-row"><input class="inp" id="oOngkir" inputmode="numeric" placeholder="Ongkir" value="${settings.ongkir}"></div>
      <div class="f-row"><input class="inp" id="oMinGratis" inputmode="numeric" placeholder="Minimal gratis ongkir" value="${settings.minGratisOngkir}"></div>
      <div class="kasir-actions"><button class="btn kayu" id="simpanOngkir">Simpan setelan</button></div>
      <p class="hint" style="padding-top:8px;">Nilai ongkir ini akan dipakai pada checkout publik dan kasir. Gratis ongkir berlaku saat kode ONGKIRGRATIS aktif dan subtotal memenuhi minimal.</p>
    </div>`;
  $('simpanOngkir').onclick = handleOngkirSave;
}
function handleOngkirSave(){
  const ongkirVal = parseInt($('oOngkir').value) || 0;
  const minGratisVal = parseInt($('oMinGratis').value) || 0;
  if (ongkirVal < 0 || minGratisVal < 0){ toast('Nilai tidak boleh negatif'); return; }
  settings.ongkir = ongkirVal;
  settings.minGratisOngkir = minGratisVal;
  saveSettings();
  renderOngkirSettings();
  renderCart();
  renderKasir();
  toast('Setelan ongkir disimpan ✓');
}
function kasirSubtotal(){ return kasirItems.reduce((s,i)=>s + i.qty * i.harga, 0); }
function kasirOngkir(){ return kasirMetode === 'antar' ? settings.ongkir : 0; }
function kasirTotal(){ return Math.max(0, kasirSubtotal() + kasirOngkir()); }
function renderKasir(){
  const el = $('admKasirArea'); if(!el) return;
  const aktifMenu = MENU.filter(m=>m.aktif);
  const itemsHtml = kasirItems.length ? kasirItems.map((item,idx)=>`
      <div class="kasir-item">
        <div class="info"><b>${item.nama}</b><div class="kap">${item.qty}× ${rp(item.harga)} = ${rp(item.qty * item.harga)}</div></div>
        <div class="qty"><button data-kqty="${idx}|-1">−</button><span>${item.qty}</span><button data-kqty="${idx}|1">+</button><button data-krem="${idx}">✕</button></div>
      </div>`).join('') : '<div class="kosong"><div class="em">🧾</div><p>Keranjang kasir kosong.<br>Pilih produk atau input manual.</p></div>';
  el.innerHTML = `
    <div class="kasir-grid">
      <div class="kasir-panel">
        <div class="section-title">Pilih produk cepat</div>
        ${aktifMenu.length ? aktifMenu.map(m=>`
          <div class="kasir-produk"><div><b>${m.nama}</b><div class="kap">${rp(hargaFinal(m))}</div></div><button class="btn icon" data-kadd="${m.id}">+</button></div>`).join('') : '<div class="kosong"><p>Belum ada menu aktif.</p></div>'}
        <div class="section-title" style="margin-top:16px">Input manual item</div>
        <div class="f-row"><input class="inp" id="kasirManualNama" placeholder="Nama item"></div>
        <div class="f-row"><input class="inp" id="kasirManualHarga" inputmode="numeric" placeholder="Harga (Rp)"></div>
        <div class="f-row"><input class="inp" id="kasirManualQty" inputmode="numeric" placeholder="Qty" value="1"></div>
        <div class="kasir-actions"><button class="btn" id="kasirAddManual">Tambah manual</button></div>
      </div>
      <div class="kasir-panel">
        <div class="section-title">Ringkasan kasir</div>
        <div class="kasir-cart">${itemsHtml}</div>
        <div class="kasir-summary">
          <div class="row"><span>Subtotal</span><span>${rp(kasirSubtotal())}</span></div>
          <div class="row"><span>Ongkir</span><span>${rp(kasirOngkir())}</span></div>
          <div class="row total"><span>Total</span><span>${rp(kasirTotal())}</span></div>
        </div>
        <div class="section-title">Metode pesanan</div>
        <div class="seg"><button class="s ${kasirMetode==='antar'?'on':''}" data-km="antar">Antar</button><button class="s ${kasirMetode==='ambil'?'on':''}" data-km="ambil">Ambil</button></div>
        <div class="section-title">Pembayaran</div>
        <div class="seg"><button class="s ${kasirBayarMetode==='tunai'?'on':''}" data-kpay="tunai">Tunai</button><button class="s ${kasirBayarMetode==='debit'?'on':''}" data-kpay="debit">Debit/QR</button></div>
        <div class="f-row"><input class="inp" id="kasirNama" placeholder="Nama pelanggan"></div>
        <div class="f-row"><input class="inp" id="kasirHp" placeholder="No. WA (opsional)"></div>
        <div class="f-row"><input class="inp" id="kasirAlamat" placeholder="Alamat (jika antar)" ${kasirMetode==='antar'?'':'disabled'}></div>
        <div class="f-row"><textarea class="inp" id="kasirCatatan" placeholder="Catatan / keterangan"></textarea></div>
        <div class="kasir-actions"><button class="btn kayu" id="kasirCheckout">Simpan pesanan kasir</button></div>
      </div>
    </div>`;
  document.querySelectorAll('[data-kadd]').forEach(b=>b.onclick=()=>kasirAddItem(+b.dataset.kadd));
  document.querySelectorAll('[data-kqty]').forEach(b=>{const [idx,delta]=b.dataset.kqty.split('|');b.onclick=()=>kasirUpdateQty(+idx,+delta);});
  document.querySelectorAll('[data-krem]').forEach(b=>b.onclick=()=>kasirRemoveItem(+b.dataset.krem));
  document.querySelectorAll('[data-km]').forEach(b=>b.onclick=()=>{kasirMetode=b.dataset.km;renderKasir();});
  document.querySelectorAll('[data-kpay]').forEach(b=>b.onclick=()=>{kasirBayarMetode=b.dataset.kpay;renderKasir();});
  if($('kasirAddManual')) $('kasirAddManual').onclick=kasirAddManualItem;
  if($('kasirCheckout')) $('kasirCheckout').onclick=kasirSaveOrder;
}
function kasirAddItem(id){
  const m=MENU.find(x=>x.id===id); if(!m) return;
  const idx = kasirItems.findIndex(x=>x.id===id && x.harga===hargaFinal(m));
  if(idx > -1) kasirItems[idx].qty += 1;
  else kasirItems.push({id:m.id,nama:m.nama,harga:hargaFinal(m),qty:1});
  renderKasir();
}
function kasirAddManualItem(){
  const nama=($('kasirManualNama').value||'').trim();
  const harga=parseInt($('kasirManualHarga').value)||0;
  const qty=parseInt($('kasirManualQty').value)||1;
  if(!nama||!harga||qty<1){toast('Isi nama, harga, dan qty dengan benar');return;}
  kasirItems.push({id:Date.now(),nama,harga,qty});
  $('kasirManualNama').value='';$('kasirManualHarga').value='';$('kasirManualQty').value='1';
  renderKasir();
}
function kasirUpdateQty(idx,delta){ if(!kasirItems[idx]) return; kasirItems[idx].qty = Math.max(1, kasirItems[idx].qty + delta); renderKasir(); }
function kasirRemoveItem(idx){ kasirItems.splice(idx,1); renderKasir(); }
function kasirReset(){ kasirItems=[]; kasirMetode='antar'; kasirBayarMetode='tunai'; kasirTunaiBayar=''; kasirCatatan=''; }
async function kasirSaveOrder(){
  if(!kasirItems.length){toast('Keranjang kasir masih kosong');return;}
  const nama=($('kasirNama').value||'').trim();
  const hp=($('kasirHp').value||'').trim();
  const alamat=($('kasirAlamat').value||'').trim();
  const catatan=($('kasirCatatan').value||'').trim();
  if(kasirMetode==='antar' && !alamat){toast('Alamat antar harus diisi');return;}
  if(!nama){toast('Isi nama pelanggan');return;}
  const kode='BRY-'+Math.floor(1000+Math.random()*9000);
  const order={
    kode,
    items:kasirItems.map(i=>({nama:i.nama,qty:i.qty,harga:i.harga})),
    subtotal:kasirSubtotal(), diskon:0, ongkir:kasirOngkir(), total:kasirTotal(),
    metode:kasirMetode, nama, hp, alamat,
    catatan:catatan?`${kasirBayarMetode.toUpperCase()} · ${catatan}`:kasirBayarMetode.toUpperCase(),
    status:'Diproses', waktu:new Date().toISOString(),
  };
  try{
    await DB.simpanPesanan(order);
    toast('Pesanan kasir tersimpan ✓');
    kasirReset(); renderKasir();
    if($('adminPanel') && !$('adminPanel').classList.contains('hidden')) await refreshPesananAdmin();
  }catch(e){toast('Gagal simpan pesanan kasir'); console.error(e);}  
}

// tampilkan foto: gambar asli jika ada foto_url, jika tidak emoji di atas latar hangat
function fotoBox(m, cls=''){

  if(m.foto_url){
    return `<div class="${cls}" style="width:100%;height:100%"><img src="${m.foto_url}" alt="${m.nama}"></div>`;
  }
  const warna = '#a85a2a';
  return `<div class="${cls}" style="width:100%;height:100%;background:linear-gradient(150deg,${warna}22,${warna}44);display:grid;place-items:center;font-size:2.4em">${m.emoji||'☕'}</div>`;
}

// ===================== INIT =====================
async function boot(){
  $('logoNama').innerHTML = `${CONFIG.NAMA_KAFE}<small>Kopi &amp; Dapur</small>`;
  $('jamPill').textContent = CONFIG.JAM_BUKA;

  DB.initSupabase();
  if(DB.MODE_DEMO) $('demoBanner').classList.remove('hidden');
  loadSettings();

  const sesi = await DB.cekSesi();
  if(sesi){ $('adminLogin').classList.add('hidden'); $('adminPanel').classList.remove('hidden'); mulaiPollingPesanan(); }

  muatRiwayatLokal();
  MENU = await DB.getMenu();
  PROMO = await DB.getPromo();
  render(); updateFab();
  if(sesi) renderAdmin();
}

// ===================== NAV =====================
window.pindah = function(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('aktif',t.dataset.tab===tab));
  $('viewPublik').classList.toggle('hidden',tab!=='publik');
  $('viewPesanan').classList.toggle('hidden',tab!=='pesanan');
  $('viewAdmin').classList.toggle('hidden',tab!=='admin');
  updateFab();
  if(tab==='pesanan') renderRiwayat();
  if(tab==='admin' && !$('adminPanel').classList.contains('hidden')) refreshPesananAdmin();
  renderKasir();
  window.scrollTo(0,0);
};

// ===================== RENDER PUBLIK =====================
function renderChips(){
  $('chips').innerHTML = KATEGORI.map(k=>
    `<button class="chip ${k===katAktif?'aktif':''}" data-k="${k}">${k}</button>`).join('');
  document.querySelectorAll('#chips .chip').forEach(c=>c.onclick=()=>{katAktif=c.dataset.k;render();});
}
function renderPromo(){
  const list = PROMO.filter(p=>p.aktif);
  $('promoStrip').innerHTML = list.map(p=>
    `<div class="promo"><b>${p.judul}</b><span>${p.sub}</span><span class="kode">Kode: ${p.kode}</span></div>`).join('');
  $('promoStrip').classList.toggle('hidden',!list.length);
}
window.render = function(){
  renderChips(); renderPromo();
  const q = ($('cari').value||'').toLowerCase();
  let list = MENU.filter(m=>m.aktif);
  if(katAktif!=='Semua') list=list.filter(m=>m.kat===katAktif);
  if(q) list=list.filter(m=>m.nama.toLowerCase().includes(q)||(m.desk||'').toLowerCase().includes(q));

  const grup={}; list.forEach(m=>{(grup[m.kat]=grup[m.kat]||[]).push(m)});
  let html='';
  KATEGORI.filter(k=>k!=='Semua').forEach(kat=>{
    if(!grup[kat]) return;
    html += `<div class="sect-judul">${kat} <em>${grup[kat].length} pilihan</em></div><div class="grid">`;
    grup[kat].forEach(m=>{
      const diskon = m.promo && m.promo>0;
      html += `<div class="kartu" data-id="${m.id}">
        <div class="foto">${fotoBox(m)}${diskon?'<span class="badge">PROMO</span>':''}</div>
        <div class="isi"><h3>${m.nama}</h3><div class="desk">${m.desk||''}</div>
          <div class="baris"><div class="harga">${diskon?`<s>${rp(m.harga)}</s>`:''}${rp(hargaFinal(m))}</div>
          <button class="tambah" data-add="${m.id}">+</button></div>
        </div></div>`;
    });
    html+='</div>';
  });
  $('menuArea').innerHTML = html || `<div class="kosong"><div class="em">🔍</div><p>Menu tidak ketemu.<br>Coba kata kunci lain.</p></div>`;
  document.querySelectorAll('.kartu').forEach(k=>k.onclick=()=>bukaDetail(+k.dataset.id));
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=e=>{e.stopPropagation();tambah(+b.dataset.add);});
};

// ===================== DETAIL =====================
function bukaDetail(id){
  const m=MENU.find(x=>x.id===id); detailId=id; detailQty=1;
  const diskon=m.promo&&m.promo>0;
  $('detailKonten').innerHTML=`
    <div class="d-foto">${fotoBox(m)}</div>
    <div class="d-isi">
      <div class="kat">${m.kat}</div><h2>${m.nama}</h2>
      <div class="harga" style="font-size:19px;margin-top:6px">${diskon?`<s>${rp(m.harga)}</s>`:''}${rp(hargaFinal(m))}</div>
      <p>${m.desk||''}</p>
      <div class="qty"><button id="dMin">−</button><span id="dq">1</span><button id="dPlus">+</button></div>
      <button class="btn kayu" id="dAdd">Tambah ke keranjang</button>
    </div>`;
  $('dMin').onclick=()=>{detailQty=Math.max(1,detailQty-1);$('dq').textContent=detailQty;};
  $('dPlus').onclick=()=>{detailQty++;$('dq').textContent=detailQty;};
  $('dAdd').onclick=()=>{tambah(id,detailQty);tutupSemua();};
  bukaSheet('sheetDetail');
}

// ===================== KERANJANG =====================
function tambah(id,q=1){cart[id]=(cart[id]||0)+q;updateFab();toast('Ditambahkan ✓');}
window.ubahQty=function(id,d){cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];updateFab();renderCart();};
const totalItem=()=>Object.values(cart).reduce((a,b)=>a+b,0);
const subtotal=()=>Object.entries(cart).reduce((s,[id,q])=>{const m=MENU.find(x=>x.id==id);return s+hargaFinal(m)*q;},0);
function updateFab(){
  const n=totalItem();const fab=$('fab');
  const diPublik=!$('viewPublik').classList.contains('hidden');
  fab.classList.toggle('sembunyi',n===0||!diPublik);
  $('fabN').textContent=n;$('fabRp').textContent=rp(subtotal());
}
const ongkir=()=>{if(metode!=='antar')return 0;return(voucherAktif&&voucherAktif.kode==='ONGKIRGRATIS'&&subtotal()>=settings.minGratisOngkir)?0:settings.ongkir;};
const diskonVoucher=()=>{if(voucherAktif&&voucherAktif.kode==='SORE20')return Math.round(subtotal()*0.2);return 0;};
const grandTotal=()=>Math.max(0,subtotal()-diskonVoucher()+ongkir());

window.bukaKeranjang=function(){renderCart();bukaSheet('sheetCart');};
function renderCart(){
  const ids=Object.keys(cart);
  if(!ids.length){$('cartKonten').innerHTML=`<div class="kosong"><div class="em">🛒</div><p>Keranjang masih kosong.<br>Yuk pilih menu favoritmu.</p></div>`;return;}
  const items=ids.map(id=>{const m=MENU.find(x=>x.id==id);const q=cart[id];return`
    <div class="cart-item"><div class="cf">${fotoBox(m)}</div>
      <div><div class="cn">${m.nama}</div><div class="cp">${rp(hargaFinal(m))}</div></div>
      <div class="cq"><button onclick="ubahQty(${id},-1)">−</button><b>${q}</b><button onclick="ubahQty(${id},1)">+</button></div>
    </div>`;}).join('');
  $('cartKonten').innerHTML=`
    <div class="sect-judul" style="padding:8px 16px 4px">Keranjang <em>${totalItem()} item</em></div>${items}
    <div class="opsi"><h4>Metode pesanan</h4><div class="pilih">
      <div class="p ${metode==='antar'?'on':''}" data-m="antar"><div class="ic">🛵</div><div class="lb">Antar</div><div class="sub">Ongkir ${rp(settings.ongkir)}</div></div>
      <div class="p ${metode==='ambil'?'on':''}" data-m="ambil"><div class="ic">🏃</div><div class="lb">Ambil</div><div class="sub">Di kafe</div></div>
    </div></div>
    <div id="formAntar"></div>
    <div class="voucher"><input class="inp" id="kodeV" placeholder="Kode promo" style="margin-bottom:0" value="${voucherAktif?voucherAktif.kode:''}"><button id="btnV">Pakai</button></div>
    <div class="hint ${voucherAktif?'ok':''}" id="hintV">${voucherAktif?'Voucher '+voucherAktif.kode+' aktif ✓':''}</div>
    <div class="ringkas">
      <div class="r"><span>Subtotal</span><span>${rp(subtotal())}</span></div>
      ${diskonVoucher()?`<div class="r"><span>Diskon voucher</span><span>−${rp(diskonVoucher())}</span></div>`:''}
      <div class="r"><span>Ongkir</span><span>${ongkir()?rp(ongkir()):'Gratis'}</span></div>
      <div class="r total"><span>Total</span><b>${rp(grandTotal())}</b></div>
    </div>
    <div class="btn-row"><button class="btn wa" id="btnCheckout">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.2 0 .4-.1.5l-.4.5c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.9-.1 1.4z"/></svg>
      Pesan via WhatsApp · ${rp(grandTotal())}</button></div>`;
  renderFormAntar();
  document.querySelectorAll('.pilih .p').forEach(p=>p.onclick=()=>{metode=p.dataset.m;renderCart();});
  $('btnV').onclick=pakaiVoucher;
  $('btnCheckout').onclick=checkout;
}
function renderFormAntar(){
  const el=$('formAntar');if(!el)return;
  el.innerHTML = metode==='antar' ? `
    <div class="opsi"><input class="inp" id="fNama" placeholder="Nama penerima"><input class="inp" id="fHp" inputmode="tel" placeholder="No. WhatsApp"><textarea class="inp" id="fAlamat" placeholder="Alamat lengkap & patokan"></textarea><input class="inp" id="fCatatan" placeholder="Catatan (opsional)"></div>`
    : `<div class="opsi"><input class="inp" id="fNama" placeholder="Nama pemesan"><input class="inp" id="fHp" inputmode="tel" placeholder="No. WhatsApp"><input class="inp" id="fCatatan" placeholder="Catatan (opsional)"></div>`;
}
function pakaiVoucher(){
  const kode=($('kodeV').value||'').trim().toUpperCase();
  const found=PROMO.find(p=>p.aktif&&p.kode===kode);
  const h=$('hintV');
  if(found){voucherAktif=found;h.className='hint ok';h.textContent='Voucher '+kode+' aktif ✓';renderCart();}
  else{voucherAktif=null;h.className='hint no';h.textContent='Kode tidak valid / tidak berlaku.';}
}
async function checkout(){
  if(!Object.keys(cart).length)return;
  const nama=($('fNama')?.value||'').trim();
  const hp=($('fHp')?.value||'').trim();
  if(!nama){toast('Isi nama dulu ya');return;}
  if(!hp){toast('Nomor WhatsApp belum diisi');return;}
  if(metode==='antar' && !($('fAlamat')?.value||'').trim()){toast('Alamat belum diisi');return;}

  const kode='BRY-'+Math.floor(1000+Math.random()*9000);
  const items=Object.entries(cart).map(([id,q])=>{const m=MENU.find(x=>x.id==id);return{nama:m.nama,qty:q,harga:hargaFinal(m)};});
  const order={
    kode, items, subtotal:subtotal(), diskon:diskonVoucher(), ongkir:ongkir(), total:grandTotal(),
    metode, nama, hp,
    alamat:($('fAlamat')?.value||'').trim(), catatan:($('fCatatan')?.value||'').trim(),
    status:'Diproses', waktu:new Date().toISOString(),
  };

  // simpan ke Supabase (kalau aktif) — tidak menghalangi checkout kalau gagal
  try { await DB.simpanPesanan(order); } catch(e){ console.warn('Simpan pesanan gagal:',e.message); }

  // kirim ke WhatsApp Beriyu
  pesanKeWhatsApp(order);

  riwayat.unshift(order);
  simpanRiwayatLokal();
  $('cartKonten').innerHTML=`
    <div class="sukses-box"><div class="ring">🎉</div><h2>Pesanan dikirim!</h2>
      <p>Terima kasih, ${nama}. Kami membuka WhatsApp untuk konfirmasi pesananmu.</p>
      <div class="kode-order">${kode}</div>
      <p>Jika WhatsApp tidak terbuka, ketuk tombol di bawah.</p></div>
    <div class="btn-row"><button class="btn wa" id="ulangWA">Buka WhatsApp lagi</button>
    <button class="btn ghost" id="selesai" style="margin-top:10px">Selesai</button></div>`;
  $('ulangWA').onclick=()=>pesanKeWhatsApp(order);
  $('selesai').onclick=()=>{tutupSemua();cart={};voucherAktif=null;updateFab();pindah('pesanan');};
}

// ===================== RIWAYAT =====================
async function renderRiwayat(){
  if(!riwayat.length){$('riwayatArea').innerHTML=`<div class="kosong"><div class="em">📋</div><p>Belum ada pesanan.<br>Pesanan aktifmu muncul di sini.</p></div>`;return;}

  await Promise.all(riwayat.filter(o=>!['Selesai','Dibatalkan'].includes(o.status) && o.hp).map(async o=>{
    try{ const r=await DB.cekStatusPesanan(o.kode,o.hp); if(r && r.status) o.status=r.status; }catch(e){}
  }));
  simpanRiwayatLokal();

  $('riwayatArea').innerHTML=riwayat.map(o=>{const w=new Date(o.waktu);const bisaBatal=o.status==='Diproses';return`
    <div class="adm-sect" style="box-shadow:var(--sh)">
      <div class="adm-head"><h3>${o.kode}</h3><span class="status-pill status-${o.status}">${o.status}</span></div>
      <div style="padding:0 14px 12px;font-size:13px;color:var(--abu)">
        ${o.items.map(i=>i.qty+'× '+i.nama).join(' · ')}<br>
        <b style="color:var(--hutan)">${rp(o.total)}</b> · ${o.metode==='antar'?'Diantar':'Ambil sendiri'} · ${w.getHours()}:${String(w.getMinutes()).padStart(2,'0')}
      </div>
      ${bisaBatal?`<div style="padding:0 14px 14px"><button class="btn ghost" data-batalr="${o.kode}" style="padding:11px">Batalkan pesanan</button></div>`:''}
    </div>`;}).join('');
  document.querySelectorAll('[data-batalr]').forEach(b=>b.onclick=()=>{
    const o=riwayat.find(x=>x.kode===b.dataset.batalr);
    if(o) bukaFormBatal(o, async(alasan)=>{ batalkanKeWhatsApp(o,alasan); });
  });
}

// ===================== SHEET =====================
function bukaSheet(id){$('overlay').classList.add('buka');$(id).classList.add('buka');document.body.style.overflow='hidden';}
window.tutupSemua=function(){$('overlay').classList.remove('buka');document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('buka'));document.body.style.overflow='';};

// ===================== BATALKAN PESANAN (form alasan) =====================
function bukaFormBatal(order, onKonfirmasi){
  $('formKonten').innerHTML=`
    <div class="sect-judul" style="padding:8px 16px 4px">Batalkan pesanan ${order.kode}</div>
    <div style="padding:0 16px">
      <div class="f-label">Alasan pembatalan</div>
      <textarea class="inp" id="alasanBatal" placeholder="cth. Stok bahan habis / pesanan ganda / permintaan pelanggan"></textarea>
      <button class="btn" id="konfirmasiBatal" style="background:#c0392b">Batalkan & kirim WhatsApp</button>
    </div>`;
  $('konfirmasiBatal').onclick=async()=>{
    const alasan=$('alasanBatal').value.trim();
    tutupSemua();
    await onKonfirmasi(alasan);
  };
  bukaSheet('sheetForm');
}

function bukaFormTolak(order, onKonfirmasi){
  $('formKonten').innerHTML=`
    <div class="sect-judul" style="padding:8px 16px 4px">Tolak pesanan ${order.kode}</div>
    <div style="padding:0 16px">
      <div class="f-label">Alasan penolakan</div>
      <textarea class="inp" id="alasanTolak" placeholder="cth. Bahan habis / menu tidak tersedia / jadwal penuh"></textarea>
      <button class="btn" id="konfirmasiTolak" style="background:#d35400">Tolak & kirim WhatsApp</button>
    </div>`;
  $('konfirmasiTolak').onclick=async()=>{
    const alasan=$('alasanTolak').value.trim();
    tutupSemua();
    await onKonfirmasi(alasan);
  };
  bukaSheet('sheetForm');
}

function renderPesananHistori(){
  const el=$('admPesananHistori'); if(!el) return;
  const histori = PESANAN_ADMIN.filter(o=>['dibatalkan','ditolak'].includes(normalizeStatus(o.status)));
  if(!histori.length){
    el.innerHTML = `<div class="kosong" style="padding:30px 20px"><div class="em">📦</div><p>Belum ada pesanan batal atau ditolak.</p></div>`;
    return;
  }
  el.innerHTML = histori.map(o=>{
    const w=new Date(o.waktu);
    return `<div class="pesanan-item histori">
      <div class="pi-head"><b>${o.kode}</b><span class="status-pill status-${o.status}">${o.status}</span></div>
      <div class="pi-info">${o.nama||'-'} · ${o.hp||'-'} · ${o.metode==='antar'?'Diantar':'Ambil'}</div>
      <div class="pi-items">${(o.items||[]).map(i=>i.qty+'× '+i.nama).join(' · ')}</div>
      <div class="pi-total">${rp(o.total)}</div>
      <div class="pi-meta">${w.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})} ${w.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div>
    </div>`;
  }).join('');
}

// ===================== ADMIN =====================
window.loginAdminUI=async function(){
  const email=($('adminEmail').value||'').trim();
  const pass=$('adminPass').value||'';
  if(!email||!pass){toast('Isi email & password');return;}
  const btn=$('btnLoginAdmin');btn.disabled=true;btn.textContent='Masuk…';
  try{
    await DB.loginAdmin(email,pass);
    $('adminLogin').classList.add('hidden');$('adminPanel').classList.remove('hidden');renderAdmin();mulaiPollingPesanan();
  }catch(e){
    toast(DB.MODE_DEMO?'Login butuh Supabase aktif, bukan mode demo':'Email/password salah');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Masuk';}
  }
};
window.logoutAdmin=async function(){await DB.logoutAdmin();hentikanPollingPesanan();$('adminPanel').classList.add('hidden');$('adminLogin').classList.remove('hidden');$('adminEmail').value='';$('adminPass').value='';};

function renderAdmin(){
  $('stMenu').textContent=MENU.filter(m=>m.aktif).length;
  $('stPromo').textContent=PROMO.filter(p=>p.aktif).length;
  renderKasir();
  renderOngkirSettings();
  refreshPesananAdmin();
  $('admMenuList').innerHTML=MENU.map(m=>`
    <div class="adm-item"><div class="af">${fotoBox(m)}</div>
      <div><div class="an">${m.nama}</div><div class="ap">${rp(hargaFinal(m))}${m.promo?' · promo':''} · ${m.kat}</div></div>
      <div class="actions"><div class="tog ${m.aktif?'on':''}" data-tog="${m.id}"></div>
        <button data-edit="${m.id}">✏️</button><button data-del="${m.id}">🗑️</button></div>
    </div>`).join('');
  $('admPromoList').innerHTML=PROMO.map(p=>`
    <div class="adm-item"><div class="af" style="background:linear-gradient(135deg,var(--kayu),var(--kayu-terang));display:grid;place-items:center;font-size:20px">🎟️</div>
      <div><div class="an">${p.judul}</div><div class="ap">${p.kode} · ${p.sub}</div></div>
      <div class="actions"><div class="tog ${p.aktif?'on':''}" data-togp="${p.id}"></div><button data-delp="${p.id}">🗑️</button></div>
    </div>`).join('');
  document.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>toggleMenu(+b.dataset.tog));
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>bukaFormMenu(+b.dataset.edit));
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>hapusMenuUI(+b.dataset.del));
  document.querySelectorAll('[data-togp]').forEach(b=>b.onclick=()=>togglePromo(+b.dataset.togp));
  document.querySelectorAll('[data-delp]').forEach(b=>b.onclick=()=>hapusPromoUI(+b.dataset.delp));
}
// ---- pesanan (admin) ----
window.refreshPesananAdmin=async function(){
  await DB.hapusPesananLama();
  PESANAN_ADMIN = (await DB.getPesanan()).map(o => ({ ...o, status: formatStatus(o.status) }));
  $('stPesanan').textContent = PESANAN_ADMIN.filter(p=>!['selesai','dibatalkan','ditolak'].includes(normalizeStatus(p.status))).length;
  renderPesananList();
  renderPesananHistori();
  if(dashDari) renderDashboard(); else setDashRange('7');
};

// ---- dashboard penjualan (admin) ----
window.setDashRange=function(kind){
  const now=new Date();
  let dari, sampai=new Date(now); sampai.setHours(23,59,59,999);
  if(kind==='hari'){ dari=new Date(now); dari.setHours(0,0,0,0); }
  else if(kind==='30'){ dari=new Date(now); dari.setDate(dari.getDate()-29); dari.setHours(0,0,0,0); }
  else if(kind==='bulan'){ dari=new Date(now.getFullYear(),now.getMonth(),1); }
  else { dari=new Date(now); dari.setDate(dari.getDate()-6); dari.setHours(0,0,0,0); }
  dashDari=dari; dashSampai=sampai;
  $('dashDari').value=dari.toISOString().slice(0,10);
  $('dashSampai').value=sampai.toISOString().slice(0,10);
  document.querySelectorAll('.dash-chips .chip').forEach(c=>c.classList.toggle('aktif',c.dataset.range===kind));
  renderDashboard();
};
window.terapkanDashCustom=function(){
  const dVal=$('dashDari').value, sVal=$('dashSampai').value;
  if(!dVal||!sVal){toast('Pilih tanggal dari & sampai');return;}
  if(dVal>sVal){toast('Tanggal "dari" harus sebelum "sampai"');return;}
  dashDari=new Date(dVal+'T00:00:00'); dashSampai=new Date(sVal+'T23:59:59');
  document.querySelectorAll('.dash-chips .chip').forEach(c=>c.classList.remove('aktif'));
  renderDashboard();
};
function renderDashboard(){
  if(!dashDari||!dashSampai) return;
  const dalamRange = PESANAN_ADMIN.filter(o=>{
    const w=new Date(o.waktu).getTime();
    return w>=dashDari.getTime() && w<=dashSampai.getTime();
  });
  const selesai = dalamRange.filter(o=>normalizeStatus(o.status)==='selesai');
  const batal = dalamRange.filter(o=>normalizeStatus(o.status)==='dibatalkan');
  const ditolak = dalamRange.filter(o=>normalizeStatus(o.status)==='ditolak');
  const omzet = selesai.reduce((s,o)=>s+Number(o.total||0),0);
  const rata = selesai.length ? Math.round(omzet/selesai.length) : 0;
  $('dOmzet').textContent = rp(omzet);
  $('dJumlah').textContent = selesai.length;
  $('dRata').textContent = rp(rata);
  $('dBatal').textContent = batal.length + ditolak.length;

  const agg={};
  selesai.forEach(o=>(o.items||[]).forEach(i=>{
    const k=i.nama; agg[k]=agg[k]||{qty:0,omzet:0};
    agg[k].qty+=i.qty; agg[k].omzet+=i.qty*i.harga;
  }));
  const top=Object.entries(agg).sort((a,b)=>b[1].qty-a[1].qty).slice(0,6);
  const maxQty=top.length?top[0][1].qty:0;
  $('dashTerlaris').innerHTML = top.length ? top.map(([nama,v])=>`
    <div class="terlaris-row">
      <div class="tr-head"><span>${nama}</span><b>${v.qty}× · ${rp(v.omzet)}</b></div>
      <div class="tr-bar"><div class="tr-fill" style="width:${maxQty?Math.round(v.qty/maxQty*100):0}%"></div></div>
    </div>`).join('') : `<p style="font-size:12px;color:var(--abu);padding:2px">Belum ada pesanan selesai di rentang ini.</p>`;
}
function renderPesananList(){
  const el=$('admPesananList'); if(!el) return;
  const aktif = PESANAN_ADMIN.filter(o=>!['selesai','dibatalkan','ditolak'].includes(normalizeStatus(o.status)));
  if(!aktif.length){ el.innerHTML=`<div class="kosong" style="padding:30px 20px"><div class="em">📭</div><p>Tidak ada pesanan aktif saat ini.</p></div>`; return; }
  const statusFlowNormalized = DB.STATUS_FLOW.map(normalizeStatus);
  el.innerHTML = aktif.map(o=>{
    const next = DB.STATUS_FLOW[statusFlowNormalized.indexOf(normalizeStatus(o.status))+1];
    const bisaBatal = !['selesai','dibatalkan','ditolak'].includes(normalizeStatus(o.status));
    return `<div class="pesanan-item">
      <div class="pi-head"><b>${o.kode}</b><span class="status-pill status-${normalizeStatus(o.status)}">${formatStatus(o.status)}</span></div>
      <div class="pi-info">${o.nama||'-'} · ${o.hp||'-'} · ${o.metode==='antar'?'Diantar':'Ambil'}</div>
      <div class="pi-items">${(o.items||[]).map(i=>i.qty+'× '+i.nama).join(' · ')}</div>
      <div class="pi-total">${rp(o.total)}</div>
      <div class="pi-actions">
        ${next?`<button class="maju" data-maju="${o.id}|${next}">Tandai ${next}</button>`:''}
        ${bisaBatal?`<button class="selesai" data-selesai="${o.id}">Selesai</button><button class="tolak" data-tolak="${o.id}">Tolak</button><button class="batal" data-batal="${o.id}">Batalkan</button>`:''}
      </div>
    </div>`;
  }).join('');
  document.querySelectorAll('#admPesananList [data-maju]').forEach(b=>b.onclick=()=>{
    const [id,status]=b.dataset.maju.split('|');
    ubahStatusUI(+id,status);
  });
  document.querySelectorAll('#admPesananList [data-selesai]').forEach(b=>b.onclick=()=>{
    const id = +b.dataset.selesai;
    ubahStatusUI(id,'Selesai');
  });
  document.querySelectorAll('#admPesananList [data-batal]').forEach(b=>b.onclick=()=>{
    const o=PESANAN_ADMIN.find(x=>String(x.id)===b.dataset.batal);
    if(!o) return;
    bukaFormBatal(o, async(alasan)=>{
      try{
        await DB.ubahStatusPesanan(o.id,'Dibatalkan');
        beritahuBatalKeWhatsApp(o,alasan);
        toast('Pesanan dibatalkan ✓');
        await refreshPesananAdmin();
      }catch(e){ toast('Gagal membatalkan'); console.error(e); }
    });
  });
  document.querySelectorAll('#admPesananList [data-tolak]').forEach(b=>b.onclick=()=>{
    const o=PESANAN_ADMIN.find(x=>String(x.id)===b.dataset.tolak);
    if(!o) return;
    bukaFormTolak(o, async(alasan)=>{
      try{
        await DB.ubahStatusPesanan(o.id,'Ditolak');
        tolakKeWhatsApp(o,alasan);
        toast('Pesanan ditolak ✓');
        await refreshPesananAdmin();
      }catch(e){ toast('Gagal tolak pesanan'); console.error(e); }
    });
  });
}
async function ubahStatusUI(id,status){
  try{ await DB.ubahStatusPesanan(id,status); toast('Status diperbarui ✓'); await refreshPesananAdmin(); }
  catch(e){ toast('Gagal ubah status'); console.error(e); }
}

async function toggleMenu(id){const m=MENU.find(x=>x.id===id);m.aktif=!m.aktif;await DB.updateMenu(id,{aktif:m.aktif});renderAdmin();render();}
async function hapusMenuUI(id){if(confirm('Hapus menu ini?')){await DB.hapusMenu(id);MENU=MENU.filter(m=>m.id!==id);renderAdmin();render();}}
async function togglePromo(id){const p=PROMO.find(x=>x.id===id);p.aktif=!p.aktif;await DB.updatePromo(id,{aktif:p.aktif});renderAdmin();renderPromo();}
async function hapusPromoUI(id){if(confirm('Hapus promo ini?')){await DB.hapusPromo(id);PROMO=PROMO.filter(p=>p.id!==id);renderAdmin();renderPromo();}}

// ---- form menu ----
window.bukaFormMenu=function(id=null){
  editId=id;const m=id?MENU.find(x=>x.id===id):null;
  tmpKat=m?m.kat:'Kopi'; tmpFoto=m?(m.emoji||'☕'):'☕'; tmpFotoFile=null;
  $('formKonten').innerHTML=`
    <div class="sect-judul" style="padding:8px 16px 4px">${id?'Edit menu':'Tambah menu'}</div>
    <div style="padding:0 16px">
      <div class="f-label">Foto menu (unggah)</div>
      <label class="upload-foto" for="fileUp"><div class="ph" id="upPh">${m&&m.foto_url?'':'<span class="big">📷</span>Ketuk untuk unggah foto'}</div>
        ${m&&m.foto_url?`<img src="${m.foto_url}">`:''}</label>
      <input type="file" id="fileUp" accept="image/*" style="display:none">
      <div class="f-label">Atau pilih ikon cepat</div>
      <div class="seg" id="emoSeg">${EMOJI_OPS.map(e=>`<button class="s ${e===tmpFoto?'on':''}" data-emo="${e}">${e}</button>`).join('')}</div>
      <div class="f-label">Nama menu</div><input class="inp" id="mNama" placeholder="cth. Kopi Susu Beriyu" value="${m?m.nama:''}">
      <div class="f-label">Deskripsi</div><textarea class="inp" id="mDesk" placeholder="Bahan & daya tarik singkat">${m?(m.desk||''):''}</textarea>
      <div class="f-label">Kategori</div>
      <div class="seg" id="katSeg">${KATEGORI.filter(k=>k!=='Semua').map(k=>`<button class="s ${k===tmpKat?'on':''}" data-kat="${k}">${k}</button>`).join('')}</div>
      <div class="f-row">
        <div style="flex:1"><div class="f-label">Harga (Rp)</div><input class="inp" id="mHarga" inputmode="numeric" placeholder="22000" value="${m?m.harga:''}"></div>
        <div style="flex:1"><div class="f-label">Harga promo</div><input class="inp" id="mPromo" inputmode="numeric" placeholder="kosong = tanpa" value="${m&&m.promo?m.promo:''}"></div>
      </div>
      <button class="btn" id="simpanMenu">${id?'Simpan perubahan':'Tambah ke katalog'}</button>
    </div>`;
  $('fileUp').onchange=previewFoto;
  document.querySelectorAll('#emoSeg .s').forEach(b=>b.onclick=()=>{tmpFoto=b.dataset.emo;tmpFotoFile=null;document.querySelectorAll('#emoSeg .s').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('upPh').innerHTML='<span class="big">📷</span>Ketuk untuk unggah foto';const im=document.querySelector('.upload-foto img');if(im)im.remove();});
  document.querySelectorAll('#katSeg .s').forEach(b=>b.onclick=()=>{tmpKat=b.dataset.kat;document.querySelectorAll('#katSeg .s').forEach(x=>x.classList.remove('on'));b.classList.add('on');});
  $('simpanMenu').onclick=simpanMenu;
  bukaSheet('sheetForm');
};
function previewFoto(e){
  const f=e.target.files[0];if(!f)return;tmpFotoFile=f;
  const url=URL.createObjectURL(f);
  const box=document.querySelector('.upload-foto');
  $('upPh').innerHTML='';
  let im=box.querySelector('img');if(!im){im=document.createElement('img');box.appendChild(im);}im.src=url;
}
async function simpanMenu(){
  const nama=$('mNama').value.trim();const harga=parseInt($('mHarga').value)||0;
  if(!nama||!harga){toast('Nama & harga wajib diisi');return;}
  const promo=parseInt($('mPromo').value)||0;
  const desk=$('mDesk').value.trim()||'Menu spesial Beriyu.';
  $('simpanMenu').disabled=true;$('simpanMenu').textContent='Menyimpan…';

  let foto_url = editId ? (MENU.find(x=>x.id===editId).foto_url||null) : null;
  try{ if(tmpFotoFile){ foto_url = await DB.uploadFoto(tmpFotoFile); } }
  catch(e){ toast('Upload foto gagal'); console.error(e); }

  const payload={nama,kat:tmpKat,harga,promo,desk,emoji:tmpFoto,foto_url,aktif:true};
  try{
    if(editId){ await DB.updateMenu(editId,payload); Object.assign(MENU.find(x=>x.id===editId),payload); }
    else{ const baru=await DB.tambahMenu(payload); MENU.push(baru.id?baru:{...payload,id:Date.now()}); }
    if(!MENU.find(x=>x.id===editId) && editId){} // no-op
    // refresh dari sumber kalau supabase
    if(!DB.MODE_DEMO){ MENU=await DB.getMenu(); }
    tutupSemua();renderAdmin();render();toast(editId?'Menu diperbarui ✓':'Menu ditambahkan ✓');
  }catch(e){ toast('Gagal menyimpan'); console.error(e); }
  finally{ if($('simpanMenu')){$('simpanMenu').disabled=false;} }
}

// ---- form promo ----
window.bukaFormPromo=function(){
  $('formKonten').innerHTML=`
    <div class="sect-judul" style="padding:8px 16px 4px">Tambah promo</div>
    <div style="padding:0 16px">
      <div class="f-label">Judul promo</div><input class="inp" id="pJudul" placeholder="cth. Diskon Akhir Pekan">
      <div class="f-label">Keterangan</div><input class="inp" id="pSub" placeholder="cth. Potongan 15% semua kopi">
      <div class="f-label">Kode voucher</div><input class="inp" id="pKode" placeholder="cth. WEEKEND15" style="text-transform:uppercase">
      <button class="btn kayu" id="simpanPromo">Buat promo</button>
      <p class="hint" style="padding:10px 0 0;color:var(--abu)">SORE20 (diskon 20%) & ONGKIRGRATIS (min. ${rp(CONFIG.MIN_GRATIS_ONGKIR)}) sudah punya logika bawaan. Kode lain tampil sebagai info promo.</p>
    </div>`;
  $('simpanPromo').onclick=simpanPromo;
  bukaSheet('sheetForm');
};
async function simpanPromo(){
  const judul=$('pJudul').value.trim(),sub=$('pSub').value.trim(),kode=$('pKode').value.trim().toUpperCase();
  if(!judul||!kode){toast('Judul & kode wajib diisi');return;}
  const payload={judul,sub:sub||'Promo spesial',kode,aktif:true};
  try{
    const baru=await DB.tambahPromo(payload);
    PROMO.push(baru.id?baru:{...payload,id:Date.now()});
    if(!DB.MODE_DEMO) PROMO=await DB.getPromo();
    tutupSemua();renderAdmin();renderPromo();toast('Promo dibuat ✓');
  }catch(e){toast('Gagal menyimpan promo');console.error(e);}
}

// expose sedikit yang dipakai inline
window.CONFIG = CONFIG;

// go!
boot();

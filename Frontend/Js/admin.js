/* =========================================
   BUĞRA POLAT TURİZM - ADMIN JS (FULL DİNAMİK)
========================================= */

let currentTab = 'active';
let tumVeriler = [];

// Araç Değişkenleri
let tumAraclar = [];
let aktifOzellikler = [];
let aktifYorumlar = [];
let secilenGaleriDosyalari = [];

// Tur Değişkenleri
let tumTurlar = [];
let aktifYerler = [];
let secilenTurGaleriDosyalari = [];

window.onload = verileriYukle;

function escapeHtml(deger) {
    return String(deger ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function encodeBase64Unicode(deger) {
    return btoa(unescape(encodeURIComponent(String(deger ?? ''))));
}

function decodeBase64Unicode(deger) {
    return decodeURIComponent(escape(atob(deger)));
}

function sanitizeAssetUrl(url, fallback = '') {
    if (typeof url !== 'string') return fallback;
    const temizUrl = url.trim();
    if (!temizUrl) return fallback;
    if (temizUrl.startsWith('/Frontend/')) return temizUrl;
    if (/^https?:\/\//i.test(temizUrl)) return temizUrl;
    return fallback;
}

function sanitizePhoneForWhatsapp(telefon) {
    return String(telefon ?? '').replace(/[^\d]/g, '');
}

// Yetki Kontrolü Yapan Ortak İstek Fonksiyonu
async function guvenliFetch(url, options = {}) {
    const res = await fetch(url, {
        credentials: 'same-origin',
        ...options
    });
    if (res.status === 401) {
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
    }
    return res;
}

// Sekmeler arası yenileme butonu yönlendirmesi
function aktifSekmeyiYenile() {
    if (currentTab === 'vehicles') {
        araclariYukle();
    } else if (currentTab === 'tours') {
        turlariYukle();
    } else {
        verileriYukle();
    }
}

// --- 1. REZERVASYON SİSTEMİ KODLARI ---
async function verileriYukle() {
    const tbody = document.getElementById('tableBody');
    const refreshBtnIcon = document.querySelector('.btn-refresh i');
    if (refreshBtnIcon) refreshBtnIcon.classList.add('fa-spin');

    try {
        const sRes = await guvenliFetch('/api/admin/stats');
        const stats = await sRes.json();
        document.getElementById('statTotal').innerText = stats.toplam || 0;
        document.getElementById('statNew').innerText = stats.okunmamis || 0;
        document.getElementById('statTrash').innerText = stats.cop || 0;

        const url = currentTab === 'active' ? '/api/admin/reservations' : '/api/admin/trash';
        const res = await guvenliFetch(url);
        tumVeriler = await res.json();
        tabloyuCiz(tumVeriler);
    } catch (e) {
        if (e.message !== 'Oturum süresi doldu.') {
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Bağlantı hatası.</td></tr>';
        }
    } finally {
        if (refreshBtnIcon) refreshBtnIcon.classList.remove('fa-spin');
    }
}

function tabloyuCiz(liste) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (liste.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#999;">Kayıt bulunamadı.</td></tr>';
        return;
    }

    liste.forEach(item => {
        const tarih = item.kayitTarihi ? new Date(item.kayitTarihi).toLocaleDateString('tr-TR') : '-';
        const rowClass = (item.isRead && currentTab === 'active') ? 'is-read' : '';
        const wpLink = `https://wa.me/${sanitizePhoneForWhatsapp(item.telefon)}?text=Merhaba%20${encodeURIComponent(item.adSoyad || '')}`;

        const msgEscaped = encodeBase64Unicode(item.mesaj || '-');
        const noteEscaped = encodeBase64Unicode(item.adminNotu || '');

        const rawMsg = item.mesaj || '-';
        const msgPreview = escapeHtml(rawMsg.length > 35 ? rawMsg.substring(0, 35) + "..." : rawMsg);
        const adSoyad = escapeHtml(item.adSoyad || 'İsimsiz');
        const telefon = escapeHtml(item.telefon || '-');
        const alinisNoktasi = escapeHtml(item.alinisNoktasi || '-');
        const birakilisNoktasi = escapeHtml(item.birakilisNoktasi || '-');
        const formTipi = escapeHtml(item.formTipi || 'Genel');
        const adminNotu = item.adminNotu ? `${escapeHtml(item.adminNotu.substring(0, 25))}...` : '';

        tbody.innerHTML += `
            <tr class="${rowClass}">
                <td data-label="Tarih">${tarih}</td>
                <td data-label="Müşteri"><strong>${adSoyad}</strong><br><small style="color:#666">${telefon}</small></td>
                <td class="route-cell" data-label="Güzergah">
                    <div><i class="fas fa-map-marker-alt text-danger"></i> ${alinisNoktasi}</div>
                    <div><i class="fas fa-flag-checkered text-dark"></i> ${birakilisNoktasi}</div>
                </td>
                <td onclick="mesajGoster('${msgEscaped}', '${item._id}', '${noteEscaped}')" class="msg-cell" data-label="Mesaj">
                    <div class="msg-preview" title="Detay için tıkla">${msgPreview}</div>
                    <span class="note-tag">${item.adminNotu ? `<i class="fas fa-sticky-note"></i> ${adminNotu}` : '<i class="fas fa-plus-circle"></i> Not ekle'}</span>
                </td>
                <td data-label="Tip"><span class="tag ${item.formTipi?.includes('Hero') ? 'tag-hero' : 'tag-contact'}">${formTipi}</span></td>
                <td data-label="İşlemler">
                    <div class="action-flex">
                        ${currentTab === 'active' ? `
                            <button onclick="durumDegistir('${item._id}')" class="btn btn-blue" title="Görülme Durumu"><i class="fas ${item.isRead ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                            <a href="${wpLink}" target="_blank" rel="noopener noreferrer" class="btn btn-green" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
                            <button onclick="kayitSil('${item._id}')" class="btn btn-red" title="Çöpe At"><i class="fas fa-trash"></i></button>
                        ` : `
                            <button onclick="geriYukle('${item._id}')" class="btn btn-orange" title="Geri Yükle"><i class="fas fa-undo"></i></button>
                        `}
                    </div>
                </td>
            </tr>`;
    });
}

function tabloyuFiltrele() {
    const q = document.getElementById('searchInput').value.toLocaleLowerCase('tr-TR');

    if (currentTab === 'vehicles') {
        const filtrelenmisAraclar = tumAraclar.filter(i => (i.aracAd || '').toLocaleLowerCase('tr-TR').includes(q));
        araclariCiz(filtrelenmisAraclar);
        return;
    }

    if (currentTab === 'tours') {
        const filtrelenmisTurlar = tumTurlar.filter(i => (i.turAd || '').toLocaleLowerCase('tr-TR').includes(q));
        turlariCiz(filtrelenmisTurlar);
        return;
    }

    const filtrelenmis = tumVeriler.filter(i => {
        return (i.adSoyad || '').toLocaleLowerCase('tr-TR').includes(q) ||
            (i.telefon || '').includes(q) ||
            (i.alinisNoktasi || '').toLocaleLowerCase('tr-TR').includes(q);
    });
    tabloyuCiz(filtrelenmis);
}

async function mesajGoster(encodedMsg, id, encodedNote) {
    const msg = decodeBase64Unicode(encodedMsg);
    const note = decodeBase64Unicode(encodedNote);
    const { value: text, isConfirmed } = await Swal.fire({
        title: '<span style="color:#0f3d7a; font-weight:800;">Talep Detayları</span>',
        customClass: { popup: 'modern-modal' },
        html: `
            <div class="modern-msg-title">Müşteriden Gelen Mesaj</div>
            <div class="modern-msg-content">${escapeHtml(msg)}</div>
            <div class="modern-msg-title">Admin Özel Notu</div>
            <textarea id="swal-note" class="modern-note-area" rows="4" placeholder="Müşteriyle ilgili notlarınızı buraya yazın...">${escapeHtml(note !== 'undefined' ? note : '')}</textarea>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> Notu Güncelle',
        cancelButtonText: 'Kapat',
        confirmButtonColor: '#0f3d7a',
        reverseButtons: true,
        preConfirm: () => document.getElementById('swal-note').value
    });

    if (isConfirmed && text !== undefined) {
        const res = await guvenliFetch(`/api/admin/reservations/${id}/note`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ not: text })
        });
        if (res.ok) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Kaydedildi', showConfirmButton: false, timer: 1500 });
            verileriYukle();
        }
    }
}

async function durumDegistir(id) { await guvenliFetch(`/api/admin/reservations/${id}/toggle-read`, { method: 'PUT' }); verileriYukle(); }
async function kayitSil(id) {
    const confirm = await Swal.fire({ title: 'Emin misiniz?', text: "Çöpe taşınacak.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c' });
    if (confirm.isConfirmed) { await guvenliFetch(`/api/admin/reservations/${id}`, { method: 'DELETE' }); verileriYukle(); }
}
async function geriYukle(id) { await guvenliFetch(`/api/admin/trash/${id}/restore`, { method: 'PUT' }); verileriYukle(); }

window.cikisYap = async function () {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
};


// --- 2. SEKME (TAB) YÖNETİMİ ---
window.tabDegistir = function (t) {
    currentTab = t;
    document.getElementById('btnActive').classList.toggle('active', t === 'active');
    document.getElementById('btnTrash').classList.toggle('active', t === 'trash');
    document.getElementById('btnVehicles').classList.toggle('active', t === 'vehicles');
    document.getElementById('btnTours').classList.toggle('active', t === 'tours'); // Yeni Tur Sekmesi

    const searchInput = document.getElementById('searchInput');

    // Araçlar
    if (t === 'vehicles') {
        document.getElementById('reservationsSection').style.display = 'none';
        document.getElementById('toursSection').style.display = 'none';
        document.getElementById('vehiclesSection').style.display = 'block';
        searchInput.placeholder = "Araç adı ara...";
        searchInput.value = '';
        araclariYukle();
    }
    // Turlar
    else if (t === 'tours') {
        document.getElementById('reservationsSection').style.display = 'none';
        document.getElementById('vehiclesSection').style.display = 'none';
        document.getElementById('toursSection').style.display = 'block';
        searchInput.placeholder = "Tur adı ara...";
        searchInput.value = '';
        turlariYukle();
    }
    // Rezervasyonlar
    else {
        document.getElementById('vehiclesSection').style.display = 'none';
        document.getElementById('toursSection').style.display = 'none';
        document.getElementById('reservationsSection').style.display = 'block';
        searchInput.placeholder = "İsim, telefon veya güzergah ara...";
        searchInput.value = '';
        verileriYukle();
    }
}


/* ==============================================================
   3. ARAÇ YÖNETİMİ SİSTEMİ KODLARI
============================================================== */
async function araclariYukle() {
    const refreshBtnIcon = document.querySelector('.btn-refresh i');
    if (refreshBtnIcon) refreshBtnIcon.classList.add('fa-spin');

    try {
        const res = await guvenliFetch('/api/admin/vehicles');
        if (res.ok) {
            tumAraclar = await res.json();
            tumAraclar.sort((a, b) => (a.aracSira || 999) - (b.aracSira || 999));
            araclariCiz(tumAraclar);
        } else {
            document.getElementById('vehicleGrid').innerHTML = '<p style="color:#666; width:100%; text-align:center;">Araçlar yüklenemedi.</p>';
        }
    } catch (e) {
        console.error("Araç yükleme hatası:", e);
    } finally {
        if (refreshBtnIcon) refreshBtnIcon.classList.remove('fa-spin');
    }
}

function araclariCiz(liste) {
    const grid = document.getElementById('vehicleGrid');
    grid.innerHTML = '';

    if (liste.length === 0) {
        grid.innerHTML = '<p style="color:#999; text-align:center; width:100%; padding:40px;">Henüz sistemde araç bulunmuyor.</p>';
        return;
    }

    liste.forEach(arac => {
        const foto = sanitizeAssetUrl(arac.fotoUrl, '/Frontend/Images/default-car.jpg');
        const aracVerisi = encodeBase64Unicode(JSON.stringify(arac));
        const aracAd = escapeHtml(arac.aracAd || '');
        const aracMarka = escapeHtml(arac.aracMarka || '');

        let ozellikHtml = '';
        if (arac.aracOzellikler) {
            const ozDizisi = arac.aracOzellikler.split(',');
            ozDizisi.forEach(oz => {
                if (oz.trim()) ozellikHtml += `<span class="tag tag-hero" style="margin:2px;">${escapeHtml(oz.trim())}</span>`;
            });
        } else {
            ozellikHtml = '<span style="color:#999; font-size:12px;">Özellik eklenmemiş</span>';
        }

        const siraRozeti = arac.aracSira ? `<div style="position:absolute; top:10px; right:10px; background:#0f3d7a; color:#fff; padding:5px 10px; border-radius:5px; font-weight:bold; font-size:12px;">Sıra: ${arac.aracSira}</div>` : '';

        grid.innerHTML += `
            <div class="vehicle-card" style="position:relative;">
                ${siraRozeti}
                <div class="vehicle-img-box">
                    <img src="${foto}" alt="${aracAd}">
                </div>
                <div class="vehicle-details">
                    <h4>${aracAd}</h4>
                    <p style="font-size:12px; color:#888; margin-top:-5px; margin-bottom:10px;">${aracMarka}</p>
                    <div style="margin-bottom:15px; display:flex; flex-wrap:wrap; gap:4px;">${ozellikHtml}</div>
                    <div class="vehicle-actions">
                        <button class="btn-edit-veh" onclick="aracDuzenleModalAc('${aracVerisi}')"><i class="fas fa-edit"></i> Düzenle</button>
                        <button class="btn-delete-veh" onclick="aracTamamenSil('${arac._id}')"><i class="fas fa-trash"></i> Sil</button>
                    </div>
                </div>
            </div>
        `;
    });
}

// Modal İşlemleri
const vehicleModal = document.getElementById('vehicleModal');
const vehicleForm = document.getElementById('vehicleForm');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('aracFotoInput');
const imagePreviewBox = document.getElementById('imagePreviewBox');
const previewImg = document.getElementById('previewImg');
const btnSaveVehicle = document.getElementById('btnSaveVehicle');

window.aracModalAc = function () {
    vehicleForm.reset();
    document.getElementById('aracId').value = '';
    document.getElementById('aracSira').value = '';
    document.getElementById('aracMarka').value = '';
    document.getElementById('aracAciklama').value = '';
    document.getElementById('modalTitle').innerText = 'Yeni Araç Ekle';
    btnSaveVehicle.innerHTML = '<i class="fas fa-save"></i> Kaydet';

    aktifOzellikler = [];
    ozellikleriEkranaCiz();
    aktifYorumlar = [];
    yorumlariEkranaCiz();
    secilenGaleriDosyalari = [];
    document.getElementById('galleryPreviewBox').innerHTML = '';
    fotoKaldir();
    vehicleModal.classList.add('active');
}

window.aracDuzenleModalAc = function (encodedData) {
    const arac = JSON.parse(decodeBase64Unicode(encodedData));

    document.getElementById('aracId').value = arac._id;
    document.getElementById('aracAd').value = arac.aracAd;
    document.getElementById('aracSira').value = arac.aracSira || '';
    document.getElementById('aracMarka').value = arac.aracMarka || '';
    document.getElementById('aracAciklama').value = arac.aracAciklama || '';
    document.getElementById('modalTitle').innerText = 'Aracı Düzenle';
    btnSaveVehicle.innerHTML = '<i class="fas fa-sync"></i> Güncelle';

    aktifOzellikler = arac.aracOzellikler ? arac.aracOzellikler.split(',').map(o => o.trim()).filter(o => o) : [];
    ozellikleriEkranaCiz();

    try {
        aktifYorumlar = arac.aracYorumlar ? JSON.parse(arac.aracYorumlar) : [];
    } catch (e) { aktifYorumlar = []; }
    yorumlariEkranaCiz();

    secilenGaleriDosyalari = [];
    document.getElementById('galleryPreviewBox').innerHTML = '';

    if (arac.fotoUrl) {
        previewImg.src = arac.fotoUrl;
        imagePreviewBox.style.display = 'block';
        dropZone.style.display = 'none';
    } else {
        fotoKaldir();
    }

    vehicleModal.classList.add('active');
}

window.aracModalKapat = function () {
    vehicleModal.classList.remove('active');
}

// Araç Özellikleri
window.ozellikEkle = function () {
    const input = document.getElementById('yeniOzellikInput');
    const val = input.value.trim();
    if (val && !aktifOzellikler.includes(val)) {
        aktifOzellikler.push(val);
        ozellikleriEkranaCiz();
        input.value = '';
    }
}
window.ozellikSil = function (index) {
    aktifOzellikler.splice(index, 1);
    ozellikleriEkranaCiz();
}
function ozellikleriEkranaCiz() {
    const container = document.getElementById('featureTagsContainer');
    if (!container) return;
    container.innerHTML = '';
    aktifOzellikler.forEach((ozellik, i) => {
        container.innerHTML += `
            <div class="feature-tag">
                <i class="fas fa-check-circle" style="color: #d4af37;"></i> ${escapeHtml(ozellik)} 
                <i class="fas fa-times-circle" style="margin-left: 5px; cursor:pointer; color: #e74c3c;" onclick="ozellikSil(${i})"></i>
            </div>`;
    });
    document.getElementById('aracOzelliklerGizli').value = aktifOzellikler.join(', ');
}

// Araç Yorumları
window.yorumEkle = function () {
    const isimInput = document.getElementById('yeniYorumIsim');
    const metinInput = document.getElementById('yeniYorumMetin');
    const isim = isimInput.value.trim();
    const metin = metinInput.value.trim();
    if (isim && metin) {
        aktifYorumlar.push({ isim, metin });
        yorumlariEkranaCiz();
        isimInput.value = '';
        metinInput.value = '';
    }
};
window.yorumSil = function (index) {
    aktifYorumlar.splice(index, 1);
    yorumlariEkranaCiz();
};
window.yorumlariEkranaCiz = function () {
    const container = document.getElementById('yorumlarContainer');
    if (!container) return;
    container.innerHTML = '';
    aktifYorumlar.forEach((yorum, i) => {
        container.innerHTML += `
            <div class="feature-tag" style="display:flex; justify-content:space-between; width:100%; background:#fff; border-left:3px solid #f39c12; padding:10px;">
                <div style="flex:1;"><strong>${escapeHtml(yorum.isim)}:</strong> ${escapeHtml(yorum.metin)}</div>
                <i class="fas fa-trash" style="color:#e74c3c; cursor:pointer; margin-left:15px; align-self:center;" onclick="yorumSil(${i})"></i>
            </div>`;
    });
    document.getElementById('aracYorumlarGizli').value = JSON.stringify(aktifYorumlar);
};

// Araç Kapak Foto
if (dropZone) {
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, (ev) => { ev.preventDefault(); dropZone.style.background = "#f0f4f8"; }));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, (ev) => { ev.preventDefault(); dropZone.style.background = "#f8fafc"; }));
    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            fotoOnizlemeYap(fileInput);
        }
    });
}
window.fotoOnizlemeYap = function (input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImg.src = e.target.result;
            imagePreviewBox.style.display = 'block';
            dropZone.style.display = 'none';
        }
        reader.readAsDataURL(file);
    }
}
window.fotoKaldir = function () {
    document.getElementById('aracFotoInput').value = '';
    previewImg.src = '';
    imagePreviewBox.style.display = 'none';
    dropZone.style.display = 'block';
}

// Araç Galeri
window.galeriOnizlemeYap = function (input) {
    if (input.files) {
        Array.from(input.files).forEach(file => secilenGaleriDosyalari.push(file));
        galeriEkranaCiz();
    }
    input.value = '';
}
window.galeriEkranaCiz = function () {
    const box = document.getElementById('galleryPreviewBox');
    box.innerHTML = '';
    secilenGaleriDosyalari.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            box.innerHTML += `
                <div class="gallery-item">
                    <img src="${e.target.result}">
                    <button type="button" class="btn-remove-gal" onclick="galeriResimSil(${index})"><i class="fas fa-times"></i></button>
                </div>`;
        }
        reader.readAsDataURL(file);
    });
}
window.galeriResimSil = function (index) {
    secilenGaleriDosyalari.splice(index, 1);
    galeriEkranaCiz();
}

// Araç Kaydet
window.aracKaydet = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveVehicle');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
    btn.disabled = true;
    try {
        const formEl = document.getElementById('vehicleForm');
        const formData = new FormData(formEl);
        formData.delete('aracGaleri');
        secilenGaleriDosyalari.forEach(file => formData.append('aracGaleri', file));

        const id = document.getElementById('aracId').value;
        const url = id ? `/api/admin/vehicles/${id}` : '/api/admin/vehicles';
        const method = id ? 'PUT' : 'POST';

        const res = await guvenliFetch(url, { method: method, body: formData });
        const result = await res.json();

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Başarılı', text: 'Araç bilgileri kaydedildi.', confirmButtonColor: '#0f3d7a' });
            aracModalKapat();
            araclariYukle();
        } else {
            Swal.fire({ icon: 'error', title: 'Hata', text: result.mesaj || 'Kayıt başarısız.' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Bağlantı Hatası', text: 'Sunucuya ulaşılamıyor.' });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
window.aracTamamenSil = async function (id) {
    const confirm = await Swal.fire({ title: 'Aracı Sil?', text: "Bu işlem geri alınamaz.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c' });
    if (confirm.isConfirmed) {
        await guvenliFetch(`/api/admin/vehicles/${id}`, { method: 'DELETE' });
        araclariYukle();
    }
}


/* ==============================================================
   4. YENİ: TURLAR YÖNETİMİ SİSTEMİ
============================================================== */

async function turlariYukle() {
    const refreshBtnIcon = document.querySelector('.btn-refresh i');
    if (refreshBtnIcon) refreshBtnIcon.classList.add('fa-spin');

    try {
        const res = await guvenliFetch('/api/admin/tours');
        if (res.ok) {
            tumTurlar = await res.json();
            tumTurlar.sort((a, b) => (a.turSira || 999) - (b.turSira || 999));
            turlariCiz(tumTurlar);
        } else {
            document.getElementById('tourGrid').innerHTML = '<p style="color:#666; width:100%; text-align:center;">Turlar yüklenemedi.</p>';
        }
    } catch (e) {
        console.error("Tur yükleme hatası:", e);
    } finally {
        if (refreshBtnIcon) refreshBtnIcon.classList.remove('fa-spin');
    }
}

function turlariCiz(liste) {
    const grid = document.getElementById('tourGrid');
    grid.innerHTML = '';

    if (liste.length === 0) {
        grid.innerHTML = '<p style="color:#999; text-align:center; width:100%; padding:40px;">Henüz sistemde tur bulunmuyor.</p>';
        return;
    }

    liste.forEach(tur => {
        const foto = sanitizeAssetUrl(tur.fotoUrl, '/Frontend/Images/default-car.jpg');
        const turVerisi = encodeBase64Unicode(JSON.stringify(tur));
        const turAd = escapeHtml(tur.turAd || '');
        const turBolge = escapeHtml(tur.turBolge || 'Belirtilmedi');
        const turRozet = escapeHtml(tur.turRozet || '');

        const siraRozeti = tur.turSira ? `<div style="position:absolute; top:10px; right:10px; background:#27ae60; color:#fff; padding:5px 10px; border-radius:5px; font-weight:bold; font-size:12px;">Sıra: ${tur.turSira}</div>` : '';
        const turRozetLabel = tur.turRozet ? `<div style="position:absolute; top:10px; left:10px; background:#f39c12; color:#fff; padding:5px 10px; border-radius:5px; font-weight:bold; font-size:12px;">${turRozet}</div>` : '';

        grid.innerHTML += `
            <div class="vehicle-card" style="position:relative; border-top: 3px solid #27ae60;">
                ${siraRozeti}
                ${turRozetLabel}
                <div class="vehicle-img-box">
                    <img src="${foto}" alt="${turAd}">
                </div>
                <div class="vehicle-details">
                    <h4>${turAd}</h4>
                    <p style="font-size:12px; color:#888; margin-top:-5px; margin-bottom:10px;"><i class="fas fa-map-marker-alt"></i> ${turBolge}</p>
                    
                    <div class="vehicle-actions" style="margin-top:15px;">
                        <button class="btn-edit-veh" style="background:#f0f4f8; color:#0f3d7a;" onclick="turDuzenleModalAc('${turVerisi}')"><i class="fas fa-edit"></i> Düzenle</button>
                        <button class="btn-delete-veh" style="background:#e74c3c; color:white; border:none; border-radius:5px; padding:8px 12px; cursor:pointer;" onclick="turTamamenSil('${tur._id}')"><i class="fas fa-trash"></i> Sil</button>
                    </div>
                </div>
            </div>
        `;
    });
}

// Tur Modal İşlemleri
const tourModal = document.getElementById('tourModal');
const tourForm = document.getElementById('tourForm');
const dropZoneTour = document.getElementById('dropZoneTour');
const turFotoInput = document.getElementById('turFotoInput');
const tourImagePreviewBox = document.getElementById('tourImagePreviewBox');
const tourPreviewImg = document.getElementById('tourPreviewImg');
const btnSaveTour = document.getElementById('btnSaveTour');

window.turModalAc = function () {
    tourForm.reset();
    document.getElementById('turId').value = '';
    document.getElementById('turSira').value = '';
    document.getElementById('turAd').value = '';
    document.getElementById('turBolge').value = '';
    document.getElementById('turAciklama').value = '';
    document.getElementById('turRozet').value = '';

    document.getElementById('tourModalTitle').innerText = 'Yeni Tur Ekle';
    btnSaveTour.innerHTML = '<i class="fas fa-save"></i> Kaydet';

    aktifYerler = [];
    yerleriEkranaCiz();

    secilenTurGaleriDosyalari = [];
    document.getElementById('tourGalleryPreviewBox').innerHTML = '';
    turFotoKaldir();

    tourModal.classList.add('active');
}

window.turDuzenleModalAc = function (encodedData) {
    const tur = JSON.parse(decodeBase64Unicode(encodedData));

    document.getElementById('turId').value = tur._id;
    document.getElementById('turAd').value = tur.turAd;
    document.getElementById('turSira').value = tur.turSira || '';
    document.getElementById('turBolge').value = tur.turBolge || '';
    document.getElementById('turAciklama').value = tur.turAciklama || '';
    document.getElementById('turRozet').value = tur.turRozet || '';

    document.getElementById('tourModalTitle').innerText = 'Turu Düzenle';
    btnSaveTour.innerHTML = '<i class="fas fa-sync"></i> Güncelle';

    aktifYerler = tur.turYerler ? tur.turYerler.split(',').map(o => o.trim()).filter(o => o) : [];
    yerleriEkranaCiz();

    secilenTurGaleriDosyalari = [];
    document.getElementById('tourGalleryPreviewBox').innerHTML = '';

    if (tur.fotoUrl) {
        tourPreviewImg.src = tur.fotoUrl;
        tourImagePreviewBox.style.display = 'block';
        dropZoneTour.style.display = 'none';
    } else {
        turFotoKaldir();
    }

    tourModal.classList.add('active');
}

window.turModalKapat = function () {
    tourModal.classList.remove('active');
}

// Tur Yerler Ekleme (Özellikler gibi)
window.yerEkle = function () {
    const input = document.getElementById('yeniYerInput');
    const val = input.value.trim();
    if (val && !aktifYerler.includes(val)) {
        aktifYerler.push(val);
        yerleriEkranaCiz();
        input.value = '';
    }
}
window.yerSil = function (index) {
    aktifYerler.splice(index, 1);
    yerleriEkranaCiz();
}
function yerleriEkranaCiz() {
    const container = document.getElementById('yerTagsContainer');
    if (!container) return;
    container.innerHTML = '';
    aktifYerler.forEach((yer, i) => {
        container.innerHTML += `
            <div class="feature-tag" style="background:#e8f5e9; border: 1px solid #27ae60; color:#27ae60;">
                <i class="fas fa-check" style="color: #27ae60;"></i> ${escapeHtml(yer)} 
                <i class="fas fa-times-circle" style="margin-left: 5px; cursor:pointer; color: #e74c3c;" onclick="yerSil(${i})"></i>
            </div>`;
    });
    document.getElementById('turYerlerGizli').value = aktifYerler.join(', ');
}

// Tur Kapak Foto
if (dropZoneTour) {
    ['dragenter', 'dragover'].forEach(e => dropZoneTour.addEventListener(e, (ev) => { ev.preventDefault(); dropZoneTour.style.background = "#e8f5e9"; }));
    ['dragleave', 'drop'].forEach(e => dropZoneTour.addEventListener(e, (ev) => { ev.preventDefault(); dropZoneTour.style.background = "#f8fafc"; }));
    dropZoneTour.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) {
            turFotoInput.files = e.dataTransfer.files;
            turFotoOnizlemeYap(turFotoInput);
        }
    });
}
window.turFotoOnizlemeYap = function (input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            tourPreviewImg.src = e.target.result;
            tourImagePreviewBox.style.display = 'block';
            dropZoneTour.style.display = 'none';
        }
        reader.readAsDataURL(file);
    }
}
window.turFotoKaldir = function () {
    document.getElementById('turFotoInput').value = '';
    tourPreviewImg.src = '';
    tourImagePreviewBox.style.display = 'none';
    dropZoneTour.style.display = 'block';
}

// Tur Galeri Foto
window.turGaleriOnizlemeYap = function (input) {
    if (input.files) {
        Array.from(input.files).forEach(file => secilenTurGaleriDosyalari.push(file));
        turGaleriEkranaCiz();
    }
    input.value = '';
}
window.turGaleriEkranaCiz = function () {
    const box = document.getElementById('tourGalleryPreviewBox');
    box.innerHTML = '';
    secilenTurGaleriDosyalari.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            box.innerHTML += `
                <div class="gallery-item">
                    <img src="${e.target.result}">
                    <button type="button" class="btn-remove-gal" onclick="turGaleriResimSil(${index})"><i class="fas fa-times"></i></button>
                </div>`;
        }
        reader.readAsDataURL(file);
    });
}
window.turGaleriResimSil = function (index) {
    secilenTurGaleriDosyalari.splice(index, 1);
    turGaleriEkranaCiz();
}

// Tur Kaydet / Gönder
window.turKaydet = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveTour');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
    btn.disabled = true;
    try {
        const formEl = document.getElementById('tourForm');
        const formData = new FormData(formEl);
        formData.delete('turGaleri');
        secilenTurGaleriDosyalari.forEach(file => formData.append('turGaleri', file));

        const id = document.getElementById('turId').value;
        const url = id ? `/api/admin/tours/${id}` : '/api/admin/tours';
        const method = id ? 'PUT' : 'POST';

        const res = await guvenliFetch(url, { method: method, body: formData });
        const result = await res.json();

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Başarılı', text: 'Tur bilgileri kaydedildi.', confirmButtonColor: '#27ae60' });
            turModalKapat();
            turlariYukle();
        } else {
            Swal.fire({ icon: 'error', title: 'Hata', text: result.mesaj || 'Kayıt başarısız.' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Bağlantı Hatası', text: 'Sunucuya ulaşılamıyor.' });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
window.turTamamenSil = async function (id) {
    const confirm = await Swal.fire({ title: 'Turu Sil?', text: "Bu işlem geri alınamaz.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c' });
    if (confirm.isConfirmed) {
        await guvenliFetch(`/api/admin/tours/${id}`, { method: 'DELETE' });
        turlariYukle();
    }
}

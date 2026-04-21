/* =========================================
   BUĞRA POLAT TURİZM - ADMIN JS (VER: 3.1 - TAG SİSTEMLİ)
========================================= */

let currentTab = 'active';
let tumVeriler = [];
let tumAraclar = []; // Araçları tutacağımız dizi
let aktifOzellikler = []; // YENİ: Eklenen araç özelliklerini tutacak dizi

window.onload = verileriYukle;

// Yetki Kontrolü Yapan Ortak İstek Fonksiyonu
async function guvenliFetch(url, options = {}) {
    const res = await fetch(url, options);
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
    } else {
        verileriYukle();
    }
}

// --- 1. REZERVASYON (ESKİ) SİSTEMİ KODLARI ---
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
        const wpLink = `https://wa.me/${item.telefon}?text=Merhaba%20${encodeURIComponent(item.adSoyad || '')}`;

        const msgEscaped = btoa(unescape(encodeURIComponent(item.mesaj || '-')));
        const noteEscaped = btoa(unescape(encodeURIComponent(item.adminNotu || '')));

        const rawMsg = item.mesaj || '-';
        const msgPreview = rawMsg.length > 35 ? rawMsg.substring(0, 35) + "..." : rawMsg;

        tbody.innerHTML += `
            <tr class="${rowClass}">
                <td>${tarih}</td>
                <td><strong>${item.adSoyad || 'İsimsiz'}</strong><br><small style="color:#666">${item.telefon || '-'}</small></td>
                <td class="route-cell">
                    <div><i class="fas fa-map-marker-alt text-danger"></i> ${item.alinisNoktasi || '-'}</div>
                    <div><i class="fas fa-flag-checkered text-dark"></i> ${item.birakilisNoktasi || '-'}</div>
                </td>
                <td onclick="mesajGoster('${msgEscaped}', '${item._id}', '${noteEscaped}')" class="msg-cell">
                    <div class="msg-preview" title="Detay için tıkla">${msgPreview}</div>
                    <span class="note-tag">${item.adminNotu ? `<i class="fas fa-sticky-note"></i> ${item.adminNotu.substring(0, 25)}...` : '<i class="fas fa-plus-circle"></i> Not ekle'}</span>
                </td>
                <td><span class="tag ${item.formTipi?.includes('Hero') ? 'tag-hero' : 'tag-contact'}">${item.formTipi || 'Genel'}</span></td>
                <td>
                    <div class="action-flex">
                        ${currentTab === 'active' ? `
                            <button onclick="durumDegistir('${item._id}')" class="btn btn-blue" title="Görülme Durumu"><i class="fas ${item.isRead ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                            <a href="${wpLink}" target="_blank" class="btn btn-green" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
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

    // Eğer araçlar sekmesindeysek araçları filtrele
    if (currentTab === 'vehicles') {
        const filtrelenmisAraclar = tumAraclar.filter(i => (i.aracAd || '').toLocaleLowerCase('tr-TR').includes(q));
        araclariCiz(filtrelenmisAraclar);
        return;
    }

    // Değilse rezervasyonları filtrele
    const filtrelenmis = tumVeriler.filter(i => {
        return (i.adSoyad || '').toLocaleLowerCase('tr-TR').includes(q) ||
            (i.telefon || '').includes(q) ||
            (i.alinisNoktasi || '').toLocaleLowerCase('tr-TR').includes(q);
    });
    tabloyuCiz(filtrelenmis);
}

async function mesajGoster(encodedMsg, id, encodedNote) {
    const msg = decodeURIComponent(escape(atob(encodedMsg)));
    const note = decodeURIComponent(escape(atob(encodedNote)));

    const { value: text, isConfirmed } = await Swal.fire({
        title: '<span style="color:#0f3d7a; font-weight:800;">Talep Detayları</span>',
        customClass: { popup: 'modern-modal' },
        html: `
            <div class="modern-msg-title">Müşteriden Gelen Mesaj</div>
            <div class="modern-msg-content">${msg}</div>
            
            <div class="modern-msg-title">Admin Özel Notu</div>
            <textarea id="swal-note" class="modern-note-area" rows="4" placeholder="Müşteriyle ilgili notlarınızı buraya yazın...">${note !== 'undefined' ? note : ''}</textarea>
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
function tabDegistir(t) {
    currentTab = t;
    document.getElementById('btnActive').classList.toggle('active', t === 'active');
    document.getElementById('btnTrash').classList.toggle('active', t === 'trash');
    document.getElementById('btnVehicles').classList.toggle('active', t === 'vehicles');

    const searchInput = document.getElementById('searchInput');

    if (t === 'vehicles') {
        document.getElementById('reservationsSection').style.display = 'none';
        document.getElementById('vehiclesSection').style.display = 'block';
        searchInput.placeholder = "Araç adı ara...";
        searchInput.value = '';
        araclariYukle();
    } else {
        document.getElementById('reservationsSection').style.display = 'block';
        document.getElementById('vehiclesSection').style.display = 'none';
        searchInput.placeholder = "İsim, telefon veya güzergah ara...";
        searchInput.value = '';
        verileriYukle();
    }
}


// --- 3. ARAÇ YÖNETİMİ SİSTEMİ KODLARI ---

async function araclariYukle() {
    const refreshBtnIcon = document.querySelector('.btn-refresh i');
    if (refreshBtnIcon) refreshBtnIcon.classList.add('fa-spin');

    try {
        const res = await guvenliFetch('/api/admin/vehicles');
        if (res.ok) {
            tumAraclar = await res.json();
            araclariCiz(tumAraclar);
        } else {
            document.getElementById('vehicleGrid').innerHTML = '<p style="color:#666; width:100%; text-align:center;">Araçlar yüklenemedi. Backend API adresinizi kontrol edin (/api/admin/vehicles).</p>';
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
        const foto = arac.fotoUrl || '/Frontend/Images/default-car.jpg';
        const aracVerisi = btoa(unescape(encodeURIComponent(JSON.stringify(arac))));

        // Özellikleri arayüzde kart üzerinde şık göstermek için
        let ozellikHtml = '';
        if (arac.aracOzellikler) {
            const ozDizisi = arac.aracOzellikler.split(',');
            ozDizisi.forEach(oz => {
                if (oz.trim()) {
                    ozellikHtml += `<span class="tag tag-hero" style="margin:2px;">${oz.trim()}</span>`;
                }
            });
        } else {
            ozellikHtml = '<span style="color:#999; font-size:12px;">Özellik eklenmemiş</span>';
        }

        grid.innerHTML += `
            <div class="vehicle-card">
                <div class="vehicle-img-box">
                    <img src="${foto}" alt="${arac.aracAd}">
                </div>
                <div class="vehicle-details">
                    <h4>${arac.aracAd}</h4>
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
const imagePreviewBox = document.getElementById('imagePreviewBox');
const previewImg = document.getElementById('previewImg');
const btnSaveVehicle = document.getElementById('btnSaveVehicle');

function aracModalAc() {
    vehicleForm.reset();
    document.getElementById('aracId').value = '';
    document.getElementById('modalTitle').innerText = 'Yeni Araç Ekle';
    btnSaveVehicle.innerHTML = '<i class="fas fa-save"></i> Aracı Kaydet';

    // YENİ: Özellikleri Sıfırla
    aktifOzellikler = [];
    ozellikleriEkranaCiz();

    fotoKaldir();
    vehicleModal.classList.add('active');
}

function aracDuzenleModalAc(encodedData) {
    const arac = JSON.parse(decodeURIComponent(escape(atob(encodedData))));

    document.getElementById('aracId').value = arac._id;
    document.getElementById('aracAd').value = arac.aracAd;
    document.getElementById('modalTitle').innerText = 'Aracı Düzenle';
    btnSaveVehicle.innerHTML = '<i class="fas fa-sync"></i> Güncelle';

    // YENİ: Eski veritabanı stringini (Örn: "15 Kişi, Deri Koltuk") parçalayıp etiketlere dönüştür
    aktifOzellikler = arac.aracOzellikler ? arac.aracOzellikler.split(',').map(o => o.trim()).filter(o => o) : [];
    ozellikleriEkranaCiz();

    if (arac.fotoUrl) {
        previewImg.src = arac.fotoUrl;
        imagePreviewBox.style.display = 'block';
        dropZone.style.display = 'none';
    } else {
        fotoKaldir();
    }

    vehicleModal.classList.add('active');
}

function aracModalKapat() {
    vehicleModal.classList.remove('active');
}

// --- YENİ: DİNAMİK ÖZELLİK (TAG) SİSTEMİ FONKSİYONLARI ---

function ozellikEkle() {
    const input = document.getElementById('yeniOzellikInput');
    const val = input.value.trim();

    if (val && !aktifOzellikler.includes(val)) {
        aktifOzellikler.push(val);
        ozellikleriEkranaCiz();
        input.value = ''; // Kutuyu temizle
    }
}

function ozellikSil(index) {
    aktifOzellikler.splice(index, 1);
    ozellikleriEkranaCiz();
}

function ozellikleriEkranaCiz() {
    const container = document.getElementById('featureTagsContainer');
    if (!container) return; // Güvenlik kontrolü

    container.innerHTML = '';

    aktifOzellikler.forEach((ozellik, i) => {
        container.innerHTML += `
            <div class="feature-tag">
                <i class="fas fa-check-circle" style="color: #d4af37;"></i> ${ozellik} 
                <i class="fas fa-times-circle" style="margin-left: 5px; cursor:pointer; color: #e74c3c;" onclick="ozellikSil(${i})" title="Sil"></i>
            </div>
        `;
    });

    // Formun sunucuya göndereceği gizli veriyi güncelle
    const gizliInput = document.getElementById('aracOzelliklerGizli');
    if (gizliInput) gizliInput.value = aktifOzellikler.join(', ');
}

// Fotoğraf Seçimi ve Önizleme
function fotoOnizlemeYap(input) {
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

function fotoKaldir() {
    document.getElementById('aracFotoInput').value = '';
    previewImg.src = '';
    imagePreviewBox.style.display = 'none';
    dropZone.style.display = 'block';
}

// Backend'e Gönderim
async function aracKaydet(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveVehicle');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
    btn.disabled = true;

    try {
        const formEl = document.getElementById('vehicleForm');
        const formData = new FormData(formEl); // File ve gizli özellik inputu dahil her şeyi alır
        const id = document.getElementById('aracId').value;

        let url = '/api/admin/vehicles';
        let method = 'POST';

        if (id) {
            url = `/api/admin/vehicles/${id}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            body: formData
        });

        const result = await res.json();

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Başarılı', text: 'Araç bilgileri kaydedildi.', confirmButtonColor: '#0f3d7a' });
            aracModalKapat();
            araclariYukle();
        } else {
            Swal.fire({ icon: 'error', title: 'Hata', text: result.mesaj || 'Kayıt başarısız.' });
        }
    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Bağlantı Hatası', text: 'Sunucuya ulaşılamıyor.' });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function aracTamamenSil(id) {
    const confirm = await Swal.fire({ title: 'Aracı Sil?', text: "Bu işlem geri alınamaz ve aracın fotoğrafı da sunucudan silinir.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c' });
    if (confirm.isConfirmed) {
        await guvenliFetch(`/api/admin/vehicles/${id}`, { method: 'DELETE' });
        araclariYukle();
    }
}
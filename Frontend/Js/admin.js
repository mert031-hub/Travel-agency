/* =========================================
   VIP KIBRIS TRAVEL - ADMIN JS (VER: 2.5)
========================================= */

let currentTab = 'active';
let tumVeriler = [];

window.onload = verileriYukle;

// YENİ: Yetki Kontrolü Yapan Ortak İstek Fonksiyonu
async function guvenliFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 401) { // 401: Yetkisiz erişim (Session bitmiş)
        window.location.href = '/login';
        throw new Error('Oturum süresi doldu.');
    }
    return res;
}

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
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Bağlantı hatası.</td></tr>';
        }
    } finally {
        if (refreshBtnIcon) refreshBtnIcon.classList.remove('fa-spin');
    }
}

function tabloyuCiz(liste) {
    const tbody = document.getElementById('tableBody');
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
    const filtrelenmis = tumVeriler.filter(i => {
        return (i.adSoyad || '').toLocaleLowerCase('tr-TR').includes(q) ||
            (i.telefon || '').includes(q) ||
            (i.alinisNoktasi || '').toLocaleLowerCase('tr-TR').includes(q);
    });
    tabloyuCiz(filtrelenmis);
}

// YARATICI MODAL: Müşteri Mesajı vs Admin Notu
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

function tabDegistir(t) {
    currentTab = t;
    document.getElementById('btnActive').classList.toggle('active', t === 'active');
    document.getElementById('btnTrash').classList.toggle('active', t === 'trash');
    verileriYukle();
}

async function durumDegistir(id) { await guvenliFetch(`/api/admin/reservations/${id}/toggle-read`, { method: 'PUT' }); verileriYukle(); }

async function kayitSil(id) {
    const confirm = await Swal.fire({ title: 'Emin misiniz?', text: "Çöpe taşınacak.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#e74c3c' });
    if (confirm.isConfirmed) {
        await guvenliFetch(`/api/admin/reservations/${id}`, { method: 'DELETE' });
        verileriYukle();
    }
}

async function geriYukle(id) { await guvenliFetch(`/api/admin/trash/${id}/restore`, { method: 'PUT' }); verileriYukle(); }

// YENİ: Çıkış Yap Fonksiyonu
window.cikisYap = async function () {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
};
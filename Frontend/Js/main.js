/* ==============================================================
   1. PRELOADER ZORLAYICI (GECİKMEYİ SIFIRLAMAK İÇİN)
============================================================== */
(function () {
    const preloader = document.getElementById('bp-preloader');
    if (preloader) {
        preloader.style.display = 'flex';
        preloader.style.opacity = '1';
        preloader.style.visibility = 'visible';
    }
})();

/* =========================================
   BUĞRA POLAT TURİZM - MAIN JAVASCRIPT
========================================= */

const WHATSAPP_NUMBER = "905338577240";

// Titreme (flickering) sorununu tamamen kaldıran kilit değişken
let isInitialLoad = true;

function escapeHtml(deger) {
    return String(deger ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeAssetUrl(url, fallback = '') {
    if (typeof url !== 'string') return fallback;
    const temizUrl = url.trim();
    if (!temizUrl) return fallback;
    if (temizUrl.startsWith('/Frontend/') || temizUrl.startsWith('/Css/') || temizUrl.startsWith('/Js/')) {
        return temizUrl;
    }
    if (/^https?:\/\//i.test(temizUrl)) {
        return temizUrl;
    }
    return fallback;
}

function normalizePhone(telefon) {
    return String(telefon ?? '').trim().replace(/\s+/g, '');
}

function applyBlankLinkSecurity(scope = document) {
    scope.querySelectorAll('a[target="_blank"]').forEach(link => {
        link.rel = 'noopener noreferrer';
    });
}

window.bpUtils = {
    escapeHtml,
    sanitizeAssetUrl,
    normalizePhone,
    applyBlankLinkSecurity
};

/**
 * Dil değiştirme fonksiyonu
 */
function changeLanguage(lang) {
    localStorage.setItem('selectedLang', lang);

    if (typeof translations === 'undefined' || !translations[lang]) {
        console.warn("Dil dosyası henüz hazır değil.");
        return;
    }

    const elements = document.querySelectorAll('[data-lang]');
    elements.forEach(el => {
        const key = el.getAttribute('data-lang');
        if (translations[lang][key]) {
            el.innerHTML = translations[lang][key];
        }
    });

    const placeholders = document.querySelectorAll('[data-lang-placeholder]');
    placeholders.forEach(el => {
        const key = el.getAttribute('data-lang-placeholder');
        if (translations[lang][key]) {
            el.setAttribute('placeholder', translations[lang][key]);
        }
    });

    // Bayrak ve metin güncelleme
    const currentFlag = document.getElementById('currentFlag');
    const currentLangText = document.getElementById('currentLangText');

    if (lang === 'tr') {
        currentFlag.src = "https://flagcdn.com/w20/tr.png";
        currentLangText.innerText = "TR";
    } else if (lang === 'en') {
        currentFlag.src = "https://flagcdn.com/w20/gb.png";
        currentLangText.innerText = "EN";
    } else if (lang === 'ru') {
        currentFlag.src = "https://flagcdn.com/w20/ru.png";
        currentLangText.innerText = "RU";
    }

    updateWhatsAppLinks(lang);

    // KİLİT NOKTA: Sayfa ilk açılışında çifte yükleme (flickering) yapmaması için koruma kondu!
    if (!isInitialLoad) {
        if (typeof window.turlariYukle === 'function') window.turlariYukle();
        if (typeof window.araclariYukle === 'function') window.araclariYukle();
        if (typeof window.detayliAraclariYukle === 'function') window.detayliAraclariYukle();
    }

    if (typeof AOS !== 'undefined') {
        setTimeout(() => { AOS.refresh(); }, 150);
    }
}

/**
 * WhatsApp butonlarını akıllı hale getiren fonksiyon
 */
function updateWhatsAppLinks(lang) {
    const wpLinks = document.querySelectorAll('[data-wp-msg]');
    wpLinks.forEach(link => {
        const msgKey = link.getAttribute('data-wp-msg');

        let message = "Merhaba";
        if (typeof translations !== 'undefined' && translations[lang]) {
            message = translations[lang][msgKey] || translations[lang]['wp_msg_default'] || "Merhaba";
        }

        const encodedMsg = encodeURIComponent(message);
        link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMsg}`;
    });
}

/* --- ORTAK UYGULAMA İŞLEMLERİ --- */
document.addEventListener('DOMContentLoaded', function () {
    applyBlankLinkSecurity();

    const savedLang = localStorage.getItem('selectedLang') || 'tr';
    changeLanguage(savedLang);

    // Mobil Menü Kontrolü
    const mobileMenuBtn = document.getElementById('mobileMenuBtn') || document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    function toggleMenu() {
        if (mainNav) {
            mainNav.classList.toggle('active');
            if (menuOverlay) menuOverlay.classList.toggle('active');
            document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : 'auto';
        }
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMenu);
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', toggleMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', toggleMenu);

    if (mainNav) {
        const navLinks = mainNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('active');
                if (menuOverlay) menuOverlay.classList.remove('active');
                document.body.style.overflow = 'auto';
            });
        });
    }

    // Slider Ayarları (Swiper) 
    if (typeof Swiper !== 'undefined') {
        if (document.querySelector('.heroSwiper')) {
            new Swiper(".heroSwiper", {
                loop: true, effect: "fade", autoplay: { delay: 5000 },
                navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
                pagination: { el: ".swiper-pagination", clickable: true }
            });
        }

        if (document.querySelector('.servicesSwiper')) {
            new Swiper(".servicesSwiper", {
                slidesPerView: 1, spaceBetween: 30,
                navigation: { nextEl: ".s-next", prevEl: ".s-prev" },
                pagination: { el: ".swiper-pagination", clickable: true },
                breakpoints: {
                    768: { slidesPerView: 2 },
                    1024: { slidesPerView: 3 }
                }
            });
        }
    }

    if (typeof AOS !== 'undefined') {
        AOS.init({ duration: 800, easing: 'ease-in-out', once: true, offset: 50, disable: false });
    }

    // Telefon giriş engelleme
    const phoneInputs = document.querySelectorAll('input[type="tel"], #heroPhone');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function (e) {
            this.value = this.value.replace(/(?!^\+)[^\d]/g, '');
        });
    });

    /* ==============================================================
        5. API ENTEGRASYONU & VALIDATION
    ============================================================== */
    async function veriGonder(data, formElement) {
        if (data.telefon !== undefined) {
            const cleanPhone = normalizePhone(data.telefon);
            const phoneRegex = /^\+?[0-9]{10,15}$/;
            if (!phoneRegex.test(cleanPhone)) {
                Swal.fire({ icon: 'warning', title: 'Geçersiz Telefon', text: 'Lütfen geçerli bir numara giriniz.' });
                return;
            }
            data.telefon = cleanPhone;
        }

        if (!data.adSoyad || data.adSoyad.trim().length < 3) {
            Swal.fire({ icon: 'warning', title: 'İsim Gerekli', text: 'Lütfen adınızı giriniz.' });
            return;
        }

        const btn = formElement.querySelector('button');
        let originalText = btn ? btn.innerHTML : "";
        if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İletiliyor...'; btn.disabled = true; }

        try {
            const response = await fetch('/api/teklif-al', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.basari) {
                Swal.fire({ icon: 'success', title: 'Başarılı!', text: 'Talebiniz alınmıştır.', confirmButtonColor: '#0f3d7a' });
                formElement.reset();
            } else {
                Swal.fire({ icon: 'error', title: 'Hata!', text: 'İşlem başarısız.' });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Hata', text: 'Sunucuya ulaşılamıyor.' });
        } finally {
            if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
        }
    }

    // Form Eventleri 
    window.gonderHeroForm = async function () {
        const form = document.getElementById('heroForm');
        if (!form) return;
        await veriGonder({
            adSoyad: document.getElementById('heroName').value,
            telefon: document.getElementById('heroPhone').value,
            alinisNoktasi: document.getElementById('heroFrom').value,
            birakilisNoktasi: document.getElementById('heroTo').value,
            tarih: document.getElementById('heroDate').value,
            formTipi: 'Hızlı Fiyat Sor'
        }, form);
    };

    const offerForm = document.querySelector('.offer-form-box form');
    if (offerForm) {
        offerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await veriGonder({
                adSoyad: offerForm.querySelector('input[type="text"]').value,
                email: offerForm.querySelector('input[type="email"]').value,
                telefon: offerForm.querySelector('input[type="tel"]').value,
                yolcuSayisi: offerForm.querySelector('input[type="number"]').value,
                mesaj: offerForm.querySelector('textarea').value,
                formTipi: 'Detaylı Teklif Formu'
            }, offerForm);
        });
    }
});

/* ==============================================================
   DİNAMİK VERİ YÜKLEYİCİLER
============================================================== */

// 1. TURLARI YÜKLE
window.turlariYukle = async function () {
    const vitrin = document.getElementById('anaSayfaTurVitrini');
    if (!vitrin) return;

    // YENİ: İç içe geçmeyi ve tek eleman uzamasını engelleyen Esnek (Flex) sistem
    vitrin.style.display = 'flex';
    vitrin.style.flexWrap = 'wrap';
    vitrin.style.justifyContent = 'center';
    vitrin.style.gap = '30px';
    vitrin.style.alignItems = 'stretch';

    try {
        const res = await fetch('/api/tours');
        const turlar = await res.json();
        vitrin.innerHTML = '';

        if (turlar.length === 0) {
            vitrin.innerHTML = '<p style="text-align:center; width: 100%;">Şu an tur bulunmuyor.</p>';
            return;
        }

        const currentLang = localStorage.getItem('selectedLang') || 'tr';
        const sozluk = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : {};

        turlar.forEach(tur => {
            const sira = tur.turSira || 999;
            const foto = sanitizeAssetUrl(tur.fotoUrl, '/Frontend/photo/default-tour.jpg');

            // Veriler TR ise kesinlikle DB'den gelir.
            const ad = currentLang === 'tr' ? tur.turAd : (sozluk[`t${sira}_title`] || tur.turAd);
            const aciklama = currentLang === 'tr' ? tur.turAciklama : (sozluk[`t${sira}_desc`] || tur.turAciklama);
            const rozet = currentLang === 'tr' ? (tur.turRozet || 'VIP') : (sozluk[`t${sira}_badge`] || tur.turRozet || 'VIP');
            const adGuvenli = escapeHtml(ad || 'VIP Tur');
            const aciklamaGuvenli = escapeHtml(aciklama || '');
            const rozetGuvenli = escapeHtml(rozet || 'VIP');
            const bilgiMesaji = encodeURIComponent(`Merhaba, ${tur.turAd || ad || 'tur'} hakkında bilgi almak istiyorum.`);

            // YENİ: "flex: 1 1 300px; max-width: 400px; width: 100%;" eklendi (Tek kartın bozulmasını engeller)
            vitrin.innerHTML += `
                <div class="tour-card" data-aos="fade-up" style="flex: 1 1 300px; max-width: 400px; width: 100%; display: flex; flex-direction: column;">
                    <div class="card-img" style="min-height: 220px; flex-shrink: 0;">
                        <img src="${foto}" alt="${adGuvenli}" style="width: 100%; height: 100%; object-fit: cover;">
                        <div class="img-bar center"><span><i class="far fa-calendar-alt"></i> <span>${rozetGuvenli}</span></span></div>
                    </div>
                    <div class="card-body" style="flex-grow: 1; display: flex; flex-direction: column;">
                        <h3 style="word-break: break-word;">${adGuvenli}</h3>
                        <p style="margin-bottom: 15px; flex-grow: 1; word-break: break-word;">${aciklamaGuvenli}</p> 
                        <a href="https://wa.me/905338577240?text=${bilgiMesaji}" target="_blank" rel="noopener noreferrer" class="circle-icon green" style="align-self: flex-start;"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>`;
        });
        applyBlankLinkSecurity(vitrin);
        if (typeof AOS !== 'undefined') AOS.init();
    } catch (e) {
        vitrin.innerHTML = '<p style="text-align:center; width: 100%; color:red;">Turlar yüklenemedi.</p>';
    }
}

// 2. ARAÇLARI YÜKLE
window.araclariYukle = async function () {
    const vitrin = document.getElementById('anaSayfaAracVitrisi');
    if (!vitrin) return;

    // SADECE Araçlar için CSS enjekte edilir
    if (!document.getElementById('araclar-hover-styles')) {
        const hoverStyle = document.createElement('style');
        hoverStyle.id = 'araclar-hover-styles';
        hoverStyle.innerHTML = `
            .hover-arac-kart { transition: all 0.3s ease; border: 1px solid #eaeaea; }
            .hover-arac-kart:hover { transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.1) !important; border-color: #0f3d7a; }
            .hover-arac-img { transition: transform 0.5s ease; }
            .hover-arac-kart:hover .hover-arac-img { transform: scale(1.08); }
            .hover-arac-btn { transition: all 0.3s ease; border: 2px solid transparent; }
            .hover-arac-btn:hover { background: transparent !important; color: #0f3d7a !important; border-color: #0f3d7a !important; }
        `;
        document.head.appendChild(hoverStyle);
    }

    // YENİ: İç içe geçmeyi ve tek araç kalınca devasa uzamayı engelleyen Esnek (Flex) sistem
    vitrin.style.display = 'flex';
    vitrin.style.flexWrap = 'wrap';
    vitrin.style.justifyContent = 'center';
    vitrin.style.gap = '30px';
    vitrin.style.alignItems = 'stretch';

    try {
        const res = await fetch('/api/vehicles');
        const araclar = await res.json();
        vitrin.innerHTML = '';

        if (araclar.length === 0) {
            vitrin.innerHTML = '<p style="text-align:center; width:100%;">Araç bulunmuyor.</p>';
            return;
        }

        const currentLang = localStorage.getItem('selectedLang') || 'tr';
        const sozluk = (typeof translations !== 'undefined' && translations[currentLang]) ? translations[currentLang] : {};

        araclar.forEach(arac => {
            const sira = arac.aracSira || 999;
            const foto = sanitizeAssetUrl(arac.fotoUrl, '/Frontend/Images/default-car.jpg');

            // TR ise veritabanından çek. 
            const ad = currentLang === 'tr' ? arac.aracAd : (sozluk[`veh${sira}_title`] || arac.aracAd);
            const marka = currentLang === 'tr' ? (arac.aracMarka || 'VIP') : (sozluk[`veh${sira}_tag`] || arac.aracMarka || 'VIP');
            const aciklama = currentLang === 'tr' ? arac.aracAciklama : (sozluk[`veh${sira}_desc`] || arac.aracAciklama);
            const adGuvenli = escapeHtml(ad || 'VIP Arac');
            const markaGuvenli = escapeHtml(marka || 'VIP');
            const aciklamaGuvenli = escapeHtml(aciklama || '');

            // SADECE BUTON SÖZLÜKTEN GELSİN:
            const btnText = sozluk['btn_incele'] || 'İncele';
            const btnTextGuvenli = escapeHtml(btnText);

            // YENİ: "flex: 1 1 300px; max-width: 400px; width: 100%;" eklendi (Tek kartın bozulmasını engeller)
            vitrin.innerHTML += `
                <div class="vehicle-card-home hover-arac-kart" data-aos="fade-up" style="flex: 1 1 300px; max-width: 400px; width: 100%; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
                    <div style="height:200px; overflow:hidden; flex-shrink: 0;"><img src="${foto}" class="hover-arac-img" style="width:100%; height:100%; object-fit:cover;"></div>
                    <div style="padding:20px; flex-grow: 1; display: flex; flex-direction: column;">
                        <span style="font-size:11px; color:#f39c12; font-weight:bold; text-transform:uppercase;">${markaGuvenli}</span>
                        <h3 style="margin:5px 0; font-size:18px; color:#0f3d7a; word-break: break-word;">${adGuvenli}</h3>
                        <p style="font-size:13px; color:#666; margin-bottom:15px; flex-grow: 1; word-break: break-word;">${aciklamaGuvenli}</p>
                        <div style="margin-top:auto;"><a href="araclarimiz.html" class="hover-arac-btn" style="display:block; text-align:center; padding:10px; background:#0f3d7a; color:#fff; border-radius:8px; text-decoration:none;" data-lang="btn_incele">${btnTextGuvenli}</a></div>
                    </div>
                </div>`;
        });
        applyBlankLinkSecurity(vitrin);
        if (typeof AOS !== 'undefined') AOS.init();
    } catch (e) {
        vitrin.innerHTML = '<p style="text-align:center; width:100%; color:red;">Araçlar yüklenemedi.</p>';
    }
}

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.turlariYukle === 'function') window.turlariYukle();
    if (typeof window.araclariYukle === 'function') window.araclariYukle();
    if (typeof window.detayliAraclariYukle === 'function') window.detayliAraclariYukle();

    // İşlemler bittikten sonra kilidi kapatıyoruz (Bir daha gereksiz yere çekmesin diye)
    setTimeout(() => { isInitialLoad = false; }, 500);
});

/* Sayfalar Arası Yumuşak Geçiş */
document.addEventListener('DOMContentLoaded', function () {
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        link.addEventListener('click', function (e) {
            const targetUrl = this.getAttribute('href');
            if (targetUrl && !targetUrl.startsWith('#') && !targetUrl.startsWith('tel:') && !targetUrl.startsWith('https://wa.me')) {
                e.preventDefault();
                document.body.classList.add('page-exit');
                setTimeout(() => { window.location.href = targetUrl; }, 300);
            }
        });
    });
});

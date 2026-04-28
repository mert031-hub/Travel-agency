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
            const cleanPhone = data.telefon.trim().replace(/\s/g, '');
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
   YENİ DİNAMİK VERİ YÜKLEYİCİLER (AÇIKLAMALAR TAMAMEN GÖRÜNÜR)
============================================================== */

// 1. TURLARI YÜKLE
async function turlariYukle() {
    const vitrin = document.getElementById('anaSayfaTurVitrini');
    if (!vitrin) return;

    try {
        const res = await fetch('/api/tours');
        const turlar = await res.json();
        vitrin.innerHTML = '';

        if (turlar.length === 0) {
            vitrin.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Şu an tur bulunmuyor.</p>';
            return;
        }

        turlar.forEach(tur => {
            const foto = tur.fotoUrl || '/Frontend/photo/default-tour.jpg';
            vitrin.innerHTML += `
                <div class="tour-card" data-aos="fade-up">
                    <div class="card-img">
                        <img src="${foto}" alt="${tur.turAd}">
                        <div class="img-bar center"><span><i class="far fa-calendar-alt"></i> <span>${tur.turRozet || 'VIP'}</span></span></div>
                    </div>
                    <div class="card-body">
                        <h3>${tur.turAd}</h3>
                        <p style="margin-bottom: 15px;">${tur.turAciklama || ''}</p> 
                        <a href="https://wa.me/905338577240?text=Merhaba, ${encodeURIComponent(tur.turAd)} hakkında bilgi almak istiyorum." target="_blank" class="circle-icon green"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>`;
        });
        if (typeof AOS !== 'undefined') AOS.init();
    } catch (e) {
        vitrin.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:red;">Turlar yüklenemedi.</p>';
    }
}

// 2. ARAÇLARI YÜKLE
async function araclariYukle() {
    const vitrin = document.getElementById('anaSayfaAracVitrisi');
    if (!vitrin) return;

    try {
        const res = await fetch('/api/vehicles');
        const araclar = await res.json();
        vitrin.innerHTML = '';

        if (araclar.length === 0) {
            vitrin.innerHTML = '<p style="text-align:center; width:100%;">Araç bulunmuyor.</p>';
            return;
        }

        araclar.forEach(arac => {
            const foto = arac.fotoUrl || '/Frontend/Images/default-car.jpg';
            vitrin.innerHTML += `
                <div class="col-md-4 col-sm-6 mb-4">
                    <div class="vehicle-card-home" style="background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.05); height: 100%; display: flex; flex-direction: column;">
                        <div style="height:200px; overflow:hidden;"><img src="${foto}" style="width:100%; height:100%; object-fit:cover;"></div>
                        <div style="padding:20px; flex-grow: 1; display: flex; flex-direction: column;">
                            <span style="font-size:11px; color:#f39c12; font-weight:bold;">${arac.aracMarka || 'VIP'}</span>
                            <h3 style="margin:5px 0; font-size:18px; color:#0f3d7a;">${arac.aracAd}</h3>
                            <p style="font-size:13px; color:#666; margin-bottom:15px;">${arac.aracAciklama || ''}</p>
                            <div style="margin-top:auto;"><a href="araclarimiz.html" style="display:block; text-align:center; padding:10px; background:#0f3d7a; color:#fff; border-radius:8px; text-decoration:none;">İncele</a></div>
                        </div>
                    </div>
                </div>`;
        });
    } catch (e) {
        vitrin.innerHTML = '<p style="text-align:center; width:100%; color:red;">Araçlar yüklenemedi.</p>';
    }
}

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', () => {
    turlariYukle();
    araclariYukle();
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
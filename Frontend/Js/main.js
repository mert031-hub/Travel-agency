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
            el.placeholder = translations[lang][key];
        }
    });

    updateWhatsAppLinks(lang);

    const flagImg = document.getElementById('currentFlag');
    const langText = document.getElementById('currentLangText');

    if (flagImg && langText) {
        if (lang === 'tr') { flagImg.src = 'https://flagcdn.com/w20/tr.png'; langText.innerText = 'TR'; }
        if (lang === 'en') { flagImg.src = 'https://flagcdn.com/w20/gb.png'; langText.innerText = 'EN'; }
        if (lang === 'ru') { flagImg.src = 'https://flagcdn.com/w20/ru.png'; langText.innerText = 'RU'; }
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

    // --- TELEFON ALANLARINA HARF GİRİŞİNİ ANLIK ENGELLEME ---
    const phoneInputs = document.querySelectorAll('input[type="tel"], #heroPhone');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function (e) {
            this.value = this.value.replace(/(?!^\+)[^\d]/g, '');
        });
    });

    /* ==============================================================
        5. API ENTEGRASYONU & VALIDATION (KONTROLLER)
    ============================================================== */

    async function veriGonder(data, formElement) {
        // --- 1. TELEFON TEMİZLİĞİ VE KONTROLÜ ---
        if (data.telefon !== undefined) {
            const cleanPhone = data.telefon.trim().replace(/\s/g, '');
            const phoneRegex = /^\+?[0-9]{10,15}$/;

            if (!phoneRegex.test(cleanPhone)) {
                Swal.fire({ icon: 'warning', title: 'Geçersiz Telefon', text: 'Lütfen geçerli bir telefon numarası giriniz (Örn: 05xx...).' });
                return;
            }
            data.telefon = cleanPhone;
        }

        // --- 2. AD SOYAD KONTROLÜ ---
        if (!data.adSoyad || data.adSoyad.trim().length < 3) {
            Swal.fire({ icon: 'warning', title: 'İsim Gerekli', text: 'Lütfen adınızı ve soyadınızı giriniz.' });
            return;
        }
        if (/[0-9]/.test(data.adSoyad)) {
            Swal.fire({ icon: 'warning', title: 'Hata', text: 'İsim alanı rakam içeremez.' });
            return;
        }

        // --- 3. E-POSTA KONTROLÜ ---
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email.trim())) {
                Swal.fire({ icon: 'warning', title: 'Geçersiz E-Posta', text: 'Lütfen e-posta formatını kontrol ediniz.' });
                return;
            }
        }

        // --- 4. BOŞ ALAN KONTROLÜ (Hero Form için ekstra kontrol) ---
        if (data.formTipi.includes('Hero') && (!data.alinisNoktasi || !data.birakilisNoktasi || !data.tarih)) {
            Swal.fire({ icon: 'info', title: 'Eksik Bilgi', text: 'Lütfen nereden, nereye ve tarih alanlarını doldurunuz.' });
            return;
        }

        const btn = formElement.querySelector('button');
        let originalText = "";

        if (btn) {
            originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İletiliyor...';
            btn.disabled = true;
        }

        try {
            // BACKEND'E (ADMİN PANELİNE) İSTEK ATILAN YER
            const response = await fetch('/api/teklif-al', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.basari) {
                Swal.fire({
                    icon: 'success',
                    title: 'Başarılı!',
                    text: result.mesaj || 'Talebiniz alınmıştır, en kısa sürede dönüş yapılacaktır.',
                    confirmButtonColor: '#0f3d7a'
                });
                formElement.reset();
            } else {
                Swal.fire({ icon: 'error', title: 'Hata!', text: result.mesaj || 'İşlem başarısız.' });
            }
        } catch (error) {
            console.error('API Gönderim Hatası:', error);
            Swal.fire({ icon: 'error', title: 'Bağlantı Hatası', text: 'Sunucuya ulaşılamıyor, lütfen WhatsApp üzerinden ulaşın.' });
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    }

    // A) HERO FORM (Ana Sayfa Üst Kısım)
    window.gonderHeroForm = async function () {
        const form = document.getElementById('heroForm');
        if (!form) return;
        const adSoyad = document.getElementById('heroName').value;
        const telefon = document.getElementById('heroPhone').value;
        const alinisNoktasi = document.getElementById('heroFrom').value;
        const birakilisNoktasi = document.getElementById('heroTo').value;
        const tarih = document.getElementById('heroDate').value;

        await veriGonder({
            adSoyad: adSoyad,
            telefon: telefon,
            alinisNoktasi: alinisNoktasi,
            birakilisNoktasi: birakilisNoktasi,
            tarih: tarih,
            mesaj: `Seçilen Tarih: ${tarih}`,
            formTipi: 'Hızlı Fiyat Sor (Ana Sayfa Hero Form)'
        }, form);
    };

    // B) DETAYLI TEKLİF AL FORMU (Ana Sayfa Alt Kutu)
    const offerForm = document.querySelector('.offer-form-box form');
    if (offerForm) {
        offerForm.removeAttribute('action');
        offerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await veriGonder({
                adSoyad: offerForm.querySelector('input[type="text"]').value,
                email: offerForm.querySelector('input[type="email"]').value,
                telefon: offerForm.querySelector('input[type="tel"]').value,
                yolcuSayisi: offerForm.querySelector('input[type="number"]').value,
                mesaj: offerForm.querySelector('textarea').value,
                formTipi: 'Detaylı Teklif Al Formu'
            }, offerForm);
        });
    }

    // C) İLETİŞİM SAYFASI FORMU
    const contactForm = document.querySelector('.contact-form-clean');
    if (contactForm) {
        contactForm.removeAttribute('action');
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectBox = contactForm.querySelector('select');
            await veriGonder({
                adSoyad: contactForm.querySelector('input[type="text"]').value,
                telefon: contactForm.querySelector('input[type="tel"]').value,
                email: contactForm.querySelector('input[type="email"]').value,
                mesaj: (selectBox ? `[Konu: ${selectBox.value}] \n` : '') + contactForm.querySelector('textarea').value,
                formTipi: 'İletişim Sayfası Mesajı'
            }, contactForm);
        });
    }

    // D) ARAÇLARIMIZ SAYFASI ÖZEL VIP ARAÇ FORMLARI (YENİ EKLENDİ)
    const vehicleForms = document.querySelectorAll('.vh-form');
    vehicleForms.forEach(vForm => {
        vForm.removeAttribute('action');
        vForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputs = vForm.querySelectorAll('input');

            // İlgili aracın ismini almak için DOM'da yukarı çıkıp başlığı buluyoruz
            const card = vForm.closest('.vip-horiz-card');
            const carName = card ? card.querySelector('.vh-title').innerText : 'VIP Araç';

            await veriGonder({
                adSoyad: inputs[0].value,
                telefon: inputs[1].value,
                tarih: inputs[2].value,
                mesaj: `Araçlar sayfasından özel araç talebi.\nTalep Edilen Araç: ${carName}\nSeçilen Tarih: ${inputs[2].value}`,
                formTipi: 'VIP Araç Rezervasyon Talebi'
            }, vForm);
        });
    });

});

/* ======================================================
   SAYFALAR ARASI YUMUŞAK GEÇİŞ (HIZLANDIRILDI)
========================================================= */
document.addEventListener('DOMContentLoaded', function () {
    const links = document.querySelectorAll('a[href]');

    links.forEach(link => {
        link.addEventListener('click', function (e) {
            const targetUrl = this.getAttribute('href');

            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1 || this.getAttribute('target') === '_blank') {
                return;
            }

            if (
                targetUrl &&
                !targetUrl.startsWith('#') &&
                !targetUrl.startsWith('tel:') &&
                !targetUrl.startsWith('mailto:') &&
                !targetUrl.startsWith('javascript') &&
                !targetUrl.startsWith('https://wa.me')
            ) {
                e.preventDefault();

                document.body.classList.add('page-exit');

                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 300);
            }
        });
    });
});
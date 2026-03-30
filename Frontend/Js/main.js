/* =========================================
   VIP KIBRIS TRAVEL - MAIN JAVASCRIPT
========================================= */

const WHATSAPP_NUMBER = "905320000000";

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

        // --- 2. AD SOYAD KONTROLÜ (Hero form hariç zorunlu) ---
        if (!data.formTipi.includes('Hero')) {
            if (!data.adSoyad || data.adSoyad.trim().length < 3) {
                Swal.fire({ icon: 'warning', title: 'İsim Gerekli', text: 'Lütfen adınızı ve soyadınızı giriniz.' });
                return;
            }
            if (/[0-9]/.test(data.adSoyad)) {
                Swal.fire({ icon: 'warning', title: 'Hata', text: 'İsim alanı rakam içeremez.' });
                return;
            }
        }

        // --- 3. E-POSTA KONTROLÜ ---
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email.trim())) {
                Swal.fire({ icon: 'warning', title: 'Geçersiz E-Posta', text: 'Lütfen e-posta formatını kontrol ediniz.' });
                return;
            }
        }

        // --- 4. BOŞ ALAN KONTROLÜ (Sadece Hero Form için) ---
        if (data.formTipi.includes('Hero') && (!data.alinisNoktasi || !data.birakilisNoktasi || !data.tarih)) {
            Swal.fire({ icon: 'info', title: 'Eksik Bilgi', text: 'Lütfen tüm alanları doldurunuz.' });
            return;
        }

        const btn = formElement.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İletiliyor...';
        btn.disabled = true;

        try {
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
                    text: result.mesaj,
                    confirmButtonColor: '#0f3d7a'
                });
                formElement.reset();
            } else {
                Swal.fire({ icon: 'error', title: 'Hata!', text: result.mesaj });
            }
        } catch (error) {
            console.error('API Gönderim Hatası:', error);
            Swal.fire({ icon: 'error', title: 'Bağlantı Hatası', text: 'Sunucuya ulaşılamıyor, lütfen tekrar deneyin.' });
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // A) HERO FORM (Ana Sayfa Üst Kısım)
    const heroForm = document.querySelector('.hero-booking-form');
    if (heroForm) {
        heroForm.removeAttribute('action');
        heroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const inputs = heroForm.querySelectorAll('input');
            await veriGonder({
                alinisNoktasi: inputs[0].value,
                birakilisNoktasi: inputs[1].value,
                tarih: inputs[2].value,
                formTipi: 'Hızlı Fiyat Sor '
            }, heroForm);
        });
    }

    // B) DETAYLI TEKLİF AL FORMU (Alt Kutu)
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
                formTipi: 'Detaylı Teklif Al Kutusu'
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
}); // <--- DOMContentLoaded burada düzgünce kapanıyor.
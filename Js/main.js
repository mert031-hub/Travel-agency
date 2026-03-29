/* =========================================
   VIP KIBRIS TRAVEL - MAIN JAVASCRIPT
========================================= */

// WP Numarası (Buradan değiştirince tüm site güncellenir)
const WHATSAPP_NUMBER = "905320000000";

/**
 * Dil değiştirme fonksiyonu
 */
function changeLanguage(lang) {
    localStorage.setItem('selectedLang', lang);

    // Normal metinleri çevir
    const elements = document.querySelectorAll('[data-lang]');
    elements.forEach(el => {
        const key = el.getAttribute('data-lang');
        if (typeof translations !== 'undefined' && translations[lang][key]) {
            el.innerHTML = translations[lang][key];
        }
    });

    // Placeholder'ları çevir
    const placeholders = document.querySelectorAll('[data-lang-placeholder]');
    placeholders.forEach(el => {
        const key = el.getAttribute('data-lang-placeholder');
        if (typeof translations !== 'undefined' && translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });

    // --- KRİTİK GÜNCELLEME: WhatsApp Linklerini de her dil değişiminde yenile ---
    updateWhatsAppLinks(lang);

    // Bayrak ve dil metnini güncelle
    const flagImg = document.getElementById('currentFlag');
    const langText = document.getElementById('currentLangText');

    if (flagImg && langText) {
        if (lang === 'tr') { flagImg.src = 'https://flagcdn.com/w20/tr.png'; langText.innerText = 'TR'; }
        if (lang === 'en') { flagImg.src = 'https://flagcdn.com/w20/gb.png'; langText.innerText = 'EN'; }
        if (lang === 'ru') { flagImg.src = 'https://flagcdn.com/w20/ru.png'; langText.innerText = 'RU'; }
    }

    // AOS animasyonlarını sayfadaki yazı değişimlerine göre yeniden hesapla
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
        // Eğer özel bir mesaj anahtarı yoksa varsayılan mesajı kullan
        const message = (typeof translations !== 'undefined' && translations[lang][msgKey])
            ? translations[lang][msgKey]
            : (translations[lang]['wp_msg_default'] || "Merhaba");

        const encodedMsg = encodeURIComponent(message);
        link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMsg}`;
    });
}

/* --- ORTAK UYGULAMA İŞLEMLERİ --- */
document.addEventListener('DOMContentLoaded', function () {

    // 1. Başlangıç Dil Ayarı
    const savedLang = localStorage.getItem('selectedLang') || 'tr';
    changeLanguage(savedLang);

    // 2. Mobil Menü Kontrolü
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

    // 3. Slider Ayarları (Swiper)
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

    // 4. AOS Animasyonlarını Başlat
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            offset: 50,
            // AOS Mobilde çalışsın ancak donmalar yaşanırsa window.innerWidth < 768 ile kapatılabilir.
            disable: false
        });
    }
});
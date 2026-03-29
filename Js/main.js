/* =========================================
   VIP KIBRIS TRAVEL - MAIN JAVASCRIPT
========================================= */

function changeLanguage(lang) {
    // Seçilen dili tarayıcı hafızasına kaydet
    localStorage.setItem('selectedLang', lang);

    // Normal metinleri çevir (lang.js içindeki translations objesinden çeker)
    const elements = document.querySelectorAll('[data-lang]');
    elements.forEach(el => {
        const key = el.getAttribute('data-lang');
        if (typeof translations !== 'undefined' && translations[lang][key]) {
            el.innerHTML = translations[lang][key];
        }
    });

    // Input Placeholder'larını (Kutu içi silik yazıları) çevir
    const placeholders = document.querySelectorAll('[data-lang-placeholder]');
    placeholders.forEach(el => {
        const key = el.getAttribute('data-lang-placeholder');
        if (typeof translations !== 'undefined' && translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });

    // Bayrak ve dil metnini güncelle
    const flagImg = document.getElementById('currentFlag');
    const langText = document.getElementById('currentLangText');

    if (flagImg && langText) {
        if (lang === 'tr') { flagImg.src = 'https://flagcdn.com/w20/tr.png'; langText.innerText = 'TR'; }
        if (lang === 'en') { flagImg.src = 'https://flagcdn.com/w20/gb.png'; langText.innerText = 'EN'; }
        if (lang === 'ru') { flagImg.src = 'https://flagcdn.com/w20/ru.png'; langText.innerText = 'RU'; }
    }
}


/* --- ORTAK UYGULAMA İŞLEMLERİ --- */
document.addEventListener('DOMContentLoaded', function () {

    // Sayfa yüklendiğinde kullanıcının son seçtiği dili hafızadan çek ve uygula
    const savedLang = localStorage.getItem('selectedLang') || 'tr';
    changeLanguage(savedLang);

    // 1. MOBİL MENÜ KONTROLÜ
    const mobileMenuBtn = document.getElementById('mobileMenuBtn') || document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    function toggleMenu() {
        if (mainNav) {
            mainNav.classList.toggle('active');
            if (menuOverlay) menuOverlay.classList.toggle('active');
            // Menü açıkken arkadaki sayfanın kaymasını engelle
            document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : 'auto';
        }
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMenu);
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', toggleMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', toggleMenu);

    // Ekstra UX Geliştirmesi: Mobilde linke tıklayınca menü otomatik kapansın
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

    // 2. SLIDER AYARLARI 
    if (typeof Swiper !== 'undefined') {

        // Hero Slider
        if (document.querySelector('.heroSwiper')) {
            new Swiper(".heroSwiper", {
                loop: true, effect: "fade", autoplay: { delay: 5000 },
                navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
                pagination: { el: ".swiper-pagination", clickable: true }
            });
        }

        // Hizmetler Slider
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
    } else {
        console.warn("Swiper kütüphanesi yüklenemediği için sliderlar başlatılamadı.");
    }
});
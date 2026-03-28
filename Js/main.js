/* =========================================
   VIP KIBRIS TRAVEL - MAIN JAVASCRIPT
========================================= */

document.addEventListener('DOMContentLoaded', function () {

    // 1. MOBİL MENÜ KONTROLÜ (En üste aldık ki önce bu yüklensin)
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.getElementById('mainNav');
    const closeMenuBtn = document.getElementById('closeMenuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    function toggleMenu() {
        if (mainNav && menuOverlay) {
            mainNav.classList.toggle('active');
            menuOverlay.classList.toggle('active');
            // Menü açıkken arkadaki sayfanın kaymasını engelle
            document.body.style.overflow = mainNav.classList.contains('active') ? 'hidden' : 'auto';
        }
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMenu);
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', toggleMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', toggleMenu);


    // 2. SLIDER AYARLARI (Güvenlik kontrolleri eklendi)
    // Eğer Swiper kütüphanesi sayfada yüklüyse bu kodlar çalışsın
    if (typeof Swiper !== 'undefined') {

        // Hero Slider
        if (document.querySelector('.heroSwiper')) {
            new Swiper(".heroSwiper", {
                loop: true,
                effect: "fade",
                autoplay: { delay: 5000 },
                navigation: { nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" },
                pagination: { el: ".swiper-pagination", clickable: true }
            });
        }

        // Hizmetler Slider
        if (document.querySelector('.servicesSwiper')) {
            new Swiper(".servicesSwiper", {
                slidesPerView: 1,
                spaceBetween: 30,
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
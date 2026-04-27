require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Dosya silme/kontrol işlemleri için
const helmet = require('helmet'); // Güvenlik kalkanı
const morgan = require('morgan'); // HTTP istek loglayıcı
const rateLimit = require('express-rate-limit'); // İstek sınırlayıcı
const multer = require('multer'); // Fotoğraf yükleme kütüphanesi
const { Resend } = require('resend');
const session = require('express-session');

const Reservation = require('./models/Reservation');

// --- ARAÇLAR (VEHICLES) İÇİN MONGODB ŞEMASI (GÜNCELLENDİ) ---
const vehicleSchema = new mongoose.Schema({
    aracAd: { type: String, required: true },
    aracSira: { type: Number, default: 999 }, // Ekranda gösterme sırası
    aracOzellikler: { type: String, default: '' },
    fotoUrl: { type: String, default: '' }, // Ana Kapak Fotoğrafı
    galeriUrls: [{ type: String }], // YENİ: Çoklu Galeri Fotoğrafları
    kayitTarihi: { type: Date, default: Date.now }
});
const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. GÜVENLİK, İZLEME VE OTURUM (Middleware) ---

// Helmet: HTTP başlıklarını güvenli hale getirir. (Resimlerin görünmesi için CSP kapalı tutulmuştur)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Morgan: Gelen istekleri terminale detaylı basar
app.use(morgan('dev'));

// Rate Limit: 15 dakikada aynı IP'den en fazla 100 istek (Sadece teklif formu için)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { mesaj: "Çok fazla deneme yaptınız, lütfen biraz bekleyin." }
});
app.use('/api/teklif-al', limiter);

// Standart Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session (Oturum) Ayarları
app.use(session({
    secret: process.env.SESSION_SECRET || 'kibris-vip-gizli-anahtari-123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 saat
        httpOnly: true
    }
}));

// Admin Güvenlik Kapısı (Middleware)
const adminKontrol = (req, res, next) => {
    if (req.session && req.session.adminGirisYapti) {
        next();
    } else {
        if (req.originalUrl.startsWith('/api/')) {
            res.status(401).json({ basari: false, mesaj: 'Yetkisiz erişim. Lütfen giriş yapın.' });
        } else {
            res.redirect('/login');
        }
    }
};

// --- YENİ: MULTER (FOTOĞRAF YÜKLEME) AYARLARI ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Resimlerin kaydedileceği fiziksel klasör
        const dir = path.join(__dirname, 'Frontend', 'Images', 'Cars');

        // Eğer böyle bir klasör yoksa, otomatik olarak oluşturur (Çökme önleyici)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // İki resim aynı isimde olursa çakışmasın diye zaman damgası ekliyoruz
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'arac-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// YENİ: Hem Ana Fotoğrafı Hem de Çoklu Galeri Fotoğraflarını Yakalayacak Yapı
const cpUpload = upload.fields([
    { name: 'aracFoto', maxCount: 1 },
    { name: 'aracGaleri', maxCount: 10 } // Maksimum 10 galeri resmi
]);

// Resend (E-posta) Başlatma
let resend;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
}

// --- 2. STATİK DOSYA SUNUMU ---
app.use('/Frontend', express.static(path.join(__dirname, 'Frontend')));
app.use('/Css', express.static(path.join(__dirname, 'Frontend', 'Css')));
app.use('/Js', express.static(path.join(__dirname, 'Frontend', 'Js')));
app.use(express.static(path.join(__dirname, 'Frontend')));
app.use(express.static(path.join(__dirname, 'Frontend', 'Html')));

// --- 3. ÖZEL ROTALAR VE GİRİŞ (AUTH) ---
app.get('/login', (req, res) => {
    if (req.session.adminGirisYapti) return res.redirect('/admin');
    res.sendFile(path.join(__dirname, 'Frontend', 'Html', 'login.html'));
});

app.post('/api/login', (req, res) => {
    const { kullaniciAdi, sifre } = req.body;
    if (kullaniciAdi === process.env.ADMIN_USERNAME && sifre === process.env.ADMIN_PASS) {
        req.session.adminGirisYapti = true;
        res.json({ basari: true });
    } else {
        res.json({ basari: false, mesaj: 'Hatalı kullanıcı adı veya şifre!' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ basari: true });
});

app.get('/admin', adminKontrol, (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'Html', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'Html', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ durum: 'UP', zaman: new Date(), uptime: Math.floor(process.uptime()) + " saniye" });
});

// --- 4. MONGODB BAĞLANTISI ---
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('✅ MongoDB Bağlantısı Başarılı'))
        .catch((err) => console.error('❌ MongoDB Hatası:', err));
}

// --- 5. API UÇ NOKTALARI (CRM VE REZERVASYON) ---

// İstatistikler
app.get('/api/admin/stats', adminKontrol, async (req, res) => {
    try {
        const toplam = await Reservation.countDocuments({ isDeleted: { $ne: true } });
        const okunmamis = await Reservation.countDocuments({ isDeleted: { $ne: true }, isRead: false });
        const cop = await Reservation.countDocuments({ isDeleted: true });
        res.json({ toplam, okunmamis, cop });
    } catch (e) { res.status(500).json({ hata: e.message }); }
});

// Aktif Talepler
app.get('/api/admin/reservations', adminKontrol, async (req, res) => {
    try {
        const veriler = await Reservation.find({ isDeleted: { $ne: true } }).sort({ kayitTarihi: -1 });
        res.json(veriler);
    } catch (e) { res.status(500).json({ mesaj: "Hata" }); }
});

// Çöp Kutusu
app.get('/api/admin/trash', adminKontrol, async (req, res) => {
    try {
        const veriler = await Reservation.find({ isDeleted: true }).sort({ deletedAt: -1 });
        res.json(veriler);
    } catch (e) { res.status(500).json({ mesaj: "Hata" }); }
});

// Okundu/Okunmadı Toggle
app.put('/api/admin/reservations/:id/toggle-read', adminKontrol, async (req, res) => {
    try {
        const rez = await Reservation.findById(req.params.id);
        if (!rez) return res.status(404).send();
        rez.isRead = !rez.isRead;
        await rez.save();
        res.json({ basari: true });
    } catch (e) { res.status(500).send(); }
});

// Admin Notu Güncelleme
app.put('/api/admin/reservations/:id/note', adminKontrol, async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { adminNotu: req.body.not });
        res.json({ basari: true });
    } catch (e) { res.status(500).send(); }
});

// Çöpe Taşı (Soft Delete)
app.delete('/api/admin/reservations/:id', adminKontrol, async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date() });
        res.json({ basari: true });
    } catch (error) { res.status(500).send(); }
});

// Geri Yükle
app.put('/api/admin/trash/:id/restore', adminKontrol, async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { isDeleted: false, deletedAt: null });
        res.json({ basari: true });
    } catch (error) { res.status(500).send(); }
});

// --- YENİ: ARAÇ YÖNETİMİ API'LERİ (GALERİ DESTEKLİ) ---

// Tüm Araçları Getir (Herkese Açık - Anasayfa çekecek)
app.get('/api/vehicles', async (req, res) => {
    try {
        const araclar = await Vehicle.find().sort({ aracSira: 1, kayitTarihi: -1 });
        res.json(araclar);
    } catch (error) {
        res.status(500).json({ mesaj: "Araçlar getirilemedi." });
    }
});

// Admin Panel Tüm Araçları Getir
app.get('/api/admin/vehicles', adminKontrol, async (req, res) => {
    try {
        const araclar = await Vehicle.find().sort({ aracSira: 1, kayitTarihi: -1 });
        res.json(araclar);
    } catch (error) {
        res.status(500).json({ mesaj: "Araçlar getirilemedi." });
    }
});

// Yeni Araç Ekle (Çoklu Fotoğraf Dahil)
app.post('/api/admin/vehicles', adminKontrol, cpUpload, async (req, res) => {
    try {
        const { aracAd, aracOzellikler, aracSira } = req.body;

        let fotoUrl = '';
        if (req.files && req.files['aracFoto']) {
            fotoUrl = '/Frontend/Images/Cars/' + req.files['aracFoto'][0].filename;
        }

        let galeriUrls = [];
        if (req.files && req.files['aracGaleri']) {
            req.files['aracGaleri'].forEach(file => {
                galeriUrls.push('/Frontend/Images/Cars/' + file.filename);
            });
        }

        const yeniArac = new Vehicle({
            aracAd: aracAd,
            aracSira: aracSira || 999, // Sıra girilmezse en sona atsın
            aracOzellikler: aracOzellikler,
            fotoUrl: fotoUrl,
            galeriUrls: galeriUrls
        });

        await yeniArac.save();
        res.status(201).json({ basari: true, mesaj: "Araç başarıyla eklendi." });
    } catch (error) {
        console.error("Araç ekleme hatası:", error);
        res.status(500).json({ basari: false, mesaj: "Araç eklenirken hata oluştu." });
    }
});

// Araç Güncelle
app.put('/api/admin/vehicles/:id', adminKontrol, cpUpload, async (req, res) => {
    try {
        const arac = await Vehicle.findById(req.params.id);
        if (!arac) return res.status(404).json({ basari: false, mesaj: "Araç bulunamadı." });

        arac.aracAd = req.body.aracAd || arac.aracAd;
        arac.aracSira = req.body.aracSira || arac.aracSira;
        arac.aracOzellikler = req.body.aracOzellikler || arac.aracOzellikler;

        // Admin YENİ bir KAPAK fotoğrafı seçtiyse
        if (req.files && req.files['aracFoto']) {
            if (arac.fotoUrl) {
                const eskiFotoPath = path.join(__dirname, arac.fotoUrl);
                if (fs.existsSync(eskiFotoPath)) fs.unlinkSync(eskiFotoPath);
            }
            arac.fotoUrl = '/Frontend/Images/Cars/' + req.files['aracFoto'][0].filename;
        }

        // Admin YENİ bir GALERİ seçtiyse
        if (req.files && req.files['aracGaleri']) {
            // Eskileri fiziksel olarak klasörden sil
            if (arac.galeriUrls && arac.galeriUrls.length > 0) {
                arac.galeriUrls.forEach(url => {
                    const eskiGaleriPath = path.join(__dirname, url);
                    if (fs.existsSync(eskiGaleriPath)) fs.unlinkSync(eskiGaleriPath);
                });
            }

            // Yenileri veritabanına kaydet
            let yeniGaleriUrls = [];
            req.files['aracGaleri'].forEach(file => {
                yeniGaleriUrls.push('/Frontend/Images/Cars/' + file.filename);
            });
            arac.galeriUrls = yeniGaleriUrls;
        }

        await arac.save();
        res.json({ basari: true, mesaj: "Araç güncellendi." });
    } catch (error) {
        console.error("Araç güncelleme hatası:", error);
        res.status(500).json({ basari: false, mesaj: "Araç güncellenirken hata oluştu." });
    }
});

// Araç Sil (Veritabanından ve Klasörden tamamen temizler)
app.delete('/api/admin/vehicles/:id', adminKontrol, async (req, res) => {
    try {
        const arac = await Vehicle.findById(req.params.id);
        if (!arac) return res.status(404).json({ basari: false, mesaj: "Araç bulunamadı." });

        // Kapak Fotoğrafını Sil
        if (arac.fotoUrl) {
            const fotoPath = path.join(__dirname, arac.fotoUrl);
            if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
        }

        // Galeri Fotoğraflarını Sil
        if (arac.galeriUrls && arac.galeriUrls.length > 0) {
            arac.galeriUrls.forEach(url => {
                const galeriPath = path.join(__dirname, url);
                if (fs.existsSync(galeriPath)) fs.unlinkSync(galeriPath);
            });
        }

        await Vehicle.findByIdAndDelete(req.params.id);
        res.json({ basari: true, mesaj: "Araç ve fotoğrafı tamamen silindi." });
    } catch (error) {
        console.error("Araç silme hatası:", error);
        res.status(500).json({ basari: false, mesaj: "Silme işlemi başarısız." });
    }
});

// --- MÜŞTERİ FORMU (TEKLİF AL) ---
app.post('/api/teklif-al', async (req, res) => {
    try {
        const yeni = new Reservation(req.body);
        await yeni.save();

        // Admin'e E-posta Bildirimi Gönder (İsteğe Bağlı)
        if (resend && process.env.RESEND_API_KEY) {
            try {
                await resend.emails.send({
                    from: 'BUGRA POLAT <onboarding@resend.dev>',
                    to: 'senin.kendimailadresin@gmail.com', // Daha sonra patronun veya kendi mailiniz ile değiştirin
                    subject: `🔔 Yeni VIP Talep: ${req.body.adSoyad}`,
                    html: `
                        <h3>Yeni Rezervasyon Talebi!</h3>
                        <p><strong>Müşteri:</strong> ${req.body.adSoyad}</p>
                        <p><strong>Tel:</strong> ${req.body.telefon}</p>
                        <p><strong>Nereden:</strong> ${req.body.alinisNoktasi || '-'}</p>
                        <p><strong>Nereye:</strong> ${req.body.birakilisNoktasi || '-'}</p>
                        <p><strong>Tarih:</strong> ${req.body.tarih || '-'}</p>
                        <p><strong>Mesaj:</strong> ${req.body.mesaj || '-'}</p>
                    `
                });
            } catch (e) {
                console.log("Mail gönderiminde takıldı, ancak talep veritabanına yazıldı.");
            }
        }
        res.status(201).json({ basari: true, mesaj: "Talebiniz başarıyla alındı." });
    } catch (e) {
        res.status(500).json({ basari: false, mesaj: "Sunucu hatası oluştu." });
    }
});

// --- 6. HATA YÖNETİMİ (Catch-All) ---
app.use((err, req, res, next) => {
    console.error("🔥 Beklenmedik Sunucu Hatası:", err.stack);
    res.status(500).json({ basari: false, mesaj: "Bir hata oluştu." });
});

// --- 7. BAŞLATMA ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 VIP Kıbrıs Yayında: http://localhost:${PORT}`);
});
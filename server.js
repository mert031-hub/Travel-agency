require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Dosya silme/kontrol işlemleri için eklendi
const helmet = require('helmet'); // Güvenlik kalkanı
const morgan = require('morgan'); // HTTP istek loglayıcı
const rateLimit = require('express-rate-limit'); // İstek sınırlayıcı
const multer = require('multer'); // YENİ: Fotoğraf yükleme kütüphanesi
const { Resend } = require('resend');
const session = require('express-session');

const Reservation = require('./models/Reservation');

// YENİ: Araçlar (Vehicles) için Veritabanı Şeması (Ayrı dosya açmamak için buraya eklendi)
const vehicleSchema = new mongoose.Schema({
    aracAd: { type: String, required: true },
    aracOzellikler: { type: String, default: '' },
    fotoUrl: { type: String, default: '' },
    kayitTarihi: { type: Date, default: Date.now }
});
const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. GÜVENLİK, İZLEME VE OTURUM (Middleware) ---

// Helmet: HTTP başlıklarını güvenli hale getirir
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Morgan: Gelen istekleri terminale detaylı basar
app.use(morgan('dev'));

// Rate Limit: 15 dakikada aynı IP'den en fazla 100 istek
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
        const dir = path.join(__dirname, 'Frontend', 'Images', 'Cars');
        // Klasör yoksa otomatik oluşturur
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'arac-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Resend Başlatma
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

// --- 5. API UÇ NOKTALARI (CRM) ---

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

// --- YENİ: ARAÇ YÖNETİMİ API'LERİ ---

// Tüm Araçları Getir
app.get('/api/admin/vehicles', adminKontrol, async (req, res) => {
    try {
        const araclar = await Vehicle.find().sort({ kayitTarihi: -1 });
        res.json(araclar);
    } catch (error) {
        res.status(500).json({ mesaj: "Araçlar getirilemedi." });
    }
});

// Yeni Araç Ekle (Fotoğraf Dahil)
app.post('/api/admin/vehicles', adminKontrol, upload.single('aracFoto'), async (req, res) => {
    try {
        const { aracAd, aracOzellikler } = req.body;
        const fotoUrl = req.file ? '/Frontend/Images/Cars/' + req.file.filename : '';

        const yeniArac = new Vehicle({ aracAd, aracOzellikler, fotoUrl });
        await yeniArac.save();

        res.status(201).json({ basari: true, mesaj: "Araç başarıyla eklendi." });
    } catch (error) {
        res.status(500).json({ basari: false, mesaj: "Araç eklenirken hata oluştu." });
    }
});

// Araç Güncelle (Fotoğraf Opsiyonel)
app.put('/api/admin/vehicles/:id', adminKontrol, upload.single('aracFoto'), async (req, res) => {
    try {
        const arac = await Vehicle.findById(req.params.id);
        if (!arac) return res.status(404).json({ basari: false, mesaj: "Araç bulunamadı." });

        arac.aracAd = req.body.aracAd || arac.aracAd;
        arac.aracOzellikler = req.body.aracOzellikler || arac.aracOzellikler;

        // Yeni fotoğraf yüklendiyse eskisini silip yenisini kaydet
        if (req.file) {
            if (arac.fotoUrl) {
                const eskiFotoPath = path.join(__dirname, arac.fotoUrl);
                if (fs.existsSync(eskiFotoPath)) fs.unlinkSync(eskiFotoPath);
            }
            arac.fotoUrl = '/Frontend/Images/Cars/' + req.file.filename;
        }

        await arac.save();
        res.json({ basari: true, mesaj: "Araç güncellendi." });
    } catch (error) {
        res.status(500).json({ basari: false, mesaj: "Araç güncellenirken hata oluştu." });
    }
});

// Araç Sil (Veritabanından ve Klasörden)
app.delete('/api/admin/vehicles/:id', adminKontrol, async (req, res) => {
    try {
        const arac = await Vehicle.findById(req.params.id);
        if (!arac) return res.status(404).json({ basari: false, mesaj: "Araç bulunamadı." });

        // Aracın fotoğrafı varsa klasörden sil
        if (arac.fotoUrl) {
            const fotoPath = path.join(__dirname, arac.fotoUrl);
            if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
        }

        await Vehicle.findByIdAndDelete(req.params.id);
        res.json({ basari: true, mesaj: "Araç tamamen silindi." });
    } catch (error) {
        res.status(500).json({ basari: false, mesaj: "Silme işlemi başarısız." });
    }
});

// --- MÜŞTERİ FORMU (TEKLİF AL) ---
app.post('/api/teklif-al', async (req, res) => {
    try {
        const yeni = new Reservation(req.body);
        await yeni.save();

        if (resend && process.env.RESEND_API_KEY) {
            try {
                await resend.emails.send({
                    from: 'BUGRA POLAT <onboarding@resend.dev>',
                    to: 'senin.kendimailadresin@gmail.com', // Bunu daha sonra güncellersin
                    subject: `🔔 Yeni Talep: ${req.body.adSoyad}`,
                    html: `<h3>Yeni Rezervasyon!</h3><p>Müşteri: ${req.body.adSoyad}</p><p>Tel: ${req.body.telefon}</p>`
                });
            } catch (e) { console.log("Mail gönderiminde takıldı."); }
        }
        res.status(201).json({ basari: true, mesaj: "Alındı" });
    } catch (e) { res.status(500).json({ basari: false }); }
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
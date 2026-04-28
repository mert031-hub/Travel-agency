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

// --- 1. MONGODB ŞEMALARI ---

// ARAÇLAR (VEHICLES) ŞEMASI
const vehicleSchema = new mongoose.Schema({
    aracAd: { type: String, required: true },
    aracMarka: { type: String, default: '' },
    aracAciklama: { type: String, default: '' },
    aracYorumlar: { type: String, default: '[]' },
    aracSira: { type: Number, default: 999 },
    aracOzellikler: { type: String, default: '' },
    fotoUrl: { type: String, default: '' },
    galeriUrls: [{ type: String }],
    kayitTarihi: { type: Date, default: Date.now }
});
const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);

// YENİ: TURLAR (TOURS) ŞEMASI
const tourSchema = new mongoose.Schema({
    turAd: { type: String, required: true }, // Örn: Girne & Bellapais
    turBolge: { type: String, default: '' }, // Örn: Girne Bölgesi
    turAciklama: { type: String, default: '' }, // Örn: Limanın büyüleyici...
    turYerler: { type: String, default: '' }, // Örn: Girne Kalesi, Eski Yat Limanı (Virgülle ayrılmış)
    turRozet: { type: String, default: '' }, // Örn: VIP Tur, Popüler
    turSira: { type: Number, default: 999 }, // Ekranda gösterme sırası
    fotoUrl: { type: String, default: '' }, // Ana Kapak Fotoğrafı
    galeriUrls: [{ type: String }], // Çoklu Galeri Fotoğrafları
    kayitTarihi: { type: Date, default: Date.now }
});
const Tour = mongoose.models.Tour || mongoose.model('Tour', tourSchema);


const app = express();
const PORT = process.env.PORT || 5000;

// --- 2. GÜVENLİK, İZLEME VE OTURUM ---

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(morgan('dev'));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { mesaj: "Çok fazla deneme yaptınız, lütfen biraz bekleyin." }
});
app.use('/api/teklif-al', limiter);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'kibris-vip-gizli-anahtari-123',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true }
}));

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

// --- 3. MULTER (FOTOĞRAF YÜKLEME) AYARLARI ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // İsteğin geldiği URL'ye göre klasörü belirle (Araç mı Tur mu?)
        let folderName = 'Cars';
        if (req.originalUrl.includes('tours')) {
            folderName = 'Tours';
        }

        const dir = path.join(__dirname, 'Frontend', 'Images', folderName);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = req.originalUrl.includes('tours') ? 'tur-' : 'arac-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Araçlar İçin Upload
const cpUpload = upload.fields([
    { name: 'aracFoto', maxCount: 1 },
    { name: 'aracGaleri', maxCount: 10 }
]);

// Turlar İçin Upload
const tourUpload = upload.fields([
    { name: 'turFoto', maxCount: 1 },
    { name: 'turGaleri', maxCount: 10 }
]);

// Resend (E-posta) Başlatma
let resend;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
}

// --- 4. STATİK DOSYA SUNUMU ---
app.use('/Frontend', express.static(path.join(__dirname, 'Frontend')));
app.use('/Css', express.static(path.join(__dirname, 'Frontend', 'Css')));
app.use('/Js', express.static(path.join(__dirname, 'Frontend', 'Js')));
app.use(express.static(path.join(__dirname, 'Frontend')));
app.use(express.static(path.join(__dirname, 'Frontend', 'Html')));

// --- 5. ÖZEL ROTALAR VE GİRİŞ (AUTH) ---
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

// --- 6. MONGODB BAĞLANTISI ---
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('✅ MongoDB Bağlantısı Başarılı'))
        .catch((err) => console.error('❌ MongoDB Hatası:', err));
}

// --- 7. API UÇ NOKTALARI (CRM VE REZERVASYON) ---
app.get('/api/admin/stats', adminKontrol, async (req, res) => {
    try {
        const toplam = await Reservation.countDocuments({ isDeleted: { $ne: true } });
        const okunmamis = await Reservation.countDocuments({ isDeleted: { $ne: true }, isRead: false });
        const cop = await Reservation.countDocuments({ isDeleted: true });
        res.json({ toplam, okunmamis, cop });
    } catch (e) { res.status(500).json({ hata: e.message }); }
});

app.get('/api/admin/reservations', adminKontrol, async (req, res) => {
    try {
        const veriler = await Reservation.find({ isDeleted: { $ne: true } }).sort({ kayitTarihi: -1 });
        res.json(veriler);
    } catch (e) { res.status(500).json({ mesaj: "Hata" }); }
});

app.get('/api/admin/trash', adminKontrol, async (req, res) => {
    try {
        const veriler = await Reservation.find({ isDeleted: true }).sort({ deletedAt: -1 });
        res.json(veriler);
    } catch (e) { res.status(500).json({ mesaj: "Hata" }); }
});

app.put('/api/admin/reservations/:id/toggle-read', adminKontrol, async (req, res) => {
    try {
        const rez = await Reservation.findById(req.params.id);
        if (!rez) return res.status(404).send();
        rez.isRead = !rez.isRead;
        await rez.save();
        res.json({ basari: true });
    } catch (e) { res.status(500).send(); }
});

app.put('/api/admin/reservations/:id/note', adminKontrol, async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { adminNotu: req.body.not });
        res.json({ basari: true });
    } catch (e) { res.status(500).send(); }
});

app.delete('/api/admin/reservations/:id', adminKontrol, async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date() });
        res.json({ basari: true });
    } catch (error) { res.status(500).send(); }
});

app.put('/api/admin/trash/:id/restore', adminKontrol, async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { isDeleted: false, deletedAt: null });
        res.json({ basari: true });
    } catch (error) { res.status(500).send(); }
});

// --- 8. ARAÇ YÖNETİMİ API'LERİ ---
app.get('/api/vehicles', async (req, res) => {
    try {
        const araclar = await Vehicle.find().sort({ aracSira: 1, kayitTarihi: -1 });
        res.json(araclar);
    } catch (error) { res.status(500).json({ mesaj: "Araçlar getirilemedi." }); }
});

app.get('/api/admin/vehicles', adminKontrol, async (req, res) => {
    try {
        const araclar = await Vehicle.find().sort({ aracSira: 1, kayitTarihi: -1 });
        res.json(araclar);
    } catch (error) { res.status(500).json({ mesaj: "Araçlar getirilemedi." }); }
});

app.post('/api/admin/vehicles', adminKontrol, cpUpload, async (req, res) => {
    try {
        const { aracAd, aracMarka, aracAciklama, aracOzellikler, aracYorumlar, aracSira } = req.body;

        let fotoUrl = '';
        if (req.files && req.files['aracFoto']) { fotoUrl = '/Frontend/Images/Cars/' + req.files['aracFoto'][0].filename; }

        let galeriUrls = [];
        if (req.files && req.files['aracGaleri']) {
            req.files['aracGaleri'].forEach(file => { galeriUrls.push('/Frontend/Images/Cars/' + file.filename); });
        }

        const yeniArac = new Vehicle({
            aracAd: aracAd,
            aracMarka: aracMarka || '',
            aracAciklama: aracAciklama || '',
            aracYorumlar: aracYorumlar || '[]',
            aracSira: aracSira || 999,
            aracOzellikler: aracOzellikler || '',
            fotoUrl: fotoUrl,
            galeriUrls: galeriUrls
        });

        await yeniArac.save();
        res.status(201).json({ basari: true, mesaj: "Araç başarıyla eklendi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Araç eklenirken hata oluştu." }); }
});

app.put('/api/admin/vehicles/:id', adminKontrol, cpUpload, async (req, res) => {
    try {
        const arac = await Vehicle.findById(req.params.id);
        if (!arac) return res.status(404).json({ basari: false, mesaj: "Araç bulunamadı." });

        arac.aracAd = req.body.aracAd || arac.aracAd;
        arac.aracSira = req.body.aracSira || arac.aracSira;
        arac.aracOzellikler = req.body.aracOzellikler !== undefined ? req.body.aracOzellikler : arac.aracOzellikler;
        arac.aracMarka = req.body.aracMarka !== undefined ? req.body.aracMarka : arac.aracMarka;
        arac.aracAciklama = req.body.aracAciklama !== undefined ? req.body.aracAciklama : arac.aracAciklama;
        if (req.body.aracYorumlar !== undefined) { arac.aracYorumlar = req.body.aracYorumlar; }

        if (req.files && req.files['aracFoto']) {
            if (arac.fotoUrl) {
                const eskiFotoPath = path.join(__dirname, arac.fotoUrl);
                if (fs.existsSync(eskiFotoPath)) fs.unlinkSync(eskiFotoPath);
            }
            arac.fotoUrl = '/Frontend/Images/Cars/' + req.files['aracFoto'][0].filename;
        }

        if (req.files && req.files['aracGaleri']) {
            if (arac.galeriUrls && arac.galeriUrls.length > 0) {
                arac.galeriUrls.forEach(url => {
                    const eskiGaleriPath = path.join(__dirname, url);
                    if (fs.existsSync(eskiGaleriPath)) fs.unlinkSync(eskiGaleriPath);
                });
            }
            let yeniGaleriUrls = [];
            req.files['aracGaleri'].forEach(file => { yeniGaleriUrls.push('/Frontend/Images/Cars/' + file.filename); });
            arac.galeriUrls = yeniGaleriUrls;
        }

        await arac.save();
        res.json({ basari: true, mesaj: "Araç güncellendi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Araç güncellenirken hata oluştu." }); }
});

app.delete('/api/admin/vehicles/:id', adminKontrol, async (req, res) => {
    try {
        const arac = await Vehicle.findById(req.params.id);
        if (!arac) return res.status(404).json({ basari: false, mesaj: "Araç bulunamadı." });

        if (arac.fotoUrl) {
            const fotoPath = path.join(__dirname, arac.fotoUrl);
            if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
        }

        if (arac.galeriUrls && arac.galeriUrls.length > 0) {
            arac.galeriUrls.forEach(url => {
                const galeriPath = path.join(__dirname, url);
                if (fs.existsSync(galeriPath)) fs.unlinkSync(galeriPath);
            });
        }

        await Vehicle.findByIdAndDelete(req.params.id);
        res.json({ basari: true, mesaj: "Araç tamamen silindi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Silme işlemi başarısız." }); }
});

// --- YENİ: 9. TUR YÖNETİMİ API'LERİ ---
app.get('/api/tours', async (req, res) => {
    try {
        const turlar = await Tour.find().sort({ turSira: 1, kayitTarihi: -1 });
        res.json(turlar);
    } catch (error) { res.status(500).json({ mesaj: "Turlar getirilemedi." }); }
});

app.get('/api/admin/tours', adminKontrol, async (req, res) => {
    try {
        const turlar = await Tour.find().sort({ turSira: 1, kayitTarihi: -1 });
        res.json(turlar);
    } catch (error) { res.status(500).json({ mesaj: "Turlar getirilemedi." }); }
});

app.post('/api/admin/tours', adminKontrol, tourUpload, async (req, res) => {
    try {
        const { turAd, turBolge, turAciklama, turYerler, turRozet, turSira } = req.body;

        let fotoUrl = '';
        if (req.files && req.files['turFoto']) { fotoUrl = '/Frontend/Images/Tours/' + req.files['turFoto'][0].filename; }

        let galeriUrls = [];
        if (req.files && req.files['turGaleri']) {
            req.files['turGaleri'].forEach(file => { galeriUrls.push('/Frontend/Images/Tours/' + file.filename); });
        }

        const yeniTur = new Tour({
            turAd: turAd,
            turBolge: turBolge || '',
            turAciklama: turAciklama || '',
            turYerler: turYerler || '',
            turRozet: turRozet || '',
            turSira: turSira || 999,
            fotoUrl: fotoUrl,
            galeriUrls: galeriUrls
        });

        await yeniTur.save();
        res.status(201).json({ basari: true, mesaj: "Tur başarıyla eklendi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Tur eklenirken hata oluştu." }); }
});

app.put('/api/admin/tours/:id', adminKontrol, tourUpload, async (req, res) => {
    try {
        const tur = await Tour.findById(req.params.id);
        if (!tur) return res.status(404).json({ basari: false, mesaj: "Tur bulunamadı." });

        tur.turAd = req.body.turAd || tur.turAd;
        tur.turSira = req.body.turSira || tur.turSira;
        tur.turBolge = req.body.turBolge !== undefined ? req.body.turBolge : tur.turBolge;
        tur.turAciklama = req.body.turAciklama !== undefined ? req.body.turAciklama : tur.turAciklama;
        tur.turYerler = req.body.turYerler !== undefined ? req.body.turYerler : tur.turYerler;
        tur.turRozet = req.body.turRozet !== undefined ? req.body.turRozet : tur.turRozet;

        if (req.files && req.files['turFoto']) {
            if (tur.fotoUrl) {
                const eskiFotoPath = path.join(__dirname, tur.fotoUrl);
                if (fs.existsSync(eskiFotoPath)) fs.unlinkSync(eskiFotoPath);
            }
            tur.fotoUrl = '/Frontend/Images/Tours/' + req.files['turFoto'][0].filename;
        }

        if (req.files && req.files['turGaleri']) {
            if (tur.galeriUrls && tur.galeriUrls.length > 0) {
                tur.galeriUrls.forEach(url => {
                    const eskiGaleriPath = path.join(__dirname, url);
                    if (fs.existsSync(eskiGaleriPath)) fs.unlinkSync(eskiGaleriPath);
                });
            }
            let yeniGaleriUrls = [];
            req.files['turGaleri'].forEach(file => { yeniGaleriUrls.push('/Frontend/Images/Tours/' + file.filename); });
            tur.galeriUrls = yeniGaleriUrls;
        }

        await tur.save();
        res.json({ basari: true, mesaj: "Tur güncellendi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Tur güncellenirken hata." }); }
});

app.delete('/api/admin/tours/:id', adminKontrol, async (req, res) => {
    try {
        const tur = await Tour.findById(req.params.id);
        if (!tur) return res.status(404).json({ basari: false, mesaj: "Tur bulunamadı." });

        if (tur.fotoUrl) {
            const fotoPath = path.join(__dirname, tur.fotoUrl);
            if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
        }

        if (tur.galeriUrls && tur.galeriUrls.length > 0) {
            tur.galeriUrls.forEach(url => {
                const galeriPath = path.join(__dirname, url);
                if (fs.existsSync(galeriPath)) fs.unlinkSync(galeriPath);
            });
        }

        await Tour.findByIdAndDelete(req.params.id);
        res.json({ basari: true, mesaj: "Tur tamamen silindi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Silme işlemi başarısız." }); }
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
                    to: 'senin.kendimailadresin@gmail.com',
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

// --- 10. HATA YÖNETİMİ ---
app.use((err, req, res, next) => {
    console.error("🔥 Beklenmedik Sunucu Hatası:", err.stack);
    res.status(500).json({ basari: false, mesaj: "Bir hata oluştu." });
});

// --- 11. BAŞLATMA ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 VIP Kıbrıs Yayında: http://localhost:${PORT}`);
});
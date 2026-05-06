require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs'); // Şifreleri güvenle şifrelemek için

const Reservation = require('./models/Reservation');

// --- 1. MONGODB ŞEMALARI ---
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

const tourSchema = new mongoose.Schema({
    turAd: { type: String, required: true },
    turBolge: { type: String, default: '' },
    turAciklama: { type: String, default: '' },
    turYerler: { type: String, default: '' },
    turRozet: { type: String, default: '' },
    turSira: { type: Number, default: 999 },
    fotoUrl: { type: String, default: '' },
    galeriUrls: [{ type: String }],
    kayitTarihi: { type: Date, default: Date.now }
});
const Tour = mongoose.models.Tour || mongoose.model('Tour', tourSchema);

// ADMİN ŞEMASI (Dinamik Şifre Yönetimi İçin)
const adminSchema = new mongoose.Schema({
    kullaniciAdi: { type: String, required: true },
    email: { type: String, required: true },
    sifre: { type: String, required: true }, // Bcrypt ile şifrelenmiş tutulacak
    resetPasswordToken: String,
    resetPasswordExpires: Date
});
const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);


const app = express();

// =========================================================================
// KRİTİK SEO ÇÖZÜMÜ: Sitemap ve Robots.txt Rotaları
// =========================================================================
app.get('/sitemap.xml', (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.sendFile(path.join(__dirname, 'robots.txt'));
});

const PORT = process.env.PORT || 5000;
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
    : null;
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const emailAlici = process.env.NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || '';

function temizMetin(deger, maxUzunluk = 5000) {
    if (deger === undefined || deger === null) return '';
    return String(deger).replace(/\0/g, '').trim().slice(0, maxUzunluk);
}

function temizListeMetni(deger, maxUzunluk = 500) {
    if (!deger) return '';
    return String(deger).split(',').map(item => temizMetin(item, 80)).filter(Boolean).join(', ');
}

function temizEmail(deger) {
    const email = temizMetin(deger, 254).toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? email : '';
}

function temizTelefon(deger) {
    const telefon = temizMetin(deger, 20).replace(/\s+/g, '');
    const telefonRegex = /^\+?[0-9]{10,15}$/;
    return telefonRegex.test(telefon) ? telefon : '';
}

function sayiOku(deger, varsayilanDeger = 999) {
    if (deger === undefined || deger === null || deger === '') return varsayilanDeger;
    const sayi = Number.parseInt(deger, 10);
    return Number.isFinite(sayi) ? sayi : varsayilanDeger;
}

function htmlKacis(deger) {
    return String(deger).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function rezervasyonVerisiniHazirla(body = {}) {
    return {
        adSoyad: temizMetin(body.adSoyad, 120),
        telefon: temizTelefon(body.telefon),
        email: temizEmail(body.email),
        alinisNoktasi: temizMetin(body.alinisNoktasi, 150),
        birakilisNoktasi: temizMetin(body.birakilisNoktasi, 150),
        tarih: temizMetin(body.tarih, 50),
        yolcuSayisi: temizMetin(body.yolcuSayisi, 20),
        mesaj: temizMetin(body.mesaj, 2000),
        formTipi: temizMetin(body.formTipi, 80) || 'Genel Teklif'
    };
}

function rezervasyonDogrula(veri) {
    if (!veri.adSoyad || veri.adSoyad.length < 3) return 'Lutfen gecerli bir ad soyad girin.';
    if (!veri.telefon) return 'Lutfen gecerli bir telefon numarasi girin.';
    if (veri.email && !temizEmail(veri.email)) return 'Lutfen gecerli bir e-posta adresi girin.';
    return '';
}

function dosyaYolunuCoz(dosyaUrl) {
    if (!dosyaUrl || typeof dosyaUrl !== 'string' || !dosyaUrl.startsWith('/Frontend/Images/')) return '';
    return path.join(__dirname, dosyaUrl);
}

// --- 2. GÜVENLİK VE SİSTEM KONTROLÜ ---
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/teklif-al', limiter);

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
app.use('/api/login', loginLimiter);

const sifreSifirlaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: { basari: false, mesaj: "Çok fazla istek gönderdiniz, lütfen 15 dakika bekleyin." }
});

app.use(cors({
    origin(origin, cb) {
        if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('CORS engellendi.'));
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

const adminKontrol = (req, res, next) => {
    const cookies = req.headers.cookie || '';
    if (cookies.includes('bp_admin_auth=basarili_giris')) {
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
        let folderName = req.originalUrl.includes('tours') ? 'Tours' : 'Cars';
        const dir = path.join(__dirname, 'Frontend', 'Images', folderName);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const prefix = req.originalUrl.includes('tours') ? 'tur-' : 'arac-';
        cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 11 },
    fileFilter(req, file, cb) {
        if (!allowedImageMimeTypes.has(file.mimetype)) return cb(new Error('Sadece gorsel dosyalari yuklenebilir.'));
        cb(null, true);
    }
});

const cpUpload = upload.fields([{ name: 'aracFoto', maxCount: 1 }, { name: 'aracGaleri', maxCount: 10 }]);
const tourUpload = upload.fields([{ name: 'turFoto', maxCount: 1 }, { name: 'turGaleri', maxCount: 10 }]);

let resend;
if (process.env.RESEND_API_KEY) resend = new Resend(process.env.RESEND_API_KEY);


// --- 4. STATİK DOSYA SUNUMU ---
app.use('/Frontend', express.static(path.join(__dirname, 'Frontend')));
app.use('/Css', express.static(path.join(__dirname, 'Frontend', 'Css')));
app.use('/Js', express.static(path.join(__dirname, 'Frontend', 'Js')));
app.use(express.static(path.join(__dirname, 'Frontend', 'Html')));
app.use(express.static(path.join(__dirname, 'Frontend')));
app.use(express.static(__dirname));

// --- 5. ÖZEL ROTALAR VE GİRİŞ (AUTH) ---
app.get('/login', (req, res) => {
    const cookies = req.headers.cookie || '';
    if (cookies.includes('bp_admin_auth=basarili_giris')) return res.redirect('/admin');
    res.sendFile(path.join(__dirname, 'Frontend', 'Html', 'login.html'));
});

// VERİTABANI VE BCRYPT DESTEKLİ GİRİŞ
app.post('/api/login', async (req, res) => {
    try {
        const kullaniciAdi = temizMetin(req.body?.kullaniciAdi, 120);
        const sifre = temizMetin(req.body?.sifre, 120);

        // Veritabanından admini bul
        const admin = await Admin.findOne({ kullaniciAdi });
        if (!admin) {
            return res.status(401).json({ basari: false, mesaj: 'Hatalı kullanıcı adı veya şifre!' });
        }

        // Şifreyi bcrypt ile kontrol et
        const sifreDogruMu = await bcrypt.compare(sifre, admin.sifre);
        if (!sifreDogruMu) {
            return res.status(401).json({ basari: false, mesaj: 'Hatalı kullanıcı adı veya şifre!' });
        }

        res.cookie('bp_admin_auth', 'basarili_giris', {
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
            httpOnly: false,
            secure: false
        });

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json({ basari: true });
    } catch (err) {
        console.error("Login hatası:", err);
        res.status(500).json({ basari: false, mesaj: 'Sunucu hatası oluştu.' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('bp_admin_auth', { path: '/' });
    res.json({ basari: true });
});

// =========================================================================
// GERÇEK ŞİFRE SIFIRLAMA (LİNK GÖNDERME) PLESK UYUMLU
// =========================================================================
app.post('/api/sifre-sifirla', sifreSifirlaLimiter, async (req, res) => {
    try {
        const email = temizEmail(req.body?.email);
        const admin = await Admin.findOne({ email });

        // Admin bulunamazsa da başarılı dön (Brute force koruması)
        if (!admin) {
            return res.json({ basari: true, mesaj: "Eğer e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderilmiştir." });
        }

        // Benzersiz Token Üretimi
        const resetToken = crypto.randomBytes(32).toString('hex');
        admin.resetPasswordToken = resetToken;
        admin.resetPasswordExpires = Date.now() + 3600000; // 1 Saat geçerli
        await admin.save();

        // Şifre sıfırlama linki (Domain yerine dinamik host alıyoruz)
        const host = req.get('host');
        const protokol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const resetUrl = `${protokol}://${host}/sifre-yenile.html?token=${resetToken}`;

        // Plesk kurumsal mail uyumlu Nodemailer ayarları
        const transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: 465,
            secure: true,
            auth: {
                user: process.env.MAIL_ADRES,
                pass: process.env.MAIL_SIFRE
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: `"BUĞRA POLAT TURİZM" <${process.env.MAIL_ADRES}>`,
            to: admin.email,
            subject: 'VIP Kıbrıs - Şifre Sıfırlama Talebi',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #eaeaea; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0f3d7a; border-bottom: 2px solid #f39c12; padding-bottom: 10px;">Şifre Sıfırlama</h2>
                    <p style="color: #333; font-size: 15px;">Yönetim paneli için şifre sıfırlama talebinde bulundunuz.</p>
                    <p>Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz. <b>Bu bağlantı 1 saat boyunca geçerlidir.</b></p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #f39c12; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Şifremi Yenile</a>
                    </div>
                    <p style="color: #666; font-size: 13px;"><em>Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</em></p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ basari: true, mesaj: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi." });

    } catch (error) {
        console.error("Şifre sıfırlama hatası:", error);
        res.status(500).json({ basari: false, mesaj: "Sunucu hatası oluştu. E-posta gönderilemedi." });
    }
});

// YENİ ŞİFREYİ KAYDETME API'Sİ
app.post('/api/yeni-sifre', async (req, res) => {
    try {
        const { token, yeniSifre } = req.body;

        // Tokeni kontrol et ve süresinin dolup dolmadığına bak
        const admin = await Admin.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() } // Zamanı geçmemiş olmalı
        });

        if (!admin) {
            return res.status(400).json({ basari: false, mesaj: "Geçersiz veya süresi dolmuş bir bağlantı kullandınız." });
        }

        // Yeni şifreyi Hash'le (şifrele) ve kaydet
        admin.sifre = await bcrypt.hash(yeniSifre, 10);
        admin.resetPasswordToken = undefined; // Tokeni temizle (tek kullanımlık)
        admin.resetPasswordExpires = undefined;
        await admin.save();

        res.json({ basari: true, mesaj: "Şifreniz başarıyla güncellendi! Artık giriş yapabilirsiniz." });

    } catch (error) {
        console.error("Yeni şifre kaydetme hatası:", error);
        res.status(500).json({ basari: false, mesaj: "Sunucu hatası." });
    }
});
// =========================================================================

app.get('/admin', adminKontrol, (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'Html', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'Html', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ durum: 'UP', zaman: new Date() });
});

// --- 6. MONGODB BAĞLANTISI VE VARSAYILAN ADMİN OLUŞTURUCU ---
async function varsayilanAdminOlustur() {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const defaultPass = process.env.ADMIN_PASS || 'pass';
            const hashedSifre = await bcrypt.hash(defaultPass, 10);

            await Admin.create({
                kullaniciAdi: process.env.ADMIN_USERNAME || 'admin',
                email: process.env.MAIL_ADRES || process.env.ADMIN_EMAIL || 'info@bugrapolatturizim.com',
                sifre: hashedSifre
            });
            console.log('✅ Varsayılan Yönetici (Admin) hesabı veritabanına eklendi!');
        }
    } catch (err) {
        console.error('Admin oluşturulurken hata:', err);
    }
}

if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log('✅ MongoDB Bağlantısı Başarılı');
            varsayilanAdminOlustur(); // Veritabanı bağlanınca admini kontrol et
        })
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
        const adminNotu = temizMetin(req.body?.not, 1000);
        await Reservation.findByIdAndUpdate(req.params.id, { adminNotu });
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
    } catch (error) { res.status(500).json({ mesaj: "Hata" }); }
});

app.get('/api/admin/vehicles', adminKontrol, async (req, res) => {
    try {
        const araclar = await Vehicle.find().sort({ aracSira: 1, kayitTarihi: -1 });
        res.json(araclar);
    } catch (error) { res.status(500).json({ mesaj: "Hata" }); }
});

app.post('/api/admin/vehicles', adminKontrol, cpUpload, async (req, res) => {
    try {
        const aracAd = temizMetin(req.body?.aracAd, 150);
        const aracMarka = temizMetin(req.body?.aracMarka, 150);
        const aracAciklama = temizMetin(req.body?.aracAciklama, 3000);
        const aracOzellikler = temizListeMetni(req.body?.aracOzellikler, 500);
        const aracYorumlar = temizMetin(req.body?.aracYorumlar, 5000) || '[]';
        const aracSira = sayiOku(req.body?.aracSira, 999);

        if (!aracAd) return res.status(400).json({ basari: false, mesaj: "Araç adı zorunludur." });

        let fotoUrl = '';
        if (req.files && req.files['aracFoto']) { fotoUrl = '/Frontend/Images/Cars/' + req.files['aracFoto'][0].filename; }

        let galeriUrls = [];
        if (req.files && req.files['aracGaleri']) {
            req.files['aracGaleri'].forEach(file => { galeriUrls.push('/Frontend/Images/Cars/' + file.filename); });
        }

        const yeniArac = new Vehicle({ aracAd, aracMarka, aracAciklama, aracYorumlar, aracSira, aracOzellikler, fotoUrl, galeriUrls });
        await yeniArac.save();
        res.status(201).json({ basari: true, mesaj: "Araç eklendi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Hata" }); }
});

app.put('/api/admin/vehicles/:id', adminKontrol, cpUpload, async (req, res) => {
    try {
        const arac = await Vehicle.findById(req.params.id);
        if (!arac) return res.status(404).json({ basari: false, mesaj: "Araç bulunamadı." });

        arac.aracAd = req.body.aracAd !== undefined ? temizMetin(req.body.aracAd, 150) || arac.aracAd : arac.aracAd;
        arac.aracSira = req.body.aracSira !== undefined ? sayiOku(req.body.aracSira, arac.aracSira) : arac.aracSira;
        arac.aracOzellikler = req.body.aracOzellikler !== undefined ? temizListeMetni(req.body.aracOzellikler, 500) : arac.aracOzellikler;
        arac.aracMarka = req.body.aracMarka !== undefined ? temizMetin(req.body.aracMarka, 150) : arac.aracMarka;
        arac.aracAciklama = req.body.aracAciklama !== undefined ? temizMetin(req.body.aracAciklama, 3000) : arac.aracAciklama;
        if (req.body.aracYorumlar !== undefined) arac.aracYorumlar = temizMetin(req.body.aracYorumlar, 5000) || '[]';

        if (req.files && req.files['aracFoto']) {
            if (arac.fotoUrl) {
                const eskiFotoPath = dosyaYolunuCoz(arac.fotoUrl);
                if (fs.existsSync(eskiFotoPath)) fs.unlinkSync(eskiFotoPath);
            }
            arac.fotoUrl = '/Frontend/Images/Cars/' + req.files['aracFoto'][0].filename;
        }

        if (req.files && req.files['aracGaleri']) {
            if (arac.galeriUrls && arac.galeriUrls.length > 0) {
                arac.galeriUrls.forEach(url => {
                    const eskiGaleriPath = dosyaYolunuCoz(url);
                    if (fs.existsSync(eskiGaleriPath)) fs.unlinkSync(eskiGaleriPath);
                });
            }
            let yeniGaleriUrls = [];
            req.files['aracGaleri'].forEach(file => { yeniGaleriUrls.push('/Frontend/Images/Cars/' + file.filename); });
            arac.galeriUrls = yeniGaleriUrls;
        }

        await arac.save();
        res.json({ basari: true, mesaj: "Araç güncellendi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Hata" }); }
});

app.delete('/api/admin/vehicles/:id', adminKontrol, async (req, res) => {
    try {
        const arac = await Vehicle.findById(req.params.id);
        if (!arac) return res.status(404).json({ basari: false, mesaj: "Araç bulunamadı." });

        if (arac.fotoUrl) {
            const fotoPath = dosyaYolunuCoz(arac.fotoUrl);
            if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
        }

        if (arac.galeriUrls && arac.galeriUrls.length > 0) {
            arac.galeriUrls.forEach(url => {
                const galeriPath = dosyaYolunuCoz(url);
                if (fs.existsSync(galeriPath)) fs.unlinkSync(galeriPath);
            });
        }

        await Vehicle.findByIdAndDelete(req.params.id);
        res.json({ basari: true, mesaj: "Araç silindi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Hata" }); }
});

// --- 9. TUR YÖNETİMİ API'LERİ ---
app.get('/api/tours', async (req, res) => {
    try {
        const turlar = await Tour.find().sort({ turSira: 1, kayitTarihi: -1 });
        res.json(turlar);
    } catch (error) { res.status(500).json({ mesaj: "Hata" }); }
});

app.get('/api/admin/tours', adminKontrol, async (req, res) => {
    try {
        const turlar = await Tour.find().sort({ turSira: 1, kayitTarihi: -1 });
        res.json(turlar);
    } catch (error) { res.status(500).json({ mesaj: "Hata" }); }
});

app.post('/api/admin/tours', adminKontrol, tourUpload, async (req, res) => {
    try {
        const turAd = temizMetin(req.body?.turAd, 150);
        const turBolge = temizMetin(req.body?.turBolge, 150);
        const turAciklama = temizMetin(req.body?.turAciklama, 3000);
        const turYerler = temizListeMetni(req.body?.turYerler, 500);
        const turRozet = temizMetin(req.body?.turRozet, 80);
        const turSira = sayiOku(req.body?.turSira, 999);

        if (!turAd) return res.status(400).json({ basari: false, mesaj: "Tur adı zorunludur." });

        let fotoUrl = '';
        if (req.files && req.files['turFoto']) { fotoUrl = '/Frontend/Images/Tours/' + req.files['turFoto'][0].filename; }

        let galeriUrls = [];
        if (req.files && req.files['turGaleri']) {
            req.files['turGaleri'].forEach(file => { galeriUrls.push('/Frontend/Images/Tours/' + file.filename); });
        }

        const yeniTur = new Tour({ turAd, turBolge, turAciklama, turYerler, turRozet, turSira, fotoUrl, galeriUrls });
        await yeniTur.save();
        res.status(201).json({ basari: true, mesaj: "Tur eklendi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Hata" }); }
});

app.put('/api/admin/tours/:id', adminKontrol, tourUpload, async (req, res) => {
    try {
        const tur = await Tour.findById(req.params.id);
        if (!tur) return res.status(404).json({ basari: false, mesaj: "Tur bulunamadı." });

        tur.turAd = req.body.turAd !== undefined ? temizMetin(req.body.turAd, 150) || tur.turAd : tur.turAd;
        tur.turSira = req.body.turSira !== undefined ? sayiOku(req.body.turSira, tur.turSira) : tur.turSira;
        tur.turBolge = req.body.turBolge !== undefined ? temizMetin(req.body.turBolge, 150) : tur.turBolge;
        tur.turAciklama = req.body.turAciklama !== undefined ? temizMetin(req.body.turAciklama, 3000) : tur.turAciklama;
        tur.turYerler = req.body.turYerler !== undefined ? temizListeMetni(req.body.turYerler, 500) : tur.turYerler;
        tur.turRozet = req.body.turRozet !== undefined ? temizMetin(req.body.turRozet, 80) : tur.turRozet;

        if (req.files && req.files['turFoto']) {
            if (tur.fotoUrl) {
                const eskiFotoPath = dosyaYolunuCoz(tur.fotoUrl);
                if (fs.existsSync(eskiFotoPath)) fs.unlinkSync(eskiFotoPath);
            }
            tur.fotoUrl = '/Frontend/Images/Tours/' + req.files['turFoto'][0].filename;
        }

        if (req.files && req.files['turGaleri']) {
            if (tur.galeriUrls && tur.galeriUrls.length > 0) {
                tur.galeriUrls.forEach(url => {
                    const eskiGaleriPath = dosyaYolunuCoz(url);
                    if (fs.existsSync(eskiGaleriPath)) fs.unlinkSync(eskiGaleriPath);
                });
            }
            let yeniGaleriUrls = [];
            req.files['turGaleri'].forEach(file => { yeniGaleriUrls.push('/Frontend/Images/Tours/' + file.filename); });
            tur.galeriUrls = yeniGaleriUrls;
        }

        await tur.save();
        res.json({ basari: true, mesaj: "Güncellendi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Hata" }); }
});

app.delete('/api/admin/tours/:id', adminKontrol, async (req, res) => {
    try {
        const tur = await Tour.findById(req.params.id);
        if (!tur) return res.status(404).json({ basari: false, mesaj: "Tur bulunamadı." });

        if (tur.fotoUrl) {
            const fotoPath = dosyaYolunuCoz(tur.fotoUrl);
            if (fs.existsSync(fotoPath)) fs.unlinkSync(fotoPath);
        }

        if (tur.galeriUrls && tur.galeriUrls.length > 0) {
            tur.galeriUrls.forEach(url => {
                const galeriPath = dosyaYolunuCoz(url);
                if (fs.existsSync(galeriPath)) fs.unlinkSync(galeriPath);
            });
        }

        await Tour.findByIdAndDelete(req.params.id);
        res.json({ basari: true, mesaj: "Tur silindi." });
    } catch (error) { res.status(500).json({ basari: false, mesaj: "Hata" }); }
});

// --- MÜŞTERİ FORMU (TEKLİF AL) ---
app.post('/api/teklif-al', async (req, res) => {
    try {
        const rezervasyonVerisi = rezervasyonVerisiniHazirla(req.body);
        const dogrulamaHatasi = rezervasyonDogrula(rezervasyonVerisi);

        if (dogrulamaHatasi) return res.status(400).json({ basari: false, mesaj: dogrulamaHatasi });

        const yeni = new Reservation(rezervasyonVerisi);
        await yeni.save();

        if (resend && process.env.RESEND_API_KEY && emailAlici) {
            try {
                await resend.emails.send({
                    from: 'BUGRA POLAT <onboarding@resend.dev>',
                    to: emailAlici,
                    subject: `Yeni VIP Talep: ${htmlKacis(rezervasyonVerisi.adSoyad)}`,
                    html: `<p>Yeni Talep: ${htmlKacis(rezervasyonVerisi.adSoyad)}</p>`
                });
            } catch (e) {
                console.log("Mail gönderiminde hata.");
            }
        }
        res.status(201).json({ basari: true });
    } catch (e) { res.status(500).json({ basari: false }); }
});

// --- 10. HATA YÖNETİMİ ---
app.use((err, req, res, next) => {
    console.error("🔥 Beklenmedik Sunucu Hatası:", err.stack);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ basari: false, mesaj: "Dosya yukleme siniri asildi veya gecersiz dosya secildi." });
    }
    if (err.message === 'Sadece gorsel dosyalari yuklenebilir.' || err.message === 'CORS engellendi.') {
        return res.status(400).json({ basari: false, mesaj: err.message });
    }
    res.status(500).json({ basari: false, mesaj: "Bir hata oluştu." });
});

// --- 11. BAŞLATMA ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 VIP Kıbrıs Yayında: http://localhost:${PORT}`);
});
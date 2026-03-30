require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { Resend } = require('resend');

const Reservation = require('./models/Reservation');

const app = express();
const PORT = process.env.PORT || 5000;

let resend;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================================
// 🧭 ÖZEL GÜVENLİ ROTALAR (Statiklerden ÖNCE olmalı)
// ==========================================================

app.get('/admin', (req, res) => {
    if (req.query.pass === 'mert123') {
        res.sendFile(path.join(__dirname, 'Frontend', 'Html', 'admin.html'));
    } else {
        res.redirect('/');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'Html', 'index.html'));
});

// ==========================================================
// 🚀 STATİK DOSYA SUNUMU
// ==========================================================
app.use('/Frontend', express.static(path.join(__dirname, 'Frontend')));
app.use('/Css', express.static(path.join(__dirname, 'Frontend', 'Css')));
app.use('/Js', express.static(path.join(__dirname, 'Frontend', 'Js')));
app.use(express.static(path.join(__dirname, 'Frontend')));
app.use(express.static(path.join(__dirname, 'Frontend', 'Html')));

// --- MONGODB BAĞLANTISI ---
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('✅ MongoDB Bağlantısı Başarılı'))
        .catch((err) => console.error('❌ MongoDB Hatası:', err));
}

// ==========================================================
// 🛠️ API UÇ NOKTALARI
// ==========================================================

// 1. İstatistik API
app.get('/api/admin/stats', async (req, res) => {
    try {
        const toplam = await Reservation.countDocuments({ isDeleted: { $ne: true } });
        const okunmamis = await Reservation.countDocuments({ isDeleted: { $ne: true }, isRead: false });
        const cop = await Reservation.countDocuments({ isDeleted: true });
        res.json({ toplam, okunmamis, cop });
    } catch (e) { res.status(500).json({ hata: e.message }); }
});

// 2. Aktif Talepleri Listeleme
app.get('/api/admin/reservations', async (req, res) => {
    try {
        const veriler = await Reservation.find({ isDeleted: { $ne: true } }).sort({ kayitTarihi: -1 });
        res.json(veriler);
    } catch (e) { res.status(500).json({ mesaj: "Hata" }); }
});

// 3. Çöp Kutusunu Listeleme
app.get('/api/admin/trash', async (req, res) => {
    try {
        const veriler = await Reservation.find({ isDeleted: true }).sort({ deletedAt: -1 });
        res.json(veriler);
    } catch (e) { res.status(500).json({ mesaj: "Hata" }); }
});

// 4. Okundu Toggle
app.put('/api/admin/reservations/:id/toggle-read', async (req, res) => {
    try {
        const rez = await Reservation.findById(req.params.id);
        rez.isRead = !rez.isRead;
        await rez.save();
        res.json({ basari: true });
    } catch (e) { res.status(500).send(); }
});

// 5. Admin Notu Güncelleme
app.put('/api/admin/reservations/:id/note', async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { adminNotu: req.body.not });
        res.json({ basari: true });
    } catch (e) { res.status(500).send(); }
});

// 6. Çöpe Taşı (Soft Delete)
app.delete('/api/admin/reservations/:id', async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date() });
        res.json({ basari: true });
    } catch (error) { res.status(500).send(); }
});

// 7. Geri Yükle
app.put('/api/admin/trash/:id/restore', async (req, res) => {
    try {
        await Reservation.findByIdAndUpdate(req.params.id, { isDeleted: false, deletedAt: null });
        res.json({ basari: true });
    } catch (error) { res.status(500).send(); }
});

// 8. Teklif Alma (Müşteri Formu)
app.post('/api/teklif-al', async (req, res) => {
    try {
        const yeni = new Reservation(req.body);
        await yeni.save();

        if (resend && process.env.RESEND_API_KEY) {
            try {
                await resend.emails.send({
                    from: 'VIP Kibris <onboarding@resend.dev>',
                    to: 'senin.kendimailadresin@gmail.com',
                    subject: `🔔 Yeni Talep: ${req.body.formTipi}`,
                    html: `<p>Müşteri: ${req.body.adSoyad}</p><p>Tel: ${req.body.telefon}</p>`
                });
            } catch (e) { console.log("Mail hatası"); }
        }
        res.status(201).json({ basari: true, mesaj: "Alındı" });
    } catch (e) { res.status(500).json({ basari: false }); }
});

app.listen(PORT, () => console.log(`🚀 Sunucu Aktif: http://localhost:${PORT}/admin?pass=mert123`));
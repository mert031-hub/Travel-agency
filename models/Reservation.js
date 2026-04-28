const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    adSoyad: { type: String, trim: true, maxlength: 120 },
    telefon: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    alinisNoktasi: { type: String, trim: true, maxlength: 150 },
    birakilisNoktasi: { type: String, trim: true, maxlength: 150 },
    tarih: { type: String, trim: true, maxlength: 50 },
    yolcuSayisi: { type: String, trim: true, maxlength: 20 },
    mesaj: { type: String, trim: true, maxlength: 2000 },
    adminNotu: { type: String, trim: true, maxlength: 1000, default: '' }, // Yeni: Admin notları için
    formTipi: { type: String, trim: true, maxlength: 80, default: 'Genel Teklif' },
    isRead: { type: Boolean, default: false },
    kayitTarihi: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
});

// Çöp kutusundaki verileri 30 gün sonra otomatik temizler
reservationSchema.index({ "deletedAt": 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Reservation', reservationSchema);

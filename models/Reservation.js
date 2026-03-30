const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    adSoyad: { type: String },
    telefon: { type: String },
    email: { type: String },
    alinisNoktasi: { type: String },
    birakilisNoktasi: { type: String },
    tarih: { type: String },
    yolcuSayisi: { type: String },
    mesaj: { type: String },
    adminNotu: { type: String, default: '' }, // Yeni: Admin notları için
    formTipi: { type: String, default: 'Genel Teklif' },
    isRead: { type: Boolean, default: false },
    kayitTarihi: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
});

// Çöp kutusundaki verileri 30 gün sonra otomatik temizler
reservationSchema.index({ "deletedAt": 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Reservation', reservationSchema);
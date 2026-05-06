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
    adminNotu: { type: String, trim: true, maxlength: 1000, default: '' }, // Admin notları için
    formTipi: { type: String, trim: true, maxlength: 80, default: 'Genel Teklif' },
    isRead: { type: Boolean, default: false },
    kayitTarihi: { type: Date, default: Date.now },

    // --- Çöp Kutusu (Trash) Yönetimi ---
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    // --- YENİ: Arşiv (Archive) Yönetimi ---
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    arsivSebebi: { type: String, trim: true, maxlength: 200, default: '' }, // Örn: 'Seneye düşünüyor', 'VIP Müşteri'
    hatirlatmaTarihi: { type: Date, default: null } // İleride tekrar iletişime geçmek için tarih
});

// Çöp kutusundaki verileri 30 gün sonra otomatik temizler (Arşivdeki verilere dokunmaz!)
reservationSchema.index({ "deletedAt": 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Reservation', reservationSchema);
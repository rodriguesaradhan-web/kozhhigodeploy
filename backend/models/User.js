const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['driver', 'passenger', 'admin'], default: 'passenger' },
    warnings: [{
        reason: { type: String },
        reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
        issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        issuedAt: { type: Date, default: Date.now }
    }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedReason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

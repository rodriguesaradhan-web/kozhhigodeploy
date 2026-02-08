const mongoose = require('mongoose');

const studentRegistrationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    sid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    studentIdImagePath: { type: String, required: true }, // Path to uploaded image
    studentIdImageBuffer: { type: Buffer }, // Or store buffer directly
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin who approved
    rejectionReason: { type: String }, // If rejected
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('StudentRegistration', studentRegistrationSchema);

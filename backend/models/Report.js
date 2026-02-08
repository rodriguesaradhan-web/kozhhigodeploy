const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    ride: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'WARNING_ISSUED', 'ACCOUNT_DELETED', 'DISMISSED'], default: 'PENDING' },
    adminNote: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);

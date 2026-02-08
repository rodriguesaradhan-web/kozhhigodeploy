const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    driverPhone: { type: String },
    from: { type: String, required: true },
    to: { type: String, required: true },
    fromCoord: {
        lat: { type: Number },
        lng: { type: Number }
    },
    toCoord: {
        lat: { type: Number },
        lng: { type: Number }
    },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    seats: { type: Number, required: true },

    distance: { type: Number }, // in meters (from OSRM)
    duration: { type: Number }, // in seconds (from OSRM)
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'STARTED', 'ARRIVED', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
    startTime: { type: Date }, // When driver started the ride
    arrivalTime: { type: Date }, // When driver reached passenger
    tripStartTime: { type: Date }, // When driver started trip to destination
    tripEndTime: { type: Date }, // When driver reached destination
    tripDistance: { type: Number }, // Distance from pickup to destination in meters
    tripDuration: { type: Number }, // Duration from pickup to destination in seconds
    price: { type: Number }, // Final price in rupees (calculated when ride completes)
    driverLocation: {
        latitude: { type: Number },
        longitude: { type: Number }
    },
    passengers: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED'], default: 'REQUESTED' },
        phoneNumber: { type: String },
        pickupLocation: { type: String },
        eta: { type: Number }, // Estimated time to arrive in seconds
        distanceToPickup: { type: Number }, // Actual distance traveled to pickup in meters
        cancelReason: { type: String }
    }],
    reports: [{
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        driverId: { type: String },
        reason: { type: String },
        description: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    otp: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);

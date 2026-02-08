const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const User = require('../models/User');
const auth = require('../middleware/auth');

const geocodeAddress = async (address) => {
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();
    if (!geoData || geoData.length === 0) return null;
    const lat = parseFloat(geoData[0].lat);
    const lng = parseFloat(geoData[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
};// Create a ride (drivers can only post one ride at a time - no active rides allowed)
router.post('/', async (req, res) => {
    try {
        const { driverId, from, to, time, seats, distance, duration, fromCoord, toCoord, phoneNumber } = req.body;
        
        // Validate required fields
        if (!driverId) {
            return res.status(400).json({ message: 'Driver ID required' });
        }
        if (!from || !to) {
            return res.status(400).json({ message: 'From and To locations required' });
        }
        if (!phoneNumber) {
            return res.status(400).json({ message: 'Phone number required' });
        }
        
        // Check if driver already has an active ride (any status except COMPLETED or CANCELLED)
        const existingActiveRide = await Ride.findOne({
            driver: driverId,
            status: { $in: ['PENDING', 'STARTED', 'ARRIVED', 'IN_PROGRESS'] }
        });
        
        if (existingActiveRide) {
            return res.status(400).json({ message: 'You have an active ride in progress. Please complete it before posting a new ride.' });
        }
        
        const ride = new Ride({
            driver: driverId,
            driverPhone: phoneNumber,
            from,
            to,
            fromCoord,
            toCoord,
            // Use system date for ride posting
            date: new Date(),
            time,
            seats: seats || 1,
            distance,
            duration
        });
        await ride.save();
        res.status(201).json(ride);
    } catch (error) {
        console.error('Error creating ride:', error);
        res.status(500).json({ message: 'Error creating ride' });
    }
});

// Get all rides
router.get('/', async (req, res) => {
    try {
        const rides = await Ride.find()
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');
        res.json(rides);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching rides' });
    }
});

// Request a ride (passenger requests to join)
router.post('/:id/request', async (req, res) => {
    try {
        const { passengerId, phoneNumber, pickupLocation } = req.body;
        if (!passengerId) return res.status(400).json({ message: 'Passenger ID required' });
        if (!phoneNumber) return res.status(400).json({ message: 'Phone number required' });
        if (!pickupLocation) return res.status(400).json({ message: 'Pickup location required' });

        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        if (ride.status !== 'PENDING') {
            return res.status(400).json({ message: 'Ride cannot be started in its current status' });
        }

        // Check if passenger already requested
        if (ride.passengers.find(p => p.user?.toString() === passengerId)) {
            return res.status(400).json({ message: 'You already requested this ride' });
        }

            // For two-wheeler: check if seat is already taken (one accepted passenger)
        if (ride.passengers?.some(p => p.status === 'ACCEPTED')) {
            return res.status(400).json({ message: 'Ride seat already taken' });
        }

        ride.passengers.push({ 
            user: passengerId, 
            status: 'REQUESTED',
            phoneNumber,
            pickupLocation
        });
        await ride.save();

        const updated = await Ride.findById(ride._id)
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error requesting ride', error: error.message });
    }
});

// Driver responds to request (accept/reject)
router.put('/:id/response', async (req, res) => {
    try {
        const { passengerId, action } = req.body;
        if (!passengerId || !action) return res.status(400).json({ message: 'Passenger ID and action required' });
        if (!['ACCEPTED', 'REJECTED'].includes(action)) {
            return res.status(400).json({ message: 'Action must be ACCEPTED or REJECTED' });
        }

        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        const passenger = ride.passengers.find(p => p.user?.toString() === passengerId);
        if (!passenger) return res.status(404).json({ message: 'Passenger request not found' });

        if (action === 'ACCEPTED') {
            // For two-wheeler: only one passenger can be accepted
            if (ride.passengers?.some(p => p.status === 'ACCEPTED')) {
                return res.status(400).json({ message: 'Ride seat already taken' });
            }
            // Accept this passenger (ride stays PENDING until driver clicks START RIDE)
            passenger.status = 'ACCEPTED';
            // Reject all other requested passengers
            ride.passengers.forEach(p => {
                if (p.user?.toString() !== passengerId && p.status === 'REQUESTED') {
                    p.status = 'REJECTED';
                }
            });
            // Keep ride status as PENDING - driver will start it with START RIDE button
        } else {
            passenger.status = 'REJECTED';
        }

        await ride.save();
        const updated = await Ride.findById(ride._id)
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error responding to request', error: error.message });
    }
});

// Generate OTP for ride completion
router.post('/:id/generate-otp', async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        ride.otp = otp;
        await ride.save();

        res.json({ message: 'OTP generated', otp });
    } catch (error) {
        res.status(500).json({ message: 'Error generating OTP', error: error.message });
    }
});

// Verify OTP and mark ride as completed

// Start ride (driver begins journey to passenger)
router.post('/:id/start', auth, async (req, res) => {
    try {
        const { driverLatitude, driverLongitude } = req.body;
        if (!driverLatitude || !driverLongitude) {
            return res.status(400).json({ message: 'Driver location required' });
        }

        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        if (ride.driver.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only the ride driver can start this ride' });
        }

        // Get accepted passenger
        const acceptedPassenger = ride.passengers.find(p => p.status === 'ACCEPTED');
        if (!acceptedPassenger) {
            return res.status(400).json({ message: 'No accepted passenger for this ride' });
        }

        // Parse pickup location (expecting "latitude, longitude" format)
        const pickupParts = acceptedPassenger.pickupLocation?.split(',');
        if (!pickupParts || pickupParts.length < 2) {
            return res.status(400).json({ message: 'Invalid passenger pickup location' });
        }

        const passengerLat = parseFloat(pickupParts[0]);
        const passengerLng = parseFloat(pickupParts[1]);

        // Calculate ETA using OSRM
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${driverLongitude},${driverLatitude};${passengerLng},${passengerLat}?overview=false`;
        const osrmResponse = await fetch(osrmUrl);
        const osrmData = await osrmResponse.json();

        let eta = 0;
        if (osrmData.routes && osrmData.routes[0]) {
            eta = Math.round(osrmData.routes[0].duration); // in seconds
        }

        // Update ride
        ride.status = 'STARTED';
        ride.startTime = new Date();
        ride.driverLocation = {
            latitude: driverLatitude,
            longitude: driverLongitude
        };

        // Update passenger ETA
        acceptedPassenger.eta = eta;
        await ride.save();

        const updated = await Ride.findById(ride._id)
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');
        
        res.json({
            ...updated.toObject(),
            eta: eta,
            etaMinutes: Math.ceil(eta / 60)
        });
    } catch (error) {
        console.error('Error starting ride:', error);
        res.status(500).json({ message: 'Error starting ride', error: error.message });
    }
});

// Mark driver as arrived at passenger location
router.post('/:id/arrived', auth, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id)
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');
        
        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        // Verify driver is the one who posted the ride
        if (ride.driver._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only the ride driver can mark arrival' });
        }

        // Find the accepted passenger
        const acceptedPassenger = ride.passengers.find(p => p.status === 'ACCEPTED');
        
        if (acceptedPassenger && acceptedPassenger.pickupLocation && ride.driverLocation) {
            try {
                // Parse passenger pickup location (coords or address)
                const pickupParts = acceptedPassenger.pickupLocation?.split(',');
                let passengerLat = null;
                let passengerLng = null;

                if (pickupParts && pickupParts.length >= 2) {
                    const parsedLat = parseFloat(pickupParts[0].trim());
                    const parsedLng = parseFloat(pickupParts[1].trim());
                    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                        passengerLat = parsedLat;
                        passengerLng = parsedLng;
                    }
                }

                if (passengerLat === null || passengerLng === null) {
                    const geo = await geocodeAddress(acceptedPassenger.pickupLocation);
                    if (geo) {
                        passengerLat = geo.lat;
                        passengerLng = geo.lng;
                    }
                }

                if (passengerLat !== null && passengerLng !== null) {
                    const driverLat = ride.driverLocation.latitude;
                    const driverLng = ride.driverLocation.longitude;

                    // Call OSRM to get the actual distance
                    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${passengerLng},${passengerLat}?overview=false`;
                    const osrmResponse = await fetch(osrmUrl);
                    const osrmData = await osrmResponse.json();

                    if (osrmData.routes && osrmData.routes.length > 0) {
                        const distance = Math.round(osrmData.routes[0].distance); // Distance in meters
                        acceptedPassenger.distanceToPickup = distance;
                    }
                }
            } catch (error) {
                console.error('Error calculating distance:', error);
                // Continue even if distance calculation fails
            }
        }

        // Update ride status
        ride.status = 'ARRIVED';
        ride.arrivalTime = new Date();
        await ride.save();

        res.json({
            message: 'Arrival confirmed. Passenger has been notified.',
            ride: ride,
            distanceKm: acceptedPassenger?.distanceToPickup ? (acceptedPassenger.distanceToPickup / 1000).toFixed(2) : null
        });
    } catch (error) {
        console.error('Error marking arrival:', error);
        res.status(500).json({ message: 'Error marking arrival', error: error.message });
    }
});

// Start trip to destination (after passenger pickup)
router.post('/:id/start-trip', auth, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id)
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');

        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        if (ride.driver._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only the ride driver can start the trip' });
        }

        if (ride.status !== 'ARRIVED') {
            return res.status(400).json({ message: 'Ride must be ARRIVED before starting trip' });
        }

        const acceptedPassenger = ride.passengers.find(p => p.status === 'ACCEPTED');
        if (!acceptedPassenger || !acceptedPassenger.pickupLocation) {
            return res.status(400).json({ message: 'No accepted passenger pickup location' });
        }

        // Determine pickup coords (coords or address)
        const pickupParts = acceptedPassenger.pickupLocation.split(',');
        let pickupLat = null;
        let pickupLng = null;
        if (pickupParts && pickupParts.length >= 2) {
            const parsedLat = parseFloat(pickupParts[0].trim());
            const parsedLng = parseFloat(pickupParts[1].trim());
            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                pickupLat = parsedLat;
                pickupLng = parsedLng;
            }
        }

        if (pickupLat === null || pickupLng === null) {
            const geo = await geocodeAddress(acceptedPassenger.pickupLocation);
            if (!geo) {
                return res.status(400).json({ message: 'Invalid passenger pickup location' });
            }
            pickupLat = geo.lat;
            pickupLng = geo.lng;
        }

        let destLat = ride.toCoord?.lat;
        let destLng = ride.toCoord?.lng;

        if (typeof destLat !== 'number' || typeof destLng !== 'number') {
            // Fallback: geocode destination address
            const geo = await geocodeAddress(ride.to);
            if (!geo) {
                return res.status(400).json({ message: 'Unable to geocode destination address' });
            }
            destLat = geo.lat;
            destLng = geo.lng;
        }

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${destLng},${destLat}?overview=false`;
        const osrmResponse = await fetch(osrmUrl);
        const osrmData = await osrmResponse.json();

        if (!osrmData.routes || !osrmData.routes[0]) {
            return res.status(400).json({ message: 'Unable to calculate trip distance' });
        }

        ride.tripDistance = Math.round(osrmData.routes[0].distance);
        ride.tripDuration = Math.round(osrmData.routes[0].duration);
        ride.tripStartTime = new Date();
        ride.status = 'IN_PROGRESS';
        await ride.save();

        res.json({
            message: 'Trip started to destination',
            ride,
            tripDistanceKm: (ride.tripDistance / 1000).toFixed(2),
            tripDurationMinutes: Math.ceil(ride.tripDuration / 60)
        });
    } catch (error) {
        console.error('Error starting trip:', error);
        res.status(500).json({ message: 'Error starting trip', error: error.message });
    }
});

// Complete trip to destination
router.post('/:id/complete', auth, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id)
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');

        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        if (ride.driver._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Only the ride driver can complete the trip' });
        }

        if (ride.status !== 'IN_PROGRESS') {
            return res.status(400).json({ message: 'Ride must be IN_PROGRESS to complete' });
        }

        // Calculate price: Min 25 rupees, 5 rupees per km
        const tripDistanceKm = ride.tripDistance ? ride.tripDistance / 1000 : 0;
        const price = Math.max(25, Math.ceil(tripDistanceKm * 5));

        ride.status = 'COMPLETED';
        ride.tripEndTime = new Date();
        ride.price = price;
        await ride.save();

        const updated = await Ride.findById(ride._id)
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');

        res.json({
            message: 'Ride completed at destination',
            ride: updated,
            tripDistanceKm: ride.tripDistance ? (ride.tripDistance / 1000).toFixed(2) : null,
            price: price
        });
    } catch (error) {
        console.error('Error completing trip:', error);
        res.status(500).json({ message: 'Error completing trip', error: error.message });
    }
});

// Cancel trip (passenger cancels their accepted ride)
router.post('/:id/cancel-passenger', auth, async (req, res) => {
    try {
        const { reason, passengerId } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: 'Cancellation reason is required' });
        }

        const ride = await Ride.findById(req.params.id)
            .populate('driver', 'name email')
            .populate('passengers.user', 'name email');

        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        if (['COMPLETED', 'CANCELLED'].includes(ride.status)) {
            return res.status(400).json({ message: 'Cannot cancel a completed or already cancelled ride' });
        }

        const passengerEntry = ride.passengers.find(p => {
            const pid = p.user?._id?.toString() || p.user?.toString();
            return pid === passengerId || pid === req.user.id;
        });

        if (!passengerEntry) {
            return res.status(404).json({ message: 'You are not a passenger on this ride' });
        }

        if (passengerEntry.status !== 'ACCEPTED') {
            return res.status(400).json({ message: 'Only accepted rides can be cancelled' });
        }

        // Mark passenger as cancelled
        passengerEntry.status = 'CANCELLED';
        passengerEntry.cancelReason = reason;

        // Reset ride status back to PENDING so driver can accept new passengers
        ride.status = 'PENDING';
        await ride.save();

        res.json({ message: 'Trip cancelled successfully. Driver has been notified.', ride });
    } catch (error) {
        console.error('Error cancelling trip:', error);
        res.status(500).json({ message: 'Error cancelling trip', error: error.message });
    }
});

const Report = require('../models/Report');

// Report driver (passenger reports an issue)
router.post('/:id/report-driver', auth, async (req, res) => {
    try {
        const { driverId, reason, description } = req.body;
        if (!reason || !description?.trim()) {
            return res.status(400).json({ message: 'Reason and description are required' });
        }

        const ride = await Ride.findById(req.params.id);
        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        // Store report on the ride (for backward compat)
        if (!ride.reports) ride.reports = [];
        ride.reports.push({
            reportedBy: req.user.id,
            driverId,
            reason,
            description,
            createdAt: new Date()
        });
        await ride.save();

        // Also create a standalone Report document for admin review
        const report = new Report({
            ride: ride._id,
            reportedBy: req.user.id,
            driver: driverId || ride.driver,
            reason,
            description
        });
        await report.save();

        res.json({ message: 'Report submitted successfully. Admin will review it.' });
    } catch (error) {
        console.error('Error reporting driver:', error);
        res.status(500).json({ message: 'Error submitting report', error: error.message });
    }
});

router.post('/:id/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ message: 'OTP required' });

        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        if (ride.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        ride.status = 'COMPLETED';
        ride.otp = null;
        await ride.save();

        const updated = await ride.populate('driver', 'name email').populate('passengers.user', 'name email');
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error verifying OTP', error: error.message });
    }
});

module.exports = router;

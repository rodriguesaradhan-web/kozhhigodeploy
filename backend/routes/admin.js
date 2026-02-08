const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const User = require('../models/User');
const StudentRegistration = require('../models/StudentRegistration');
const DriverApplication = require('../models/DriverApplication');
const Report = require('../models/Report');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Protect all admin routes
router.use(auth);

// Require admin role
router.use((req, res, next) => {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden: Admins only' });
    next();
});

// Get basic stats
router.get('/stats', async (req, res) => {
    try {
        const users = await User.countDocuments();
        const drivers = await User.countDocuments({ role: 'driver' });
        const passengers = await User.countDocuments({ role: 'passenger' });
        const rides = await Ride.countDocuments();
        const active = await Ride.countDocuments({ status: { $in: ['PENDING', 'IN_PROGRESS'] } });
        res.json({ users, drivers, passengers, rides, active });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

// List all rides
router.get('/rides', async (req, res) => {
    try {
        const rides = await Ride.find().populate('driver', 'name email').populate('passengers.user', 'name email');
        res.json(rides);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching rides' });
    }
});

// Delete a ride
router.delete('/rides/:id', async (req, res) => {
    try {
        const ride = await Ride.findByIdAndDelete(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });
        res.json({ message: 'Ride deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting ride' });
    }
});

// Get pending student registrations
router.get('/registrations', async (req, res) => {
    try {
        const registrations = await StudentRegistration.find({ status: 'PENDING' })
            .select('-password')
            .sort({ createdAt: -1 });
        res.json(registrations);
    } catch (err) {
        console.error('Error fetching registrations:', err);
        res.status(500).json({ message: 'Error fetching registrations' });
    }
});

// Get registration by ID
router.get('/registrations/:id', async (req, res) => {
    try {
        const registration = await StudentRegistration.findById(req.params.id).select('-password');
        if (!registration) return res.status(404).json({ message: 'Registration not found' });
        res.json(registration);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching registration' });
    }
});

// Approve student registration - creates User account
router.put('/registrations/:id/approve', async (req, res) => {
    try {
        const registration = await StudentRegistration.findById(req.params.id);
        if (!registration) return res.status(404).json({ message: 'Registration not found' });
        if (registration.status !== 'PENDING') {
            return res.status(400).json({ message: 'Registration is not pending' });
        }

        // Check if user already exists with this email
        const existingUser = await User.findOne({ email: registration.email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Create User account (default to passenger role)
        const newUser = new User({
            name: registration.name,
            email: registration.email,
            password: registration.password, // Already hashed in StudentRegistration
            role: 'passenger' // Default role after approval
        });

        await newUser.save();

        // Update registration status
        registration.status = 'APPROVED';
        registration.approvedBy = req.user._id; // Admin who approved
        await registration.save();

        res.json({
            message: 'Student approved successfully',
            userId: newUser._id,
            userEmail: newUser.email
        });
    } catch (err) {
        console.error('Error approving registration:', err);
        res.status(500).json({ message: 'Error approving registration', error: err.message });
    }
});

// Reject student registration
router.put('/registrations/:id/reject', async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        
        if (!rejectionReason) {
            return res.status(400).json({ message: 'Rejection reason is required' });
        }

        const registration = await StudentRegistration.findById(req.params.id);
        if (!registration) return res.status(404).json({ message: 'Registration not found' });
        if (registration.status !== 'PENDING') {
            return res.status(400).json({ message: 'Registration is not pending' });
        }

        registration.status = 'REJECTED';
        registration.rejectionReason = rejectionReason;
        registration.approvedBy = req.user._id; // Admin who rejected
        await registration.save();

        res.json({
            message: 'Student registration rejected',
            rejectionReason: rejectionReason
        });
    } catch (err) {
        console.error('Error rejecting registration:', err);
        res.status(500).json({ message: 'Error rejecting registration', error: err.message });
    }
});

// Get pending driver applications
router.get('/driver-applications', async (req, res) => {
    try {
        const applications = await DriverApplication.find({ status: 'PENDING' })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        res.json(applications);
    } catch (err) {
        console.error('Error fetching driver applications:', err);
        res.status(500).json({ message: 'Error fetching driver applications' });
    }
});

// Approve driver application - upgrades user role to driver
router.put('/driver-applications/:id/approve', async (req, res) => {
    try {
        const application = await DriverApplication.findById(req.params.id).populate('user');
        if (!application) return res.status(404).json({ message: 'Application not found' });
        if (application.status !== 'PENDING') {
            return res.status(400).json({ message: 'Application is not pending' });
        }

        const user = await User.findById(application.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Upgrade user role to driver
        user.role = 'driver';
        await user.save();

        // Update application status
        application.status = 'APPROVED';
        application.approvedBy = req.user._id; // Admin who approved
        await application.save();

        res.json({
            message: 'Driver application approved successfully',
            userId: user._id,
            userEmail: user.email
        });
    } catch (err) {
        console.error('Error approving driver application:', err);
        res.status(500).json({ message: 'Error approving application', error: err.message });
    }
});

// Reject driver application
router.put('/driver-applications/:id/reject', async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        
        if (!rejectionReason) {
            return res.status(400).json({ message: 'Rejection reason is required' });
        }

        const application = await DriverApplication.findById(req.params.id);
        if (!application) return res.status(404).json({ message: 'Application not found' });
        if (application.status !== 'PENDING') {
            return res.status(400).json({ message: 'Application is not pending' });
        }

        application.status = 'REJECTED';
        application.rejectionReason = rejectionReason;
        application.approvedBy = req.user._id; // Admin who rejected
        await application.save();

        res.json({
            message: 'Driver application rejected',
            rejectionReason: rejectionReason
        });
    } catch (err) {
        console.error('Error rejecting driver application:', err);
        res.status(500).json({ message: 'Error rejecting application', error: err.message });
    }
});

// ===== DRIVER REPORTS =====

// Get all reports (pending first, then reviewed)
router.get('/reports', async (req, res) => {
    try {
        const reports = await Report.find()
            .populate('reportedBy', 'name email')
            .populate('driver', 'name email warnings')
            .populate('ride', 'from to date status')
            .populate('reviewedBy', 'name')
            .sort({ status: 1, createdAt: -1 });
        res.json(reports);
    } catch (err) {
        console.error('Error fetching reports:', err);
        res.status(500).json({ message: 'Error fetching reports' });
    }
});

// Issue warning to driver
router.put('/reports/:id/warn', async (req, res) => {
    try {
        const { adminNote } = req.body;
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found' });
        if (report.status !== 'PENDING') {
            return res.status(400).json({ message: 'Report has already been reviewed' });
        }

        // Update report status
        report.status = 'WARNING_ISSUED';
        report.adminNote = adminNote || 'Warning issued by admin';
        report.reviewedBy = req.user._id;
        report.reviewedAt = new Date();
        await report.save();

        // Add warning to driver's user record
        const driver = await User.findById(report.driver);
        if (driver) {
            if (!driver.warnings) driver.warnings = [];
            driver.warnings.push({
                reason: `${report.reason}: ${report.description}`,
                reportId: report._id,
                issuedBy: req.user._id,
                issuedAt: new Date()
            });
            await driver.save();
        }

        const warningCount = driver?.warnings?.length || 0;
        res.json({ 
            message: `Warning issued to driver. They now have ${warningCount} warning(s).`,
            warningCount
        });
    } catch (err) {
        console.error('Error issuing warning:', err);
        res.status(500).json({ message: 'Error issuing warning', error: err.message });
    }
});

// Delete driver account (ban)
router.put('/reports/:id/delete-account', async (req, res) => {
    try {
        const { adminNote } = req.body;
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found' });
        if (report.status !== 'PENDING') {
            return res.status(400).json({ message: 'Report has already been reviewed' });
        }

        // Update report status
        report.status = 'ACCOUNT_DELETED';
        report.adminNote = adminNote || 'Account deleted by admin';
        report.reviewedBy = req.user._id;
        report.reviewedAt = new Date();
        await report.save();

        // Soft-delete the driver's account
        const driver = await User.findById(report.driver);
        if (driver) {
            driver.isDeleted = true;
            driver.deletedAt = new Date();
            driver.deletedReason = `Report: ${report.reason} - ${adminNote || report.description}`;
            await driver.save();

            // Cancel all active rides for this driver
            await Ride.updateMany(
                { driver: driver._id, status: { $in: ['PENDING', 'STARTED', 'ARRIVED', 'IN_PROGRESS'] } },
                { status: 'CANCELLED' }
            );
        }

        res.json({ message: 'Driver account has been deleted and all active rides cancelled.' });
    } catch (err) {
        console.error('Error deleting driver account:', err);
        res.status(500).json({ message: 'Error deleting account', error: err.message });
    }
});

// Dismiss report (no action needed)
router.put('/reports/:id/dismiss', async (req, res) => {
    try {
        const { adminNote } = req.body;
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Report not found' });
        if (report.status !== 'PENDING') {
            return res.status(400).json({ message: 'Report has already been reviewed' });
        }

        report.status = 'DISMISSED';
        report.adminNote = adminNote || 'Dismissed by admin';
        report.reviewedBy = req.user._id;
        report.reviewedAt = new Date();
        await report.save();

        res.json({ message: 'Report dismissed.' });
    } catch (err) {
        console.error('Error dismissing report:', err);
        res.status(500).json({ message: 'Error dismissing report', error: err.message });
    }
});

// Get driver details with warnings
router.get('/drivers/:id', async (req, res) => {
    try {
        const driver = await User.findById(req.params.id).select('-password');
        if (!driver) return res.status(404).json({ message: 'Driver not found' });

        const reportCount = await Report.countDocuments({ driver: driver._id });
        const pendingReports = await Report.countDocuments({ driver: driver._id, status: 'PENDING' });

        res.json({
            ...driver.toObject(),
            totalReports: reportCount,
            pendingReports
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching driver details' });
    }
});

module.exports = router;

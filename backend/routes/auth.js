const express = require('express');
const router = express.Router();
const User = require('../models/User');
const StudentRegistration = require('../models/StudentRegistration');
const DriverApplication = require('../models/DriverApplication');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, role });
        await newUser.save();

        const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token, user: { id: newUser._id, name, email, role } });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const emailTrim = email && email.toString().trim();
        const emailNorm = emailTrim && emailTrim.toLowerCase();
        // Direct admin shortcut: allow login with preset credentials without signup
        const ADMIN_EMAIL = 'admin@gmail.com';
        const ADMIN_PASSWORD = 'admin@123';
        if (emailNorm === ADMIN_EMAIL && password && password.toString().trim() === ADMIN_PASSWORD) {
            let adminUser = await User.findOne({ email: ADMIN_EMAIL });
            if (!adminUser) {
                const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
                adminUser = new User({ name: 'Admin', email: ADMIN_EMAIL, password: hashedPassword, role: 'admin' });
                await adminUser.save();
            }
            const token = jwt.sign({ id: adminUser._id, role: adminUser.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
            return res.json({ token, user: { id: adminUser._id, name: adminUser.name, email: adminUser.email, role: adminUser.role } });
        }
        const user = await User.findOne({ email: emailTrim });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        // Block deleted/suspended accounts
        if (user.isDeleted) {
            return res.status(403).json({ message: 'Your account has been suspended due to policy violations. Contact support for more information.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Student Registration (with file upload)
router.post('/register-student', async (req, res) => {
    try {
        const { name, sid, email, password } = req.body;
        
        // Validation
        if (!name || !sid || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Check if student ID or email already exists
        const existingSID = await StudentRegistration.findOne({ sid });
        if (existingSID) {
            return res.status(400).json({ message: 'Student ID already registered' });
        }

        const existingEmail = await StudentRegistration.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Check if file was uploaded
        if (!req.files || !req.files.studentIdImage) {
            return res.status(400).json({ message: 'Student ID image is required' });
        }

        const file = req.files.studentIdImage;
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({ message: 'Only image files are allowed' });
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: 'File size must be less than 5MB' });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../uploads/student-ids');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Save file
        const fileName = `${sid}-${Date.now()}-${file.name}`;
        const filePath = path.join(uploadsDir, fileName);
        await file.mv(filePath);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create StudentRegistration record (PENDING approval)
        const studentReg = new StudentRegistration({
            name,
            sid,
            email,
            password: hashedPassword,
            studentIdImagePath: `/uploads/student-ids/${fileName}`,
            status: 'PENDING'
        });

        await studentReg.save();

        res.status(201).json({
            message: 'Registration submitted successfully. Please wait for admin approval.',
            registrationId: studentReg._id
        });
    } catch (error) {
        console.error('Student registration error:', error);
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
});

// Apply to become a driver (requires authentication)
router.post('/apply-driver', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user is already a driver
        if (user.role === 'driver') {
            return res.status(400).json({ message: 'You are already a driver' });
        }

        // Check if application already exists
        const existingApplication = await DriverApplication.findOne({ user: userId });
        if (existingApplication) {
            return res.status(400).json({ 
                message: 'Application already submitted', 
                status: existingApplication.status 
            });
        }

        // Check if file was uploaded
        if (!req.files || !req.files.drivingLicense) {
            return res.status(400).json({ message: 'Driving license image is required' });
        }

        const file = req.files.drivingLicense;
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({ message: 'Only image files are allowed' });
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: 'File size must be less than 5MB' });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(__dirname, '../uploads/driver-licenses');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Save file
        const fileName = `${userId}-${Date.now()}-${file.name}`;
        const filePath = path.join(uploadsDir, fileName);
        await file.mv(filePath);

        // Create DriverApplication record (PENDING approval)
        const driverApp = new DriverApplication({
            user: userId,
            userName: user.name,
            userEmail: user.email,
            drivingLicenseImagePath: `/uploads/driver-licenses/${fileName}`,
            status: 'PENDING'
        });

        await driverApp.save();

        res.status(201).json({
            message: 'Driver application submitted successfully. Please wait for admin approval.',
            applicationId: driverApp._id
        });
    } catch (error) {
        console.error('Driver application error:', error);
        res.status(500).json({ message: 'Application failed', error: error.message });
    }
});

// Get current user's warnings
router.get('/my-warnings', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('warnings');
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Return warnings sorted newest first, with a seen/dismissed flag
        const warnings = (user.warnings || []).map(w => ({
            _id: w._id,
            reason: w.reason,
            reportId: w.reportId,
            issuedAt: w.issuedAt
        })).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));

        res.json({ warnings, count: warnings.length });
    } catch (err) {
        console.error('Error fetching warnings:', err);
        res.status(500).json({ message: 'Error fetching warnings' });
    }
});

module.exports = router;

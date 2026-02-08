const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET not configured');
            return res.status(500).json({ message: 'Server configuration error' });
        }
        const payload = jwt.verify(token, jwtSecret);
        req.user = { id: payload.id, role: payload.role };
        next();
    } catch (err) {
        console.error('Token verification error:', err.message);
        return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
    }
};

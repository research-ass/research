const jwt = require('jsonwebtoken');
require('dotenv').config();

function verifyToken(req, res, next) {
const token = req.header('Authorization')?.replace('Bearer ', '');

if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
}

try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
} catch (error) {
    res.status(401).json({ error: 'Invalid token' });
}
}

module.exports = verifyToken;


const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Expects "Authorization: Bearer <token>" and sets req.userId
function requireAuth(req, res, next) {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Please log in' });
    }
    try {
        req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
        next();
    } catch {
        res.status(401).json({ error: 'Session expired, please log in again' });
    }
}

// Reads the role from the database, not the token, so it can never be stale or forged
const isAdmin = async (userId) => Boolean(await User.exists({ _id: userId, role: 'admin' }));

// Use after requireAuth
async function requireAdmin(req, res, next) {
    if (!(await isAdmin(req.userId))) return res.status(403).json({ error: 'Admins only' });
    next();
}

module.exports = requireAuth;
module.exports.isAdmin = isAdmin;
module.exports.requireAdmin = requireAdmin;

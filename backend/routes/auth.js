const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const MIN_PASSWORD = 6;
const signToken = (user) => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
    }
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: signToken(user), user });
});

router.post('/login', async (req, res) => {
    // String() stops query-operator injection like { "email": { "$gt": "" } }
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(String(req.body.password ?? ''), user.password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user });
});

module.exports = router;
module.exports.MIN_PASSWORD = MIN_PASSWORD;

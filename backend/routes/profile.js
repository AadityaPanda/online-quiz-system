const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { MIN_PASSWORD } = require('./auth');

router.get('/profile', async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

// Body: { name?, email?, currentPassword?, newPassword? }
router.put('/profile', async (req, res) => {
    const user = await User.findById(req.userId).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, email, currentPassword, newPassword } = req.body;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;

    if (newPassword) {
        if (!(await bcrypt.compare(String(currentPassword ?? ''), user.password))) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        if (String(newPassword).length < MIN_PASSWORD) {
            return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
        }
        user.password = await bcrypt.hash(String(newPassword), 10);
    }

    await user.save();
    res.json(user);
});

module.exports = router;

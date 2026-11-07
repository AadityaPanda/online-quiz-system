const router = require('express').Router();
const User = require('../models/User');
const { requireAdmin } = require('../middleware/auth');

router.get('/users', requireAdmin, async (req, res) => {
    res.json(await User.find().sort({ createdAt: -1 }));
});

module.exports = router;

// Creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env. Run: npm run seed
// Safe to re-run. An existing account with that email is promoted and keeps its password.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const { MIN_PASSWORD } = require('./routes/auth');

async function seedAdmin({ name = 'Admin', email, password }) {
    if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env');
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
        existing.role = 'admin';
        return existing.save();
    }
    if (password.length < MIN_PASSWORD) throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD} characters`);
    return User.create({ name, email, password: await bcrypt.hash(password, 10), role: 'admin' });
}

module.exports = seedAdmin;

if (require.main === module) {
    connectDB(process.env.MONGO_URI)
        .then(() => seedAdmin({ name: process.env.ADMIN_NAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }))
        .then((admin) => console.log(`Admin ready: ${admin.email}`))
        .catch((err) => {
            console.error(err.message);
            process.exitCode = 1;
        })
        .finally(() => mongoose.disconnect());
}

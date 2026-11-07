const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');

async function connectDB(uri) {
    await mongoose.connect(uri);
    // Wait for the unique indexes, so duplicates get a 409 even on a brand new database
    await Promise.all([User.init(), Category.init()]);
}

module.exports = connectDB;

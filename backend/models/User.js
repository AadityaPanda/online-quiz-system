const { Schema, model } = require('mongoose');

const userSchema = new Schema({
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 60 },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email is invalid'],
    },
    password: { type: String, required: true, select: false }, // bcrypt hash, never returned by default
    role: { type: String, enum: ['user', 'admin'], default: 'user' }, // only seed.js ever sets admin
}, { timestamps: true });

userSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
    },
});

module.exports = model('User', userSchema);

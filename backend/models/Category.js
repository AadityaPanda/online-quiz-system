const { Schema, model } = require('mongoose');

const categorySchema = new Schema({
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });

// Case-insensitive, so "Science" and "science" can't both exist
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = model('Category', categorySchema);

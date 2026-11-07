const { Schema, model } = require('mongoose');
const Category = require('./Category');

const questionSchema = new Schema({
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: [true, 'Category is required'],
        index: true,
        validate: { validator: async (id) => Boolean(await Category.exists({ _id: id })), message: 'Unknown category' },
    },
    text: { type: String, required: [true, 'Question text is required'], trim: true, maxlength: 500 },
    choices: {
        type: [{ type: String, trim: true, maxlength: 200 }],
        validate: {
            validator: (v) => v.length >= 2 && v.length <= 6 && v.every(Boolean) && new Set(v).size === v.length,
            message: 'A question needs 2 to 6 different choices',
        },
    },
    // Never returned by default: only admins ask for it with .select('+correctIndex')
    correctIndex: {
        type: Number,
        required: [true, 'Choose the correct answer'],
        min: [0, 'Choose the correct answer'],
        validate: { validator: Number.isInteger, message: 'Choose the correct answer' },
        select: false,
    },
}, { timestamps: true });

// A hook because an update may change only the choices, and unmodified paths skip their validators
questionSchema.pre('validate', function checkCorrectIndex() {
    if (this.correctIndex >= this.choices.length) this.invalidate('correctIndex', 'Choose the correct answer');
});

module.exports = model('Question', questionSchema);

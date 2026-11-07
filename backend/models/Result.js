const { Schema, model } = require('mongoose');

// One document per attempt, created by /quiz/start and graded by /quiz/submit.
// The questions are copied in so editing or deleting a question later never changes an attempt.
// shortcut: abandoned attempts (submittedAt null) stay forever, add a TTL index if they pile up.
const resultSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    categoryName: { type: String, required: true },
    questions: [{
        _id: false,
        question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
        text: { type: String, required: true },
        choices: [String],
        selected: { type: Number, default: null },
        correct: { type: Boolean, default: false },
    }],
    answerKey: { type: [Number], select: false }, // correct choice per question, never sent to anyone
    score: { type: Number, default: 0 },
    total: { type: Number, required: true },
    submittedAt: { type: Date, default: null },
}, { timestamps: true });

resultSchema.index({ user: 1, submittedAt: -1 });

module.exports = model('Result', resultSchema);

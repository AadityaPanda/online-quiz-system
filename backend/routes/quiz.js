const router = require('express').Router();
const Category = require('../models/Category');
const Question = require('../models/Question');
const Result = require('../models/Result');
const { isAdmin } = require('../middleware/auth');

const QUIZ_SIZE = 10;
const LEADERBOARD_SIZE = 20;

// Body: { category }. Picks random questions and opens an attempt; no answers leave the server.
router.post('/quiz/start', async (req, res) => {
    const category = await Category.findById(String(req.body.category ?? ''));
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const picked = await Question.aggregate([{ $match: { category: category._id } }, { $sample: { size: QUIZ_SIZE } }]);
    if (!picked.length) return res.status(400).json({ error: 'This category has no questions yet' });

    const result = await Result.create({
        user: req.userId,
        category: category._id,
        categoryName: category.name,
        questions: picked.map((q) => ({ question: q._id, text: q.text, choices: q.choices })),
        answerKey: picked.map((q) => q.correctIndex),
        total: picked.length,
    });
    res.status(201).json({
        resultId: result.id,
        categoryName: category.name,
        questions: picked.map((q) => ({ _id: q._id, text: q.text, choices: q.choices })),
    });
});

// Body: { resultId, answers: [{ question, selected }] }. Graded only against the stored answer key.
router.post('/quiz/submit', async (req, res) => {
    const { resultId, answers } = req.body;
    if (!Array.isArray(answers)) return res.status(400).json({ error: 'Answers are required' });

    // String() stops query-operator injection; the user check stops submitting someone else's attempt
    const attempt = await Result.findOne({ _id: String(resultId ?? ''), user: req.userId }).select('+answerKey');
    if (!attempt) return res.status(404).json({ error: 'Quiz attempt not found' });

    const picks = new Map(answers.map((a) => [String(a?.question), a?.selected]));
    const questions = attempt.toObject().questions.map((q, i) => {
        const pick = picks.get(String(q.question));
        const selected = Number.isInteger(pick) && pick >= 0 && pick < q.choices.length ? pick : null;
        return { ...q, selected, correct: selected === attempt.answerKey[i] };
    });

    // The submittedAt check in the filter makes a double submit lose the race, not grade twice
    const result = await Result.findOneAndUpdate(
        { _id: attempt._id, submittedAt: null },
        { questions, score: questions.filter((q) => q.correct).length, submittedAt: new Date() },
        { returnDocument: 'after' },
    );
    if (!result) return res.status(409).json({ error: 'This quiz was already submitted' });
    res.json(result);
});

// Own history, or everyone's for admins. Open attempts are left out.
router.get('/results', async (req, res) => {
    const admin = await isAdmin(req.userId);
    const query = Result.find({ submittedAt: { $ne: null }, ...(!admin && { user: req.userId }) }).sort({ submittedAt: -1 });
    if (admin) query.populate('user', 'name email');
    res.json(await query);
});

// Most correct answers overall; on a tie, the player who needed fewer questions ranks higher
router.get('/leaderboard', async (req, res) => {
    res.json(await Result.aggregate([
        { $match: { submittedAt: { $ne: null } } },
        { $group: { _id: '$user', score: { $sum: '$score' }, total: { $sum: '$total' }, quizzes: { $sum: 1 } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $sort: { score: -1, total: 1, 'user.name': 1 } },
        { $limit: LEADERBOARD_SIZE },
        { $project: { _id: 0, name: '$user.name', score: 1, total: 1, quizzes: 1 } },
    ]));
});

module.exports = router;

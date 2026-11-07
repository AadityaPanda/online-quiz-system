const router = require('express').Router();
const Question = require('../models/Question');
const { isAdmin, requireAdmin } = require('../middleware/auth');

const FIELDS = ['category', 'text', 'choices', 'correctIndex'];
const pick = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

// Query: ?category=<id>. Only admins get correctIndex.
router.get('/questions', async (req, res) => {
    const filter = req.query.category ? { category: req.query.category } : {};
    const query = Question.find(filter).sort({ createdAt: -1 }).populate('category', 'name');
    if (await isAdmin(req.userId)) query.select('+correctIndex');
    res.json(await query);
});

router.post('/question', requireAdmin, async (req, res) => {
    const question = await Question.create(pick(req.body));
    res.status(201).json(await question.populate('category', 'name'));
});

router.put('/question/:id', requireAdmin, async (req, res) => {
    const question = await Question.findById(req.params.id).select('+correctIndex');
    if (!question) return res.status(404).json({ error: 'Question not found' });
    question.set(pick(req.body));
    await question.save(); // save(), not findByIdAndUpdate, so the correctIndex hook sees the whole question
    res.json(await question.populate('category', 'name'));
});

router.delete('/question/:id', requireAdmin, async (req, res) => {
    const question = await Question.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ message: 'Question deleted' });
});

module.exports = router;

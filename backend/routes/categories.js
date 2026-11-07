const router = require('express').Router();
const Category = require('../models/Category');
const Question = require('../models/Question');
const { requireAdmin } = require('../middleware/auth');

const FIELDS = ['name', 'description'];
const pick = (body) => Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

router.get('/categories', async (req, res) => {
    const [categories, counts] = await Promise.all([
        Category.find().sort({ name: 1 }).lean(),
        Question.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c.count]));
    res.json(categories.map((c) => ({ ...c, questionCount: countById.get(String(c._id)) ?? 0 })));
});

router.post('/category', requireAdmin, async (req, res) => {
    res.status(201).json(await Category.create(pick(req.body)));
});

router.put('/category/:id', requireAdmin, async (req, res) => {
    const category = await Category.findByIdAndUpdate(req.params.id, pick(req.body), { returnDocument: 'after', runValidators: true });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
});

router.delete('/category/:id', requireAdmin, async (req, res) => {
    // Refuse instead of cascading, so one click can't wipe a whole question bank
    if (await Question.exists({ category: req.params.id })) {
        return res.status(409).json({ error: 'Delete the questions in this category first' });
    }
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
});

module.exports = router;

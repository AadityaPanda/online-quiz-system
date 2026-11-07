// Integration tests against a real MongoDB.
// Run: npm test   (uses TEST_MONGO_URI or mongodb://127.0.0.1:27017/online_quiz_system_test)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.JWT_SECRET ||= 'test-secret';
const app = require('../server');
const connectDB = require('../config/db');
const seedAdmin = require('../seed');
const User = require('../models/User');
const Category = require('../models/Category');
const Question = require('../models/Question');
const Result = require('../models/Result');

let server, base, admin, alice, bob, science, history;

async function call(method, path, body, token) {
    const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

const leaksAnswers = (body) => /correctIndex|answerKey/.test(JSON.stringify(body));

// Answers every question using the admin's answer sheet; `right` of them correctly
async function play(token, categoryId, right) {
    const quiz = (await call('POST', '/quiz/start', { category: categoryId }, token)).body;
    const sheet = (await call('GET', `/questions?category=${categoryId}`, null, admin)).body;
    const answers = quiz.questions.map((q, i) => {
        const { correctIndex } = sheet.find((s) => s._id === q._id);
        return { question: q._id, selected: i < right ? correctIndex : (correctIndex + 1) % q.choices.length };
    });
    return { quiz, answers, submit: await call('POST', '/quiz/submit', { resultId: quiz.resultId, answers }, token) };
}

before(async () => {
    await connectDB(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/online_quiz_system_test');
    await Promise.all([User.deleteMany(), Category.deleteMany(), Question.deleteMany(), Result.deleteMany()]);
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
    server.close();
    await mongoose.disconnect();
});

test('register and login', async () => {
    let r = await call('POST', '/register', { name: 'Alice', email: 'Alice@Example.com', password: 'secret1' });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.email, 'alice@example.com');
    assert.equal(r.body.user.role, 'user');
    assert.equal(r.body.user.password, undefined);
    alice = r.body.token;

    assert.equal((await call('POST', '/register', { name: 'Alice 2', email: 'alice@example.com', password: 'secret1' })).status, 409);
    assert.equal((await call('POST', '/register', { name: 'Shorty', email: 's@example.com', password: '123' })).status, 400);
    assert.equal((await call('POST', '/register', { name: 'NoEmail', password: 'secret1' })).status, 400);

    assert.equal((await call('POST', '/login', { email: 'alice@example.com', password: 'wrong' })).status, 401);
    assert.equal((await call('POST', '/login', { email: { $gt: '' }, password: 'secret1' })).status, 401, 'operator injection must not log in');
    assert.equal((await call('POST', '/login', { email: 'ALICE@example.com', password: 'secret1' })).status, 200);

    bob = (await call('POST', '/register', { name: 'Bob', email: 'bob@example.com', password: 'secret2' })).body.token;
});

test('nobody can make themselves admin', async () => {
    const r = await call('POST', '/register', { name: 'Eve', email: 'eve@example.com', password: 'secret3', role: 'admin' });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, 'user', 'role in the register body is ignored');

    const p = await call('PUT', '/profile', { role: 'admin' }, r.body.token);
    assert.equal(p.status, 200);
    assert.equal(p.body.role, 'user', 'role in the profile body is ignored');
    assert.equal((await call('POST', '/category', { name: 'Hacked' }, r.body.token)).status, 403);
});

test('seed script creates the admin, and admin login works', async () => {
    await seedAdmin({ email: 'Admin@Example.com', password: 'adminpass' });
    await seedAdmin({ email: 'admin@example.com', password: 'ignored-on-rerun' });
    assert.equal(await User.countDocuments({ role: 'admin' }), 1, 're-running does not duplicate');

    const r = await call('POST', '/login', { email: 'admin@example.com', password: 'adminpass' });
    assert.equal(r.status, 200, 're-running keeps the password');
    assert.equal(r.body.user.role, 'admin');
    admin = r.body.token;

    await seedAdmin({ email: 'eve@example.com', password: 'whatever' });
    assert.equal((await User.findOne({ email: 'eve@example.com' })).role, 'admin', 'an existing account is promoted');
    await User.updateOne({ email: 'eve@example.com' }, { role: 'user' });

    await assert.rejects(seedAdmin({ email: 'x@example.com', password: '123' }), /at least/);
    await assert.rejects(seedAdmin({ email: '', password: '' }), /ADMIN_EMAIL/);
});

test('protected routes need a valid token', async () => {
    assert.equal((await call('GET', '/categories')).status, 401);
    assert.equal((await call('GET', '/categories', null, 'garbage')).status, 401);
    assert.equal((await call('GET', '/nope', null, alice)).status, 404);
});

test('admin-only endpoints refuse normal users', async () => {
    const id = new mongoose.Types.ObjectId();
    for (const [method, path] of [
        ['POST', '/category'], ['PUT', `/category/${id}`], ['DELETE', `/category/${id}`],
        ['POST', '/question'], ['PUT', `/question/${id}`], ['DELETE', `/question/${id}`],
        ['GET', '/users'],
    ]) {
        assert.equal((await call(method, path, method === 'GET' ? null : {}, alice)).status, 403, `${method} ${path}`);
    }
});

test('add, update, list and delete categories', async () => {
    let r = await call('POST', '/category', { name: 'Science', description: 'Atoms and stars' }, admin);
    assert.equal(r.status, 201);
    science = r.body._id;
    history = (await call('POST', '/category', { name: 'History' }, admin)).body._id;

    assert.equal((await call('POST', '/category', { name: 'science' }, admin)).status, 409, 'names are case-insensitive');
    assert.equal((await call('POST', '/category', {}, admin)).status, 400);

    r = await call('PUT', `/category/${history}`, { name: 'World History' }, admin);
    assert.equal(r.status, 200);
    assert.equal(r.body.name, 'World History');
    assert.equal((await call('PUT', `/category/${history}`, { name: 'Science' }, admin)).status, 409);
    assert.equal((await call('PUT', `/category/${history}`, { name: '' }, admin)).status, 400);
    assert.equal((await call('PUT', `/category/${new mongoose.Types.ObjectId()}`, { name: 'Ghost' }, admin)).status, 404);
    assert.equal((await call('PUT', '/category/not-an-id', { name: 'Ghost' }, admin)).status, 400);

    r = await call('GET', '/categories', null, alice);
    assert.deepEqual(r.body.map((c) => [c.name, c.questionCount]), [['Science', 0], ['World History', 0]]);

    const temp = (await call('POST', '/category', { name: 'Temp' }, admin)).body._id;
    assert.equal((await call('DELETE', `/category/${temp}`, null, admin)).status, 200);
    assert.equal((await call('DELETE', `/category/${temp}`, null, admin)).status, 404);
    assert.equal((await call('DELETE', '/category/not-an-id', null, admin)).status, 400);
});

test('add, update and delete questions with validation', async () => {
    const valid = { category: science, text: 'Q', choices: ['a', 'b'], correctIndex: 1 };
    for (const [why, patch] of [
        ['no text', { text: '' }],
        ['one choice', { choices: ['a'] }],
        ['seven choices', { choices: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }],
        ['blank choice', { choices: ['a', ' '] }],
        ['repeated choice', { choices: ['a', 'a'] }],
        ['no answer', { correctIndex: undefined }],
        ['answer out of range', { correctIndex: 2 }],
        ['negative answer', { correctIndex: -1 }],
        ['fractional answer', { correctIndex: 0.5 }],
        ['unknown category', { category: new mongoose.Types.ObjectId() }],
        ['bad category id', { category: 'nope' }],
    ]) {
        assert.equal((await call('POST', '/question', { ...valid, ...patch }, admin)).status, 400, why);
    }

    let r = await call('POST', '/question', { ...valid, text: 'Edit me' }, admin);
    assert.equal(r.status, 201);
    assert.equal(r.body.category.name, 'Science');
    const id = r.body._id;

    r = await call('PUT', `/question/${id}`, { text: 'Edited', choices: ['x', 'y', 'z'], correctIndex: 2 }, admin);
    assert.equal(r.status, 200);
    assert.equal(r.body.text, 'Edited');
    assert.equal(r.body.correctIndex, 2);
    assert.equal((await call('PUT', `/question/${id}`, { choices: ['x', 'y'] }, admin)).status, 400, 'choices cannot shrink below the stored answer');
    assert.equal((await call('PUT', `/question/${id}`, { correctIndex: 9 }, admin)).status, 400);
    assert.equal((await call('PUT', `/question/${new mongoose.Types.ObjectId()}`, { text: 'x' }, admin)).status, 404);

    assert.equal((await call('DELETE', `/question/${id}`, null, admin)).status, 200);
    assert.equal((await call('DELETE', `/question/${id}`, null, admin)).status, 404);
    assert.equal((await call('DELETE', '/question/not-an-id', null, admin)).status, 400);

    for (let i = 0; i < 12; i += 1) {
        await call('POST', '/question', { category: science, text: `Science ${i}`, choices: ['w', 'x', 'y', 'z'], correctIndex: i % 4 }, admin);
    }
    await call('POST', '/question', { category: history, text: 'Year?', choices: ['1066', '1492'], correctIndex: 0 }, admin);
});

test('only admins see answers in GET /questions', async () => {
    let r = await call('GET', `/questions?category=${history}`, null, alice);
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 1);
    assert.deepEqual(r.body[0].choices, ['1066', '1492']);
    assert.ok(!leaksAnswers(r.body));

    r = await call('GET', '/questions', null, admin);
    assert.equal(r.body.length, 13);
    assert.ok(r.body.every((q) => Number.isInteger(q.correctIndex)));
    assert.equal((await call('GET', '/questions?category=nope', null, alice)).status, 400);
});

test('category with questions cannot be deleted, and counts are right', async () => {
    assert.equal((await call('DELETE', `/category/${history}`, null, admin)).status, 409);
    const { body } = await call('GET', '/categories', null, alice);
    assert.deepEqual(body.map((c) => c.questionCount), [12, 1]);
});

test('quiz start returns random questions without answers', async () => {
    let r = await call('POST', '/quiz/start', { category: science }, alice);
    assert.equal(r.status, 201);
    assert.equal(r.body.questions.length, 10, 'capped at the quiz size');
    assert.equal(new Set(r.body.questions.map((q) => q._id)).size, 10, 'no repeats');
    assert.ok(!leaksAnswers(r.body));

    assert.equal((await call('POST', '/quiz/start', { category: new mongoose.Types.ObjectId() }, alice)).status, 404);
    assert.equal((await call('POST', '/quiz/start', { category: 'nope' }, alice)).status, 400);
    assert.equal((await call('POST', '/quiz/start', {}, alice)).status, 400);
    assert.equal((await call('POST', '/quiz/start', { category: { $ne: null } }, alice)).status, 400);

    const empty = (await call('POST', '/category', { name: 'Empty' }, admin)).body._id;
    assert.equal((await call('POST', '/quiz/start', { category: empty }, alice)).status, 400);
    await call('DELETE', `/category/${empty}`, null, admin);
});

test('quiz is graded on the server, and only once', async () => {
    const { quiz, answers, submit } = await play(alice, science, 7);
    assert.equal(submit.status, 200);
    assert.equal(submit.body.score, 7);
    assert.equal(submit.body.total, 10);
    assert.equal(submit.body.questions.filter((q) => q.correct).length, 7);
    assert.ok(!leaksAnswers(submit.body));

    const again = await call('POST', '/quiz/submit', { resultId: quiz.resultId, answers }, alice);
    assert.equal(again.status, 409, 'cannot resubmit');
});

test('client cannot forge a score or a correct flag', async () => {
    const quiz = (await call('POST', '/quiz/start', { category: history }, bob)).body;
    const r = await call('POST', '/quiz/submit', {
        resultId: quiz.resultId,
        score: 999,
        total: 1,
        submittedAt: '2000-01-01',
        answers: [{ question: quiz.questions[0]._id, selected: 1, correct: true }], // 1 is the wrong choice
    }, bob);
    assert.equal(r.status, 200);
    assert.equal(r.body.score, 0);
    assert.equal(r.body.questions[0].correct, false);
    assert.equal(r.body.questions[0].selected, 1);
});

test('bad answers count as unanswered, never as correct', async () => {
    for (const selected of [99, -1, '0', 0.5, null, { $gt: 0 }]) {
        const quiz = (await call('POST', '/quiz/start', { category: history }, bob)).body;
        const r = await call('POST', '/quiz/submit', { resultId: quiz.resultId, answers: [{ question: quiz.questions[0]._id, selected }] }, bob);
        assert.equal(r.status, 200, JSON.stringify(selected));
        assert.equal(r.body.score, 0, JSON.stringify(selected));
        assert.equal(r.body.questions[0].selected, null, JSON.stringify(selected));
    }

    const quiz = (await call('POST', '/quiz/start', { category: history }, bob)).body;
    const none = await call('POST', '/quiz/submit', { resultId: quiz.resultId, answers: [null, 'junk', { question: new mongoose.Types.ObjectId() }] }, bob);
    assert.equal(none.status, 200, 'junk entries are ignored');
    assert.equal(none.body.score, 0);
});

test('submit is scoped to the attempt owner and validates input', async () => {
    const quiz = (await call('POST', '/quiz/start', { category: history }, alice)).body;
    const body = { resultId: quiz.resultId, answers: [] };
    assert.equal((await call('POST', '/quiz/submit', body, bob)).status, 404, 'not your attempt');
    assert.equal((await call('POST', '/quiz/submit', { resultId: quiz.resultId }, alice)).status, 400);
    assert.equal((await call('POST', '/quiz/submit', { ...body, resultId: 'nope' }, alice)).status, 400);
    assert.equal((await call('POST', '/quiz/submit', { ...body, resultId: { $ne: null } }, alice)).status, 400);
    assert.equal((await call('POST', '/quiz/submit', { ...body, resultId: new mongoose.Types.ObjectId() }, alice)).status, 404);
});

test('editing or deleting a question mid-quiz does not change the attempt', async () => {
    const added = (await call('POST', '/question', { category: history, text: 'Temp', choices: ['p', 'q'], correctIndex: 0 }, admin)).body;
    const sheet = (await call('GET', `/questions?category=${history}`, null, admin)).body;
    const quiz = (await call('POST', '/quiz/start', { category: history }, bob)).body;
    const answers = quiz.questions.map((q) => ({ question: q._id, selected: sheet.find((s) => s._id === q._id).correctIndex }));

    await call('PUT', `/question/${sheet.find((s) => s.text === 'Year?')._id}`, { correctIndex: 1 }, admin);
    await call('DELETE', `/question/${added._id}`, null, admin);

    const r = await call('POST', '/quiz/submit', { resultId: quiz.resultId, answers }, bob);
    assert.equal(r.body.score, 2);
    assert.equal(r.body.total, 2);
    await call('PUT', `/question/${sheet.find((s) => s.text === 'Year?')._id}`, { correctIndex: 0 }, admin);
});

test('results are scoped to the user; admins see everyone', async () => {
    await call('POST', '/quiz/start', { category: history }, bob); // left open on purpose

    const mine = (await call('GET', '/results', null, alice)).body;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].score, 7);
    assert.equal(mine[0].categoryName, 'Science');
    assert.ok(!leaksAnswers(mine));

    const bobs = (await call('GET', '/results', null, bob)).body;
    assert.equal(bobs.length, 9, 'open attempts are not listed');
    const aliceId = (await call('GET', '/profile', null, alice)).body._id;
    assert.ok(bobs.every((b) => b.user !== aliceId));

    const all = (await call('GET', '/results', null, admin)).body;
    assert.equal(all.length, 10);
    assert.ok(all.some((x) => x.user.email === 'alice@example.com'));
    assert.ok(all.every((x) => x.user.name && x.user.password === undefined));
    assert.ok(!leaksAnswers(all));
});

test('leaderboard ranks by total score and hides private data', async () => {
    const r = await call('GET', '/leaderboard', null, bob);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map(({ name, score }) => [name, score]), [['Alice', 7], ['Bob', 2]]);
    assert.deepEqual(Object.keys(r.body[0]).sort(), ['name', 'quizzes', 'score', 'total']);

    await play(bob, science, 8); // Bob overtakes Alice: 2 + 8 = 10
    assert.deepEqual((await call('GET', '/leaderboard', null, alice)).body.map((x) => x.name), ['Bob', 'Alice']);
});

test('admin can view registered users, without passwords', async () => {
    const r = await call('GET', '/users', null, admin);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map((u) => u.email).sort(), ['admin@example.com', 'alice@example.com', 'bob@example.com', 'eve@example.com']);
    assert.ok(!JSON.stringify(r.body).includes('password'));
});

test('profile management', async () => {
    let r = await call('GET', '/profile', null, alice);
    assert.equal(r.body.name, 'Alice');

    r = await call('PUT', '/profile', { name: 'Alice P' }, alice);
    assert.equal(r.status, 200);
    assert.equal(r.body.name, 'Alice P');
    assert.equal((await call('PUT', '/profile', { email: 'bob@example.com' }, alice)).status, 409);

    assert.equal((await call('PUT', '/profile', { currentPassword: 'wrong', newPassword: 'newpass1' }, alice)).status, 400);
    assert.equal((await call('PUT', '/profile', { currentPassword: 'secret1', newPassword: 'newpass1' }, alice)).status, 200);
    assert.equal((await call('POST', '/login', { email: 'alice@example.com', password: 'secret1' })).status, 401);
    assert.equal((await call('POST', '/login', { email: 'alice@example.com', password: 'newpass1' })).status, 200);
});

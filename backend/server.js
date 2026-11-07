const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true }); // works from any folder

const express = require('express');
const connectDB = require('./config/db');
const requireAuth = require('./middleware/auth');

const app = express();

app.use(express.json());
app.use((req, res, next) => { req.body ??= {}; next(); }); // Express 5 leaves req.body undefined when no body is sent
app.use(express.static(path.join(__dirname, '../frontend')));

// Public routes
app.use('/api', require('./routes/auth'));
// Everything below needs a valid token
app.use('/api', requireAuth, require('./routes/profile'), require('./routes/users'), require('./routes/categories'), require('./routes/questions'), require('./routes/quiz'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards rejected promises from async handlers here
app.use((err, req, res, next) => {
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(', ') });
    }
    if (err.name === 'CastError') return res.status(400).json({ error: `Invalid ${err.path}` });
    if (err.code === 11000) return res.status(409).json({ error: `That ${Object.keys(err.keyValue)[0]} is already taken` });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message }); // includes bad JSON bodies
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;

if (require.main === module) {
    // Fail fast with a clear message instead of a confusing runtime error later
    const missing = ['MONGO_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
    if (missing.length) {
        console.error(`Missing ${missing.join(', ')} in backend/.env (copy .env.example to .env and fill it in).`);
        process.exit(1);
    }
    const port = process.env.PORT || 3001;
    connectDB(process.env.MONGO_URI)
        .then(() => app.listen(port, () => console.log(`Online Quiz System running at http://localhost:${port}`)))
        .catch((err) => {
            console.error('Could not connect to MongoDB:', err.message);
            console.error('Is MongoDB running? See "Run it" in README.md.');
            process.exit(1);
        });
}

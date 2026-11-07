# Online Quiz System

Full-stack web app where users register, log in, take quizzes, view scores and track performance. Admins manage quiz categories, questions and results.

**Stack:** HTML5 · CSS3 · JavaScript (ES modules, no framework) · Node.js · Express 5 · MongoDB (Mongoose) · REST API · JWT auth

## Run it

Needs Node.js 20+ and MongoDB. No Docker required.

- **Local (recommended):** `winget install MongoDB.Server` installs MongoDB as a Windows service that starts with Windows. Check it with `sc query MongoDB` (should say RUNNING).
- **MongoDB Atlas** (free cloud cluster): put its connection string in `MONGO_URI` in `backend/.env`.

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env  — then set JWT_SECRET and ADMIN_PASSWORD
npm run seed              # creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev               # or: npm start
```

Open http://localhost:3001. The Express server serves the frontend too, so there is nothing else to start. Port 3001 lets it run next to the Expense Tracker on 3000.

Nobody can register as an admin. `npm run seed` is the only way to get one, and it is safe to re-run: an existing account with that email is promoted and keeps its password. Admins use the normal login page and land in the admin area, where they add categories and questions before anyone can play.

### Tests

```bash
cd backend
npm test
```

Integration tests run against a real MongoDB database called `online_quiz_system_test` (override with `TEST_MONGO_URI`). They cover every endpoint, plus the rules that matter: no answers reach players, grading ignores anything the client claims, an attempt can be submitted once and only by its owner, and role checks happen on the server.

## Layout

```
online-quiz-system/
├── backend/
│   ├── server.js            app setup, routes, error handler
│   ├── seed.js              creates the admin account
│   ├── config/db.js         Mongo connection
│   ├── models/              User, Category, Question, Result
│   ├── middleware/auth.js   JWT check → req.userId, plus requireAdmin
│   ├── routes/              auth, profile, users, categories, questions, quiz
│   └── test/api.test.js
└── frontend/
    ├── index.html           login / register (users and admins)
    ├── quizzes.html         categories, start a quiz
    ├── quiz.html            take a quiz, see the score and review
    ├── history.html         past scores, average and best, review
    ├── leaderboard.html     top players
    ├── profile.html         update details, change password
    ├── admin-*.html         categories, questions, users, results
    ├── css/style.css
    └── js/                  api.js (shared helpers) + one script per page
```

## Features

### User module
- [x] User Registration
- [x] User Login
- [x] Profile Management (name, email, password)
- [x] View Quiz Categories
- [x] Start Quiz (up to 10 random questions from a category)
- [x] Submit Quiz (graded on the server, once per attempt)
- [x] View Score (with a right / wrong review)
- [x] Quiz History
- [x] Leaderboard

### Admin module
- [x] Admin Login
- [x] Add / Update / Delete Quiz Category
- [x] Add / Update / Delete Questions
- [x] View Registered Users
- [x] View Quiz Results

## Collections

| Collection | Fields |
|---|---|
| users | name, email (unique), password (bcrypt hash), role (`user` / `admin`), timestamps |
| categories | name (unique, ignoring case), description, timestamps |
| questions | category → categories, text, choices (2 to 6), correctIndex (hidden by default), timestamps |
| results | user → users, category → categories, categoryName, questions (copy with selected and correct), answerKey (hidden), score, total, submittedAt (null while open), timestamps |

Each attempt keeps its own copy of the questions, so editing or deleting a question never changes a quiz in progress or anyone's history.

## API

All endpoints are under `/api`. Everything except register and login needs `Authorization: Bearer <token>`.

| Method | Path | Who | Body / query | Returns |
|---|---|---|---|---|
| POST | /register | anyone | `{ name, email, password }` | `{ token, user }` |
| POST | /login | anyone | `{ email, password }` | `{ token, user }` (`user.role` tells admins apart) |
| GET | /profile | user | | user |
| PUT | /profile | user | `{ name?, email?, currentPassword?, newPassword? }` | user |
| GET | /categories | user | | `[{ _id, name, description, questionCount }]` |
| POST | /category | admin | `{ name, description? }` | category |
| PUT | /category/:id | admin | any of the fields above | category |
| DELETE | /category/:id | admin | | `{ message }`, or 409 while it still has questions |
| GET | /questions | user | `?category=<id>` | questions; only admins get `correctIndex` |
| POST | /question | admin | `{ category, text, choices, correctIndex }` | question |
| PUT | /question/:id | admin | any of the fields above | question |
| DELETE | /question/:id | admin | | `{ message }` |
| POST | /quiz/start | user | `{ category }` | `{ resultId, categoryName, questions: [{ _id, text, choices }] }` |
| POST | /quiz/submit | user | `{ resultId, answers: [{ question, selected }] }` | graded result (each question says `correct` or not, never which choice was right) |
| GET | /results | user | | own results; admins get everyone's, with name and email |
| GET | /leaderboard | user | | top 20 `[{ name, score, total, quizzes }]` by total correct answers |
| GET | /users | admin | | all users (not in the original spec, needed for View Registered Users) |

Errors come back as `{ "error": "message" }` with 400 (validation), 401 (not logged in), 403 (admins only), 404 (not found or not yours) or 409 (name or email taken, category not empty, quiz already submitted).

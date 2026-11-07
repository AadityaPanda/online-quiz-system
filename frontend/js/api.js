// Shared helpers used by every page.
const TOKEN_KEY = 'qz_token';
const USER_KEY = 'qz_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser = () => JSON.parse(localStorage.getItem(USER_KEY) || 'null');
export const saveUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));

export function saveSession({ token, user }) {
    localStorage.setItem(TOKEN_KEY, token);
    saveUser(user);
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.replace('index.html');
}

// fetch wrapper: adds the token, parses JSON, throws Error(message) on failure
export async function api(path, { method = 'GET', body } = {}) {
    const token = getToken();
    const res = await fetch(`/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: body && JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) logout(); // token expired or invalid
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

const NAV = {
    user: [['quizzes.html', 'Quizzes'], ['history.html', 'History'], ['leaderboard.html', 'Leaderboard'], ['profile.html', 'Profile']],
    admin: [['admin-categories.html', 'Categories'], ['admin-questions.html', 'Questions'], ['admin-users.html', 'Users'], ['admin-results.html', 'Results'], ['leaderboard.html', 'Leaderboard'], ['profile.html', 'Profile']],
};

export const homePage = () => (getUser()?.role === 'admin' ? 'admin-categories.html' : 'quizzes.html');

// `await initPage()` at the top of every logged-in page: fills the header, or redirects away
// and never resolves, so the rest of the page script doesn't run.
// The admin check only picks the page to show; the API enforces the role itself.
export function initPage({ admin = false } = {}) {
    if (!getToken() || (admin && getUser()?.role !== 'admin')) {
        location.replace(getToken() ? homePage() : 'index.html');
        return new Promise(() => {});
    }
    const here = location.pathname.split('/').pop();
    document.querySelector('.topbar nav').append(...NAV[getUser()?.role === 'admin' ? 'admin' : 'user'].map(([href, label]) => (
        el('a', { href, ...(href === here && { ariaCurrent: 'page' }) }, label)
    )));
    document.querySelector('[data-user-name]').textContent = getUser()?.name ?? '';
    document.querySelector('[data-logout]').addEventListener('click', logout);
}

// Builds DOM nodes; strings become text nodes, so user data can never inject HTML
export function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c !== null && c !== undefined));
    return node;
}

export function showMessage(node, text, type = 'error') {
    node.textContent = text;
    node.className = `message ${type}`;
    node.hidden = !text;
}

export const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const percent = (score, total) => (total ? Math.round((score / total) * 100) : 0);

// One list item per question of a graded attempt. Says right or wrong, never which choice was right.
export function renderReview(questions) {
    return questions.map((q, i) => el('li', { className: 'stack' },
        el('strong', {}, `${i + 1}. ${q.text}`),
        el('p', { className: `message ${q.correct ? 'success' : 'error'}` },
            `${q.correct ? 'Correct' : 'Incorrect'}. Your answer: ${q.selected === null ? 'not answered' : q.choices[q.selected]}`)));
}

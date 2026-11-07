import { api, initPage, el, showMessage } from './api.js';

await initPage();

const list = document.getElementById('categories');

try {
    const categories = await api('/categories');
    list.replaceChildren(...(categories.length ? categories.map((c) => el('section', { className: 'card category-card' },
        el('h2', {}, c.name),
        c.description ? el('p', { className: 'muted' }, c.description) : null,
        el('span', { className: 'tag' }, `${c.questionCount} question${c.questionCount === 1 ? '' : 's'}`),
        c.questionCount
            ? el('a', { className: 'btn primary', href: `quiz.html?category=${c._id}` }, 'Start quiz')
            : el('span', { className: 'muted small' }, 'No questions yet'),
    )) : [el('p', { className: 'empty' }, 'No quizzes yet. Check back soon.')]));
} catch (err) {
    showMessage(document.getElementById('message'), err.message);
}

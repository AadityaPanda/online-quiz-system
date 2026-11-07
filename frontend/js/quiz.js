import { api, initPage, el, showMessage, percent, renderReview } from './api.js';

await initPage();

const form = document.getElementById('quiz-form');
const message = document.getElementById('message');
const category = new URLSearchParams(location.search).get('category');

let quiz;

function showResult(result) {
    form.hidden = true;
    document.getElementById('result-score').textContent = `${result.score} / ${result.total}`;
    document.getElementById('result-percent').textContent = `${percent(result.score, result.total)}% correct`;
    document.getElementById('result-review').replaceChildren(...renderReview(result.questions));
    document.getElementById('retake').href = location.href;
    document.getElementById('quiz-result').hidden = false;
    scrollTo(0, 0);
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chosen = new FormData(form);
    const answers = quiz.questions.filter((q) => chosen.has(q._id)).map((q) => ({ question: q._id, selected: Number(chosen.get(q._id)) }));
    const missing = quiz.questions.length - answers.length;
    if (missing && !confirm(`You left ${missing} question${missing === 1 ? '' : 's'} unanswered. Submit anyway?`)) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    showMessage(message, '');
    try {
        showResult(await api('/quiz/submit', { method: 'POST', body: { resultId: quiz.resultId, answers } }));
    } catch (err) {
        showMessage(message, err.message);
    } finally {
        button.disabled = false;
    }
});

try {
    quiz = await api('/quiz/start', { method: 'POST', body: { category } });
    document.getElementById('quiz-title').textContent = quiz.categoryName;
    document.getElementById('quiz-questions').replaceChildren(...quiz.questions.map((q, i) => el('li', {},
        el('fieldset', {},
            el('legend', {}, `${i + 1}. ${q.text}`),
            ...q.choices.map((choice, index) => el('label', { className: 'choice' },
                el('input', { type: 'radio', name: q._id, value: index }),
                choice))))));
    form.hidden = false;
} catch (err) {
    showMessage(message, err.message);
}

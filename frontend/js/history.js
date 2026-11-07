import { api, initPage, el, showMessage, formatDate, percent, renderReview } from './api.js';

await initPage();

function showReview(result) {
    document.getElementById('review-title').textContent = `${result.categoryName}, ${formatDate(result.submittedAt)}`;
    document.getElementById('review-list').replaceChildren(...renderReview(result.questions));
    const section = document.getElementById('review');
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

try {
    const results = await api('/results');
    const percents = results.map((r) => percent(r.score, r.total));
    document.getElementById('stat-count').textContent = results.length;
    document.getElementById('stat-average').textContent = `${results.length ? Math.round(percents.reduce((a, b) => a + b, 0) / results.length) : 0}%`;
    document.getElementById('stat-best').textContent = `${results.length ? Math.max(...percents) : 0}%`;

    document.getElementById('result-rows').replaceChildren(...(results.length ? results.map((r, i) => el('tr', {},
        el('td', { className: 'nowrap' }, formatDate(r.submittedAt)),
        el('td', {}, el('span', { className: 'tag' }, r.categoryName)),
        el('td', { className: 'num' }, `${r.score} / ${r.total}`),
        el('td', { className: 'num' }, `${percents[i]}%`),
        el('td', { className: 'actions' }, el('button', { type: 'button', className: 'link', textContent: 'Review', onclick: () => showReview(r) })),
    )) : [el('tr', {}, el('td', { colSpan: 5, className: 'empty' }, 'No quizzes taken yet.'))]));
} catch (err) {
    showMessage(document.getElementById('message'), err.message);
}

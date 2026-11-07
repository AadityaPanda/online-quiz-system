import { api, initPage, el, showMessage, formatDate, percent } from './api.js';

await initPage({ admin: true });

try {
    const results = await api('/results');
    document.getElementById('count').textContent = `${results.length} result${results.length === 1 ? '' : 's'}`;
    document.getElementById('rows').replaceChildren(...(results.length ? results.map((r) => el('tr', {},
        el('td', { className: 'nowrap' }, formatDate(r.submittedAt)),
        el('td', {}, r.user?.name ?? 'Unknown', el('div', { className: 'muted small' }, r.user?.email ?? '')),
        el('td', {}, el('span', { className: 'tag' }, r.categoryName)),
        el('td', { className: 'num' }, `${r.score} / ${r.total}`),
        el('td', { className: 'num' }, `${percent(r.score, r.total)}%`),
    )) : [el('tr', {}, el('td', { colSpan: 5, className: 'empty' }, 'No results yet.'))]));
} catch (err) {
    showMessage(document.getElementById('message'), err.message);
}

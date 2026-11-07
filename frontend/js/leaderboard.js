import { api, initPage, el, showMessage, percent } from './api.js';

await initPage();

try {
    const players = await api('/leaderboard');
    document.getElementById('rows').replaceChildren(...(players.length ? players.map((p, i) => el('tr', {},
        el('td', {}, String(i + 1)),
        el('td', {}, p.name),
        el('td', { className: 'num' }, String(p.quizzes)),
        el('td', { className: 'num' }, `${p.score} / ${p.total}`),
        el('td', { className: 'num' }, `${percent(p.score, p.total)}%`),
    )) : [el('tr', {}, el('td', { colSpan: 5, className: 'empty' }, 'Nobody has finished a quiz yet.'))]));
} catch (err) {
    showMessage(document.getElementById('message'), err.message);
}

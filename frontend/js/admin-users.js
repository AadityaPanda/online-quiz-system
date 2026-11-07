import { api, initPage, el, showMessage, formatDate } from './api.js';

await initPage({ admin: true });

try {
    const users = await api('/users');
    document.getElementById('count').textContent = `${users.length} user${users.length === 1 ? '' : 's'}`;
    document.getElementById('rows').replaceChildren(...users.map((u) => el('tr', {},
        el('td', {}, u.name),
        el('td', {}, u.email),
        el('td', {}, el('span', { className: 'tag' }, u.role)),
        el('td', { className: 'nowrap' }, formatDate(u.createdAt)),
    )));
} catch (err) {
    showMessage(document.getElementById('message'), err.message);
}

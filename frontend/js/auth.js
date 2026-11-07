import { api, getToken, homePage, saveSession, showMessage } from './api.js';

if (getToken()) location.replace(homePage());

const message = document.getElementById('message');
const forms = { login: document.getElementById('login-form'), register: document.getElementById('register-form') };

function showTab(name) {
    for (const [key, form] of Object.entries(forms)) {
        form.hidden = key !== name;
        document.getElementById(`tab-${key}`).setAttribute('aria-selected', String(key === name));
    }
    showMessage(message, '');
}

document.getElementById('tab-login').addEventListener('click', () => showTab('login'));
document.getElementById('tab-register').addEventListener('click', () => showTab('register'));

for (const [endpoint, form] of Object.entries(forms)) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            saveSession(await api(`/${endpoint}`, { method: 'POST', body: Object.fromEntries(new FormData(form)) }));
            location.replace(homePage());
        } catch (err) {
            showMessage(message, err.message);
        } finally {
            button.disabled = false;
        }
    });
}

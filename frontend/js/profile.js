import { api, initPage, saveUser, showMessage, formatDate } from './api.js';

await initPage();

const detailsForm = document.getElementById('details-form');
const passwordForm = document.getElementById('password-form');
const detailsMessage = document.getElementById('details-message');
const passwordMessage = document.getElementById('password-message');

function fill(user) {
    detailsForm.elements.name.value = user.name;
    detailsForm.elements.email.value = user.email;
    document.getElementById('member-since').textContent = `Member since ${formatDate(user.createdAt)}`;
    document.querySelector('[data-user-name]').textContent = user.name;
    saveUser(user);
}

async function submit(form, messageNode, body, successText) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        fill(await api('/profile', { method: 'PUT', body }));
        showMessage(messageNode, successText, 'success');
        return true;
    } catch (err) {
        showMessage(messageNode, err.message);
        return false;
    } finally {
        button.disabled = false;
    }
}

detailsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(detailsForm, detailsMessage, Object.fromEntries(new FormData(detailsForm)), 'Details saved.');
});

passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = Object.fromEntries(new FormData(passwordForm));
    if (newPassword !== confirmPassword) return showMessage(passwordMessage, 'New passwords do not match.');
    if (await submit(passwordForm, passwordMessage, { currentPassword, newPassword }, 'Password changed.')) passwordForm.reset();
});

api('/profile').then(fill).catch((err) => showMessage(detailsMessage, err.message));

import { api, initPage, el, showMessage } from './api.js';

await initPage({ admin: true });

const form = document.getElementById('category-form');
const rows = document.getElementById('rows');
const formMessage = document.getElementById('form-message');
const listMessage = document.getElementById('list-message');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-edit');

let editingId = null;

function resetForm() {
    editingId = null;
    form.reset();
    document.getElementById('form-title').textContent = 'Add category';
    submitBtn.textContent = 'Add category';
    cancelBtn.hidden = true;
}

function startEdit(category) {
    editingId = category._id;
    form.elements.name.value = category.name;
    form.elements.description.value = category.description ?? '';
    document.getElementById('form-title').textContent = 'Edit category';
    submitBtn.textContent = 'Save changes';
    cancelBtn.hidden = false;
    showMessage(formMessage, '');
    form.elements.name.focus();
}

async function remove(category) {
    if (!confirm(`Delete "${category.name}"?`)) return;
    try {
        await api(`/category/${category._id}`, { method: 'DELETE' });
        if (editingId === category._id) resetForm();
        showMessage(listMessage, '');
        await load();
    } catch (err) {
        showMessage(listMessage, err.message);
    }
}

async function load() {
    const categories = await api('/categories');
    rows.replaceChildren(...(categories.length ? categories.map((c) => el('tr', {},
        el('td', {}, c.name),
        el('td', { className: 'muted' }, c.description ?? ''),
        el('td', { className: 'num' }, String(c.questionCount)),
        el('td', { className: 'actions' },
            el('button', { type: 'button', className: 'link', textContent: 'Edit', onclick: () => startEdit(c) }),
            el('button', { type: 'button', className: 'link danger', textContent: 'Delete', onclick: () => remove(c) })),
    )) : [el('tr', {}, el('td', { colSpan: 4, className: 'empty' }, 'No categories yet.'))]));
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    showMessage(formMessage, '');
    try {
        await api(editingId ? `/category/${editingId}` : '/category', {
            method: editingId ? 'PUT' : 'POST',
            body: Object.fromEntries(new FormData(form)),
        });
        resetForm();
        showMessage(formMessage, 'Saved.', 'success');
        await load();
    } catch (err) {
        showMessage(formMessage, err.message);
    } finally {
        submitBtn.disabled = false;
    }
});

cancelBtn.addEventListener('click', resetForm);

load().catch((err) => showMessage(listMessage, err.message));

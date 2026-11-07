import { api, initPage, el, showMessage } from './api.js';

await initPage({ admin: true });

const MAX_CHOICES = 6;

const form = document.getElementById('question-form');
const filters = document.getElementById('filters');
const rows = document.getElementById('rows');
const formMessage = document.getElementById('form-message');
const listMessage = document.getElementById('list-message');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-edit');

let editingId = null;

// Radio values follow the row, so a blank row in the middle can't shift the correct answer
const choiceRows = Array.from({ length: MAX_CHOICES }, (_, i) => {
    const radio = el('input', { type: 'radio', name: 'correct', ariaLabel: `Choice ${i + 1} is correct` });
    const text = el('input', { type: 'text', maxLength: 200, placeholder: `Choice ${i + 1}`, ariaLabel: `Choice ${i + 1}` });
    document.getElementById('choices').append(el('div', { className: 'choice-row' }, radio, text));
    return { radio, text };
});

function resetForm() {
    const category = form.elements.category.value; // keep it: admins usually add several questions in a row
    editingId = null;
    form.reset();
    form.elements.category.value = category;
    document.getElementById('form-title').textContent = 'Add question';
    submitBtn.textContent = 'Add question';
    cancelBtn.hidden = true;
}

function startEdit(question) {
    editingId = question._id;
    form.elements.category.value = question.category?._id ?? '';
    form.elements.text.value = question.text;
    choiceRows.forEach(({ radio, text }, i) => {
        text.value = question.choices[i] ?? '';
        radio.checked = i === question.correctIndex;
    });
    document.getElementById('form-title').textContent = 'Edit question';
    submitBtn.textContent = 'Save changes';
    cancelBtn.hidden = false;
    showMessage(formMessage, '');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.text.focus({ preventScroll: true });
}

async function remove(question) {
    if (!confirm(`Delete "${question.text}"?`)) return;
    try {
        await api(`/question/${question._id}`, { method: 'DELETE' });
        if (editingId === question._id) resetForm();
        showMessage(listMessage, '');
        await load();
    } catch (err) {
        showMessage(listMessage, err.message);
    }
}

async function load() {
    const qs = new URLSearchParams([...new FormData(filters)].filter(([, v]) => v)).toString();
    const questions = await api(`/questions?${qs}`);
    rows.replaceChildren(...(questions.length ? questions.map((q) => el('tr', {},
        el('td', {}, q.text),
        el('td', {}, el('span', { className: 'tag' }, q.category?.name ?? 'Unknown')),
        el('td', {}, q.choices[q.correctIndex]),
        el('td', { className: 'actions' },
            el('button', { type: 'button', className: 'link', textContent: 'Edit', onclick: () => startEdit(q) }),
            el('button', { type: 'button', className: 'link danger', textContent: 'Delete', onclick: () => remove(q) })),
    )) : [el('tr', {}, el('td', { colSpan: 4, className: 'empty' }, 'No questions found.'))]));
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const filled = choiceRows.filter(({ text }) => text.value.trim());
    const body = {
        category: form.elements.category.value,
        text: form.elements.text.value,
        choices: filled.map(({ text }) => text.value),
        correctIndex: filled.findIndex(({ radio }) => radio.checked), // -1 is rejected by the schema
    };
    submitBtn.disabled = true;
    showMessage(formMessage, '');
    try {
        await api(editingId ? `/question/${editingId}` : '/question', { method: editingId ? 'PUT' : 'POST', body });
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
filters.addEventListener('input', () => load().catch((err) => showMessage(listMessage, err.message)));
filters.addEventListener('submit', (e) => e.preventDefault());

(async () => {
    const categories = await api('/categories');
    const options = () => categories.map((c) => el('option', { value: c._id }, c.name));
    form.elements.category.append(...options());
    filters.elements.category.append(...options());
    await load();
})().catch((err) => showMessage(listMessage, err.message));

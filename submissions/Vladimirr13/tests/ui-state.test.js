import { ApiError } from '../dist/public/api.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUsersController } from '../dist/public/users-controller.js';

const user = { id: 1, name: 'Alex', email: 'alex@example.com' };
const flush = () => new Promise(resolve => setImmediate(resolve));

async function setup({ remove = async () => {}, add = async () => user, honorAbort = true } = {}) {
  const state = { users: [], deleting: new Set(), actionError: '', formError: '', notice: '', resets: 0 };
  const view = {
    renderUsers(users, deleting) { state.users = [...users]; state.deleting = new Set(deleting); },
    setDeleting(id, pending) { pending ? state.deleting.add(id) : state.deleting.delete(id); },
    setListLoading() { state.loading = true; state.listError = ''; },
    setListBusy(busy) { state.loading = busy; },
    setSearchPending() { state.loading = true; },
    setListResult(count, query) { state.result = { count, query }; },
    setListError(message) { state.listError = message; },
    setActionError(message) { state.actionError = message; },
    clearFormErrors() { state.formError = ''; state.fields = {}; },
    setFormError(message, fields) { state.formError = message; state.fields = fields; },
    setSubmitting(pending) { state.submitting = pending; },
    resetForm() { state.resets++; },
    focusName() {},
    focusFirstInvalid() {
      assert.notEqual(state.submitting, true, 'inputs must be enabled before focusing');
      state.focusedField = ['name', 'email'].find(field => state.fields?.[field]);
    },
  };
  const pending = [];
  const scheduled = new Map();
  let timerId = 0;
  const api = {
    list(search, signal) {
      return new Promise((resolve, reject) => {
        pending.push({ search, signal, resolve, reject });
        if (honorAbort) {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        }
      });
    },
    remove, add,
  };
  const controller = createUsersController({
    api, view,
    notifications: { show(message, kind) { state.notice = message; state.noticeKind = kind; }, hide() { state.notice = ''; } },
    timers: {
      setTimeout(callback) { scheduled.set(++timerId, callback); return timerId; },
      clearTimeout(id) { scheduled.delete(id); },
    },
  });
  const initial = controller.loadUsers();
  pending[0].resolve([user]);
  await initial;
  return { controller, state, pending, runSearch: () => [...scheduled.values()].at(-1)() };
}

test('confirmed deletion stays removed when search aborts the subsequent refresh', async () => {
  let resolveDelete;
  let calls = 0;
  const ui = await setup({ remove: () => { calls++; return new Promise(resolve => { resolveDelete = resolve; }); } });
  const deletion = ui.controller.deleteUser(user.id);
  await ui.controller.deleteUser(user.id);
  assert.equal(calls, 1, 'duplicate deletion must be blocked');
  assert.equal(ui.state.users.length, 1, 'wait for server confirmation');
  assert.ok(ui.state.deleting.has(user.id));
  resolveDelete();
  await flush();
  assert.equal(ui.pending.length, 2);
  ui.controller.setSearch('Alex');
  await deletion;
  assert.ok(ui.pending[1].signal.aborted);
  assert.deepEqual(ui.state.users, []);
  assert.equal(ui.state.actionError, '');
  await ui.controller.deleteUser(user.id);
  assert.equal(calls, 1, 'deleted record cannot be deleted again');

  const search = ui.runSearch();
  assert.equal(ui.pending[2].search, 'Alex');
  ui.pending[2].resolve([]);
  await search;
  assert.deepEqual(ui.state.result, { count: 0, query: 'Alex' });
});

test('failed deletion preserves the user and restores the delete button', async () => {
  const ui = await setup({ remove: async () => { throw new Error('Ошибка удаления'); } });
  await ui.controller.deleteUser(user.id);
  assert.deepEqual(ui.state.users, [user]);
  assert.equal(ui.state.deleting.size, 0);
  assert.equal(ui.pending.length, 1);
  assert.match(ui.state.actionError, /Ошибка удаления/);
});

test('old search response is ignored immediately during the debounce window', async () => {
  const ui = await setup({ honorAbort: false });
  const old = ui.controller.loadUsers();
  ui.controller.setSearch('Maria');
  ui.pending[1].resolve([{ id: 99, name: 'Stale', email: 'stale@example.com' }]);
  await old;
  assert.deepEqual(ui.state.users, [user]);
  const latest = ui.runSearch();
  ui.pending[2].resolve([]);
  await latest;
  assert.deepEqual(ui.state.users, []);
  assert.equal(ui.state.loading, false);
});

test('successful creation remains successful when list refresh fails and blocks duplicate submits', async () => {
  let resolveAdd;
  let calls = 0;
  const ui = await setup({ add: () => { calls++; return new Promise(resolve => { resolveAdd = resolve; }); } });
  ui.controller.setSearch('Alex');
  const creation = ui.controller.createUser({ name: 'New', email: 'new@example.com' });
  await ui.controller.createUser({ name: 'New', email: 'new@example.com' });
  assert.equal(calls, 1);
  assert.equal(ui.state.submitting, true);
  resolveAdd({ ...user, id: 11 });
  await flush();
  assert.equal(ui.pending[1].search, 'Alex');
  ui.pending[1].reject(new Error('Сеть недоступна'));
  await creation;
  assert.equal(ui.state.resets, 1);
  assert.equal(ui.state.formError, '');
  assert.match(ui.state.notice, /добавлен/);
  assert.equal(ui.state.listError, 'Сеть недоступна');
  assert.equal(ui.state.submitting, false);
});

test('failed creation retains form data and forwards field validation errors', async () => {
  const fields = { email: 'Некорректный email' };
  const ui = await setup({ add: async () => { throw new ApiError('Проверьте данные', fields); } });
  await ui.controller.createUser({ name: 'Alex', email: 'alex@example.com' });
  assert.equal(ui.state.resets, 0);
  assert.equal(ui.state.formError, 'Проверьте данные');
  assert.equal(ui.state.focusedField, 'email');
  assert.deepEqual(ui.state.fields, fields);
  assert.equal(ui.state.submitting, false);
  assert.equal(ui.pending.length, 1);
});

test('invalid form data shows custom field errors without calling the API', async () => {
  let calls = 0;
  const ui = await setup({ add: async () => { calls++; return user; } });
  await ui.controller.createUser({ name: '   ', email: '' });
  assert.deepEqual(ui.state.fields, { name: 'Введите имя.', email: 'Введите email.' });
  assert.equal(ui.state.focusedField, 'name');
  for (const email of ['bad', 'a@b..com', 'a@-example.com', 'a@exa!mple.com']) {
    await ui.controller.createUser({ name: 'Alex', email });
    assert.ok(ui.state.fields.email);
    assert.equal(ui.state.fields.name, undefined);
    assert.equal(ui.state.focusedField, 'email');
  }
  await ui.controller.createUser({ name: 'a'.repeat(101), email: 'a@example.com' });
  assert.ok(ui.state.fields.name);
  assert.equal(calls, 0);
  assert.equal(ui.state.resets, 0);
});

test('correcting local validation errors allows submission', async () => {
  let calls = 0;
  const ui = await setup({ add: async () => { calls++; return user; } });
  await ui.controller.createUser({ name: '', email: '' });
  const creation = ui.controller.createUser({ name: 'Alex', email: 'alex@example.com' });
  await flush();
  assert.equal(calls, 1);
  ui.pending[1].resolve([user]);
  await creation;
  assert.equal(ui.state.formError, '');
  assert.deepEqual(ui.state.fields, {});
  assert.equal(ui.state.resets, 1);
  assert.equal(ui.state.submitting, false);
});

test('network errors appear as error notifications without expanding the form', async () => {
  const ui = await setup({ add: async () => { throw new Error('Не удалось связаться с сервером.'); } });
  await ui.controller.createUser({ name: 'Alex', email: 'alex@example.com' });
  assert.equal(ui.state.noticeKind, 'error');
  assert.match(ui.state.notice, /Не удалось связаться/);
  assert.equal(ui.state.formError, '');
  assert.deepEqual(ui.state.fields, {});
  assert.equal(ui.state.resets, 0);
  assert.equal(ui.state.submitting, false);
});

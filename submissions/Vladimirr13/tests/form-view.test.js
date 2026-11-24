import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createView } from '../dist/public/view.js';

test('form displays one compact summary and marks only invalid fields', () => {
  const nodes = new Map();
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) {
        const attributes = new Map();
        nodes.set(selector, {
          value: '', textContent: '',
          setAttribute: (name, value) => attributes.set(name, value),
          removeAttribute: name => attributes.delete(name),
          getAttribute: name => attributes.get(name),
          focus() { document.activeElement = this; },
        });
      }
      return nodes.get(selector);
    },
  };
  const view = createView(document);
  const name = document.querySelector('#name');
  const email = document.querySelector('#email');
  const summary = document.querySelector('#form-error');
  view.setFormError('Проверьте поля', { name: 'Введите имя', email: 'Введите email' });
  assert.equal(summary.textContent, 'Введите имя и email.');
  assert.equal(name.getAttribute('aria-invalid'), 'true');
  assert.equal(email.getAttribute('aria-invalid'), 'true');
  view.focusFirstInvalid();
  assert.equal(document.activeElement, name);

  name.value = 'Alex';
  email.value = 'bad';
  view.setFormError('Некорректный email', { email: 'Некорректный email' });
  assert.equal(summary.textContent, 'Проверьте email.');
  assert.equal(name.getAttribute('aria-invalid'), undefined);
  view.focusFirstInvalid();
  assert.equal(document.activeElement, email);

  view.clearFormErrors();
  assert.equal(summary.textContent, '');
  assert.equal(email.getAttribute('aria-invalid'), undefined);
});

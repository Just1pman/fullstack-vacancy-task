import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNewUser } from '../src/server/users-create.ts';

const input = { name: 'Alex', email: 'alex@example.com' };

test('parseNewUser возвращает имя без крайних пробелов и исходный email', () => {
  const body = Buffer.from(JSON.stringify({ ...input, name: '  Alex  ' }));
  assert.deepEqual(parseNewUser(body), { user: input });
});

test('parseNewUser различает некорректный JSON и ошибку структуры данных', () => {
  for (const body of [Buffer.from(''), Buffer.from('{'), Buffer.from([0xff])]) {
    const result = parseNewUser(body);
    assert.ok('error' in result);
    assert.equal(result.error.code, 'INVALID_JSON');
  }

  for (const value of [null, [], { ...input, id: 1 }]) {
    const result = parseNewUser(Buffer.from(JSON.stringify(value)));
    assert.ok('error' in result);
    assert.equal(result.error.code, 'VALIDATION_ERROR');
  }
});

test('parseNewUser возвращает ошибки для обоих некорректных полей', () => {
  const body = Buffer.from(JSON.stringify({ name: '   ', email: 'alex..work@example.com' }));
  const result = parseNewUser(body);

  assert.ok('error' in result);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.ok(result.error.fields?.name);
  assert.ok(result.error.fields?.email);
});

test('валидация объясняет по-русски разные причины ошибки имени и email', () => {
  const cases = [
    { field: 'name', value: '   ', message: 'Укажите имя.' },
    { field: 'name', value: 'я'.repeat(101), message: 'Имя должно содержать не более 100 символов.' },
    { field: 'name', value: 'Alex\tJohnson', message: 'Имя не должно содержать управляющие символы.' },
    { field: 'email', value: '', message: 'Укажите email.' },
    { field: 'email', value: 'dnv.kjn', message: 'Добавьте символ @. Например, name@example.com.' },
    { field: 'email', value: 'alex@', message: 'Введите email в формате name@example.com.' },
    { field: 'email', value: 'a@b@c.com', message: 'Введите email в формате name@example.com.' },
    { field: 'email', value: 'alex@-example.com', message: 'Введите email в формате name@example.com.' },
    { field: 'email', value: 'a'.repeat(255), message: 'Email должен содержать не более 254 символов.' },
  ] as const;

  for (const { field, value, message } of cases) {
    const json = Buffer.from(JSON.stringify({ ...input, [field]: value }));
    const result = parseNewUser(json);
    assert.ok('error' in result);
    assert.equal(result.error.fields?.[field], message);
  }
});

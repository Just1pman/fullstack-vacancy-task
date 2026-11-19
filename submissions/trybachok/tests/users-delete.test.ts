import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseUserId } from '../src/server/users-delete.ts';

test('parseUserId принимает положительные безопасные целые числа', () => {
  assert.equal(parseUserId('1'), 1);
  assert.equal(parseUserId('9007199254740991'), Number.MAX_SAFE_INTEGER);
});

test('parseUserId отклоняет значения вне десятичного формата id', () => {
  const invalidIds = ['', '0', '-1', '01', '+1', '1.5', 'abc', '9007199254740992'];
  for (const id of invalidIds) {
    assert.equal(parseUserId(id), null);
  }
});

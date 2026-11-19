import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterUsersByName, parseNameFilter } from '../src/users-search.ts';

const alex = { id: 1, name: 'Alex Johnson', email: 'alex@example.com' };
const maria = { id: 2, name: 'Maria Petrova', email: 'maria.alex@example.com' };
const users = [alex, maria];

test('parseNameFilter обрезает пробелы и принимает пустой фильтр', () => {
  assert.deepEqual(parseNameFilter(['  aLeX  ']), { name: 'aLeX' });
  assert.deepEqual(parseNameFilter([]), { name: '' });
  assert.deepEqual(parseNameFilter(['   ']), { name: '' });
});

test('parseNameFilter отклоняет повтор параметра и значение длиннее 100 символов', () => {
  const maxLength = 'ю'.repeat(100);
  assert.deepEqual(parseNameFilter([maxLength]), { name: maxLength });
  assert.ok('error' in parseNameFilter([maxLength + 'ю']));
  assert.ok('error' in parseNameFilter(['Alex', 'Maria']));
});

test('filterUsersByName ищет подстроку в имени без учёта регистра', () => {
  assert.deepEqual(filterUsersByName(users, 'lEx'), [alex]);
});

test('filterUsersByName возвращает весь список для пустого запроса и пустой массив без совпадений', () => {
  assert.deepEqual(filterUsersByName(users, ''), users);
  assert.deepEqual(filterUsersByName(users, 'Sergei'), []);
});

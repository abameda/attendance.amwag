import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Messages = Record<string, unknown>;

const arMessages = JSON.parse(readFileSync('messages/ar.json', 'utf8')) as Messages;
const enMessages = JSON.parse(readFileSync('messages/en.json', 'utf8')) as Messages;

const requiredAdminEmployeeNamespaces = ['Employees', 'EmployeeAnalytics', 'BulkImport'] as const;

test('admin employee pages expose Arabic and English message namespaces', () => {
  for (const namespace of requiredAdminEmployeeNamespaces) {
    assert.equal(typeof arMessages[namespace], 'object', `Arabic ${namespace} messages are missing`);
    assert.equal(typeof enMessages[namespace], 'object', `English ${namespace} messages are missing`);
  }
});

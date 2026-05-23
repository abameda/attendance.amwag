import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_EMPLOYEE_LIMIT,
  EMPLOYEE_PAGE_SIZE,
  filterEmployeeOptions,
  normalizeEmployeeListParams,
} from '../src/lib/employeeDirectory';

const options = [
  {
    id: 'employee-1',
    full_name: 'Mona Hassan',
    email: 'mona@example.com',
    branch: 'Nasr City',
    job_title: 'Dispatcher',
  },
  {
    id: 'employee-2',
    full_name: 'Omar Ali',
    email: 'omar@example.com',
    branch: 'Alexandria',
    job_title: 'Driver',
  },
  {
    id: 'employee-3',
    full_name: 'Sara Nabil',
    email: 'sara@example.com',
    branch: null,
    job_title: null,
  },
];

test('normalizeEmployeeListParams defaults to the first three employee cards', () => {
  assert.deepEqual(normalizeEmployeeListParams(new URLSearchParams()), {
    page: 1,
    pageSize: DEFAULT_EMPLOYEE_LIMIT,
    offset: 0,
  });
});

test('normalizeEmployeeListParams supports paged show-all requests with a capped page size', () => {
  assert.deepEqual(
    normalizeEmployeeListParams(new URLSearchParams({ page: '3', pageSize: '500' })),
    {
      page: 3,
      pageSize: EMPLOYEE_PAGE_SIZE,
      offset: EMPLOYEE_PAGE_SIZE * 2,
    }
  );
});

test('filterEmployeeOptions searches name, email, branch, and job title', () => {
  assert.deepEqual(filterEmployeeOptions(options, 'dispatcher').map((employee) => employee.id), ['employee-1']);
  assert.deepEqual(filterEmployeeOptions(options, 'alex').map((employee) => employee.id), ['employee-2']);
  assert.deepEqual(filterEmployeeOptions(options, 'sara@').map((employee) => employee.id), ['employee-3']);
  assert.deepEqual(filterEmployeeOptions(options, 'mona').map((employee) => employee.id), ['employee-1']);
});

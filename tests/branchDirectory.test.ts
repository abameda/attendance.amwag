import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBranchCode,
  mergeBranchNameSources,
  normalizeBranchName,
} from '../src/lib/branchDirectory';

test('normalizeBranchName trims and collapses branch whitespace', () => {
  assert.equal(normalizeBranchName('  Cairo   Main  '), 'Cairo Main');
  assert.equal(normalizeBranchName('\tفرع   القاهرة\n'), 'فرع القاهرة');
});

test('mergeBranchNameSources removes blanks and duplicate normalized names', () => {
  assert.deepEqual(
    mergeBranchNameSources([
      ['Cairo', '  Cairo  ', '', null],
      ['Alexandria', 'Alexandria  '],
    ]),
    ['Cairo', 'Alexandria']
  );
});

test('buildBranchCode creates stable uppercase codes from names', () => {
  assert.equal(buildBranchCode('Cairo Main'), 'CAIRO-MAIN');
  assert.equal(buildBranchCode('فرع القاهرة'), 'BRANCH-39E1D2C8');
});

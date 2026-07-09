import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BULK_IMPORT_INSERT_BATCH_SIZE,
  BULK_IMPORT_MAX_BODY_BYTES,
  BULK_IMPORT_MAX_ROWS,
  chunkBulkImportRows,
  hasTooManyBulkImportRows,
  isBulkImportBodyTooLarge,
} from '../src/lib/bulkImportLimits';
import { getShaderPerformanceMode } from '../src/lib/shaderPerformance';

test('bulk import limits reject oversized payloads and row counts', () => {
  assert.equal(isBulkImportBodyTooLarge(String(BULK_IMPORT_MAX_BODY_BYTES + 1)), true);
  assert.equal(isBulkImportBodyTooLarge(String(BULK_IMPORT_MAX_BODY_BYTES)), false);
  assert.equal(hasTooManyBulkImportRows(Array(BULK_IMPORT_MAX_ROWS).fill('row').join('\n')), false);
  assert.equal(hasTooManyBulkImportRows(Array(BULK_IMPORT_MAX_ROWS + 1).fill('row').join('\n')), true);
});

test('bulk import rows are divided into bounded insert batches', () => {
  const rows = Array.from({ length: BULK_IMPORT_INSERT_BATCH_SIZE + 1 }, (_, index) => index);
  assert.deepEqual(chunkBulkImportRows(rows), [
    rows.slice(0, BULK_IMPORT_INSERT_BATCH_SIZE),
    rows.slice(BULK_IMPORT_INSERT_BATCH_SIZE),
  ]);
});

test('shader uses a static fallback for reduced motion and constrained devices', () => {
  assert.equal(
    getShaderPerformanceMode({ prefersReducedMotion: true, isCoarsePointer: false }),
    'static',
  );
  assert.equal(
    getShaderPerformanceMode({ prefersReducedMotion: false, isCoarsePointer: false, deviceMemory: 4 }),
    'static',
  );
  assert.equal(
    getShaderPerformanceMode({ prefersReducedMotion: false, isCoarsePointer: false, hardwareConcurrency: 8 }),
    'animated',
  );
});

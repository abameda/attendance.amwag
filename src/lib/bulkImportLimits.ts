export const BULK_IMPORT_MAX_BODY_BYTES = 1024 * 1024;
export const BULK_IMPORT_MAX_ROWS = 500;
export const BULK_IMPORT_INSERT_BATCH_SIZE = 25;

export function isBulkImportBodyTooLarge(contentLength: string | null): boolean {
  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > BULK_IMPORT_MAX_BODY_BYTES;
}

export function hasTooManyBulkImportRows(csvData: string): boolean {
  let rows = 0;

  for (const line of csvData.split(/\r?\n/)) {
    if (!line.trim()) continue;
    rows += 1;
    if (rows > BULK_IMPORT_MAX_ROWS) return true;
  }

  return false;
}

export function chunkBulkImportRows<T>(rows: T[]): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < rows.length; index += BULK_IMPORT_INSERT_BATCH_SIZE) {
    batches.push(rows.slice(index, index + BULK_IMPORT_INSERT_BATCH_SIZE));
  }

  return batches;
}

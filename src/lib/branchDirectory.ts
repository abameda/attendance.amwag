import { createHash } from 'node:crypto';

export type BranchOption = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
};

export function normalizeBranchName(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function mergeBranchNameSources(sources: Array<Array<string | null | undefined>>) {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const source of sources) {
    for (const value of source) {
      const name = normalizeBranchName(value);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
  }

  return names;
}

export function buildBranchCode(name: string) {
  const normalized = normalizeBranchName(name);
  const asciiCode = normalized
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();

  if (asciiCode) {
    return asciiCode.slice(0, 64);
  }

  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 8).toUpperCase();
  return `BRANCH-${hash}`;
}

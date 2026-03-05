/**
 * Canonical list of Amwag branch names.
 * Use this constant wherever branches need to be listed (UI, validation, etc.)
 * to avoid duplication and typos across the codebase.
 */
export const BRANCHES = [
  'ملوي',
  'الأضافيه',
  'شلبي',
  'بني مزار',
  'الجيزه',
  'رمسيس',
  'محرم بك',
  'شرم الشيخ',
  'الغردقه',
  'IT Department',
] as const;

export type Branch = (typeof BRANCHES)[number];

# Attendance Shift 12-Hour Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render attendance shift ranges in locale-aware 12-hour format on the logs page and in English and Arabic PDFs.

**Architecture:** Put time-range display conversion in a shared utility and keep storage/calculation values unchanged. The attendance page supplies its UI locale; the existing PDF report builder supplies its export locale.

**Tech Stack:** Next.js App Router, React, `next-intl`, TypeScript, Node test runner.

---

## File Structure

- Modify `src/lib/utils.ts` to export the locale-aware shift range formatter.
- Modify `src/app/[locale]/admin/attendance/page.tsx` to render page shift values with the shared formatter and active locale.
- Modify `src/lib/attendance-report.ts` to format PDF row shift values through the shared formatter.
- Modify `tests/attendanceCalculations.test.ts` to cover the shared formatter behavior.
- Modify `tests/attendanceReportPdfLayout.test.ts` to cover report builder shift output.
- Modify `tests/attendancePageDesign.test.ts` to require the shared formatter in the page output path.

### Task 1: Add Failing Display Contract Tests

- [ ] **Step 1: Add utility and report row assertions**

Add tests importing `formatShiftTimeRange` and `buildAttendanceReportData`, asserting:

```ts
assert.equal(formatShiftTimeRange('09:00:00', '17:00:00', 'en'), '09:00 AM - 05:00 PM');
assert.equal(formatShiftTimeRange('09:00:00', '17:00:00', 'ar'), '٠٩:٠٠ ص - ٠٥:٠٠ م');
assert.equal(buildAttendanceReportData([record], {}, 'Admin', 'en').rows[0]?.shift, '09:00 AM - 05:00 PM');
assert.equal(buildAttendanceReportData([record], {}, 'Admin', 'ar').rows[0]?.shift, '٠٩:٠٠ ص - ٠٥:٠٠ م');
```

- [ ] **Step 2: Require the page caller**

Add a page-source assertion that both shift cell call sites invoke:

```ts
formatShiftTimeRange(record.profiles?.shift_start, record.profiles?.shift_end, displayLocale)
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test -- tests/attendanceCalculations.test.ts tests/attendanceReportPdfLayout.test.ts tests/attendancePageDesign.test.ts`

Expected: FAIL because `formatShiftTimeRange` is not exported or consumed yet.

### Task 2: Implement Shared Formatting

- [ ] **Step 1: Export the shared formatter**

In `src/lib/utils.ts`, implement `formatShiftTimeRange(start, end, locale)` using `Intl.DateTimeFormat` with `hour12: true` and locale `en-US` or `ar-EG`; return `-` unless both endpoints exist.

- [ ] **Step 2: Consume it in both display boundaries**

Import and call `formatShiftTimeRange` in `src/lib/attendance-report.ts`. In `src/app/[locale]/admin/attendance/page.tsx`, obtain `useLocale()`, normalize it to `en` or `ar`, and use the helper in desktop and mobile shift rows.

- [ ] **Step 3: Run targeted tests to verify green**

Run: `npm test -- tests/attendanceCalculations.test.ts tests/attendanceReportPdfLayout.test.ts tests/attendancePageDesign.test.ts`

Expected: PASS.

### Task 3: Verification

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: exit code 0, or report any existing unrelated failures.

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: the new shift/PDF coverage passes; report the already observed unrelated login design failure if it remains.

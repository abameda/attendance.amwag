# Arabic Attendance Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate Arabic RTL PDF export option for attendance logs.

**Architecture:** Reuse the current export endpoint and report data model, adding a validated report locale parameter. Keep English output unchanged and make Arabic rendering a presentation concern inside the PDF component.

**Tech Stack:** Next.js App Router, React client component, `@react-pdf/renderer`, `next-intl`, Node test runner.

---

## File Structure

- Modify `tests/attendanceReportPdfLayout.test.ts` to cover Arabic report text, RTL row direction, and filenames.
- Modify `src/lib/attendance-report.ts` to define report locale support and localized filename behavior.
- Modify `src/lib/downloadAttendancePdf.ts` to send the requested report locale.
- Modify `src/app/api/admin/attendance/export-pdf/route.ts` to validate and pass the locale.
- Modify `src/components/pdf/AttendanceReportPdf.tsx` to render English LTR or Arabic RTL report chrome.
- Modify `src/app/[locale]/admin/attendance/page.tsx` and message files to add the separate Arabic export button.

## Tasks

### Task 1: Add Failing Contract Tests

- [ ] Add tests asserting Arabic footer text, banner title, table headers, status labels, RTL table row direction, and Arabic filename prefix.
- [ ] Run `npm test -- tests/attendanceReportPdfLayout.test.ts` and verify the new tests fail because locale support does not exist yet.

### Task 2: Add Locale Plumbing

- [ ] Add `AttendanceReportLocale = 'en' | 'ar'`, a locale parser, and locale-aware filename helper.
- [ ] Pass locale from the client helper to the API request body.
- [ ] Pass the validated locale from the API route to `buildPdfFilename` and `AttendanceReportPdf`.

### Task 3: Localize PDF Rendering

- [ ] Add English and Arabic label dictionaries in `AttendanceReportPdf.tsx`.
- [ ] Render Arabic pages with RTL direction, Amiri font, reversed table row/header order, Arabic status labels, and Arabic footer/page labels.
- [ ] Preserve current English labels and layout.

### Task 4: Add UI Action

- [ ] Add `exportArabicPDF` and `exportingArabicReport` translations.
- [ ] Add a second attendance export button that calls the same handler with `ar`.
- [ ] Keep separate loading state for the two export buttons.

### Task 5: Verify

- [ ] Run `npm test -- tests/attendanceReportPdfLayout.test.ts`.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.

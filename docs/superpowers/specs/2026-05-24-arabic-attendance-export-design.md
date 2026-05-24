# Design: Arabic Attendance PDF Export

## Goal

Add a separate Arabic PDF export option for attendance logs while preserving the existing English PDF export behavior.

## Scope

- Add a second export action on the attendance logs page.
- Reuse the current filtered attendance data query.
- Send a report locale to the existing PDF export endpoint.
- Render Arabic report chrome in RTL when the requested report locale is Arabic.
- Keep English as the default and backwards-compatible behavior.

## Architecture

The client keeps one data-fetch path for export records and passes the selected report locale to `downloadAttendanceReportPdf`. The API route accepts an optional `locale` in the request body, validates it to English or Arabic, builds the same attendance report data, then passes the locale to the React PDF component and filename helper.

`AttendanceReportPdf` owns the presentation differences: report title, metadata labels, KPI labels, table headers, status labels, footer text, page direction, and RTL row ordering. The data model remains unchanged so attendance calculations and filtering stay isolated from localization.

## Error Handling

Invalid or missing locale values fall back to English. Export errors continue to use the existing JSON error response and client toast flow.

## Testing

Unit tests cover that English output remains unchanged, Arabic report helpers return Arabic text, Arabic layout uses RTL row direction, and Arabic filenames are distinct from English filenames.

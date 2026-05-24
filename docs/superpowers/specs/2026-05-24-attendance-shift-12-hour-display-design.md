# Design: Attendance Shift 12-Hour Display

## Goal

Render configured attendance shift ranges in 12-hour format everywhere they appear in attendance logs and exported attendance PDFs.

## Scope

- Change shift display values only; do not change stored shift times or attendance calculations.
- Apply to the attendance logs desktop table and mobile record view.
- Apply to English and Arabic PDF report rows.
- Preserve `-` for records without a complete shift range.

## Architecture

Add one locale-aware `formatShiftTimeRange` display helper in `src/lib/utils.ts`. The attendance page reads its active `next-intl` locale and passes it to the helper. The PDF report-data builder already accepts an export locale, so it passes that same locale while creating each row.

English output uses 12-hour time with `AM`/`PM`, for example `09:00 AM - 05:00 PM`. Arabic output uses Arabic 12-hour period markers and digits through `ar-EG` formatting, for example `٠٩:٠٠ ص - ٠٥:٠٠ م`.

## Testing

- Add utility assertions for English, Arabic, overnight, and incomplete shift ranges.
- Add report-data assertions proving PDF rows use locale-aware formatted shifts.
- Assert that the attendance page renders shift cells through the shared formatter.
- Run targeted tests, then lint and the full test suite; report any unrelated existing failure separately.

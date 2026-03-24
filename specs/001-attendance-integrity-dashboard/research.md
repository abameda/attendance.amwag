# Research: Attendance Integrity Dashboard

## Decision 1: Use a server-hosted scheduled trigger for attendance finalization

- Decision: Keep attendance finalization in one backend-owned path that can be triggered either by `pg_cron` in Postgres or by a free `systemd` timer on the company server calling one protected internal endpoint.
- Rationale: The feature requires a free-to-run background process. `pg_cron` is already partially modeled in the repository, and `systemd` is a free self-hosted fallback when database scheduling is unavailable or undesirable.
- Alternatives considered:
  - Client-triggered finalization from the admin dashboard: rejected because finalization would be unreliable and dependent on user activity.
  - Paid third-party worker/scheduler services: rejected because the requirement explicitly prefers a free company-hosted approach.

## Decision 2: Keep `missing_checkout` as the canonical incomplete-shift state

- Decision: Preserve `missing_checkout` as the database status while presenting it in the UI as an incomplete shift where appropriate.
- Rationale: The status already exists across the current SQL, API, badge, and translations, so keeping it avoids a broad breaking rename while still meeting the business requirement.
- Alternatives considered:
  - Introduce a brand new `incomplete_shift` status immediately: rejected because it would expand migration scope without adding functional value beyond the current distinct state.
  - Auto-checkout every incomplete shift: rejected because it can create payroll and compliance ambiguity unless policy rules are explicitly defined.

## Decision 3: Require date selection before fetching any admin attendance dataset

- Decision: Attendance logs and date-specific dashboard insights should not fetch attendance records until the user selects a date.
- Rationale: The current admin attendance page fetches immediately on mount and always includes expected/pending logic. Date-gating removes unnecessary work and aligns with the requirement to avoid loading all historical data by default.
- Alternatives considered:
  - Default to today's date and auto-fetch: rejected because the requirement explicitly says the user must select a date first.
  - Continue loading a mixed default view with pagination: rejected because it keeps the current performance problem.

## Decision 4: Replace client-side multi-query dashboard stats with one aggregate backend contract

- Decision: Serve dashboard insight cards from one backend aggregate interface for a selected date.
- Rationale: The current dashboard issues several client-side count queries and still calculates some values in the browser. One aggregate response reduces round trips and centralizes branch compliance logic.
- Alternatives considered:
  - Keep multiple client-side count queries: rejected because it preserves unnecessary network chatter and duplicated business logic.
  - Precompute all daily summaries for all dates: rejected because the current requirement is on-demand, date-scoped fetching.

## Decision 5: Harden attendance event integrity around server authority

- Decision: Use only server-generated timestamps, reject duplicate check-ins explicitly, keep conditional check-out updates, and trust network/location data only from server-side proxy headers and branch IP validation.
- Rationale: The user requirement calls for bulletproof logic against fake time and duplicate entries. Server authority and explicit uniqueness checks are the lowest-complexity reliable approach.
- Alternatives considered:
  - Accept client timestamps with validation: rejected because client clocks can be manipulated.
  - Rely only on frontend button disabling to prevent duplicates: rejected because it is trivial to bypass.

## Decision 6: Fix the employee-form layout with structural changes, not cosmetic spacing patches

- Decision: Move the “shift ends at” helper into the shift-start field stack and make the overtime row wrap safely with `min-w-0`, `overflow-hidden`, and direction-aware thumb positioning.
- Rationale: The current empty gap is caused by a conditional full-row grid item, and the RTL overflow is caused by a rigid flex row and LTR-only transform values.
- Alternatives considered:
  - Mask the gap with fixed heights and margin tweaks: rejected because it does not address the underlying grid behavior.
  - Use separate RTL-only CSS overrides without restructuring: rejected because the current container still lacks safe wrapping constraints.

## Decision 7: Remove CSV and Excel exports, keep PDF unless product scope changes

- Decision: Remove CSV and Excel export flows from the admin UX and from the attendance page bundle, while leaving PDF export untouched unless a later requirement removes all export formats.
- Rationale: The requirement explicitly names CSV and Excel removal. This also removes the eager `xlsx` dependency from that page path.
- Alternatives considered:
  - Remove all exports including PDF: rejected because that was not requested in the feature spec.
  - Keep export code hidden behind feature flags: rejected because dead code and bundle cost would remain.

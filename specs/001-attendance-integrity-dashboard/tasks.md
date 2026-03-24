# Tasks: Attendance Integrity Dashboard

**Input**: Design documents from `/specs/001-attendance-integrity-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The feature spec did not request a TDD-first workflow or automated test creation, so this task list focuses on implementation and manual validation steps.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Next.js project rooted at `src/`
- Migrations in `migrations/`
- Feature docs in `specs/001-attendance-integrity-dashboard/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared feature scaffolding and align admin-facing types/messages with the planned contracts

- [X] T001 Update dashboard and attendance copy placeholders for date-first insights in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/messages/en.json` and `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/messages/ar.json`
- [X] T002 [P] Add shared dashboard summary types for selected-date insights in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/types/index.ts`
- [X] T003 [P] Add an internal scheduler authorization helper for protected background execution in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/lib/auth.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend and data prerequisites that MUST be complete before any user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create a corrective SQL migration for idempotent attendance finalization and missing `overtime_enabled` selection in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/migrations/20260324100000_fix_attendance_finalization.sql`
- [X] T005 [P] Implement a protected internal finalization endpoint matching the contract in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/api/internal/attendance/finalize/route.ts`
- [X] T006 [P] Add shared selected-date attendance summary query helpers in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/lib/timezone.ts` and `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/lib/utils.ts`
- [X] T007 Implement the date-scoped dashboard summary API contract in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/api/attendance/summary/route.ts`
- [X] T008 Harden admin attendance data access to return empty results without a selected date in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/api/attendance/route.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Review Daily Attendance Insights (Priority: P1) 🎯 MVP

**Goal**: Replace quick actions with date-driven dashboard insights and require date selection before attendance data loads

**Independent Test**: Open dashboard and attendance logs with no date selected and verify no attendance data loads; then select a date and verify only that date's statistics and records appear, with no CSV/Excel actions visible

### Implementation for User Story 1

- [X] T009 [US1] Refactor the admin dashboard to require date selection and render statistics and insights instead of quick actions in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/[locale]/admin/page.tsx`
- [X] T010 [P] [US1] Remove CSV and Excel export logic and convert attendance logs to date-gated loading in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/[locale]/admin/attendance/page.tsx`
- [X] T011 [P] [US1] Remove obsolete CSV export helpers that are no longer used by admin attendance flows in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/lib/utils.ts`
- [X] T012 [US1] Update PDF export entry points and empty-state messaging to remain consistent with date-first admin behavior in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/lib/pdfExport.ts` and `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/messages/en.json`

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Enforce End-of-Shift Attendance Outcomes (Priority: P1)

**Goal**: Finalize waiting employees to absent, finalize no-checkout shifts to missing checkout, and reject duplicate or untrusted attendance events

**Independent Test**: Simulate an employee who never checks in and another who checks in without checking out, run the finalization path after shift end, and verify final statuses are correct and not duplicated across repeated runs

### Implementation for User Story 2

- [X] T013 [US2] Update manual finalization trigger behavior to use the corrected backend finalization path in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/api/attendance/mark-absent/route.ts`
- [X] T014 [P] [US2] Harden duplicate check-in handling and server-authoritative state transitions in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/api/attendance/check-in/route.ts`
- [X] T015 [P] [US2] Preserve strict duplicate checkout protection and align incomplete-shift handling with the finalization policy in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/api/attendance/check-out/route.ts`
- [X] T016 [P] [US2] Align shared attendance status typing and badge presentation with the finalized incomplete-shift policy in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/types/index.ts` and `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/components/ui/Badge.tsx`
- [X] T017 [US2] Document the free self-hosted scheduler setup and protected internal trigger flow in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/README.md` and `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/specs/001-attendance-integrity-dashboard/quickstart.md`

**Checkpoint**: User Story 2 should be fully functional and testable independently

---

## Phase 5: User Story 3 - Maintain Stable Employee Management UI in Arabic and English (Priority: P2)

**Goal**: Remove the shift-start layout gap and keep the overtime switch contained in RTL and narrow layouts

**Independent Test**: Open the employee create/edit modal in English and Arabic, select a shift start time, and verify the helper text and overtime toggle remain visually stable and contained

### Implementation for User Story 3

- [X] T018 [US3] Move the shift-end helper into the shift-start field stack to eliminate the conditional grid gap in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/[locale]/admin/employees/page.tsx`
- [X] T019 [US3] Make the overtime tracking row and switch RTL-safe and overflow-safe in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/[locale]/admin/employees/page.tsx`
- [X] T020 [P] [US3] Add any shared RTL-safe utility classes or global overflow safeguards needed by the employee modal in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/globals.css`

**Checkpoint**: User Story 3 should be fully functional and testable independently

---

## Phase 6: User Story 4 - Navigate the Admin Panel Responsively (Priority: P2)

**Goal**: Reduce perceived slowness across admin navigation by cutting redundant requests, bundle cost, and unnecessary rerenders

**Independent Test**: Navigate repeatedly between dashboard, employees, and attendance pages and confirm that previously viewed data is reused where appropriate and no unnecessary initial attendance loads occur

### Implementation for User Story 4

- [X] T021 [US4] Replace mount-time dashboard fetching with selected-date cached summary loading in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/[locale]/admin/page.tsx`
- [X] T022 [P] [US4] Reduce attendance page client bundle cost by removing eager Excel dependencies and simplifying client-side export code in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/[locale]/admin/attendance/page.tsx`
- [X] T023 [P] [US4] Reduce redundant employee-page rerenders and align fetch behavior with admin navigation expectations in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/[locale]/admin/employees/page.tsx`
- [X] T024 [US4] Review and tune date/status attendance indexes for the selected-date access pattern in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/migrations/20260305120000_add_dashboard_indexes.sql`

**Checkpoint**: User Story 4 should be fully functional and testable independently

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, validation, and cross-story consistency

- [X] T025 [P] Remove stale imports, dead code, and unused dependencies introduced by CSV/Excel removal in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/package.json` and `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/package-lock.json`
- [X] T026 Run feature validation and fix any lint issues surfaced by `npm run lint` from `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance`
- [ ] T027 [P] Validate the manual scenarios captured in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/specs/001-attendance-integrity-dashboard/quickstart.md` and record any follow-up notes in `/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/specs/001-attendance-integrity-dashboard/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion
- **User Story 3 (Phase 5)**: Depends on Foundational completion
- **User Story 4 (Phase 6)**: Depends on Foundational completion and benefits from User Story 1 changes
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - MVP story
- **User Story 2 (P1)**: Can start after Foundational - independent from US1 in core logic, but shared admin messaging should be reconciled after both land
- **User Story 3 (P2)**: Can start after Foundational - independent UI fix
- **User Story 4 (P2)**: Can start after Foundational, but should land after or alongside US1 so performance work applies to the final date-first dashboard flow

### Within Each User Story

- Shared contracts and foundational APIs before UI consumption
- Backend state logic before admin/manual validation
- Story-specific UI cleanup after core behavior is in place
- Manual validation before polish completion

### Parallel Opportunities

- `T002` and `T003` can run in parallel in Setup
- `T005` and `T006` can run in parallel in Foundational
- `T010` and `T011` can run in parallel in User Story 1
- `T014`, `T015`, and `T016` can run in parallel in User Story 2
- `T018` and `T019` should stay sequential in one file, but `T020` can run independently
- `T022`, `T023`, and `T024` can run in parallel in User Story 4
- `T025` and `T027` can run in parallel in Polish

---

## Parallel Example: User Story 2

```bash
Task: "Harden duplicate check-in handling and server-authoritative state transitions in /Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/api/attendance/check-in/route.ts"
Task: "Preserve strict duplicate checkout protection and align incomplete-shift handling with the finalization policy in /Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/app/api/attendance/check-out/route.ts"
Task: "Align shared attendance status typing and badge presentation with the finalized incomplete-shift policy in /Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/types/index.ts and /Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/src/components/ui/Badge.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate the date-first dashboard and attendance log flow

### Incremental Delivery

1. Deliver User Story 1 for immediate admin value and removal of default heavy fetches
2. Deliver User Story 2 to lock in attendance integrity and background finalization
3. Deliver User Story 3 to resolve the employee-management UI defects
4. Deliver User Story 4 to optimize navigation and reduce repeated work
5. Finish with cross-cutting cleanup and validation

### Parallel Team Strategy

1. One developer handles Phase 2 backend foundation
2. After Phase 2:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. User Story 4 starts once the main date-first flow is merged or stable enough for optimization work

---

## Notes

- All tasks follow the required checklist format with IDs and file paths
- [P] tasks target disjoint files or non-blocking validation work
- User stories remain independently testable at each checkpoint
- No automated test tasks were added because the feature specification did not request them explicitly

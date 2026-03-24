# Feature Specification: Attendance Integrity Dashboard

**Feature Branch**: `001-attendance-integrity-dashboard`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "Act as a Senior Full-Stack Engineer and System Architect. Here are the requirements categorized by domain: Dashboard Module: Remove Quick Actions and replace with Statistics & Insights, add attendance and departure rates and branch compliance stats, remove CSV and Excel exports, require selecting a specific date before fetching attendance data, automatically convert waiting status to absent after shift grace expires, detect incomplete shifts when check-in exists without check-out. Employees Module: fix layout gap after selecting shift start time and fix RTL overtime toggle overflow. Overall System Performance & Security: optimize slow panel navigation, reduce re-renders, lazy load and cache data, and harden attendance logic against fake time and duplicate entries. Expected Output Strategy: architecture and background worker plan using free self-hosted services, frontend plan for CSS and date-gated fetching, performance audit with three actions, and exact code snippets for core logic and CSS fixes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review Daily Attendance Insights (Priority: P1)

An administrator opens the dashboard, selects a specific work date, and sees daily attendance insights for that date without loading all historical records by default.

**Why this priority**: Daily monitoring is the core purpose of the admin panel and the biggest current performance bottleneck.

**Independent Test**: Can be fully tested by loading the dashboard and attendance logs with no selected date, then selecting a date and verifying that only that day's statistics and records appear.

**Acceptance Scenarios**:

1. **Given** an administrator opens the dashboard with no date selected, **When** the page finishes loading, **Then** the system does not fetch or display attendance records for any date and clearly prompts for a date selection.
2. **Given** an administrator selects a date, **When** the dashboard and attendance logs load, **Then** the system displays statistics and records only for that selected date.
3. **Given** daily attendance data exists for multiple branches, **When** the selected date's dashboard loads, **Then** the statistics area shows overall attendance rate, overall departure completion rate, and the branch with the highest attendance compliance for that date.
4. **Given** the dashboard is displayed, **When** the administrator views available actions, **Then** the old quick actions and CSV/Excel export actions are not shown.

---

### User Story 2 - Enforce End-of-Shift Attendance Outcomes (Priority: P1)

An administrator and auditor can trust that the system automatically converts unresolved attendance states into final outcomes after the relevant shift deadlines pass.

**Why this priority**: Incorrect attendance status directly affects payroll, compliance, and trust in the system.

**Independent Test**: Can be fully tested by creating records for employees who never check in and employees who check in but never check out, then advancing evaluation time beyond shift deadlines and verifying final status updates.

**Acceptance Scenarios**:

1. **Given** an employee is expected to work on a date and has not checked in before the allowed grace period ends, **When** the shift is evaluated after the deadline, **Then** the employee is marked absent for that work date.
2. **Given** an employee checked in but did not check out by the time the shift and allowed overtime window end, **When** the shift is evaluated after the deadline, **Then** the record is updated to an incomplete-shift outcome that is clearly distinguishable from a complete attendance record.
3. **Given** an employee completed both check-in and check-out correctly, **When** end-of-shift evaluation runs, **Then** the system leaves the completed record unchanged.
4. **Given** the evaluation process runs more than once for the same attendance date, **When** previously finalized records are encountered, **Then** the system does not create duplicates or change already-finalized outcomes incorrectly.

---

### User Story 3 - Maintain Stable Employee Management UI in Arabic and English (Priority: P2)

An administrator manages employee shift settings without layout glitches, including when using Arabic right-to-left mode.

**Why this priority**: The form must remain usable and visually correct because administrators rely on it to maintain shift definitions that drive attendance accuracy.

**Independent Test**: Can be fully tested by opening the employee create/edit modal in both left-to-right and right-to-left layouts, setting a shift start time, and toggling overtime tracking.

**Acceptance Scenarios**:

1. **Given** the employee modal is open, **When** the administrator selects a shift start time, **Then** the layout remains compact and no unexplained empty gap appears in the form.
2. **Given** the employee modal is displayed in Arabic right-to-left mode, **When** the administrator views or toggles overtime tracking, **Then** the switch remains fully inside its parent container without overflow or clipping.

---

### User Story 4 - Navigate the Admin Panel Responsively (Priority: P2)

An administrator moves between dashboard, employees, and attendance pages without noticeable delay caused by unnecessary client work or repeated data loading.

**Why this priority**: Slow navigation reduces day-to-day usability and makes the system feel unreliable even when the underlying data is correct.

**Independent Test**: Can be tested by navigating repeatedly between main admin pages and verifying faster transition time, reduced redundant fetches, and stable page rendering.

**Acceptance Scenarios**:

1. **Given** an administrator navigates between admin pages, **When** the destination page loads, **Then** only the minimum required data is requested for the selected context.
2. **Given** an administrator revisits a page or filter state recently viewed, **When** the page renders, **Then** the system reuses cached or already-available data where appropriate instead of repeating equivalent requests.

### Edge Cases

- What happens when an administrator selects a date with no scheduled employees or no attendance records? The dashboard and logs should show empty-state messaging rather than errors or stale results.
- How does the system handle overnight shifts that start on one calendar date and end on the next? Final attendance outcomes must be applied to the correct work date.
- What happens when end-of-shift evaluation runs while another evaluation is already in progress? The later run must exit safely without duplicating or corrupting results.
- How does the system handle employees on their configured off day? They must not be treated as pending, absent, or missing checkout for that day.
- What happens when a user attempts repeated check-in or check-out actions for the same work date? The system must reject duplicate or contradictory actions and preserve a single authoritative record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST remove the dashboard quick-actions section and replace it with a statistics and insights section focused on attendance outcomes.
- **FR-002**: The dashboard MUST display, for the selected date, overall attendance compliance, overall departure completion compliance, and the branch with the highest attendance compliance.
- **FR-003**: The dashboard and attendance log views MUST require the administrator to select a specific date before attendance data is fetched or displayed.
- **FR-004**: The system MUST default to an empty pre-selection state that clearly indicates a date is required before records and daily insights can be viewed.
- **FR-005**: The system MUST remove CSV and Excel export actions from the admin experience for attendance reporting.
- **FR-006**: The system MUST evaluate unresolved attendance states after shift deadlines and automatically convert employees who never checked in from waiting or expected status to absent for the correct work date.
- **FR-007**: The system MUST detect employees who checked in but did not check out before the end of the allowed shift window and mark the record with a distinct incomplete-shift outcome.
- **FR-008**: The system MUST ensure end-of-shift evaluation is idempotent so repeated runs do not create duplicate records or conflicting state changes.
- **FR-009**: The system MUST base attendance decisions on server-controlled time and server-validated event sequencing rather than user-provided timestamps.
- **FR-010**: The system MUST prevent duplicate attendance events for the same employee and work date when an equivalent outcome already exists.
- **FR-011**: The employee create/edit experience MUST remain visually stable when a shift start time is selected, without leaving unexplained layout gaps.
- **FR-012**: The employee create/edit experience MUST keep the overtime tracking control fully contained within its parent container in right-to-left mode.
- **FR-013**: Admin page navigation MUST minimize redundant data fetching and unnecessary re-rendering when users move between core pages.
- **FR-014**: The system MUST support a free-to-run background evaluation approach that can be hosted on the company server without requiring paid managed worker infrastructure.

### Key Entities *(include if feature involves data)*

- **Attendance Day Summary**: A per-date summary of attendance compliance, departure completion, missing checkout counts, and branch-level ranking for administrator review.
- **Attendance Evaluation Job**: A repeatable background process that reviews unresolved attendance records after deadlines and finalizes them into absent, complete, or incomplete outcomes.
- **Attendance Record**: The authoritative daily attendance entry for one employee on one work date, including status, timestamps, and finalization state.
- **Shift Definition**: The assigned working schedule for an employee, including start time, end time, off day, and overtime allowance that determines final attendance outcomes.
- **Branch Compliance Insight**: A date-scoped metric that compares expected employees versus compliant attendance outcomes for each branch.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When no date is selected, the dashboard and attendance logs perform zero attendance-record fetches for historical or daily lists.
- **SC-002**: After a date is selected, the dashboard shows daily insights and attendance logs for that date within 2 seconds for a typical branch-wide workday load.
- **SC-003**: In validation testing, 100% of employees who miss check-in beyond the allowed grace period are finalized as absent on the correct work date without manual intervention.
- **SC-004**: In validation testing, 100% of employees who check in but do not check out by the end of the allowed shift window are finalized into the defined incomplete-shift outcome without duplicate records.
- **SC-005**: In Arabic right-to-left mode and English left-to-right mode, the employee form shows no overflow, clipped controls, or unexplained spacing gaps in the tested shift and overtime controls.
- **SC-006**: Repeated navigation across dashboard, employees, and attendance pages reduces repeated equivalent data requests for previously viewed states by at least 50%.

## Assumptions

- The existing distinct end-of-shift outcome for a checked-in employee without check-out can remain the current missing-checkout concept, provided it is presented clearly to administrators as an incomplete shift.
- The required date-selection gate applies to detailed attendance datasets and date-specific dashboard insights; generic page chrome and empty-state guidance may still render before a date is chosen.
- Company-hosted background evaluation may run on the same server as the application, provided it is free to operate and does not depend on paid third-party schedulers.

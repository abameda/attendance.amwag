# Implementation Plan: Attendance Integrity Dashboard

**Branch**: `001-attendance-integrity-dashboard` | **Date**: 2026-03-24 | **Spec**: [spec.md](/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/specs/001-attendance-integrity-dashboard/spec.md)
**Input**: Feature specification from `/specs/001-attendance-integrity-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the current dashboard quick-actions workflow with date-driven statistics and insights, require explicit date selection before attendance data loads, harden attendance state transitions so unresolved records finalize automatically and safely, and fix the employee-form layout issues in both LTR and RTL modes. The implementation will keep final attendance state logic centralized in backend/database workflows, reduce client bundle and fetch cost on admin pages, and document the internal contracts needed for the scheduler and admin UI.

## Technical Context

**Language/Version**: TypeScript 5, React 19.2.3, Next.js 15.1.0  
**Primary Dependencies**: Next.js App Router, `@supabase/supabase-js`, `@supabase/ssr`, `next-intl`, Tailwind CSS 4, `lucide-react`, `jspdf`, `html2canvas`  
**Storage**: Supabase PostgreSQL  
**Testing**: ESLint via `npm run lint`; no dedicated automated test suite currently present  
**Target Platform**: Company-hosted Linux server for the Next.js app, browser-based admin SPA, Supabase-backed database  
**Project Type**: Web application with integrated API routes and database-backed admin/employee panels  
**Performance Goals**: No attendance list or date-specific dashboard fetch before date selection; selected-date admin views should return in under 2 seconds for normal daily usage; reduce repeated equivalent requests across admin navigation  
**Constraints**: Free self-hosted background execution, server-authoritative attendance timing, idempotent attendance finalization, preserve Arabic RTL support, avoid loading unnecessary client-side export libraries on admin pages  
**Scale/Scope**: Single attendance product with admin dashboard, employee management, employee check-in/out flow, and Supabase-backed daily records for multi-branch staff

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution at `.specify/memory/constitution.md` is still an unfilled placeholder and does not define enforceable project-specific gates. Current planning therefore applies the effective gates implied by the existing product requirements:

- Pass: Final attendance decisions remain server-side and are not delegated to client code.
- Pass: The plan keeps a single source of truth for absence and missing-checkout finalization.
- Pass: Performance work focuses on removing unnecessary requests and bundle cost before adding complexity.
- Pass: Security work strengthens duplicate prevention, server-time authority, and proxy/IP trust boundaries.

Post-design re-check:

- Pass: Research, data model, contracts, and quickstart artifacts all preserve the same backend-authoritative design.
- Pass: No new unjustified architectural layers were introduced beyond one internal finalization interface and one aggregate dashboard interface.

## Project Structure

### Documentation (this feature)

```text
specs/001-attendance-integrity-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── attendance-admin-api.md
│   └── internal-finalization-job.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── [locale]/
│   │   ├── admin/
│   │   │   ├── page.tsx
│   │   │   ├── attendance/page.tsx
│   │   │   └── employees/page.tsx
│   │   └── employee/page.tsx
│   └── api/
│       ├── attendance/
│       │   ├── route.ts
│       │   ├── check-in/route.ts
│       │   ├── check-out/route.ts
│       │   └── mark-absent/route.ts
│       └── employees/
│           ├── route.ts
│           └── [id]/route.ts
├── components/
│   └── ui/
├── lib/
│   ├── auth.ts
│   ├── supabase/
│   ├── timezone.ts
│   ├── utils.ts
│   └── pdfExport.ts
└── types/

migrations/
├── 20260125000000_add_missing_checkout_status.sql
├── 20260305000000_pg_cron_mark_absent.sql
└── 20260305120000_add_dashboard_indexes.sql
```

**Structure Decision**: Keep the existing single Next.js application structure. Implement the feature by updating the admin dashboard page, attendance logs page, employees modal layout, attendance API routes, and SQL migration path rather than introducing a separate service.

## Complexity Tracking

No constitution violations or extra complexity exceptions were required during planning.

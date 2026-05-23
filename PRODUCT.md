# Product

## Register

product

## Users

Amwag Attendance is used by employees, HR and operations admins, accountants, and management.

Employees use the product to clock in, clock out, verify their current attendance state, and understand why an action may be blocked. Their experience must be fast, obvious, and resilient on mobile, desktop, and shared office devices. They need large actions, clear identity context, visible branch and time information, and immediate feedback after every attendance action.

Admins, HR, and operations users manage employees, monitor daily attendance, review exceptions, manage branches and allowed IP rules, export reports, and resolve operational problems such as absence, lateness, early leave, missing checkout, overtime, and unauthorized IP activity. They need a dashboard that feels premium without slowing down the work: the state of the workforce should be readable in seconds.

Accountants and management users review attendance records, export PDFs and logs, and use reports for payroll, audit, and operational decisions. They need records that feel trustworthy, filters that match exported data, and KPI presentation strong enough for executive review.

## Product Purpose

Amwag Attendance is an internal attendance management system for Amwag. It exists to make daily workforce attendance accurate, auditable, and easy to act on across employees, branches, HR, operations, accounting, and management.

The product is pivoting to a Premium Liquid Glass aesthetic: a modern, dimensional, animated SaaS interface with frosted glass panels, luminous depth, fluid backgrounds, and polished motion. The visual language should feel top-tier and current while preserving the operational seriousness of attendance, payroll, and compliance workflows.

Success means users can quickly answer the questions that matter: who is present, who is absent, who is late, who left early, who missed checkout, which branch has issues, what requires action today, and what should be exported for payroll or review.

## Brand Personality

Premium, fluid, precise, authoritative.

The interface should feel like a high-end operational command center made of light, depth, and glass. It should be calm enough for daily HR use, vivid enough to feel modern, and precise enough to support payroll-grade trust. Arabic and English users should both feel that the product was designed intentionally for their workflow, not translated after the fact.

The product voice is concise and direct. Labels, empty states, errors, and confirmations should explain the operational consequence of a state or action without marketing language.

## Anti-references

Do not return to the previous flat ledger look: beige canvas, opaque paper cards, low-motion layouts, timid KPI scale, and purely functional panels are no longer the design direction.

Avoid generic admin templates, default Tailwind dashboards, harsh black cyber UI, neon gaming aesthetics, childish gamification, busy decorative charts, low-contrast frosted panels, and beautiful metrics that do not help the user act.

Avoid motion that blocks work, distracts from attendance state, or ignores reduced-motion preferences. Animation should make the interface feel fluid and premium, not slow or theatrical.

Avoid flat line charts for key dashboard analytics. Attendance trends should feel dimensional through gradient area fills, soft grid lines, and clear labels.

## Design Principles

1. Make operational status instantly readable, even inside a highly stylized glass interface.
2. Use depth, blur, translucency, and motion as the product identity, not as random decoration.
3. Make KPI moments heroic: attendance rates, counts, exceptions, and today totals must command attention.
4. Treat Arabic, English, LTR, and RTL as first-class design constraints.
5. Keep every premium effect subordinate to trust, accessibility, performance, and action clarity.

## Accessibility & Inclusion

Aim for WCAG 2.2 AA as the practical baseline. Premium glass cannot come at the cost of readability. Text on glass must maintain strong contrast through dark slate or zinc text, calibrated panel opacity, backdrop blur, and fallback solid layers where needed.

Arabic and English are first-class experiences. RTL layouts must be intentionally checked for navigation, tables, charts, filters, modals, forms, truncation, icon placement, and motion direction.

Attendance status must never depend on color alone. Present, absent, late, missing checkout, early leave, overtime, and unauthorized IP states should use color, text, and where useful, Lucide icons. Statuses must remain distinguishable for color-blind users and readable on translucent surfaces.

Support `prefers-reduced-motion`. Framer Motion transitions should have reduced-motion variants that preserve clarity without large movement, blur sweeps, or staggered choreography. Background motion must slow or stop when reduced motion is requested.

All admin and employee actions must be accessible by keyboard. Focus states must be visible on glass panels and controls. Modals, dropdowns, date pickers, tables, filters, and forms must support keyboard use without traps.

Employee clock-in and clock-out actions require large touch targets, clear identity context, explicit branch/time/status information, and visible logout behavior on shared devices. Critical actions should not rely on tiny icon-only controls.

Every important operation needs feedback for loading, saving, success, error, export progress, and disabled states. Users should never wonder whether a clock action, admin update, report export, or filter change succeeded.

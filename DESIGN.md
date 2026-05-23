---
name: Amwag Attendance
description: Dark Graphite Glass admin foundation for bilingual HR, workforce, payroll, and management workflows.
stack:
  frontend: "Next.js 15 App Router, React 19, TypeScript 5"
  styling: "Tailwind CSS 4 via @tailwindcss/postcss"
  animation: "Framer Motion"
  icons: "Lucide React"
  charts: "Recharts"
  localization: "next-intl"
  components: "Custom UI components in src/components/ui"
colors:
  admin-canvas: "oklch(13.5% 0.012 250)"
  admin-canvas-deep: "oklch(9.5% 0.01 250)"
  admin-canvas-raised: "oklch(17.5% 0.014 250)"
  admin-cool-field: "oklch(23% 0.036 238)"
  admin-glass: "rgb(255 255 255 / 0.075)"
  admin-glass-strong: "rgb(255 255 255 / 0.105)"
  admin-glass-muted: "rgb(255 255 255 / 0.055)"
  admin-glass-border: "rgb(255 255 255 / 0.16)"
  admin-glass-border-muted: "rgb(255 255 255 / 0.115)"
  admin-ink: "oklch(93.5% 0.01 250)"
  admin-ink-strong: "oklch(97% 0.008 250)"
  admin-text-soft: "oklch(78% 0.018 250)"
  admin-text-muted: "oklch(68% 0.018 250)"
  admin-primary: "oklch(64% 0.115 238)"
  admin-primary-strong: "oklch(70% 0.12 238)"
  admin-success: "oklch(72% 0.13 158)"
  admin-warning: "oklch(77% 0.13 78)"
  admin-danger: "oklch(67% 0.15 28)"
  admin-info: "oklch(72% 0.105 232)"
shadows:
  admin-glass: "0 18px 48px rgba(0, 0, 0, 0.34)"
  admin-glass-hover: "0 22px 58px rgba(0, 0, 0, 0.42)"
  admin-glass-strong: "0 28px 78px rgba(0, 0, 0, 0.48)"
typography:
  ui:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    letterSpacing: "0"
radii:
  control: "0.75rem"
  panel: "1.5rem"
  shell: "1.75rem"
motion:
  ease: "[0.16, 1, 0.3, 1]"
  fast: "0.2s"
  base: "0.24s"
  background: "36s to 42s, opacity and tiny scale only"
---

# Design System: Dark Graphite Glass

## 1. Scope

Dark Graphite Glass is the approved foundation for admin surfaces only. It applies to the admin app shell, admin sidebar, admin dashboard, admin tables, admin filters, admin status badges, admin toasts, and admin glass utilities. Employee clock-in and clock-out surfaces keep their current employee visual system until a separate direction is approved.

Physical scene: HR and operations admins monitor attendance, exceptions, branch health, and payroll-sensitive exports on office desktops and laptops for long sessions. The interface should feel like a premium operational command system: dark, calm, dense, legible, and serious.

This is not a neon, cyber, gaming, star-field, AI-gradient, or purple-glow direction. The product should feel expensive because the hierarchy, contrast, and materials are disciplined.

## 2. Architecture Rules

- Styling tokens live in `src/app/globals.css`, scoped under `.admin-glass-surface`.
- Admin-only theme overrides must not leak into employee attendance screens.
- `AdminShell` owns the admin canvas, background, top bar, sidebar, mobile drawer behavior, and content layering.
- `AppSidebar` uses shared admin glass utilities for rail, active navigation, profile block, language control area, and logout.
- `LiquidBackground` is a graphite canvas layer with subtle cool radial depth. It must not use blobs, stars, purple fields, colorful gradients, or fast animation.
- Dashboard retheming should align the existing dashboard to the foundation without redesigning every admin page.
- Attendance calculations, check-in and checkout logic, summary API behavior, branch IP validation, PDF export logic, auth API behavior, password reset logic, database schema, and employee business logic are not design-system work.

## 3. Background Canvas

The admin canvas uses a near-black graphite base, one or two broad cool light fields, and optional barely visible grid or noise. It should read as dimensional graphite, not decorative scenery.

Use:

```txt
oklch(9.5% 0.01 250) to oklch(13.5% 0.012 250)
radial rgb(37 99 235 / 0.12 to 0.16)
radial rgb(14 116 144 / 0.10 to 0.12)
```

Do not use:

```txt
violet fields
purple glow
small animated blobs
star fields
rainbow or AI gradients
gradient text
```

Motion is optional and must be extremely subtle. Animate opacity and tiny scale only. In `prefers-reduced-motion`, remove the motion and keep the static graphite canvas.

## 4. Glass Surface Tokens

Admin surfaces use dark translucent glass with visible carved edges:

```txt
--admin-glass: rgb(255 255 255 / 0.075)
--admin-glass-strong: rgb(255 255 255 / 0.105)
--admin-glass-muted: rgb(255 255 255 / 0.055)
--admin-glass-border: rgb(255 255 255 / 0.16)
--admin-glass-border-muted: rgb(255 255 255 / 0.115)
```

Standard panel:

```txt
border: 1px solid var(--admin-glass-border)
background: var(--admin-glass)
backdrop-filter: blur(18px)
box-shadow: var(--admin-shadow-glass)
```

Muted panel:

```txt
border: 1px solid var(--admin-glass-border-muted)
background: var(--admin-glass-muted)
backdrop-filter: blur(14px)
```

Interactive panel:

```txt
background: var(--admin-glass)
hover background: rgb(255 255 255 / 0.095)
hover border: rgb(255 255 255 / 0.2)
hover transform: translateY(-0.125rem)
```

Glass is purposeful here: shell, panels, tables, filters, drawers, toasts, and compact operational cards. Do not nest glass cards for decoration.

## 5. Text

Text on dark glass must be strong enough for long HR sessions:

```txt
Primary: oklch(97% 0.008 250)
Body: oklch(93.5% 0.01 250)
Secondary: oklch(78% 0.018 250)
Muted: oklch(68% 0.018 250)
```

Use hierarchy through weight, scale, and spacing. Do not use gradient text. Do not use faint gray labels on glass. If a panel has dense data, raise surface opacity before lowering text contrast.

## 6. Buttons And Focus

Primary admin actions use restrained navy-blue glass:

```txt
border rgb(96 165 250 / 0.36)
background rgb(30 64 175 / 0.72)
text var(--admin-ink-strong)
```

Use this for Save, Export, Create, Confirm, and other decisive admin actions.

Secondary actions use dark glass with a visible border. Destructive actions use dark red glass:

```txt
border rgb(248 113 113 / 0.32)
background rgb(127 29 29 / 0.28 to 0.42)
text oklch(89% 0.055 28)
```

Focus rings must be visible and distinct from selected states:

```txt
0 0 0 2px rgb(147 197 253 / 0.95)
0 0 0 5px rgb(15 23 42 / 0.92)
```

Focus is an accessibility state, not a selected state. Do not reuse active navigation fill as a focus ring.

## 7. Sidebar

The admin sidebar is a dark glass rail:

```txt
background rgb(255 255 255 / 0.075)
border rgb(255 255 255 / 0.16)
backdrop-filter blur(18px)
shadow 0 24px 70px rgba(0, 0, 0, 0.42)
```

Active navigation uses a contained translucent navy-blue fill:

```txt
border rgb(96 165 250 / 0.34)
background rgb(30 64 175 / 0.34)
text var(--admin-ink-strong)
```

Do not use side stripes. Active items emphasize icon and label together. The sidebar must keep logical `start` positioning so LTR and RTL work without duplicating layout code. The mobile drawer remains a dialog with focus trap, escape close, focus return, `aria-modal`, and inert background content.

## 8. KPI Cards

KPI cards should feel like executive instruments, not decorative hero metrics. Use:

- Strong numeric hierarchy.
- Compact labels.
- A small icon or semantic status marker.
- Operational context only when useful.
- Dense responsive grids that avoid oversized marketing-card rhythm.

Use dark glass surfaces with subtle semantic tint. Avoid large colorful gradients, purple accents, and decorative glow.

## 9. Tables And Filters

Tables use a dark glass shell:

```txt
border var(--admin-glass-border)
background rgb(255 255 255 / 0.06)
row background rgb(255 255 255 / 0.035)
row hover rgb(255 255 255 / 0.075)
header background rgb(255 255 255 / 0.055)
```

Tables should remain dense, calm, readable, and horizontally resilient. Sticky headers may be used where already supported. Filters and date controls belong inside the same dark glass system, not as bright detached controls.

## 10. Status Badges

Status cannot rely on color alone. Use color, text, and an icon or marker where useful. Icons should come from Lucide React.

Recommended admin status roles:

```txt
Present: emerald text on emerald dark glass, CheckCircle2
Late: amber text on amber dark glass, AlarmClock
Absent: red text on red dark glass, UserX
Missing checkout: amber text on amber dark glass, TriangleAlert
Early leave: red text on red dark glass, TimerOff
Overtime: blue text on blue dark glass, Hourglass
Info or neutral: slate or blue text on dark glass, AlertCircle or Info
```

Badges must include readable text and a visible border. Glow is not required and should be avoided unless it conveys an active live state.

## 11. RTL And Localization

Arabic and English are first-class. Admin shell and sidebar use logical properties such as `start`, `ps`, and `pe` where possible. Icons that imply direction, such as arrows and chevrons, must rotate or mirror in RTL. Labels must wrap safely without clipping, especially in KPI cards, table cells, buttons, and sidebar items.

## 12. Accessibility And Performance

- Target WCAG 2.2 AA contrast for body text on glass.
- Raise panel opacity when contrast is weak.
- Preserve keyboard navigation and visible focus.
- Keep mobile drawer dialog semantics and focus management.
- Respect `prefers-reduced-motion`.
- On mobile, reduce backdrop blur cost. Use 10px to 14px blur rather than stacking many 18px layers.
- Do not animate layout properties.
- Avoid excessive glass layers over glass layers.

## 13. Admin Foundation Checklist

Use this checklist for future admin work:

- Dark graphite canvas is present and scoped to admin.
- No purple glow, neon gaming look, star field, colorful AI gradient, or gradient text.
- Panels have dark translucent fills, visible borders, and moderate blur.
- Primary actions use restrained navy-blue glass.
- Secondary actions use dark glass.
- Destructive actions use dark red glass without glow.
- Sidebar active state is contained fill, not a side stripe.
- KPI cards are dense and operational.
- Tables are readable, calm, and compact.
- Statuses use text plus color plus icon or marker.
- RTL and mobile drawer accessibility still work.
- Reduced motion keeps the interface usable without atmospheric movement.

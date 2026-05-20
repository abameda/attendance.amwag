---
name: Amwag Attendance
description: Premium Liquid Glass attendance operations interface for bilingual HR, workforce, payroll, and management workflows.
stack:
  frontend: "Next.js 15 App Router, React 19, TypeScript 5"
  styling: "Tailwind CSS 4 via @tailwindcss/postcss"
  animation: "Framer Motion"
  icons: "Lucide React"
  charts: "Recharts"
  localization: "next-intl"
  components: "Custom UI components in src/components/ui"
colors:
  canvas: "oklch(97% 0.018 220)"
  canvas-cyan: "oklch(94% 0.042 210)"
  canvas-lavender: "oklch(94% 0.038 292)"
  canvas-teal: "oklch(93% 0.04 178)"
  glass: "rgb(255 255 255 / 0.34)"
  glass-strong: "rgb(255 255 255 / 0.46)"
  glass-muted: "rgb(248 250 252 / 0.28)"
  glass-border: "rgb(255 255 255 / 0.58)"
  glass-border-muted: "rgb(203 213 225 / 0.32)"
  ink: "oklch(23% 0.025 255)"
  ink-strong: "oklch(16% 0.03 255)"
  text-muted: "oklch(44% 0.028 255)"
  primary: "oklch(57% 0.13 215)"
  primary-strong: "oklch(48% 0.15 225)"
  primary-soft: "oklch(86% 0.065 215)"
  violet: "oklch(62% 0.12 295)"
  teal: "oklch(61% 0.115 178)"
  success: "oklch(54% 0.12 155)"
  warning: "oklch(68% 0.14 78)"
  danger: "oklch(58% 0.16 28)"
  info: "oklch(58% 0.13 235)"
shadows:
  glass: "0 8px 32px 0 rgba(31, 38, 135, 0.07)"
  glass-hover: "0 16px 48px 0 rgba(31, 38, 135, 0.13)"
  glass-strong: "0 24px 70px 0 rgba(45, 70, 140, 0.16)"
typography:
  display:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
  kpi:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 750
    lineHeight: 1.12
    letterSpacing: "0"
  title:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 450
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
radii:
  control: "0.75rem"
  card: "1.25rem"
  panel: "1.5rem"
  shell: "2rem"
motion:
  ease: "[0.16, 1, 0.3, 1]"
  fast: "0.2s"
  base: "0.3s"
  fluid: "0.65s"
  page: "0.42s"
---

# Design System: Premium Liquid Glass

## 1. North Star

Amwag Attendance must look and feel like a premium glass SaaS command center for workforce operations. The interface uses translucent layers, intense backdrop blur, soft colored shadow, fluid background motion, heroic KPI typography, and Framer Motion choreography to create depth and momentum.

This is still a product UI. The glass aesthetic is mandatory, but it must never weaken attendance clarity, payroll trust, bilingual readability, keyboard access, or export accuracy. Every glass panel must contain useful operational information or a clear workflow.

Physical scene: HR and operations teams review live attendance on bright office displays during the workday, while employees use mobile and shared devices in practical lighting. The product should therefore use a luminous light glass theme, not a dark cyber theme.

## 2. Architecture Rules

- Frontend surfaces are built in Next.js 15 App Router with React 19 and TypeScript 5.
- Styling uses Tailwind CSS 4 utilities and `@theme` tokens in `src/app/globals.css`.
- Reusable primitives live under `src/components/ui`. Extend these primitives before creating one-off visual systems.
- Framer Motion is the default animation layer for page transitions, staggered dashboard entry, hover lift, and background movement.
- Lucide React is the icon source for controls, statuses, navigation, and table actions.
- Recharts is the charting layer. Dashboard trends use gradient Area Charts, not flat line charts.
- next-intl powers localization. Every layout, animation direction, label, and chart affordance must work in LTR and RTL.

## 3. Background Canvas

The app background is a living, light liquid canvas. Do not use solid beige, flat gray, or opaque white page backgrounds. The base should blend pale cyan, soft lavender, faint teal, and a tinted white/light-slate foundation.

Standard shell utility:

```tsx
<main className="relative min-h-dvh overflow-hidden bg-[linear-gradient(135deg,oklch(97%_0.018_220)_0%,oklch(94%_0.042_210)_32%,oklch(95%_0.034_292)_64%,oklch(96%_0.024_178)_100%)] text-slate-800">
  <LiquidBackground />
  <div className="relative z-10">{children}</div>
</main>
```

Background motion must use slow, large, blurred fields behind content. They should feel atmospheric and liquid, not like small decorative dots.

Standard animated blob classes:

```tsx
<motion.div
  aria-hidden
  className="pointer-events-none absolute -left-32 top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-cyan-300/30 blur-3xl"
/>
<motion.div
  aria-hidden
  className="pointer-events-none absolute right-[-10rem] top-32 h-[38rem] w-[38rem] rounded-full bg-violet-300/25 blur-3xl"
/>
<motion.div
  aria-hidden
  className="pointer-events-none absolute bottom-[-14rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-teal-300/25 blur-3xl"
/>
```

Motion guidance:

```tsx
animate={{ x: [0, 28, -12, 0], y: [0, -18, 20, 0], scale: [1, 1.06, 0.98, 1] }}
transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
```

In `prefers-reduced-motion`, stop background travel and keep only the static gradient.

## 4. Glass Surface Tokens

All cards, sidebars, headers, modals, tables, filters, and panels use translucent glass. Opaque cards are off-direction unless required as an accessibility fallback.

Primary glass panel:

```txt
bg-white/35 border border-white/55 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-2xl
```

Elevated glass panel:

```txt
bg-white/45 border border-white/60 backdrop-blur-2xl shadow-[0_24px_70px_0_rgba(45,70,140,0.16)] rounded-[1.5rem]
```

Muted glass panel:

```txt
bg-slate-50/30 border border-slate-200/30 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.06)] rounded-2xl
```

Interactive glass panel:

```txt
bg-white/35 border border-white/50 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-2xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/75 hover:bg-white/45 hover:shadow-[0_16px_48px_0_rgba(31,38,135,0.13)]
```

Sidebar glass:

```txt
bg-white/30 border border-white/50 backdrop-blur-2xl shadow-[0_16px_60px_0_rgba(45,70,140,0.12)] rounded-[1.75rem]
```

Top bar glass:

```txt
sticky top-4 z-40 bg-white/35 border border-white/55 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-2xl
```

Glass edge rule: every glass surface needs a visible carved edge. Use `border-white/50`, `border-white/60`, or `border-slate-200/30`; do not ship borderless glass.

Shadow rule: use soft, wide, colored shadows. Avoid harsh black shadows. The baseline is `shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]`.

## 5. Layout

The app shell should feel layered and spacious without becoming a marketing page. Use depth through stacked glass planes, not nested cards.

Dashboard layout:

```txt
grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5
```

Hero KPI panel:

```txt
lg:col-span-5 bg-white/40 border border-white/60 backdrop-blur-2xl shadow-[0_24px_70px_0_rgba(45,70,140,0.16)] rounded-[1.5rem] p-6 md:p-8
```

Operational panel:

```txt
lg:col-span-7 bg-white/35 border border-white/55 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-2xl p-5 md:p-6
```

Tables:

```txt
overflow-hidden rounded-2xl border border-white/50 bg-white/30 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]
```

Table rows:

```txt
border-b border-white/35 bg-white/10 transition-colors duration-200 hover:bg-white/30
```

Avoid identical card grids. Mix panel sizes according to operational priority: live attendance, exceptions, KPI trend, branch health, and recent actions should not all have equal weight.

## 6. Typography

Text must remain high contrast on frosted glass. Primary text uses `text-slate-800`, `text-slate-900`, `text-zinc-900`, or tokenized equivalents. Secondary text uses `text-slate-600` or `text-slate-500`. Avoid pale text on light glass.

Page title:

```txt
text-3xl font-extrabold leading-tight text-slate-900 md:text-5xl
```

Section title:

```txt
text-lg font-bold leading-tight text-slate-900 md:text-xl
```

Body:

```txt
text-sm leading-6 text-slate-600
```

Labels:

```txt
text-xs font-bold leading-5 text-slate-500
```

Heroic KPI number:

```txt
text-4xl font-extrabold leading-none text-slate-900 md:text-6xl
```

Compact KPI number:

```txt
text-3xl font-extrabold leading-none text-slate-900 md:text-4xl
```

KPI labels should be clear and compact. Do not use gradient text. Emphasis comes from scale, weight, and spacing.

## 7. Color

Use a luminous, restrained full palette: cyan and teal create freshness, lavender gives premium softness, slate anchors text and structure, semantic colors preserve operational meaning.

Recommended Tailwind usage:

- Primary actions: `bg-sky-600 text-white hover:bg-sky-700`
- Secondary actions: `bg-white/35 text-slate-800 border border-white/55 backdrop-blur-xl hover:bg-white/50`
- Selected states: `bg-cyan-100/55 text-sky-900 border border-cyan-200/60`
- Info: `bg-sky-100/60 text-sky-800 border border-sky-200/60`
- Success: `bg-emerald-100/60 text-emerald-800 border border-emerald-200/60`
- Warning: `bg-amber-100/65 text-amber-900 border border-amber-200/70`
- Danger: `bg-rose-100/65 text-rose-800 border border-rose-200/70`
- Neutral chip: `bg-white/35 text-slate-700 border border-white/50 backdrop-blur-xl`

Status colors must be paired with text and icons where useful. Color alone is never enough for attendance state.

## 8. Components

### Buttons

Primary button:

```txt
inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(2,132,199,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-[0_16px_40px_rgba(2,132,199,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white/40 disabled:pointer-events-none disabled:opacity-50
```

Glass secondary button:

```txt
inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/55 bg-white/35 px-4 text-sm font-bold text-slate-800 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/75 hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white/40
```

Icon button:

```txt
inline-flex size-10 items-center justify-center rounded-xl border border-white/50 bg-white/30 text-slate-700 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500
```

Use Lucide icons inside buttons when a clear icon exists. Icon-only buttons require accessible names and tooltips for unfamiliar actions.

### Cards and Panels

Cards use the glass tokens above. KPI cards must include a large numeric value, concise label, visible status context, and a clear comparison or timestamp only when it helps decision-making.

KPI card:

```txt
bg-white/40 border border-white/60 backdrop-blur-2xl shadow-[0_16px_48px_0_rgba(31,38,135,0.12)] rounded-[1.5rem] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/80 hover:shadow-[0_24px_70px_0_rgba(45,70,140,0.16)]
```

### Inputs and Filters

Input:

```txt
h-11 rounded-xl border border-white/55 bg-white/35 px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-300 focus:border-sky-400 focus:bg-white/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30
```

Select/filter trigger:

```txt
h-11 rounded-xl border border-white/55 bg-white/35 px-3 text-sm font-bold text-slate-800 backdrop-blur-xl transition-all duration-300 hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30
```

### Navigation

Navigation should feel like glass floating above the liquid canvas. Active items use translucent cyan fill, stronger text, and Lucide icons. Do not use thick side-stripe borders.

Nav item:

```txt
flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-600 transition-all duration-300 hover:bg-white/35 hover:text-slate-950
```

Active nav item:

```txt
bg-cyan-100/55 text-sky-900 border border-cyan-200/60 shadow-[0_10px_30px_rgba(14,165,233,0.12)]
```

### Badges

Badges must be readable on glass and must include text. Pair status badges with icons for high-risk states.

```txt
inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold backdrop-blur-xl
```

## 9. Motion

Framer Motion is crucial to the product feel. Motion should be smooth, fluid, and stateful, with reduced-motion fallbacks.

Shared ease:

```ts
export const liquidEase = [0.16, 1, 0.3, 1] as const;
```

Page transition:

```tsx
<motion.div
  initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
  exit={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
  transition={{ duration: 0.42, ease: liquidEase }}
/>
```

Dashboard stagger group:

```tsx
const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.075, delayChildren: 0.06 },
  },
};

const pourItem = {
  hidden: { opacity: 0, y: 22, scale: 0.98, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.64, ease: liquidEase },
  },
};
```

Hover states:

```txt
transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/75 hover:shadow-[0_16px_48px_0_rgba(31,38,135,0.13)]
```

Rules:

- Animate opacity, transform, filter, and shadow. Avoid animating layout properties.
- Use `AnimatePresence` for route and conditional panel transitions.
- Dashboard cards should pour into the screen with staggered entry. They must not all appear at once.
- Reduced motion variants should remove translate, scale, blur, and long background movement while preserving opacity transitions.

## 10. Data Visualization

Recharts visuals live inside glass panels. Avoid flat line charts for key dashboard data. Use Area Charts with monotone curves and SVG linear gradients that fade to transparent.

Area chart standard:

```tsx
<AreaChart data={data}>
  <defs>
    <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="rgb(14 165 233)" stopOpacity={0.42} />
      <stop offset="55%" stopColor="rgb(14 165 233)" stopOpacity={0.16} />
      <stop offset="100%" stopColor="rgb(14 165 233)" stopOpacity={0} />
    </linearGradient>
  </defs>
  <CartesianGrid stroke="rgba(148, 163, 184, 0.22)" vertical={false} />
  <XAxis dataKey="label" stroke="rgb(100 116 139)" tickLine={false} axisLine={false} />
  <YAxis stroke="rgb(100 116 139)" tickLine={false} axisLine={false} />
  <Tooltip contentStyle={{
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(255, 255, 255, 0.62)',
    borderRadius: '16px',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 16px 48px rgba(31, 38, 135, 0.13)',
  }} />
  <Area
    type="monotone"
    dataKey="value"
    stroke="rgb(14 165 233)"
    strokeWidth={3}
    fill="url(#attendanceGradient)"
  />
</AreaChart>
```

Chart cards should use `bg-white/35 border border-white/55 backdrop-blur-2xl`. Grid lines should be soft. Labels must stay legible. Tooltips must also be glass, but never low contrast.

## 11. Localization and RTL

Every visual pattern must support English and Arabic through next-intl. Arabic text should use the configured Arabic font stack and must not be squeezed into English-sized controls.

RTL requirements:

- Mirror navigation layout and icon placement where direction implies movement.
- Keep numeric attendance KPIs readable in both locales.
- Check chart axes, tooltip alignment, table actions, pagination, dropdowns, and date controls.
- Motion direction should respect reading direction when panels enter from an edge.

## 12. Accessibility and Performance

Glass requires contrast discipline. If text falls below AA contrast, increase panel opacity, add a stronger local overlay, or use darker text. Do not lower text contrast to preserve the glass effect.

Focus ring:

```txt
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white/40
```

Reduced motion:

```tsx
const reducedMotion = useReducedMotion();
```

When `reducedMotion` is true, remove background travel, blur-in transitions, large translate values, and stagger delays. Keep essential state changes immediate.

Backdrop blur can be expensive. On small screens, use `backdrop-blur-xl` instead of `backdrop-blur-2xl` when many panels are visible. Avoid stacking multiple blur-heavy panels over each other without need.

## 13. Do and Do Not

Do:

- Use the Premium Liquid Glass aesthetic on every major app surface.
- Use pale cyan, soft lavender, faint teal, and light slate gradients for the canvas.
- Use `bg-white/30` to `bg-white/45`, `backdrop-blur-xl` to `backdrop-blur-2xl`, and semi-transparent borders as the default surface vocabulary.
- Make attendance KPIs heroic with `text-4xl` to `text-6xl` and `font-extrabold`.
- Use Framer Motion for page blur-in, staggered card entry, hover lift, and liquid background movement.
- Use Recharts Area Charts with monotone curves and fading SVG gradients.
- Preserve strong contrast, keyboard access, visible focus, status text, and reduced-motion fallbacks.

Do not:

- Use beige ledger styling, opaque paper cards, or flat safe dashboards.
- Use flat line charts as the primary dashboard trend visual.
- Use harsh black shadows, tiny low-contrast text, or transparent panels without carved borders.
- Use gradient text.
- Use thick side-stripe borders for active states or alerts.
- Nest glass cards inside glass cards as decoration.
- Let animation delay attendance work or make the app feel slower.
- Rely on color alone for attendance states.

# Amwag Attendance System - Complete UI/UX Redesign Roadmap

> **Master Roadmap Document** - Reference this file when executing phases.
> Usage: Tell Claude "Execute Phase X" and it will read this file for full context.

---

## Project Overview

**Goal:** Transform the Amwag Attendance System from a warm beige/pink light-mode UI into a **world-class, portfolio-worthy dark-mode masterpiece** inspired by Apple, Vercel, and Linear aesthetics.

**Constraint:** All backend logic, API routes, authentication, i18n translations, types, and middleware remain **completely untouched**. Only frontend UI/UX changes.

---

## Current Tech Stack

| Technology | Version | Notes |
|---|---|---|
| Next.js | 15.1.0 | App Router, `src/app/[locale]/` structure |
| React | 19.2.3 | Hooks-based state management |
| Tailwind CSS | v4 | Via `@tailwindcss/postcss`, `@theme inline` block |
| Framer Motion | 12.38.0 | Already installed |
| Supabase | SSR + JS SDK | Auth, PostgreSQL, role-based access |
| next-intl | 4.7.0 | English + Arabic with RTL support |
| Lucide React | 0.562.0 | Icon library |
| Fonts | DM Sans + Playfair Display | Via next/font/google |

**No shadcn/ui** - all UI components are custom-built in `src/components/ui/`.

---

## Design System

### Color Palette (Dark Theme)

```
BACKGROUNDS
  --bg-primary:     #0A0A0F    (near-black base)
  --bg-secondary:   #0D1117    (slightly lighter)
  --bg-tertiary:    #121218    (card backgrounds)
  --bg-elevated:    #1A1A2E    (elevated surfaces)

SURFACES (glassmorphism)
  --surface:          rgba(255, 255, 255, 0.04)
  --surface-hover:    rgba(255, 255, 255, 0.07)
  --surface-strong:   rgba(255, 255, 255, 0.10)
  --surface-elevated: rgba(255, 255, 255, 0.12)

BORDERS
  --line:          rgba(255, 255, 255, 0.06)
  --line-strong:   rgba(255, 255, 255, 0.12)
  --line-active:   rgba(59, 130, 246, 0.3)

TEXT
  --foreground:      #F1F5F9   (primary text)
  --foreground-soft: #CBD5E1   (secondary text)
  --muted:           #64748B   (muted text)
  --muted-strong:    #94A3B8   (less muted)

ACCENTS
  --accent:        #3B82F6    (electric blue - primary)
  --accent-strong: #2563EB    (darker blue)
  --accent-soft:   rgba(59, 130, 246, 0.15)
  --accent-glow:   rgba(59, 130, 246, 0.25)
  --secondary:     #8B5CF6    (violet - secondary)
  --secondary-soft: rgba(139, 92, 246, 0.15)

STATUS
  --success:      #10B981    --success-soft: rgba(16, 185, 129, 0.15)
  --warning:      #F59E0B    --warning-soft: rgba(245, 158, 11, 0.15)
  --danger:       #EF4444    --danger-soft:  rgba(239, 68, 68, 0.15)

SHADOWS
  --shadow-sm:         0 2px 8px rgba(0, 0, 0, 0.3)
  --shadow-md:         0 8px 24px rgba(0, 0, 0, 0.4)
  --shadow-lg:         0 16px 48px rgba(0, 0, 0, 0.5)
  --shadow-glow-blue:  0 0 20px rgba(59, 130, 246, 0.15)
  --shadow-glow-violet: 0 0 20px rgba(139, 92, 246, 0.15)
```

### Typography

- **Body font:** DM Sans (keep existing `--font-body`)
- **Display font:** Space Grotesk (replace Playfair Display as `--font-display`)
- Both from `next/font/google`

### Visual Layers

1. **Base:** Near-black (#0A0A0F) + subtle radial gradient blobs + grid overlay
2. **Background:** 21st.dev-inspired ElegantShape floating gradient orbs (blue/violet/cyan) + SVG noise texture
3. **Surface:** Glassmorphism cards (translucent white + backdrop-blur)
4. **Accent:** Blue-to-violet gradients for interactive elements, glowing borders, status indicators

---

## Phase 1: Foundation - Dark Theme Design System

**Status:** [ ] Not Started

### Step 1.1: Install Dependencies
- **Action:** `npm install recharts`
- **File:** `package.json`

### Step 1.2: Rewrite Global Styles (COMPLETE REWRITE)
- **File:** `src/app/globals.css`
- Replace ALL `:root` CSS custom properties with dark theme tokens (see Design System above)
- Update Tailwind v4 `@theme inline` block to map all new CSS variables to utility classes
- Set `html { color-scheme: dark; }` and dark body background with:
  - Subtle radial gradient blobs (blue/violet at very low opacity)
  - Grid overlay pattern using `rgba(255,255,255,0.02)` at 36px spacing
  - Fixed attachment for parallax effect
- Dark scrollbar: `rgba(255,255,255,0.15)` thumb on transparent track
- Dark `::selection`: `rgba(59, 130, 246, 0.3)`
- New/updated utility classes:
  - `.glass` → `background: var(--surface); backdrop-filter: blur(16px); border: 1px solid var(--line);`
  - `.glass-strong` → stronger opacity version
  - `.premium-card` → dark glassmorphism with gradient and shadow
  - `.premium-surface` → elevated dark surface
  - `.gradient-text` → blue-to-violet text gradient
  - `.glow-border` → animated border glow effect
  - `.editorial-frame` → update for dark theme
  - `.focus-ring` → blue accent glow instead of pink
  - `.card-hover` → dark-adapted hover effect
- Preserve ALL animation keyframes (slide-in-right, slide-out-right, scale-in, fade-in, fade-in-up, pulse-glow, shimmer, skeleton-pulse, progress-shrink), update colors for dark theme
- Preserve `.stagger > *` delays
- Preserve `prefers-reduced-motion` media query
- Preserve RTL switch thumb transforms

### Step 1.3: Update Root Layout
- **File:** `src/app/[locale]/layout.tsx`
- Replace `Playfair_Display` import with `Space_Grotesk` from `next/font/google`
- Keep `DM_Sans` as `--font-body`
- Set `Space_Grotesk` as `--font-display` (variable: `--font-display`)
- Body className: keep `bg-background text-foreground` (variables now resolve to dark colors)

### Step 1.4: Create Aurora/Geometric Background
- **New file:** `src/components/backgrounds/AuroraBackground.tsx`
- `'use client'` component
- Adapted from 21st.dev Geometric Background pattern:
  - 4-5 `ElegantShape` elements (large rounded divs with gradient fills)
  - Slow floating animation (translateY 0 -> 15px -> 0 over 12-20s, infinite)
  - Colors: `from-indigo-500/[0.12]`, `from-violet-500/[0.10]`, `from-cyan-500/[0.06]`, `from-blue-500/[0.08]`
  - Positioned absolutely at various corners/edges
  - Each shape has `backdrop-blur-[2px]`, `border border-white/[0.08]`
  - Entry animation: fade + slide from above (2.4s ease)
- `pointer-events: none`, `position: fixed`, `inset: 0`, `z-index: 0`, `overflow: hidden`
- Top and bottom vignette overlays: `bg-gradient-to-t from-[#0A0A0F] via-transparent to-[#0A0A0F]/80`
- Respect `prefers-reduced-motion` (static positions, no animation)

### Step 1.5: Create Noise Overlay
- **New file:** `src/components/backgrounds/NoiseOverlay.tsx`
- `'use client'` component
- Renders an inline `<svg>` with `<filter>` containing `<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3">`
- Applied via `<rect>` filling the viewport
- Opacity: 0.02-0.03
- `position: fixed`, `inset: 0`, `pointer-events: none`, `z-index: 1`

### Verification for Phase 1:
- Run `npm run dev`
- Root page should show dark background with floating aurora shapes
- All CSS variables should resolve correctly
- Body should have dark scrollbar, dark selection
- No visual regressions on text readability

---

## Phase 2: Navigation & Layout

**Status:** [ ] Not Started
**Depends on:** Phase 1

### Step 2.1: Redesign Admin Sidebar/Layout
- **File:** `src/app/[locale]/admin/layout.tsx`
- **Read current file first** (it's ~230 lines with sidebar, mobile menu, nav items, profile card)
- Changes:
  - Remove all light-mode color classes and inline styles
  - Sidebar background: `bg-[rgba(255,255,255,0.03)] backdrop-blur-[20px] border-r border-[var(--line)]`
  - Remove decorative gradient blobs (replaced by AuroraBackground at body level)
  - Mount `<AuroraBackground />` and `<NoiseOverlay />` before `{children}` wrapper
  - Logo/brand container: dark glass surface with subtle blue glow ring
  - Nav items styling:
    - Default: `bg-transparent text-[var(--muted-strong)]`
    - Hover: `bg-[var(--surface)] text-[var(--foreground)]`
    - Active: `bg-[var(--accent-soft)] text-[var(--foreground)] border-s-2 border-[var(--accent)]` with blue glow
  - Active nav indicator: use Framer Motion `layoutId="active-nav"` on a `motion.div` that slides between items
  - Profile card at bottom: dark glass card, avatar with gradient border (blue-to-violet ring)
  - Logout button: ghost danger variant
  - Language switcher: ghost dark variant
  - Mobile header bar: `bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--line)]`
  - Mobile sidebar overlay: `bg-black/60 backdrop-blur-sm`
  - Mobile sidebar animation: wrap in `AnimatePresence`, use `motion.aside` with `initial={{ x: '-100%' }}` `animate={{ x: 0 }}` `exit={{ x: '-100%' }}` `transition={{ type: "spring", stiffness: 300, damping: 30 }}`
  - Replace `ChevronRight` in active item with a glow dot or keep chevron but add `rtl:rotate-180` class

### Step 2.2: Page Transition System
- **New file:** `src/components/ui/PageTransition.tsx`
- `'use client'` component wrapping `{children}` with `motion.div`
- Uses `usePathname()` as `key` for `AnimatePresence`
- Animation:
  ```
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
  ```
- Integrate into admin layout wrapping `{children}`

### Step 2.3: Update Footer
- **File:** `src/components/Footer.tsx`
- Text color: `var(--muted)` default, `var(--foreground)` on hover
- Social icon colors updated for dark theme
- Heart/link accent: `var(--accent)`

### Step 2.4: Update LanguageSwitcher
- **File:** `src/components/LanguageSwitcher.tsx`
- Background: `var(--surface)` instead of white
- Text: `var(--foreground-soft)`
- Border: `var(--line)`
- Globe icon: subtle blue tint

### Step 2.5: Update CustomCursor
- **File:** `src/components/CustomCursor.tsx`
- Already uses cyan/violet colors - mostly fine
- Increase ambient spotlight glow opacity from 0.06 to 0.08 (more visible on dark bg)
- Ensure it's mounted in root locale layout (check if it currently is)

### Verification for Phase 2:
- Admin sidebar should be dark glass with smooth nav transitions
- Active nav item has sliding blue indicator
- Mobile hamburger opens dark sidebar with spring animation
- Page transitions work between admin routes
- Footer and language switcher are dark-themed
- Aurora background visible behind content

---

## Phase 3: Core UI Components

**Status:** [ ] Not Started
**Depends on:** Phase 1

### Step 3.1: Button.tsx
- **File:** `src/components/ui/Button.tsx`
- **Read current file first** (has variants: primary, outline, ghost, danger + sizes)
- New variant styles:
  - `primary`: `bg-[var(--accent)] text-white shadow-[var(--shadow-glow-blue)]` hover: lift + stronger glow
  - `secondary`: `bg-[var(--secondary-soft)] text-[#A78BFA] border border-[var(--secondary)]/20` hover: brighten
  - `outline`: `border border-[var(--line)] bg-transparent text-[var(--foreground-soft)]` hover: `bg-[var(--surface)]`
  - `ghost`: `bg-transparent text-[var(--muted)]` hover: `bg-[var(--surface)] text-[var(--foreground)]`
  - `danger`: `bg-[var(--danger)] text-white shadow-[0_0_20px_rgba(239,68,68,0.15)]`
  - `success` (NEW): `bg-[var(--success)] text-white shadow-[0_0_20px_rgba(16,185,129,0.15)]`
- All buttons: `active:scale-[0.98] transition-all duration-200`
- Focus ring: `focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]`
- Loading spinner color: white for filled variants, accent for outline/ghost

### Step 3.2: Card.tsx
- **File:** `src/components/ui/Card.tsx`
- **Read current file first**
- Base card: `bg-[var(--surface)] border border-[var(--line)] backdrop-blur-2xl rounded-2xl`
- `CardHeader`: border-b with `var(--line)`
- `CardTitle`: `text-[var(--foreground)]`
- `CardDescription`: `text-[var(--muted)]`
- Interactive mode: hover `border-[var(--line-strong)] -translate-y-0.5 shadow-[var(--shadow-md)]`

### Step 3.3: Input.tsx
- **File:** `src/components/ui/Input.tsx`
- **Read current file first**
- Background: `bg-[var(--surface)]`
- Border: `border-[var(--line)]`, focus: `border-[var(--accent)] shadow-[var(--shadow-glow-blue)]`
- Text: `text-[var(--foreground)]`
- Placeholder: `placeholder:text-[var(--muted)]`
- Label: `text-[var(--muted-strong)]` with uppercase tracking
- Icon: `text-[var(--accent)]`
- Error: `border-[var(--danger)]` with red glow
- **RTL fix:** Replace `left-0` with `start-0`, `pl-*` with `ps-*`, `pr-*` with `pe-*`

### Step 3.4: Select.tsx
- **File:** `src/components/ui/Select.tsx`
- Same dark pattern as Input
- `<option>` elements: `bg-[var(--bg-secondary)] text-[var(--foreground)]`

### Step 3.5: Modal.tsx
- **File:** `src/components/ui/Modal.tsx`
- **Read current file first** (Portal-based, has Escape key + body scroll lock)
- Backdrop: `bg-black/60 backdrop-blur-[12px]`
- Modal body: `bg-[var(--bg-tertiary)]/95 backdrop-blur-[24px] border border-[var(--line)] rounded-2xl shadow-[var(--shadow-lg)]`
- Replace `animate-scale-in` CSS with Framer Motion:
  ```
  motion.div with
  initial={{ opacity: 0, scale: 0.95, y: 8 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 25 }}
  ```
- Header title: `text-[var(--foreground)]`
- Close button: `text-[var(--muted)]` hover: `text-[var(--foreground)]`
- Header border-b: `var(--line)`
- **RTL fix:** `pr-4` -> `pe-4` for close button spacing

### Step 3.6: Badge.tsx
- **File:** `src/components/ui/Badge.tsx`
- **Read current file first**
- Each variant gets: soft background + status border + status text + 6px glowing dot
- Variant styles:
  - `present`: `bg-[var(--success-soft)] border-[var(--success)]/20 text-[var(--success)]` + green dot with `shadow-[0_0_6px_var(--success)]`
  - `late`: `bg-[var(--warning-soft)] border-[var(--warning)]/20 text-[var(--warning)]` + amber dot
  - `absent`: `bg-[var(--danger-soft)] border-[var(--danger)]/20 text-[var(--danger)]` + red dot
  - `missing_checkout`: `bg-[rgba(249,115,22,0.15)] border-orange-500/20 text-orange-400` + orange dot
  - `pending`: `bg-[var(--secondary-soft)] border-[var(--secondary)]/20 text-[var(--secondary)]` + violet dot with `animate-pulse`
  - `info`: `bg-[var(--accent-soft)] border-[var(--accent)]/20 text-[var(--accent)]` + blue dot
- Dot implementation: small `<span>` before text with `w-1.5 h-1.5 rounded-full bg-current` + appropriate glow shadow

### Step 3.7: Toast.tsx
- **File:** `src/components/ui/Toast.tsx`
- Background: `bg-[var(--surface-elevated)] backdrop-blur-2xl border border-[var(--line)]`
- Status-specific left border or icon glow
- Text: `var(--foreground)` for message
- Progress bar: status color at 40% opacity
- **RTL fix:** `right-4` -> `end-4` (use `inset-inline-end`)

### Step 3.8: Skeleton.tsx
- **File:** `src/components/ui/Skeleton.tsx`
- Change base color to `bg-[rgba(255,255,255,0.06)]`
- Pulse animation color adjusted for dark

### Step 3.9: NEW - AnimatedCounter
- **New file:** `src/components/ui/AnimatedCounter.tsx`
- `'use client'` component
- Props: `{ value: number; duration?: number; prefix?: string; suffix?: string; decimals?: number; className?: string }`
- Implementation:
  - `useMotionValue(0)` -> `useSpring(motionValue, { stiffness: 50, damping: 20 })`
  - `useTransform(spring, (v) => format(v))` to get display string
  - `useInView(ref, { once: true })` to trigger animation on viewport entry
  - `useEffect` to set motionValue to target value when in view
  - Render: `<motion.span ref={ref}>{display}</motion.span>` with `tabular-nums` font feature

### Step 3.10: NEW - GlowingCard
- **New file:** `src/components/ui/GlowingCard.tsx`
- `'use client'` component
- Props: `{ children; className?; glowColor?: string; halo?: boolean }`
- Implementation:
  - Outer container with `relative overflow-hidden rounded-2xl p-[1px]`
  - Gradient border: `bg-gradient-to-br from-[var(--line-strong)] via-[var(--line)] to-[var(--line-strong)]`
  - Optional moving halo: `motion.div` with `absolute w-12 h-12 rounded-full bg-white/10 blur-xl` animated in a rectangle path (21st.dev StatCard pattern)
  - Optional rotating ray: `motion.div` with `absolute rounded-full bg-white/5 blur-2xl` rotating 360 degrees over 12s
  - Inner card: `relative bg-[var(--bg-tertiary)]/80 backdrop-blur-xl rounded-2xl border border-[var(--line)]`
  - Respect `prefers-reduced-motion`

### Step 3.11: NEW - ChartWrapper
- **New file:** `src/components/ui/ChartWrapper.tsx`
- `'use client'` component
- Wrapper for Recharts `<ResponsiveContainer>`
- Provides dark theme defaults:
  - Axis tick: `fill: var(--muted)`, fontSize 12
  - Grid: `stroke: rgba(255,255,255,0.04)`
  - Custom Tooltip: dark glass card with blur
  - Cartesian grid: `strokeDasharray="3 3"` with low opacity
- Export a `DarkTooltip` component for reuse

### Step 3.12: Update Component Index
- **File:** `src/components/ui/index.ts`
- Add exports: `AnimatedCounter`, `GlowingCard`, `ChartWrapper`, `PageTransition`

### Verification for Phase 3:
- Import and render each component in isolation to verify dark styling
- Button variants all look correct with glow effects
- Cards have glass effect on dark background
- Inputs focus with blue glow
- Modal opens with spring animation
- Badges show glowing status dots
- AnimatedCounter counts up from 0 smoothly
- GlowingCard shows animated halo effect

---

## Phase 4: Login Page

**Status:** [ ] Not Started
**Depends on:** Phase 1 + Phase 3

### Step 4.1: Redesign Login Page
- **File:** `src/app/[locale]/login/page.tsx`
- **Read current file first** (~250 lines, two-column: left info + right form)
- Preserve ALL logic: `handleSubmit`, `useState`, `useRouter`, `useTranslations`, toast calls
- Changes:

**Left Panel (lg+ screens):**
- Replace `editorial-frame` background with dark glass: `bg-[var(--surface)] backdrop-blur-2xl border border-[var(--line)] rounded-3xl`
- Background: subtle gradient mesh blobs (blue/violet) at very low opacity behind card
- Logo container: dark glass circle with blue glow ring
- Heading: `gradient-text` class (blue to violet)
- Subtitle: `text-[var(--muted-strong)]`
- Feature highlight cards: dark glass mini-cards with accent-colored icon circles + glow

**Right Panel (login form):**
- Card: `bg-[var(--surface-strong)] backdrop-blur-[24px] border border-[var(--line)] rounded-3xl`
- "Welcome back" kicker: `text-[var(--accent)]` uppercase tracking
- Heading: `text-[var(--foreground)]` with display font
- Input fields: use redesigned Input component (Phase 3)
- Submit button: primary variant (full width) with `whileHover={{ scale: 1.01 }}` `whileTap={{ scale: 0.98 }}`
- "Need access?" box: dark glass info card with accent border-l

**Mobile:**
- Single column, centered login card
- Aurora background visible behind
- Logo above the form card

### Verification for Phase 4:
- Login page renders with dark theme
- Form submission still works (redirects correctly by role)
- Toast notifications appear with dark glass styling
- RTL layout mirrors correctly
- Mobile layout is single-column centered

---

## Phase 5: Employee Dashboard - The Centerpiece

**Status:** [ ] Not Started
**Depends on:** Phase 1 + Phase 3

### Step 5.1: Create ClockHero Component
- **New file:** `src/components/employee/ClockHero.tsx`
- `'use client'` component
- Props: `{ currentTime: Date; shiftStatus: 'idle' | 'on_shift' | 'complete'; shiftProgress: number; onCheckIn: () => void; onCheckOut: () => void; isLoading: boolean; t: any }`
- Visual structure:
  - **Outer container:** `relative w-[300px] h-[300px] lg:w-[340px] lg:h-[340px]` centered
  - **Shift progress ring:** SVG `<circle>` with:
    - `r="145"`, `cx="170"`, `cy="170"` (adjust to container)
    - Gradient stroke via `<linearGradient>` from `var(--accent)` to `var(--secondary)`
    - `stroke-dasharray` calculated from circumference
    - `stroke-dashoffset` animated with Framer Motion `useSpring` based on `shiftProgress` (0-1)
    - `stroke-width: 3`, `fill: none`
    - `transform: rotate(-90deg)` for top-start
  - **Status ring:** inner SVG circle, thinner stroke (1.5px)
    - Idle: `stroke: var(--muted)` with slow pulse opacity animation
    - On shift: `stroke: var(--success)` with slow rotating dash animation
    - Complete: `stroke: var(--success)` static
  - **Time display:** centered in SVG
    - Hours/minutes: `text-5xl lg:text-6xl font-bold` with `tabular-nums` and display font
    - Seconds: `text-2xl text-[var(--muted)]` with subtle opacity pulse (Framer Motion `animate={{ opacity: [1, 0.4, 1] }}` over 2s)
    - Format: `HH:MM` with seconds below or to the side
  - **Date:** Below the clock circle, `text-[var(--muted)]`
  - **Action button area:** Below date

- **Check-In Button (idle state):**
  - `motion.button` with `w-[100px] h-[100px] rounded-full`
  - Background: `bg-[var(--accent)]` with pulsing glow ring
  - Pulsing ring: `motion.div` absolute behind button, `animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}` over 2s infinite
  - Icon: `LogIn` from Lucide, white
  - Text below button: "Start Your Day" in muted text
  - `whileHover={{ scale: 1.05 }}` with glow intensity increase
  - `whileTap={{ scale: 0.92 }}` with spring `{ stiffness: 400, damping: 15 }`
  - On success callback: ring burst `motion.div` animates `scale: [1, 1.8]` `opacity: [0.5, 0]` over 0.6s

- **Check-Out Button (on_shift state):**
  - Same circular button but `bg-[var(--danger)]` with red pulsing glow
  - Icon: `LogOut`, text: "End Your Day"
  - Same spring physics on press

- **Day Complete State:**
  - Button replaced with `motion.div` with `CheckCircle` icon
  - `bg-[var(--success-soft)] border border-[var(--success)]/20`
  - Text: "Day Complete" in success color
  - Entry animation: scale-in with spring + subtle upward particle burst (4-6 small circles animating outward and fading)

### Step 5.2: Redesign Employee Page
- **File:** `src/app/[locale]/employee/page.tsx`
- **Read current file first** (~458 lines)
- Preserve ALL existing logic: state variables, API calls, handlers, useEffect, translations
- Layout changes:
  - Two-column on lg+: left = ClockHero, right = Profile + TodayRecord
  - Single column on mobile: ClockHero on top, cards below
  - Wrap in `PageReveal` / `StaggerGroup`

- **Profile Card:**
  - Dark glass card
  - Avatar: `w-16 h-16 rounded-full` with gradient border ring (blue->violet), letter initial inside
  - If on shift: avatar ring has animated rotation (`motion.div` rotate 360 over 8s)
  - Info rows: each in a dark glass mini-card with accent-colored icon (Lucide) and label + value

- **Today's Record Card:**
  - Dark glass card
  - Metrics grid (2x2): each metric in dark glass mini-card
    - Check-in time, Check-out time, Late minutes, Overtime minutes
    - Values use `AnimatedCounter` for numbers
    - Status badge uses new glowing Badge component
  - "No record" state: dashed border card with muted Clock icon

- **Header:**
  - Dark glass bar with employee name, language switcher, logout button
  - Replace all light-mode colors

### Verification for Phase 5:
- Clock displays correct time (Cairo timezone), updates every second
- Shift progress ring animates smoothly
- Check-in button has pulsing glow and satisfying spring press
- On successful check-in: ring burst animation, button transitions to checkout state
- Check-out works, day complete state shows with particle effect
- Profile card shows employee details correctly
- Today's record shows correct metrics with animated counters
- RTL layout mirrors correctly
- Mobile layout stacks vertically

---

## Phase 6: Admin Dashboard

**Status:** [ ] Not Started
**Depends on:** Phase 1 + Phase 3

### Step 6.1: Redesign Admin Dashboard
- **File:** `src/app/[locale]/admin/page.tsx`
- **Read current file first** (~308 lines, hero card + date pickers + stat cards + insights)
- Preserve ALL logic: data fetching, state, sessionStorage caching, date/month filters, translations

- **Hero Section:**
  - `GlowingCard` with halo effect
  - Title: `gradient-text` class, display font
  - Date filter controls: dark glass sub-panel with dark Input components
  - Month/date toggle buttons: outline/primary dark variants

- **Stat Cards (4):**
  - Each in a `GlowingCard` with a matching accent color
  - Icon in a glass circle with colored glow (Users=blue, Present=green, Absent=red, Missing=amber)
  - Value: `AnimatedCounter` with large display font
  - Label: `text-[var(--muted)]`
  - Staggered entry with `StaggerGroup`

- **Attendance Rate Gauge:**
  - Extract to: `src/components/admin/AttendanceGauge.tsx` (optional - can be inline)
  - Semi-circular SVG gauge:
    - Arc path from -90deg to 90deg
    - Gradient stroke: red (#EF4444) at 0% -> amber (#F59E0B) at 50% -> green (#10B981) at 100%
    - Animated fill using Framer Motion `useSpring` on `stroke-dashoffset`
    - Large percentage in center: `AnimatedCounter` with `%` suffix
  - Show for attendance rate and departure completion rate

- **Insights Section:**
  - Dark glass card
  - Top branch indicator: small Badge with branch name
  - Metrics: `AnimatedCounter` for each value
  - Formatted dates in locale-aware format

- **Charts (if data available):**
  - Extract to: `src/components/admin/DashboardCharts.tsx`
  - Line/Area chart for attendance trend (Recharts with `ChartWrapper`)
  - Dark glass card container
  - Note: Current API may not return per-day arrays. If not available, display stat cards more prominently; charts can be added when API supports it.

### Verification for Phase 6:
- Dashboard loads with correct data
- Stat cards animate counters on load
- GlowingCards show halo animation
- Gauge displays correct attendance rate percentage
- Date/month filters work and update data
- All existing functionality preserved
- Mobile responsive

---

## Phase 7: Admin Sub-Pages

**Status:** [ ] Not Started
**Depends on:** Phase 1 + Phase 3

### Step 7.1: Employees Page
- **File:** `src/app/[locale]/admin/employees/page.tsx`
- **Read current file first** (~580 lines)
- Preserve ALL logic: CRUD, bulk import, search, state
- Changes:
  - Hero card: dark glass with `gradient-text` title
  - Stats row: dark glass mini-cards with `AnimatedCounter`
  - Action buttons: primary (Add) and outline (Bulk Import) dark variants
  - Search input: dark themed
  - Employee cards grid: dark glass cards
    - Avatar circle with colored border based on branch
    - Info rows in dark glass sub-cards
    - Edit button: ghost, Delete: ghost danger with red glow on hover
    - Overtime toggle: dark track (`bg-[var(--surface)]`), blue accent when on
  - Empty state: dark glass card with muted Users icon
  - Skeleton loading: dark variant

### Step 7.2: Attendance Logs Page
- **File:** `src/app/[locale]/admin/attendance/page.tsx`
- **Read current file first** (~514 lines)
- Preserve ALL logic: search, filters, pagination, PDF export, state
- Changes:
  - Hero section: dark glass
  - Filter bar: dark glass card with dark inputs and select
  - Status select: dark dropdown options
  - Toggle buttons: dark outline/primary variants

  **Desktop Table:**
  - `thead`: `bg-[var(--surface)]` with `var(--line)` border
  - Header text: `text-[var(--muted)]` uppercase
  - Row hover: `bg-[var(--surface-hover)]`
  - Row border: `border-[var(--line)]`
  - Avatar circles: gradient border (blue-violet)
  - Status: new glowing Badge
  - IP addresses: monospace in `var(--muted)` with subtle code background
  - `text-left` -> `text-start` for RTL

  **Mobile Cards:**
  - Dark glass cards per record
  - Mini-card metric grid
  - Glowing Badge for status

  **Pagination:**
  - Dark buttons (outline variant)
  - Page info: `text-[var(--muted)]`

  **Export Button:**
  - Dark outline with FileText icon, glow on hover when enabled

### Step 7.3: Settings Page
- **File:** `src/app/[locale]/admin/settings/page.tsx`
- **Read current file first** (~260 lines)
- Preserve ALL logic: fetch, save, validation, state
- Changes:
  - Header icon: dark glass circle with blue accent
  - Title: `gradient-text`
  - Save button: primary blue with glow
  - Settings cards (4): dark glass with colored icon circles
    - Early Check-in: green icon circle
    - Grace Period: amber icon circle
    - Checkout Window: blue icon circle
    - Max Overtime: purple icon circle
  - Number inputs: dark themed, centered
  - Min/max labels: `text-[var(--muted)]`
  - "How it works" info card: dark glass with accent icon

### Step 7.4: BulkImportModal
- **File:** `src/components/BulkImportModal.tsx`
- **Read current file first**
- Consistent dark theme:
  - CSV hint: dark glass with accent border
  - Textarea: dark surface, monospace, accent focus ring
  - Results: success/failed in dark badges
  - Failed emails: dark glass with danger accent

### Verification for Phase 7:
- All CRUD operations work on Employees page
- Search and filters work on Attendance Logs
- Pagination navigates correctly
- PDF export still functions
- Settings save correctly
- All modals open/close with dark theme
- RTL layouts correct on all pages

---

## Phase 8: Polish & Optimization

**Status:** [ ] Not Started
**Depends on:** ALL previous phases

### Step 8.1: RTL Verification (Arabic)
- Audit ALL modified files for directional properties:
  - `left-*` / `right-*` -> `start-*` / `end-*`
  - `pl-*` / `pr-*` -> `ps-*` / `pe-*`
  - `ml-*` / `mr-*` -> `ms-*` / `me-*`
  - `text-left` / `text-right` -> `text-start` / `text-end`
  - `rounded-l-*` / `rounded-r-*` -> `rounded-s-*` / `rounded-e-*`
  - `border-l-*` / `border-r-*` -> `border-s-*` / `border-e-*`
- ChevronRight icon: add `rtl:rotate-180` class
- Sidebar slide direction: account for RTL (slide from end instead of start)
- Test every page in Arabic locale

### Step 8.2: Responsive/Mobile Optimization
- ClockHero: 300px circle on lg+, 240px on md, 200px on sm
- Admin stat cards: `grid-cols-4` on xl, `grid-cols-2` on md, `grid-cols-1` on sm
- Charts: hidden on mobile or replaced with stat summary
- Sidebar: verify mobile hamburger works smoothly
- Tables: verify card view on mobile
- Reduce `backdrop-blur` values on mobile: `blur(16px)` -> `blur(8px)` for performance

### Step 8.3: Performance
- `will-change: transform` ONLY on actively-animated elements (remove after animation)
- Lazy-load Recharts: `const Chart = dynamic(() => import('./DashboardCharts'), { ssr: false })`
- AnimatedCounter: only animate when `useInView` triggers (already designed this way)
- Max 3-4 simultaneous `backdrop-blur` elements in viewport
- Font loading: verify `display: "swap"` on both fonts
- AuroraBackground: `React.memo()` to prevent unnecessary re-renders
- CustomCursor: already skips on touch devices

### Step 8.4: Accessibility
- Color contrast verification:
  - `#F1F5F9` on `#0A0A0F` = 17.4:1 (AAA pass)
  - `#94A3B8` on `#0A0A0F` = 7.3:1 (AAA pass)
  - `#64748B` on `#0A0A0F` = 4.6:1 (AA pass for large text only - use for labels/muted only)
  - `#3B82F6` on `#0A0A0F` = 4.8:1 (AA for large text - interactive elements only)
- Focus indicators: visible blue `box-shadow` ring on ALL interactive elements
- `prefers-reduced-motion`: verify all Framer Motion and CSS animations respect it
- ClockHero: add `aria-live="polite"` on time display (throttle announcements to 1/min)
- Tables: proper `<th>`, `<thead>`, `<tbody>` structure
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Form inputs: all have associated `<label>` elements
- Images: all have `alt` text

### Step 8.5: Final Visual Pass
- Check all pages at 375px, 768px, 1024px, 1440px
- Verify consistent card border radius (rounded-2xl = 1rem throughout)
- Verify consistent spacing (padding, gaps)
- Verify all skeleton states match new dark theme
- Verify toast notifications work on all pages
- Test login -> admin flow and login -> employee flow

### Verification for Phase 8:
- Full Arabic RTL test on every page
- Mobile test on every page at 375px
- Lighthouse audit: performance, accessibility scores
- Keyboard-only navigation test
- All existing functionality regression test

---

## Files Reference

### New Files to Create:
| # | File | Phase |
|---|---|---|
| 1 | `src/components/backgrounds/AuroraBackground.tsx` | 1 |
| 2 | `src/components/backgrounds/NoiseOverlay.tsx` | 1 |
| 3 | `src/components/ui/AnimatedCounter.tsx` | 3 |
| 4 | `src/components/ui/GlowingCard.tsx` | 3 |
| 5 | `src/components/ui/ChartWrapper.tsx` | 3 |
| 6 | `src/components/ui/PageTransition.tsx` | 2 |
| 7 | `src/components/employee/ClockHero.tsx` | 5 |
| 8 | `src/components/admin/AttendanceGauge.tsx` | 6 |
| 9 | `src/components/admin/DashboardCharts.tsx` | 6 |

### Existing Files to Modify:
| # | File | Phase |
|---|---|---|
| 1 | `package.json` | 1 |
| 2 | `src/app/globals.css` | 1 |
| 3 | `src/app/[locale]/layout.tsx` | 1 |
| 4 | `src/app/[locale]/login/page.tsx` | 4 |
| 5 | `src/app/[locale]/employee/page.tsx` | 5 |
| 6 | `src/app/[locale]/admin/layout.tsx` | 2 |
| 7 | `src/app/[locale]/admin/page.tsx` | 6 |
| 8 | `src/app/[locale]/admin/employees/page.tsx` | 7 |
| 9 | `src/app/[locale]/admin/attendance/page.tsx` | 7 |
| 10 | `src/app/[locale]/admin/settings/page.tsx` | 7 |
| 11 | `src/components/ui/Button.tsx` | 3 |
| 12 | `src/components/ui/Card.tsx` | 3 |
| 13 | `src/components/ui/Input.tsx` | 3 |
| 14 | `src/components/ui/Select.tsx` | 3 |
| 15 | `src/components/ui/Modal.tsx` | 3 |
| 16 | `src/components/ui/Badge.tsx` | 3 |
| 17 | `src/components/ui/Toast.tsx` | 3 |
| 18 | `src/components/ui/Skeleton.tsx` | 3 |
| 19 | `src/components/ui/index.ts` | 3 |
| 20 | `src/components/Footer.tsx` | 2 |
| 21 | `src/components/LanguageSwitcher.tsx` | 2 |
| 22 | `src/components/BulkImportModal.tsx` | 7 |
| 23 | `src/components/CustomCursor.tsx` | 2 |

### DO NOT Modify:
- `src/app/api/**` (all API routes)
- `src/lib/**` (auth, supabase, utils, timezone, pdf, settings, branches)
- `src/middleware.ts`
- `src/i18n/**`
- `src/types/index.ts`
- `messages/en.json`, `messages/ar.json`

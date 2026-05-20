---
name: Amwag Attendance
description: Internal attendance operations interface built for speed, trust, bilingual clarity, and payroll-grade records.
colors:
  canvas: "oklch(96.2% 0.018 88)"
  canvas-subtle: "oklch(93.4% 0.023 88)"
  surface: "oklch(98.5% 0.012 88)"
  surface-muted: "oklch(94.8% 0.018 88)"
  ink: "oklch(24.5% 0.018 125)"
  text-muted: "oklch(49% 0.018 125)"
  line: "oklch(84% 0.022 88)"
  line-strong: "oklch(74% 0.028 88)"
  primary: "oklch(42% 0.075 165)"
  primary-hover: "oklch(35% 0.08 165)"
  primary-soft: "oklch(89% 0.045 165)"
  focus: "oklch(48% 0.095 165)"
  success: "oklch(45% 0.09 150)"
  success-soft: "oklch(91% 0.048 150)"
  warning: "oklch(58% 0.105 75)"
  warning-soft: "oklch(90% 0.056 75)"
  danger: "oklch(50% 0.13 28)"
  danger-soft: "oklch(91% 0.05 28)"
  info: "oklch(49% 0.075 230)"
  info-soft: "oklch(91% 0.045 230)"
typography:
  display:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0.04em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  status-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  status-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: Amwag Attendance

## 1. Overview

**Creative North Star: "Operational Ledger"**

The interface should feel like an official operations ledger brought into a modern product: warm paper surfaces, clear ink, restrained green action color, readable tables, and calm status language. It is premium through discipline, not decoration. The design should make attendance records feel trustworthy enough for HR, payroll, and management decisions.

This is a product system, so the tool must disappear into daily work. Admins should see the attendance situation in seconds. Employees should clock in or out without uncertainty. Accountants should trust that reports match the visible records. Density is allowed when it improves scanning, but every dense surface needs strong hierarchy, predictable controls, and clear feedback.

The system explicitly rejects flashy SaaS visuals, childish gamification, generic blue-glass dashboards, overly futuristic cyber UI, heavy decorative backgrounds, marketing-style hero sections inside admin pages, too many gradients and glows, empty cards, and beautiful but useless statistics.

**Key Characteristics:**

- Warm operational neutrality with a restrained green primary action color.
- Dense, readable tables and summary panels that lead with exceptions.
- Paper, ink, and rule-line depth instead of glass, glow, or decorative blur.
- Arabic and English typography treated as equal product requirements.
- Status states communicated through text, icon, and color together.

## 2. Colors

The palette is warm paper, dark ink, restrained operational green, and sober semantic status colors.

### Primary

- **Operations Green** (`oklch(42% 0.075 165)`): Use for primary actions, current navigation, selected filters, focus affordances, and the most important active state on a screen. It should stay rare, usually less than 10% of any view.
- **Operations Green Hover** (`oklch(35% 0.08 165)`): Use only for pressed or hover states on primary controls.
- **Soft Operations Green** (`oklch(89% 0.045 165)`): Use for selected rows, active filter backgrounds, and calm positive emphasis. Pair with explicit text, never color alone.

### Secondary

- **Ledger Gold** (`oklch(58% 0.105 75)`): Use as warning and review attention, such as late arrivals, missing checkout review, and branch watch states. Keep it informational, not decorative.

### Tertiary

- **Report Blue** (`oklch(49% 0.075 230)`): Use for neutral informational states such as export progress, pending reports, and help text that needs mild prominence.

### Neutral

- **Ledger Canvas** (`oklch(96.2% 0.018 88)`): Main app background. It should feel warm, steady, and printable.
- **Subtle Canvas** (`oklch(93.4% 0.023 88)`): Sidebar, toolbar, and table header background.
- **Record Surface** (`oklch(98.5% 0.012 88)`): Cards, tables, forms, popovers, and row groups.
- **Muted Surface** (`oklch(94.8% 0.018 88)`): Secondary panels, disabled areas, and empty state blocks.
- **Ledger Ink** (`oklch(24.5% 0.018 125)`): Primary text and icons.
- **Muted Ink** (`oklch(49% 0.018 125)`): Secondary labels, helper text, timestamps, and metadata.
- **Rule Line** (`oklch(84% 0.022 88)`): Default borders, table dividers, input strokes.
- **Strong Rule Line** (`oklch(74% 0.028 88)`): Focus-adjacent separators, selected borders, and structural dividers.

### Named Rules

**The Ledger Rarity Rule.** Operations Green marks action or selection. It is not decoration.

**The No Blue Glass Rule.** Do not recreate the old generic blue-glass dashboard style. No glassmorphism as default, no decorative blur, no blue/violet glow palette.

**The Status Redundancy Rule.** Status color must always be paired with visible text and, where useful, a stable icon.

## 3. Typography

**Display Font:** Inter or system UI, with Cairo for Arabic.
**Body Font:** Inter or system UI, with Cairo for Arabic.
**Label/Mono Font:** Use the same sans family. Do not introduce a display face for product labels.

**Character:** Typography should feel official, compact, and clear. It should support bilingual scanning, table density, and form accuracy before personality.

### Hierarchy

- **Display** (700, 2rem, 1.15): Use for the highest page title only. Admin pages should rarely need more than one display-level heading.
- **Headline** (700, 1.5rem, 1.2): Use for section-level page headers, dashboard summaries, and major workflow titles.
- **Title** (650, 1rem, 1.35): Use for card titles, form groups, table panel headings, and modal titles.
- **Body** (400, 0.875rem, 1.6): Use for prose, helper copy, empty states, and readable descriptions. Keep prose line length near 65 to 75 characters.
- **Label** (650, 0.75rem, 1.35, 0.04em): Use for field labels, table metadata, badges, and compact controls. Uppercase labels are allowed only for short operational labels.

### Named Rules

**The Data First Type Rule.** Tables, filters, forms, and status text need legibility before dramatic hierarchy. Do not use display typography inside dense panels.

**The Arabic First-Class Rule.** Arabic screens must not inherit Latin spacing blindly. Check truncation, line height, alignment, and control width in RTL.

## 4. Elevation

This system is flat by default and uses tonal layering, borders, and precise spacing before shadows. Elevation should explain structure or state, not create atmosphere. Surfaces at rest use warm backgrounds and rule lines. Shadows appear only for popovers, sticky navigation, menus, and hover states where depth improves usability.

### Shadow Vocabulary

- **Surface Lift** (`0 1px 2px oklch(24.5% 0.018 125 / 0.08)`): Use for sticky headers and subtle raised panels.
- **Popover Lift** (`0 12px 28px oklch(24.5% 0.018 125 / 0.14)`): Use for dropdowns, date pickers, command menus, and popovers.
- **Dialog Lift** (`0 20px 44px oklch(24.5% 0.018 125 / 0.18)`): Use for unavoidable dialogs and sensitive confirmations.

### Named Rules

**The Flat By Default Rule.** Cards are not decoration. Use a card only when it frames a real unit of work, not to make the page look full.

**The No Glow Rule.** Do not use glow, halo, pulsing light, or blurred colored shadows on operational screens.

## 5. Components

Components should feel familiar, steady, and fast. Every interactive component needs default, hover, focus, active, disabled, loading, and error states.

### Buttons

- **Shape:** Low radius, steady rectangle (`6px`). Avoid pill buttons except for compact status chips.
- **Primary:** Operations Green background, Record Surface text, `36px` default height, `44px` minimum touch height for mobile or employee clock actions.
- **Hover / Focus:** Darken background on hover. Use a visible 2px focus ring in Operations Green with a 2px offset. Do not use glow.
- **Secondary / Ghost / Tertiary:** Secondary buttons use Record Surface, Rule Line border, and Ledger Ink. Ghost buttons are for low-risk navigation or table actions only.

### Chips

- **Style:** Status chips use soft semantic backgrounds, darker semantic text, an optional icon, and explicit label text.
- **State:** Selected filter chips use Soft Operations Green plus text. Status chips must not be clickable unless they act as filters.

### Cards / Containers

- **Corner Style:** `8px` for most surfaces, `10px` only for larger work panels.
- **Background:** Record Surface on Ledger Canvas. Subtle Canvas for sidebars, table headers, and grouped filters.
- **Shadow Strategy:** Flat at rest. Use borders and tonal layers before shadow.
- **Border:** 1px Rule Line by default. Strong Rule Line only for selected or focused containers.
- **Internal Padding:** `16px` for compact panels, `24px` for primary work sections, `32px` only for spacious empty states.

### Inputs / Fields

- **Style:** Record Surface background, Rule Line border, `6px` radius, `36px` height for admin forms, `44px` minimum on touch-heavy employee screens.
- **Focus:** Operations Green 2px outline with clear offset. Do not remove browser-accessible focus behavior without replacing it.
- **Error / Disabled:** Errors use Danger Soft background or border plus explicit text. Disabled fields use Muted Surface and Muted Ink while remaining readable.

### Navigation

- **Style:** Side navigation uses Subtle Canvas with compact rows, icons, and text labels. Active state uses Soft Operations Green plus Operations Green icon/text emphasis.
- **Typography:** Labels use the Label role, not display typography.
- **Default / Hover / Active:** Hover uses Muted Surface. Active uses selected background and text, never a thick side-stripe border.
- **Mobile Treatment:** Collapse to a drawer or top navigation with clear labels, visible focus, and a large close target.

### Tables and Reports

Tables are a signature component. They should use sticky headers where useful, clear row dividers, readable density, and status cells with text plus icon. Avoid full-row color fills except for selected rows or serious warnings. Exports must use clear labels, loading states, and success/error feedback.

### Employee Clock Surface

The clock-in/out surface should be calmer and larger than admin tables. It must clearly show current user, branch, date, time, status, and next available action. Primary actions need large touch targets and should avoid accidental taps through spacing and confirmation for sensitive actions.

## 6. Do's and Don'ts

### Do:

- **Do** make the attendance situation readable in seconds: present, absent, late, early leave, missing checkout, branch issues, and today actions should be visible without hunting.
- **Do** use warm operational neutrals and restrained Operations Green for actions, selection, and focus.
- **Do** make Arabic and English first-class. Check RTL spacing, alignment, truncation, labels, tables, and form controls.
- **Do** pair every status color with text and, where useful, an icon.
- **Do** keep admin dashboards dense but organized, with tables, filters, and action queues prioritized over decorative summaries.
- **Do** provide clear loading, saving, success, error, and export-in-progress feedback.
- **Do** use visible keyboard focus for buttons, filters, forms, date pickers, menus, tables, and dialogs.
- **Do** keep employee clock-in/out actions large, obvious, and safe for shared devices.

### Don't:

- **Don't** use flashy SaaS visuals.
- **Don't** use childish gamification.
- **Don't** use generic blue-glass dashboards.
- **Don't** use overly futuristic cyber UI.
- **Don't** use heavy decorative backgrounds that distract from data.
- **Don't** use marketing-style hero sections inside admin pages.
- **Don't** use too many gradients, glows, or empty cards.
- **Don't** create beautiful but useless statistics.
- **Don't** use glassmorphism as default.
- **Don't** use gradient text.
- **Don't** use colored side-stripe borders greater than 1px on cards, list items, callouts, alerts, or active navigation.
- **Don't** rely on color alone for late, absent, present, missing checkout, early leave, overtime, or unauthorized IP states.
- **Don't** hide focus states, create keyboard traps, or make tiny icons the only way to perform critical actions.
- **Don't** add decorative animation to operational screens. Motion must convey state and respect reduced-motion preferences.

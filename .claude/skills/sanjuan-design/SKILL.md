---
name: sanjuan-design
description: >
  MenuSanJuan visual design system. Load when working on UI components,
  pages, layouts, or any user-facing styling. Covers colors, typography,
  spacing, component patterns, and brand rules.
---

# San Juan Design System — MenuSJ

## Brand identity
- Product: MenuSanJuan (MenuSJ)
- Logo: letter "M" inside a rounded square, orange gradient
- Voice: warm, local, approachable
- Language: Argentina Spanish (vos form)

## Color system (Tailwind CSS 4, @theme in globals.css)

### Public pages (light)
- Background: white/light surfaces
- Text: dark (text-text, text-text-secondary, text-text-muted)
- Cards: bg-surface with border-border
- Accents: primary orange

### Dashboard + Admin (dark)
- Background: bg-slate-950
- Surface: bg-slate-900/50
- Borders: border-white/5, border-white/10
- Text: text-white, text-slate-400, text-slate-500
- Inputs: bg-white/5 border-white/10 text-white

### Brand colors
- Primary: #f97316 (orange-500) → `text-primary`, `bg-primary`
- Gradient: `bg-gradient-to-r from-primary to-amber-500`
- Accent: amber-500, amber-400
- Success: emerald-400/500
- Danger: red-400/500

## Core component patterns

### Card (public)
```jsx
<div className="rounded-2xl border border-border/60 bg-surface p-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
```

### Card (dashboard)
```jsx
<div className="rounded-2xl border border-white/5 bg-slate-900/50 p-6">
```

### Primary button
```jsx
<button className="rounded-xl bg-gradient-to-r from-primary to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 hover:shadow-lg hover:-translate-y-0.5 transition-all">
```

### Input (public)
```jsx
<input className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
```

### Input (dashboard)
```jsx
<input className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-primary focus:outline-none" />
```

### Price display
```jsx
<span className="font-bold">${price.toLocaleString("es-AR")}</span>
```

### Badge
```jsx
<span className="rounded-md bg-primary/90 px-2 py-0.5 text-xs font-medium text-white">{text}</span>
```

### Empty state
```jsx
<div className="rounded-2xl border border-white/5 bg-slate-900/50 p-12 text-center">
  <div className="text-4xl mb-4">🍽️</div>
  <h3 className="text-lg font-bold text-white mb-2">Sin datos</h3>
  <p className="text-sm text-slate-500">Mensaje explicativo</p>
</div>
```

## Rules
- Public pages: light background, warm and inviting
- Dashboard/admin pages: dark background (slate-950)
- Mobile-first: design for 375px, enhance at sm/md/lg
- Tap targets: 44px minimum
- Tailwind only — no inline styles, no CSS modules
- Rounded corners: rounded-xl (buttons, inputs), rounded-2xl (cards, sections)
- Animations: `animate-fade-in`, `transition-all`, `hover:-translate-y-0.5`
- Glass effect: `glass` or `glass-dark` utility classes
- No emojis in code unless user explicitly requests them

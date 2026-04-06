---
name: sanjuan-design
description: >
  MenuSanJuan visual design system. Load this skill whenever working on
  UI components, pages, layouts, or any user-facing styling.
  Covers colors, typography, spacing, component patterns, and brand rules.
---

# San Juan Design System — MenuSJ

## Brand identity
- Product: MenuSanJuan (MenuSJ)
- Logo: letter "M" inside a rounded square, terracotta on dark
- Voice: warm, local, approachable — not corporate

## Color palette
```
Primary:     #E8593C  (terracotta / burnt orange)
Primary dark:#C04828
Background:  #1A1A1A  (near-black, main bg)
Surface:     #242424  (cards, panels)
Surface 2:   #2E2E2E  (hover states, inputs)
Text primary:#F5F0EB  (warm white)
Text muted:  #9E9A94  (secondary text)
Border:      #3A3A3A  (subtle dividers)
Success:     #3D9970
Error:       #E74C3C
```

## Typography
- Font: system-ui / Inter fallback
- Headings: font-semibold, tracking-tight
- Body: font-normal, leading-relaxed
- Prices: font-bold, tabular-nums
- All user-facing copy in Spanish (Argentina)

## Spacing scale (Tailwind)
- Section padding: p-6 or p-8
- Card padding: p-4
- Button padding: px-6 py-3
- Gap between items: gap-3 or gap-4
- Stack spacing: space-y-4

## Core component patterns

### Card
```jsx
<div className="bg-[#242424] rounded-xl border border-[#3A3A3A] p-4 hover:border-[#E8593C]/40 transition-colors">
```

### Primary button
```jsx
<button className="bg-[#E8593C] hover:bg-[#C04828] text-white font-semibold px-6 py-3 rounded-lg transition-colors">
```

### Secondary button
```jsx
<button className="border border-[#3A3A3A] hover:border-[#E8593C] text-[#F5F0EB] px-6 py-3 rounded-lg transition-colors">
```

### Input field
```jsx
<input className="w-full bg-[#2E2E2E] border border-[#3A3A3A] focus:border-[#E8593C] rounded-lg px-4 py-3 text-[#F5F0EB] outline-none transition-colors" />
```

### Section header
```jsx
<h2 className="text-xl font-semibold text-[#F5F0EB] tracking-tight">
```

### Price display
```jsx
<span className="font-bold tabular-nums text-[#E8593C]">$ {price.toLocaleString('es-AR')}</span>
```

## Mobile-first rules
- Design for 375px width first
- All tap targets minimum 44px height
- Sticky bottom bar for cart/checkout CTA
- Bottom sheet modals (not centered modals on mobile)

## Dark mode
The app is dark-mode-first. Do not add light mode unless explicitly requested.

## Iconography
Use lucide-react. Consistent stroke-width="1.5". Size: 20px default, 16px in buttons, 24px in section headers.

## Animation
- Subtle only: transition-colors, transition-opacity
- Duration: 150ms for interactions, 300ms for page transitions
- No heavy animations on mobile

# TofuTablePlay — Website UI & Design System

> **Design Philosophy: Modern Minimalist Dark / Smooth Fade & Layered Opacity**
> 
> TofuTablePlay adopts a distraction-free, "Swiss Dark / Linear-aesthetic" design language. The system deliberately rejects saturated neon glows, bloom, and glare in favor of **layered opacity surfaces (`backdrop-blur-md`, subtle alpha channels)**, **smooth fade transitions**, **matte amber accents**, and **high-contrast typography**.

---

## 1. Design Tokens & Color Palette

### 1.1 Surfaces & Opacity Hierarchy
Surfaces are built from translucent zinc layers over a deep neutral canvas:

| Surface Level | Tailwind Class / CSS | Purpose |
| :--- | :--- | :--- |
| **Canvas / Base** | `bg-zinc-950` (`#09090b`) | Primary application background, neutral black |
| **Surface 1 (Cards & Panels)** | `bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50` | Standard cards, sidebars, narrative feed, modals |
| **Surface 2 (Hover / Active)** | `hover:bg-zinc-800/30 hover:border-zinc-700/60` | Card elevation, interactive container highlights |
| **Recessed Insets** | `bg-black/30 border border-zinc-800/70` | Text inputs, code blocks, draft action areas |
| **Floating Overlays** | `bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/80 shadow-2xl` | Dialogs, template studio modal, alert popups |

### 1.2 Accents (Matte & Muted)
- **Primary CTA**: `bg-amber-600/90 hover:bg-amber-600 active:bg-amber-700 text-zinc-100 font-medium rounded-lg`
- **Secondary CTA**: `bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800/60 text-zinc-300 font-medium rounded-lg`
- **Ghost Action**: `text-zinc-400 hover:text-zinc-200 transition-colors duration-200`
- **Subtle Badges**: `bg-amber-500/10 border border-amber-500/20 text-amber-400/90 rounded-full px-2.5 py-0.5 text-xs`

### 1.3 Typography
- **Font Sans**: Geist Sans (`var(--font-geist-sans)`)
- **Font Mono**: Geist Mono (`var(--font-geist-mono)`)
- **Primary Headings**: `text-zinc-100 font-semibold tracking-tight`
- **Body Text**: `text-zinc-300 text-sm leading-relaxed`
- **Secondary Labels**: `text-zinc-400 text-xs`
- **Metadata / Timestamps**: `text-zinc-500 text-xs font-mono`

---

## 2. Micro-Interactions & Motion

- **Smooth Fade Opacity**:
  Transitions rely on gentle alpha shifts rather than sudden flashes:
  `transition-opacity duration-200 ease-out`
- **Subtle Elevation**:
  Cards gently rise on hover without blur glow:
  `transition-all duration-200 ease-out hover:-translate-y-0.5`
- **Text Selection**:
  Dark matte selection highlighting:
  `selection:bg-zinc-800 selection:text-amber-200`
- **Minimalist Scrollbars**:
  Ultra-thin 5px rounded scrollbars that fade in on hover (`rgba(63, 63, 70, 0.45)`).

---

## 3. Global CSS Utilities (`globals.css`)

```css
/* Translucent frosted container */
.surface-panel {
  background-color: rgba(24, 24, 27, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(39, 39, 42, 0.5);
}

/* Smooth hover transition */
.surface-panel-hover {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.surface-panel-hover:hover {
  background-color: rgba(39, 39, 42, 0.35);
  border-color: rgba(63, 63, 70, 0.6);
  transform: translateY(-1px);
}

/* Masked gradient for smooth scroll fade-out at edges */
.fade-mask-y {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 16px), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 16px, black calc(100% - 16px), transparent 100%);
}
```

---

## 4. Implementation Status by Phase

- [x] **Phase 1: Global Theme & Base Tokens** — *Completed*
- [ ] **Phase 2: Landing Page & Authentication** — *Pending*
- [ ] **Phase 3: Hub & Campaign Management** — *Pending*
- [ ] **Phase 4: Character Codex & Template Studio** — *Pending*
- [ ] **Phase 5: Virtual Tabletop (VTT) & In-Table HUD** — *Pending*
- [ ] **Phase 6: Verification & QA** — *Pending*

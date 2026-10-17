# PRISM Design System & Style Guide (`Style.md`)

This document defines the visual design system, typography, color palettes, spacing ratios, and interaction standards for the **PRISM** ForteBank Cash Discipline Compliance Platform.

---

## 1. Design Philosophy: Linear High-Density Engineering

PRISM is designed as high-precision banking surveillance and compliance software. It follows the principles of **Linear-style high-density engineering** and **Swiss typographic minimalism**:

1. **Zero "AI Slop" & Zero Marketing Fluff:**
   - No generic tech-bro buzzwords (*"Vision Intelligence"*, *"AI-Powered Engine"*, *"Next-Gen Automation"*).
   - Language is concise, operational, and factual: *«Кассовый контроль»*, *«Проверить запись»*, *«Нарушение зафиксировано»*, *«Экспорт фрагмента»*.
2. **Quiet Confidence & Restraint:**
   - No multi-colored rainbow gradients, spinning neon shapes, or excessive drop shadows.
   - Contrast is achieved through precise typographic hierarchy and crisp `1px` borders.
3. **Low Cognitive Load & High Density:**
   - Information is structured hierarchically. Dense data (timestamps, video metrics, legal clauses) is formatted cleanly with tabular monospace digits.
   - Actions and tools are accessible without sensory overload (Master-Detail layouts instead of walls of text).

---

## 2. Typography

PRISM utilizes a dual-font system pairing modern neo-grotesque typefaces with tabular monospaced numerals.

| Role | Font Family | Fallback Stack | Use Cases |
| :--- | :--- | :--- | :--- |
| **Primary Sans** | **Geist** / **Plus Jakarta Sans** | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | Interface copy, headings, labels, legal text, buttons |
| **Telemetry Mono** | **Geist Mono** / **JetBrains Mono** | `"SF Mono", Menlo, Consolas, monospace` | Timestamps (`00:22.4`), FPS, rule codes (`UNATTENDED_SAFE_OPEN`), file sizes |

### Typographic Scale & Ratios

| Level | Size | Weight | Line Height | Tracking | Application |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Hero Brand** | `64px – 96px` | `600 (SemiBold)` | `1.0` | `+0.35em` | Screensaver **PRISM** wordmark |
| **Header Brand** | `15px – 16px` | `600 (SemiBold)` | `1.2` | `+0.20em` | Navigation bar **PRISM** mark |
| **Section Title** | `14px – 15px` | `600 (SemiBold)` | `1.3` | `-0.01em` | Card & panel titles |
| **Body Text** | `12px – 13px` | `400 (Regular)` | `1.5` | `normal` | Descriptions, legal quotes, explanations |
| **Micro Labels** | `10px – 11px` | `500 (Medium)` | `1.2` | `+0.05em` | Status chips, timecode pills, badges |
| **Technical Mono** | `11px` | `500 (Medium)` | `1.2` | `tabular` | Video duration, coordinates, cut indices |

---

## 3. Color Palettes & Contrast Ratios

### 3.1. Light Theme (Main / Default)

Designed for daytime office environments and compliance auditor screens with high readability:

- **Canvas Background:** `#F9FAFB` (Subtle off-white slate)
- **Surfaces & Cards:** `#FFFFFF` (Pure white)
- **Dividers & Borders:** `#E5E7EB` (Clean `1px` graphite hairline)
- **Sub-panels & Insets:** `#F3F4F6` (Neutral gray fill)
- **Text Primary:** `#111827` (Deep graphite, high contrast ratio $> 14:1$)
- **Text Secondary:** `#4B5563` (Muted slate for descriptions)
- **Text Tertiary / Captions:** `#9CA3AF` (Light gray for technical tags)
- **Brand Primary Accent:** `#9D1D53` (ForteBank Signature Crimson)
- **Brand Hover:** `#831644`
- **Violation Alert:** `#DC2626` (Muted red, not neon) / `#FEF2F2` (soft red tint)
- **Compliant / Success:** `#15803D` (Forest emerald) / `#F0FDF4` (soft green tint)

### 3.2. Dark Theme (Alternative)

Designed for low-light CCTV monitoring rooms using Linear’s signature matte charcoal:

- **Canvas Background:** `#0D0F12` (Matte obsidian)
- **Surfaces & Cards:** `#16191E` (Dark charcoal)
- **Dividers & Borders:** `#22272E` (`1px` hairline)
- **Sub-panels & Insets:** `#0E1015` (Deeper dark inset)
- **Text Primary:** `#EDEDEF` (Soft white, avoids eye strain)
- **Text Secondary:** `#8A919E` (Neutral cool gray)
- **Text Tertiary / Captions:** `#525866` (Subdued gray)
- **Brand Primary Accent:** `#BE123C` / `#9D1D53`
- **Violation Alert:** `#F43F5E` / `rgba(244, 63, 94, 0.15)`
- **Compliant / Success:** `#22C55E` / `rgba(34, 197, 94, 0.15)`

---

## 4. Screensaver Identity & Transition Standard

The opening screensaver serves as an editorial brand reveal rather than an animated distraction:

1. **Duration:** Exactly **1.0 second** hold time.
2. **Theme Adaptation:**
   - **Light Mode:** Off-white canvas (`#F9FAFB`), deep graphite typography, Forte crimson hairline mark.
   - **Dark Mode:** Matte obsidian canvas (`#0D0F12`), soft white typography, Forte crimson hairline mark.
3. **Dissolve Animation:**
   - Transition: `opacity 3.0s ease-in-out, filter 3.0s ease-in-out, transform 3.0s ease-in-out`.
   - Exiting State: `filter: blur(80px)`, `opacity: 0`, `transform: scale(1.06)`.
   - Unmount: Completely unmounts from the DOM at `4.0s` (1.0s active hold + 3.0s dissolve) to free memory and GPU resources.

---

## 5. UI Components & Spacing Ratios

- **Corner Radii:**
  - Micro elements (pills, badges): `rounded (4px)` or `rounded-md (6px)`
  - Cards & Viewports: `rounded-xl (12px)`
  - Modals: `rounded-xl (12px)` or `rounded-2xl (16px)`
- **Borders:**
  - Standard container border: `1px solid border-gray-200 dark:border-[#22272E]`
  - Bounding-box targeting reticle: `1.5px solid #E11D48` with hairline corner brackets
- **Spacing Scale:**
  - Component padding: `p-3.5` to `p-5`
  - Spacing between sections: `space-y-4` to `space-y-6`
  - Header height: `56px` (`h-14`)

---

## 6. Theme Persistence

- Theme preference is stored in `localStorage.getItem('prism-theme')` (`'light'` or `'dark'`).
- The `dark` class is applied to `document.documentElement` (`<html class="dark">`).
- Both the **Screensaver** and the **Main Screen** respect this stored preference on initial boot.

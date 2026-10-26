# FIRST 10 — Design System Specification

Operational design system specification for the **FIRST 10** crisis decision control room, Duty Officer dashboard, and Simulation Lab.

---

## 1. Design Philosophy & Core Principles

1. **Calm Under Pressure:** Dense, structured, and quiet. Operational displays never flash, pulse aggressively, or use gratuitous animation. Visual hierarchy directs immediate attention to escalating threats without sensory overload.
2. **Never Color Alone:** Every operational state, hypothesis, action recommendation, and authorization gate strictly pairs color with an SVG icon and an explicit text label. Color blindness (deuteranopia, protanopia, tritanopia) must never compromise situational awareness.
3. **Tabular Precision:** All sensor timestamps, probabilities, deltas, costs, and GPS coordinates render with tabular numerals (`tabular-nums`) in `JetBrains Mono` or tabular `Inter` to prevent visual jitter between 60-second updates.
4. **Honest Uncertainty & Abstention:** When sensor pipelines degrade or fail, the system explicitly abstains (e.g., *"Forecast unavailable: fewer than 2 independent supporting sources"*). Mock or synthetic data is permanently flagged with the top-level simulated banner.
5. **Two-Theme Parity with Dynamic Palettes:** Dark theme is engineered for low-light command rooms; Light theme is calibrated for high-glare projectors and administrative printouts. Both themes maintain WCAG 2.1 AA contrast ratios across all 6 selectable accent palettes.

---

## 2. Color System & Semantic Tokens

The visual foundation is completely tokenized into CSS custom variables (`frontend/src/index.css`), allowing real-time switching between Dark and Light modes as well as live swapping of accent palettes.

### 2.1 Base Theme Palettes

#### Dark Mode (Tactical Command Room — Default)
- **Base Background (`--bg-base`):** `#0D0B0A` (Deep charcoal-brown obsidian)
- **Surface (`--bg-surface`):** `#17120F` (Card and panel background)
- **Raised (`--bg-raised`):** `#211A15` (Drawers, modals, popovers, headers)
- **Subtle Border (`--border-subtle`):** `#33281F` (Subtle geometric dividers)
- **Primary Text (`--text-cream`):** `#F5EFE8` (Warm off-white, high readability)
- **Muted Text (`--text-muted`):** `#A89684` (Tactical secondary metadata, 4.8:1 contrast)

#### Light Mode (Office / High-Glare Projector)
- **Base Background (`--bg-base`):** `#F8F6F2` (Warm sand paper)
- **Surface (`--bg-surface`):** `#FFFFFF` (Clean white panels)
- **Raised (`--bg-raised`):** `#EFEAE2` (Elevated headers, active tabs)
- **Subtle Border (`--border-subtle`):** `#D8CFC4` (Subtle boundary lines)
- **Primary Text (`--text-cream`):** `#1E1B18` (Deep ink brown)
- **Muted Text (`--text-muted`):** `#665C54` (Muted slate-brown, WCAG AAA compliant)

---

### 2.2 Dynamic Accent Palettes

Users can select from 6 operational colorways. Each palette defines an active accent, a highlighted variant, and a deep tonal shade:

| Palette Key | Mission Profile | Dark Theme Values (`accent` / `light` / `dark`) | Light Theme Values (`accent` / `light` / `dark`) |
|:---|:---|:---|:---|
| **Brown (Default)** | Tactical Ground Operations | `#8B5E3C` / `#B07A4F` / `#5C3A21` | `#8B5E3C` / `#A56F47` / `#5C3A21` |
| **Teal** | Maritime & Coastal Hydrology | `#0D9488` / `#2DD4BF` / `#115E59` | `#0F766E` / `#14B8A6` / `#134E4A` |
| **Emerald** | Forest, Wildfire & Eco-Grid | `#059669` / `#34D399` / `#065F46` | `#047857` / `#10B981` / `#064E3B` |
| **Indigo** | Civil Defence & Metro Transit | `#6366F1` / `#818CF8` / `#4338CA` | `#4F46E5` / `#6366F1` / `#3730A3` |
| **Amber** | Industrial, Petrochem & Hazmat | `#D97706` / `#FBBF24` / `#92400E` | `#B45309` / `#F59E0B` / `#78350F` |
| **Crimson** | High-Alert Crisis Escalation | `#DC2626` / `#F87171` / `#991B1B` | `#B91C1C` / `#EF4444` / `#7F1D1D` |

---

### 2.3 Hypothesis Color Mapping (Data Visualization)

Probabilities across the 4 competing crisis hypotheses maintain identical chromatic identifiers across all charts, sparklines, badges, and spatial radar markers:

| Hypothesis | Color Token | Hex Code | Visual Motif | Icon Description |
|:---|:---|:---|:---|:---|
| **Noise (`h1`)** | `text-data-slate` | `#7C8DA6` | Dotted line / Slate marker | Radio wave activity |
| **Sensor Failure (`h2`)** | `text-data-violet` | `#B48CF2` | Diagonal hatch / Violet marker | Disconnected plug |
| **Isolated Flood (`h3`)** | `text-data-amber` | `#F2B84B` | Solid line / Amber marker | Location pin / Localized ripple |
| **Cascade Crisis (`h4`)** | `text-data-coral` | `#FF6B5E` | Cross-hatch / Coral pulse | Diverging branching chain |

---

### 2.4 Action Hierarchy & Emergency Escalation States

Actions derived from the cost matrix minimization and hysteresis filter:

| Action | Color Token | Icon | Styling & Microcopy | Operational Protocol |
|:---|:---|:---|:---|:---|
| **WATCH** | `#5AA9E6` (Muted Blue) | `Eye` | Outlined pill, calm border | Normal telemetry polling; log anomalies. |
| **PREPARE** | `#F2B84B` (Amber) | `ClipboardCheck` | Filled pill, dark text | Stage standby crews, verify pump telemetry. |
| **ALERT** | `#F28C38` (Orange) | `Bell` | Filled pill, high contrast text | Notify district teams; pre-position sandbags. |
| **ESCALATE** | `#E5484D` (Coral Red) | `Megaphone` | Filled pill + double border ring | Multi-agency dispatch; trigger floodgates. |

---

## 3. Typography & Numerical Formatting

The typography hierarchy uses two primary typefaces:
- **`Inter`:** Clean sans-serif for interface controls, structural labels, navigation, and narrative explanations.
- **`JetBrains Mono`:** High-legibility monospaced typeface for all raw timestamps, sensor values, correlation matrices, and event tokens.

### Typography Hierarchy

| UI Role | Typeface | Size / Weight | Letter Spacing | Tabular Setting |
|:---|:---|:---|:---|:---|
| **System Banner** | Inter | 11px / 700 SemiBold | `tracking-wider` (uppercase) | Normal |
| **Primary Page Heading** | Inter | 18px / 600 SemiBold | `tracking-tight` | Normal |
| **Section Header** | Inter | 12px / 600 SemiBold | `tracking-wider` (uppercase) | Normal |
| **Key Metric Probabilities** | Inter | 28px–32px / 700 Bold | `tracking-tight` | `tabular-nums` |
| **Telemetry & Sensor IDs** | JetBrains Mono | 12px / 500 Medium | Normal | `font-mono` |
| **Body & Microcopy** | Inter | 13px / 400 Regular | Normal | Normal |

---

## 4. Layout & Responsive Geometry

- **Grid:** 12-column responsive layout with 16px to 24px gutters, constrained to a maximum content width of 1920px.
- **Spacing Scale:** Strict geometric progression based on 4px increments (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`).
- **Corner Radii:** Consistent `8px` (`rounded-lg`) for container cards, drawers, and modal panels; `9999px` (`rounded-full`) for status pills and action badges.
- **Borders over Shadows:** In dark mode, depth is established via 1px border lines (`border-subtle-border`) rather than blurred drop shadows, maximizing crispness on control-room multi-monitor walls.

---

## 5. Core Interface Components

### 5.1 Real-Time Spatial Radar (Leaflet + OpenStreetMap)
- **Geolocation:** Integrates `navigator.geolocation.watchPosition` to track the operator's real coordinates, rendering a blue coordinate marker and confidence accuracy halo. Automatically falls back to Mumbai Disaster Management Headquarters (`19.0760° N, 72.8777° E`) if permissions are restricted.
- **Dark Mode Tile Filter:** Applies an inverted CSS matrix filter to OpenStreetMap raster tiles:
  `filter: brightness(0.7) invert(1) contrast(1.8) hue-rotate(180deg) saturate(0.3);`
  producing an authentic military-grade night radar screen without requiring commercial dark tile API keys.
- **Light Mode Tile Filter:** Clears all CSS filter transformations (`filter: none`), rendering pristine high-contrast topographic cartography.
- **Sensor Gateway Nodes:** Renders markers for Gateways G11 through G14 colored dynamically by dominant local hypothesis, with interactive popups displaying hardware status and linked sensors.

### 5.2 Live Weather Operations Panel
- Refreshes every 5 minutes using cached backend proxy endpoints (`/api/weather` and `/api/weather/alerts`).
- Clear visual distinction between real-world feeds (`[LIVE]` badge) and simulated incident feeds (`[SIMULATED]` badge).
- Graceful degradation: If external meteorological APIs encounter rate limits or network partitions, displays *"Live weather unavailable"* and maintains full application responsiveness.

### 5.3 4-Hypothesis Belief Deck
- Four interactive cards displaying current posterior probabilities $P(h_i \mid E_{1:t})$.
- Sum guarantees: Probabilities always sum to exactly 100% using the **Largest Remainder Method** (Hare-Niemeyer algorithm) to prevent rounding artifacts.
- Trend Indicators: Delta vs. previous minute ($+X\%$ / $-Y\%$) paired with inline sparklines representing the 15-minute moving window.
- Evidence Drawer: Clicking any card opens a slide-over drawer detailing top supporting and contradictory telemetry witnesses.

### 5.4 Causal Forecast Card Deck
- Displays three chronological cascading horizons:
  1. *Substation Flashover & Grid Isolation* ($t + 4\text{m}$)
  2. *Hospital Drainage Backflow* ($t + 7\text{m}$)
  3. *Arterial Road Impassability* ($t + 9\text{m}$)
- **Abstention State:** If critical input sensors drop below the independence threshold ($< 2$ uncoupled sources), the card converts to a dashed border state stating: *"Forecast unavailable: insufficient independent telemetry"*.

### 5.5 Two-Person Rule Authorization Kanban
- Four status columns: **Pending**, **Approved**, **Rejected**, and **Expired**.
- Strict security verification: The requester and approver must possess distinct user identities. An operator cannot approve their own escalation request.
- Audit trail: Captures cryptographic user token, timestamp, justification string, and active hypothesis distribution.

---

## 6. Accessibility & Keyboard Navigation

- **WCAG 2.1 AA Compliance:** Minimum 4.5:1 text contrast for body copy; minimum 3:1 for graphical UI elements and action borders.
- **Keyboard Shortcuts:**
  - `Space`: Toggle episode simulation play/pause.
  - `J`: Step forward by one minute ($t + 1$).
  - `K`: Step backward by one minute ($t - 1$).
- **Focus Rings:** High-visibility 2px solid `--color-accent` focus ring with a 2px offset on all interactive buttons, inputs, and tab switches.
- **Reduced Motion:** Fully honors `prefers-reduced-motion` by disabling CSS transitions and SVG sparkline animations.

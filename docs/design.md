# FIRST 10 — design.md

Design system for the duty-officer operations dashboard and Simulation Lab.

## 1. Design principles

1. **Calm under pressure.** Dense but quiet. Nothing blinks unless it demands action.
2. **Uncertainty is visible, not hidden.** Show ranges, entropy and "unavailable" states honestly.
3. **Numbers come from the engine.** Mock or placeholder values are always labeled *Illustrative*.
4. **Never color alone.** Every state pairs color with an icon and a text label.
5. **Explain on demand.** Headline first, reasoning one click away.
6. **One workspace.** The main dashboard answers "what is happening, what to do, what next, can I trust it" without navigation.

## 2. Visual language

Dark operations theme by default (control-room use), with a light theme for projectors and printing. Both themes use the same semantic tokens.

### 2.1 Color tokens

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--bg-base` | `#0B0F14` | `#F6F8FA` | App background |
| `--bg-surface` | `#121821` | `#FFFFFF` | Cards |
| `--bg-raised` | `#1A2330` | `#EEF2F6` | Drawers, popovers |
| `--border` | `#263244` | `#D5DCE4` | Dividers |
| `--text-primary` | `#E8EEF5` | `#101820` | Body, headings |
| `--text-secondary` | `#9AA9BC` | `#4B5B6E` | Labels |
| `--accent` | `#4C9AFF` | `#1F6FEB` | Links, focus ring |

### 2.2 Hypothesis colors (data viz)

| Hypothesis | Color (dark) | Icon | Pattern (for charts) |
|-----------|--------------|------|----------------------|
| Noise | `#7C8DA6` slate | wave | dotted |
| Sensor failure | `#B48CF2` violet | plug-off | diagonal hatch |
| Isolated incident | `#F2B84B` amber | map-pin | solid |
| Cascading crisis | `#FF6B5E` coral | git-fork / chain | cross-hatch |

### 2.3 Action colors

| Action | Color | Icon | Label style |
|--------|-------|------|-------------|
| WATCH | `#5AA9E6` blue | eye | outline pill |
| PREPARE | `#F2B84B` amber | clipboard-check | filled pill |
| ALERT | `#F28C38` orange | bell | filled pill |
| ESCALATE | `#E5484D` red | megaphone | filled pill + thick border |

Contrast: all text on colored fills must meet 4.5:1 (use dark text on amber/orange, white on red).

### 2.4 Status colors
`ok #3FB950`, `warn #D29922`, `error #F85149`, `stale #8B949E`, `revised #4C9AFF` (revision badge).

## 3. Typography

| Role | Font | Size / weight |
|------|------|---------------|
| UI text | Inter (fallback system-ui) | 14 / 400 |
| Labels | Inter | 12 / 500, uppercase tracking +4% |
| Headline numbers | Inter Tight or Inter, tabular nums | 32–48 / 600 |
| Data and IDs | JetBrains Mono | 12–13 / 400 |
| Headings | Inter | 16 / 600, 20 / 600 |

Use tabular numerals for all probabilities so digits don't jitter between ticks.

## 4. Layout

- 12-column grid, 24 px gutters, max content width 1600 px; dashboard optimized for 1440×900 and projector 1920×1080.
- Spacing scale: 4, 8, 12, 16, 24, 32.
- Radius: 8 px cards, 999 px pills.
- Elevation: borders instead of shadows in dark theme; subtle shadow in light.
- Persistent top bar (episode, minute, playback, "SIMULATED DATA" badge, version).
- Mobile/tablet: single column, belief cards first, action badge sticky at top.

## 5. Components

### 5.1 Belief card
- Large percentage, hypothesis name, delta vs last minute (▲/▼ with value), tiny 15-minute sparkline.
- Four cards always sum to 100%; rounding handled by largest-remainder method.
- Hover/focus opens evidence popover (top 3 supporting, top 3 contradicting).

### 5.2 Action badge
- Large pill with icon and text, "since minute N", and sub-line: *Held by hysteresis* or *Override*.
- Includes expected-cost mini bar chart for the four actions (lowest highlighted).

### 5.3 Forecast card (×3)
- Event title, affected area, time-window bar (earliest→latest on a minute axis), probability, confidence tag.
- Expandable: causal path chain, supporting evidence IDs, invalidation conditions.
- Unsupported state: dashed border, text "Forecast unavailable — insufficient independent evidence".

### 5.4 Evidence health strip
- Chips: independent sources n, suspected shared failures n, stale feeds n, missing feeds n.
- Click opens Source Map.

### 5.5 Belief timeline chart
- Stacked area using hypothesis colors + patterns; action ribbon beneath; vertical markers for fault injections, revisions and the twin split point.
- Optional 90% uncertainty band on cascade probability when ensemble data is available.

### 5.6 Source dependency map
- Node-link diagram (React Flow): gateways as large nodes, sensors clustered; failed groups outlined in red with hatch fill; edge thickness = estimated correlation.

### 5.7 Twin comparison view
- Two synchronized charts (A top, B bottom) or overlay toggle; shaded region for the shared prefix with a "Identical evidence" label; split line; response-lag brackets.

### 5.8 Decision explanation panel
Four fixed headings: **New evidence**, **How beliefs changed**, **Why this action**, **What would change it**. Text is generated from templates over structured records. Each sentence links to its source evidence.

### 5.9 Authorization modal
Shows recommended action, cost table, top invalidators, requester, required approver role. Primary button disabled until the reason field is completed. Clear text: "This app does not broadcast alerts. Authorization is recorded for the official procedure."

### 5.10 Tables and metrics
Calibration plot (reliability diagram with diagonal reference), bar charts for cost, KPI tiles with CIs.

## 6. Content and microcopy

| Situation | Copy |
|-----------|------|
| Simulation banner | "SIMULATED DATA — not for real emergency decisions" |
| Ambiguous belief | "Evidence is consistent with several explanations." |
| Common-cause | "N sensors affected; M share gateway G-12. Evidence discounted." |
| Missing data | "No data from cameras. Roads are not assumed clear." |
| Forecast abstain | "Forecast unavailable: fewer than 2 independent supporting sources." |
| Late data | "Minute 04 revised (v3 → v4) after late dispatch report." |

Tone: factual, no alarmist language, no emojis in operational text.

## 7. Motion
- Value changes animate with 150 ms number tween; no motion for color changes of action badge (instant, to avoid misreading).
- Respect `prefers-reduced-motion`; disable chart transitions and tweening.
- Playback ticks may pulse the minute counter once.

## 8. Accessibility
- WCAG 2.1 AA; focus ring 2 px `--accent`; full keyboard navigation (J/K step minute, Space play/pause).
- Screen readers: live region announces action changes ("Action changed from WATCH to PREPARE at minute 5") and new revisions; belief updates announced politely, not every tick.
- Charts have text/table alternatives.
- Action never by color alone (icon + label + pattern).
- Minimum touch target 44 px.

## 9. Iconography
Lucide icon set. Consistent 1.5 px stroke, 20 px default.

## 10. Frontend structure
```
src/
  app/            routes, providers
  components/     BeliefCard, ActionBadge, ForecastCard, EvidenceHealth, ...
  features/
    dashboard/ lab/ audit/ auth/ config/
  lib/            api client, ws client, formatters
  styles/         tokens.css, tailwind config
```
Tailwind theme maps the tokens in section 2 to CSS variables.

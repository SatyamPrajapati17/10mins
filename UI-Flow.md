# FIRST 10 — UI Flow

Plain-text diagrams that render in any Markdown viewer or editor. (Mermaid versions are in `03-UI-Flowchart.md`.)

Legend: `[Screen]` · `{Decision}` · `(Action)` · `──►` goes to

---

## 1. Master navigation flow

```
                         ┌───────────────┐
                         │  Open app     │
                         └───────┬───────┘
                                 ▼
                         ┌───────────────┐   invalid credentials
                         │  [S0 Login]   │◄──────────────┐
                         └───┬───────┬───┘               │
                 valid login │       │ judge link         │
                             ▼       └──────────────┐     │
                  ┌────────────────────┐            │     │
                  │ [S1 Episode Picker]│────────────┼─────┘ (retry)
                  └───┬────────────┬───┘            │
        open episode  │            │ create scenario│
                      ▼            ▼                ▼
        ┌───────────────────────┐  ┌──────────────────────────┐
        │ [S2 Operations        │  │ [S8 Simulation Lab]      │
        │     Dashboard]        │◄─┤  twin test · fault inject│
        └─┬───┬───┬───┬───┬─────┘  └───────────┬──────────────┘
          │   │   │   │   │                    ▼
          │   │   │   │   │          ┌──────────────────────┐
          │   │   │   │   │          │ [S9 Metrics and      │
          │   │   │   │   │          │     Calibration]     │
          │   │   │   │   │          └──────────────────────┘
          │   │   │   │   └─(admin)──► [S10 Config]
          │   │   │   └─────────────► [S6 Decision Audit Trail]
          │   │   └─────────────────► [S5 Action Cost Panel]
          │   └─────────────────────► [S4 Source Dependency Map]
          └─────────────────────────► [S3 Evidence Timeline]

   From S2: (Request ESCALATE/ALERT) ──► [S7 Authorization Queue] ──► back to S2
```

---

## 2. Screen map

| ID | Screen | Who uses it | Opens from |
|----|--------|-------------|------------|
| S0 | Login | everyone | app start |
| S1 | Episode Picker | everyone | after login |
| S2 | Operations Dashboard | duty officer (main) | S1 |
| S3 | Evidence Timeline | duty officer | drawer in S2 |
| S4 | Source Dependency Map | duty officer, analyst | drawer in S2, evidence-health chips |
| S5 | Action Cost Panel | duty officer, supervisor | drawer in S2, action badge |
| S6 | Decision Audit Trail | everyone | drawer in S2 |
| S7 | Authorization Queue | supervisor | S2 request button, nav |
| S8 | Simulation Lab | analyst | S1, S2 nav |
| S9 | Metrics and Calibration | analyst | S8 |
| S10 | Config | admin | nav |

---

## 3. S2 Operations Dashboard — what the user sees and does

```
┌────────────────────────────────────────────────────────────────────────┐
│ SIMULATED DATA │ Episode ep_017 │ Minute 06/30 │ ▶ ⏸ ⏭ │ speed │ v3   │  TOP BAR
├──────────────────────────┬─────────────────────────────────────────────┤
│ CURRENT ACTION           │ BELIEF CARDS (sum = 100%)                   │
│  PREPARE                 │ Noise │ Sensor fail │ Isolated │ Cascade    │
│  since min 05            │ each with delta + sparkline                 │
│  next review: min 07     │ uncertainty meter                           │
├──────────────────────────┼─────────────────────────────────────────────┤
│ NEXT THREE EVENTS        │ BELIEF TIMELINE + ACTION RIBBON             │
│  1. event·window·prob    │ markers: faults · revisions · twin split    │
│  2. event·window·prob    │                                             │
│  3. event or UNAVAILABLE │                                             │
├──────────────────────────┼─────────────────────────────────────────────┤
│ EVIDENCE HEALTH          │ WHY THIS DECISION                           │
│  independent sources     │  New evidence                               │
│  shared failures         │  How beliefs changed                        │
│  stale / missing feeds   │  Why this action                            │
│                          │  What would change it   [Request ESCALATE]  │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### Click targets
```
Belief card ───────────► popover: top supporting / contradicting evidence
Action badge ──────────► [S5 Action Cost Panel]
Forecast card ─────────► expands: causal path, evidence IDs, invalidators
Evidence-health chip ──► [S4 Source Dependency Map] filtered to that group
Revision badge ────────► version compare (old vs new assessment)
Timeline marker ───────► jumps playback to that minute
Request button ────────► authorization modal
```

---

## 4. User journey flows

### 4.1 Duty officer: watch an episode
```
[S1] pick episode
   │
   ▼
(Press Play)
   │
   ▼
Tick arrives ──► cards, charts, forecast update
   │
   ▼
{Late event rewrote a past minute?}
   ├─ yes ──► revision badge shows ──► click to compare versions ──► back to watching
   └─ no  ──► keep watching
   │
   ▼
{Action changed?}
   ├─ yes ──► badge changes + screen-reader announcement + reason shown in Why panel
   └─ no  ──► keep watching
```

### 4.2 Duty officer + supervisor: authorize ESCALATE
```
Engine recommends ESCALATE
   │
   ▼
Duty officer reviews [Why panel] and [S5 Cost Panel]
   │
   ▼
{Request authorization?}
   ├─ no  ──► logged as reviewed
   └─ yes ──► modal: costs + invalidators + justification field
                 │
                 ▼
          (Submit) ──► request = PENDING ──► [S7 Authorization Queue] for supervisor
                                              │
                                              ▼
                          {Supervisor is a different person than requester?}
                              ├─ no  ──► blocked (two-person rule)
                              └─ yes ──► {Approve or reject?}
                                            ├─ approve ──► record saved + banner:
                                            │              "Proceed via official procedure.
                                            │               App does not broadcast."
                                            └─ reject  ──► reason saved, engine continues
```

### 4.3 Analyst: twin test
```
[S8 Lab] ──► choose prefix scenario + split minute
   │
   ▼
Generate Twin A (false alarm future) and Twin B (real cascade future)
   │
   ▼
(Run both through the same engine)
   │
   ▼
Overlay charts: belief + action for A and B
   │
   ▼
{Identical before split?}
   ├─ yes ──► green check "No guessing before split"
   └─ no  ──► red flag "Prefix divergence bug"
   │
   ▼
Show: time from first discriminative evidence to action
Show: cost of delay vs cost of false alarm
   │
   ▼
[S9 Metrics and Calibration]
```

### 4.4 Analyst: inject a fault
```
[S8 Lab] ► Fault panel
   │
   ▼
Choose type:  gateway down · cameras lost · duplicates · out-of-order
              late dispatch · retraction · rumor burst · source changes story
   │
   ▼
Choose target + start minute ──► (Inject)
   │
   ▼
[S2 Dashboard] shows:
   • what degraded            • which sources remain
   • uncertainty change       • is the action still justified?
```

### 4.5 Admin: change config
```
[S10 Config] ► choose cost matrix / causal graph / dependencies / users
   │
   ▼
Edit ──► preview effect on a stored episode ──► (Save as new version)
   │
   ▼
New config_hash created; old versions kept; change written to audit log
```

---

## 5. Screen states

| Screen | Empty | Loading | Error | Degraded |
|--------|-------|---------|-------|----------|
| S2 | "No episode loaded" + picker | skeleton cards | banner + retry; last good tick marked stale | source-loss chips; forecast slots may say "unavailable" |
| S4 | "No dependency config" | graph skeleton | retry | failed groups outlined red |
| S8 | "Create your first twin test" | progress bar | error with seed to reproduce | — |
| S9 | "Run an evaluation" | progress | retry | partial results labeled |
| Live connection | — | "Connecting…" | "Reconnecting… showing minute N" | missed ticks fetched by REST on reconnect |

---

## 6. Role-based visibility

```
                         viewer  officer  supervisor  analyst  admin
Dashboard (S2)             ✔       ✔         ✔          ✔       ✔
Playback controls                  ✔         ✔          ✔       ✔
Request authorization              ✔         ✔
Approve / reject                             ✔
Simulation Lab / Metrics                                ✔       ✔
Config / Users                                                  ✔
Audit trail                                  ✔          ✔       ✔
```

---

## 7. Keyboard flow

| Key | Action |
|-----|--------|
| Space | Play / pause |
| J / K | Previous / next minute |
| 1 – 4 | Focus belief card 1–4 |
| F | Focus forecast list |
| E | Open Evidence Timeline |
| S | Open Source Map |
| C | Open Cost Panel |
| A | Open Audit Trail |
| Esc | Close drawer or modal |

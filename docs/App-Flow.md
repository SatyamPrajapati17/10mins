# FIRST 10 — App Flow

How data and decisions move through the system, in plain-text diagrams that render anywhere. (Mermaid versions are in `04-App-Flowchart.md`.)

Legend: `[Component]` · `{Decision}` · `(Store)` · `──►` data flows to

---

## 1. Big picture

```
 [Simulator / Stream Source]
            │  events (some late, duplicate, corrected)
            ▼
 [Ingestion API] ──► [Normalizer: validate · dedupe · revisions · quality flags]
                                   │
                                   ▼
                        (PostgreSQL event store, append-only)
                                   │
                                   ▼
                 [Event-time windows + watermark + replay]
                       │                         │
                       ▼                         ▼
        [Reliability + common-cause]      [Change detector]
                       │                         │
                       └────────────┬────────────┘
                                    ▼
                      [Bayesian inference engine]
                      P(noise, sensor fail, isolated, cascade)
                         │                    │
                         ▼                    ▼
            [Decision engine]        [Causal forecaster]
            expected loss +          three events or abstain
            value of waiting                  │
                         │                    │
                         ▼                    │
            [Action controller]               │
            hysteresis + override             │
                         │                    │
                         └─────────┬──────────┘
                                   ▼
                    [Explanation builder (templates)]
                                   │
                                   ▼
                 (Assessment version + audit record stored)
                                   │
                                   ▼
                     [WebSocket push] ──► [Dashboard]
```

---

## 2. Event handling flow

```
Event arrives
   │
   ▼
{Schema valid?}
   ├─ no  ──► dead-letter queue + log
   └─ yes
        │
        ▼
   {event_id already stored?}
        ├─ yes ──► drop duplicate, count it in metrics
        └─ no
             │
             ▼
        {Has revision_of?}
             ├─ yes ──► link lineage; mark earlier version superseded or retracted
             └─ no
             │
             ▼
        Append to event store
             │
             ▼
        {event_time older than the current minute?}
             ├─ no ──► add to current minute window
             ├─ yes, within allowed lateness ──► mark minutes m..t dirty ──► replay (section 3)
             └─ yes, beyond lateness ──► archive + flag, no replay
```

---

## 3. Per-minute processing (and replay)

```
Close minute t  (or replay from minute m)
   │
   ▼
1. Load effective evidence (latest non-retracted revision per lineage)
   │
   ▼
2. Source health: stale? missing? heartbeat lost?
   │      missing data = a health observation, NEVER "all clear"
   ▼
3. Group by dependency (shared gateway / network / reporter)
   │      n_eff = n / (1 + (n-1)·ρ)  → one group counts as ~n_eff witnesses
   ▼
4. Bayes update: predict with transition matrix, multiply by grouped likelihoods
   │
   ▼
5. Change detector: drift flag? classify prior / source / relationship shift
   │
   ▼
6. Expected loss for WATCH · PREPARE · ALERT · ESCALATE
   │
   ▼
7. Value of waiting one more minute
   │
   ▼
8. Controller: apply hysteresis, check override
   │
   ▼
9. Forecast: propagate causal graph → top 3 or "unavailable"
   │
   ▼
10. Build explanation from stored numbers
   │
   ▼
11. Save new assessment_version (old versions kept) + push to dashboard
```

---

## 4. Shared-failure (common-cause) flow

```
Many sensors report anomalies
   │
   ▼
Look up dependency graph
   │
   ▼
{Do they share a gateway or network?}
   ├─ no  ──► treat as independent witnesses (weight × reliability)
   └─ yes ──► treat as ONE dependency group, compute n_eff
                   │
                   ▼
            {Heartbeats lost or values implausible?}
                ├─ yes ──► raise sensor-failure likelihood, flag the gateway
                └─ no  ──► keep as discounted physical evidence
                   │
                   ▼
            Look for independent confirmation: traffic · dispatch · rainfall · hospitals
                   │
                   ▼
            Feed grouped result into Bayes update
```

---

## 5. Missing-data flow

```
Feed stops reporting
   │
   ▼
Mark stale after expected interval
   │
   ▼
{Shared dependency affected?}
   ├─ yes ──► log group outage as health observation
   └─ no  ──► log single-source outage
   │
   ▼
Recompute available evidence per hypothesis
   │
   ▼
Widen uncertainty where information is genuinely lost
   │
   ▼
{Enough independent support for each forecast slot?}
   ├─ yes ──► keep forecast
   └─ no  ──► show "Forecast unavailable" + reason
```

---

## 6. Action controller flow

```
Inputs: expected loss per action, previous action, minutes in state

{Override? P(cascade) ≥ threshold AND ≥ N independent groups}
   ├─ yes ──► ESCALATE now (no timers)
   └─ no
        │
        ▼
   {A higher action beats current by the enter margin?}
        ├─ yes ──► move up one level, log reason + evidence IDs
        └─ no
             │
             ▼
        {A lower action has beaten current by the exit margin for k minutes in a row?}
             ├─ yes ──► move down one level, log reason
             └─ no  ──► stay (mark "held by hysteresis")

Levels:  WATCH ◄──► PREPARE ◄──► ALERT ◄──► ESCALATE
                                              │
                          recommendation only; needs human authorization
```

---

## 7. Forecast flow

```
Current belief + evidence
   │
   ▼
Seed upstream nodes (rain, drainage, traffic, dispatch…) from evidence
   │
   ▼
Propagate through causal graph
   P(child in window) = noisy-OR over parents of  P(parent) · p_edge · P(delay in window)
   │
   ▼
Do it per hypothesis, then average using current belief
   │
   ▼
Rank by probability × impact, force distinct subsystems
   │
   ▼
{Slot has ≥ N independent supporting groups and P above floor?}
   ├─ yes ──► return event, area, window, probability, causal path, invalidators
   └─ no  ──► return "unavailable" + reason
```

---

## 8. Twin test flow

```
Seed + shared prefix generator
   │
   ├─► minutes 0..s : IDENTICAL events (hash-checked)
   │
   ├─► Branch A after s: gateway outage + storm traffic + unrelated hospital arrivals
   └─► Branch B after s: independent flood reports + road disruption + rescues
   │
   ▼
Run same engine, same config on both
   │
   ▼
Checks
   1. event hash equal for minutes ≤ s
   2. beliefs + actions equal for minutes ≤ s
   3. across many episodes sharing the prefix: mean predicted P(cascade) ≈ fraction that became cascades
   4. time from first discriminative evidence to justified action
   5. cost of late action vs cost of unnecessary escalation
```

---

## 9. Adaptation flow

```
Observation statistics ──► Change detector (ADWIN / BOCPD)
   │
   ▼
{Drift flagged?}
   ├─ no  ──► continue
   └─ yes
        │
        ▼
   {Season / regime flag active?}
        ├─ yes ──► PRIOR shift: update regime priors, verified outcomes only
        └─ no
             │
             ▼
        {Concentrated in one gateway or source?}
             ├─ yes ──► SOURCE shift: update that group's reliability
             └─ no  ──► possible RELATIONSHIP shift: hold, flag for review, no auto-retrain

Rule: unverified rumor bursts never change the model.
```

---

## 10. Authorization flow (application level)

```
Recommendation = ESCALATE (or ALERT)
   │
   ▼
Duty officer submits request  ──► frozen snapshot: assessment version + config hash + costs
   │
   ▼
{Approver ≠ requester?}
   ├─ no  ──► 403 two_person_rule
   └─ yes ──► {Approve?}
                 ├─ approve ──► store authorization; UI banner; no broadcast sent
                 ├─ reject  ──► store reason; engine continues
                 └─ timeout ──► status expired; engine continues
   │
   ▼
Every step written to the hash-chained audit log
```

---

## 11. Front-end ↔ back-end message flow

```
Browser                                        Server
   │  POST /auth/login ───────────────────────► verify, issue tokens
   │  POST /auth/ws-ticket ───────────────────► one-time 30 s ticket
   │  WS connect with ticket ─────────────────► bind to user + episode
   │  POST /episodes/{id}/start ──────────────► worker begins ticks
   │◄──────────────────────── tick (assessment) every simulated minute
   │◄──────────────────────── revision (replayed minute, new version)
   │◄──────────────────────── source_health / fault_injected
   │  POST /authorizations ───────────────────► pending request
   │◄──────────────────────── authorization_update
   │  GET /episodes/{id}/assessments?from=&to= ► history (also used after reconnect)
```

---

## 12. Flow-to-requirement check

| Flow | Challenge requirement it satisfies |
|------|------------------------------------|
| §2, §3 | Late, duplicate, corrected and retracted evidence |
| §4 | Many sensors that are not independent witnesses |
| §5 | Missing feeds are not negative evidence |
| §6 | Stable actions without delaying urgent escalation |
| §7 | Three forecast events with windows, or honest abstention |
| §8 | Twin test: uncertain before the split, decisive after |
| §9 | Base-rate shifts without losing sensitivity |
| §10 | Human authorization of consequential actions |

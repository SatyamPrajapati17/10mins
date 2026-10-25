# FIRST 10 — Implementation Plan (FAST TRACK)

**Goal:** a demoable, judge-ready build in **~14–18 focused hours solo** (or one weekend with Antigravity agents), instead of 70+ hours.
**Rule:** keep every requirement that the demo *shows*. Cut everything the demo doesn't show. Same product, thinner plumbing.

---

## 1. What changed vs. the old plan

| Old plan | Fast plan | Time saved |
|---|---|---|
| Postgres + Alembic + Docker Compose | **SQLite (or pure in-memory) + one `uvicorn` process**. No Docker. | ~4 h |
| Incremental replay with snapshots and dirty minutes | **Recompute the whole episode from minute 0 every time the event set changes.** 60 minutes of data = milliseconds. Same determinism, same "revision" feature, 1/10th the code | ~6 h |
| Live WebSocket ticks, WS tickets, worker | **Server computes all assessments on episode create. Frontend "plays" them with a timer** (play/pause/step/J/K). Revisions = re-fetch after a fault is injected | ~5 h |
| JWT + refresh rotation + MFA + lockout + hash-chain audit | **One JWT, 4 hardcoded demo users, role checks via a decorator, two-person rule kept, audit = simple append-only table** | ~5 h |
| Hierarchical Beta reliability, ADWIN/BOCPD, Dirichlet adaptation | **Cut to P2.** Static reliability per source type + group discount (`n_eff`). Monsoon = one config flag that shifts the transition prior | ~8 h |
| Rumor clustering with TF-IDF | **Simulator tags reports with `origin_id`; same origin = 1 provenance unit.** No NLP | ~3 h |
| 11 screens | **4 screens:** Login, Dashboard (with drawers), Twin Lab, Metrics. Config/Audit/Auth queue become drawers/tabs | ~8 h |
| Hand-written everything | **Antigravity agents write boilerplate from your docs; you only review the engine math** | huge |

**Kept (non-negotiable for the demo):** 4-hypothesis belief, cost-matrix action + hysteresis + override, value-of-waiting, 3-event forecast or abstain, gateway common-cause discount, Twin Test with prefix equality, fault injection, explanations from templates, ESCALATE two-person authorization, "SIMULATED DATA" banner, metrics vs baseline.

---

## 2. Lean stack

```
backend/   Python 3.12 · FastAPI · Pydantic v2 · NumPy · SQLite (sqlite3 / SQLModel)
frontend/  React 18 · TypeScript · Vite · Tailwind · Recharts · (React Flow only if time remains)
run:       two terminals — `uvicorn app.main:app --reload` and `npm run dev`
```

Repo layout (flat on purpose):

```
first10/
  backend/app/
    main.py          # FastAPI app, routes, auth decorator
    models.py        # Pydantic: Event, Assessment, Authorization
    sim.py           # seeded generator, scenarios, faults, twin
    engine.py        # normalize + inference + reliability + decision + controller + forecast + explain
    metrics.py       # brier, logloss, ece, cost, reversals, baselines
    db.py            # sqlite: episodes, events, authorizations, audit
  backend/tests/     # 8–10 tests only (see §6)
  frontend/src/
    pages/ Login.tsx Dashboard.tsx Lab.tsx Metrics.tsx
    components/ BeliefCard ActionBadge ForecastCard EvidenceHealth Timeline WhyPanel Drawer AuthModal
    lib/ api.ts types.ts tokens.css
  docs/              # your existing md files (the agents read these)
```

One `engine.py` (~400 lines) beats seven files for speed. Split later if you care.

---

## 3. Engine spec (lean but correct) — the part you review by hand

**State:** H ∈ {noise, sensor_failure, isolated, cascade}.

**Per-minute features** (computed from effective events of that minute — latest non-retracted revision per `event_id` lineage, dedupe by `event_id`):

| Feature | Meaning |
|---|---|
| `anom_by_group[g]` | fraction of sensors in gateway group *g* with anomalous reading |
| `hb_loss_by_group[g]` | fraction of heartbeats lost in group *g* |
| `rain_z`, `traffic_drop`, `closures`, `dispatch_rate`, `hospital_z` | independent-system signals |
| `reports_indep` | citizen reports counted by distinct `origin_id` |
| `missing_types` | feed types with no data (health observation only) |

**Likelihood table** — a small dict `L[h][feature] -> log-likelihood function` (Gaussian or logistic on the feature). Hand-write it; it's ~4×7 entries. Rules that must hold:
- Many anomalies in **one group** + heartbeat loss + no independent confirmation → favors `sensor_failure`.
- Anomalies in **several groups** + rain/traffic/dispatch/hospital agree → favors `cascade`.
- Anomalies in **one area** with only local confirmation → `isolated`.
- Missing feed → raises uncertainty / sensor_failure only if concentrated in a group; **never** evidence of "clear".

**Filter:**
```
pred   = T^T · b_prev                      # T: 4×4 sticky transition matrix (monsoon flag bumps noise-with-anomaly)
logpost = log(pred) + Σ_g  w_g · mean_LLR_g + Σ_independent_signals LLR
b      = softmax(logpost)                  # sums to 1 by construction
```
`n_eff = n / (1 + (n−1)·ρ)` with ρ = 0.8 for same gateway (config), `w_g = n_eff · r̄_g`; `r̄_g` = static reliability by sensor type (e.g. rain 0.9, drain 0.8, camera 0.7, citizen 0.4).

**Decision:** `EL(a) = Σ_h b(h)·C[a,h]` using the TRD cost matrix. Value of waiting = simplified: compare EL(a*) against `0.5·EL(a*) + delay_cost` where `delay_cost = Σ b(h)·d(h)`, `d = [0,0.5,2,10]`; if waiting is cheaper and a* is not terminal → hold PREPARE/WATCH.

**Controller:** enter higher state if EL gain ≥ `m_up` (default 2); drop only after `k=2` consecutive minutes with gain ≥ `m_down` (default 3); **override** to ESCALATE if `P(cascade) ≥ 0.75` and ≥ 2 independent groups. Log `transition_reason` every change.

**Forecast:** fixed causal chain (rain → drainage overflow → road closure → access worsens → rescue demand → hospital load), each edge `{p_edge, delay (min,max)}` in a JSON config. Seed each node from current evidence, multiply by `P(cascade)` for downstream nodes, return top 3 by `P·impact` with distinct subsystems. If independent supporting groups < 2 or P < 0.15 → `{"unavailable": true, "reason": "..."}`.

**Explain:** four f-string templates from the stored numbers: New evidence / How beliefs changed / Why this action / What would change it.

**Determinism:** all randomness from `np.random.default_rng(seed)`; process events sorted by `(event_time, source_id, event_id)`; no wall-clock in the engine.

---

## 4. Sprints (each ends with something you can click)

Time assumes solo + Antigravity doing the boilerplate. Run sprints in order. Don't polish early.

### Sprint 0 — Scaffold (≈ 1 h)
- Create repo, `backend/` venv, `frontend/` Vite+Tailwind, copy your docs into `docs/`.
- Paste design tokens from `design.md §2` into `tokens.css` and the Tailwind theme.
- `/health` endpoint, CORS for `localhost:5173`.
- **Exit:** both servers run, frontend calls `/health`.

### Sprint 1 — Simulator + event pipeline (≈ 2–3 h)
- `sim.py`: `generate(scenario, seed, minutes=30)` → list of events (TRD §3.1 envelope) + ground truth. Scenarios: `noise`, `gateway_failure`, `isolated_flood`, `cascade`. Add an `ambiguous_prefix` option so early minutes look identical.
- ~40 sensors total across 4 gateways is enough (not 500).
- `engine.normalize(events)`: dedupe by `event_id`, apply `revision_of`, drop retracted, flag late.
- `faults`: functions that **transform the event list** — `kill_gateway(g, from_min)`, `drop_cameras(from_min)`, `duplicate(frac)`, `shuffle_arrival()`, `late_dispatch(delay)`, `retract(ids)`, `rumor_burst(origin_id, n)`, `flip_story(source)`.
- `twin(prefix_scenario, split_min, seed)` → two event lists sharing events ≤ split (hash them).
- **Exit:** same seed twice = identical events; duplicates don't change counts; twin prefix hashes match.

### Sprint 2 — Inference core (≈ 3–4 h) ← critical path
- Implement §3 in `engine.py`: features → grouped likelihood → filter → entropy → `effective_independent_sources`.
- `run_episode(events, config) -> list[Assessment]` — recompute from minute 0, pure function.
- **Exit (tests):** gateway_failure → sensor_failure dominant, cascade < 0.3; cascade → P(cascade) rising and > 0.7 by the end; noise → cascade < 0.15 average; belief sums to 1; shuffled arrival gives identical output.

### Sprint 3 — Decision + controller + forecast (≈ 2–3 h)
- Cost matrix as JSON config; EL, VoW, hysteresis, override, `transition_reason`.
- Forecast with abstention; explanation templates.
- Attach all of it to each `Assessment` (TRD §3.2 shape).
- **Exit:** cascade scenario reaches ALERT/ESCALATE within ~2 minutes of first discriminative evidence; gateway_failure never ESCALATEs; reversals low.

### Sprint 4 — API + auth (≈ 2 h)
Endpoints (only these):
```
POST /auth/login                      -> JWT (4 hardcoded demo users)
POST /episodes {scenario, seed}       -> creates, runs engine, stores assessments
GET  /episodes/{id}/assessments       -> full list (frontend plays it back)
POST /episodes/{id}/faults {type,...} -> applies fault, recomputes, bumps assessment_version, returns diff of changed minutes
POST /twin-tests {prefix, split, seed}-> both episodes + prefix_equal flag
POST /eval-runs {n}                   -> runs N seeded episodes + baselines, returns metrics
POST /authorizations                  -> duty_officer, frozen snapshot
POST /authorizations/{id}/decision    -> supervisor only, requester != approver else 403 two_person_rule
GET  /audit                           -> supervisor+
```
- `@require(role)` decorator; audit row on every mutation. Skip refresh tokens, MFA, WS tickets, rate limits (list as "future work").
- **Exit:** curl/Swagger flow works end to end including the two-person 403.

### Sprint 5 — Dashboard (≈ 4–5 h)
Build `Dashboard.tsx` per `UI-Flow §3` using **only API data**:
- Top bar (episode, minute, ▶ ⏸ ⏭, speed, version, **SIMULATED DATA** banner).
- 4 BeliefCards (largest-remainder rounding, delta, sparkline), ActionBadge with 4-bar expected-cost chart, 3 ForecastCards (+ unavailable state), EvidenceHealth chips, stacked-area Timeline with action ribbon and fault/split markers, WhyPanel (4 headings).
- Playback = `setInterval` over the assessments array; keyboard Space / J / K.
- Drawers (one generic `<Drawer>` component): Evidence list, Source health (plain table of groups first — React Flow map only if time), Audit trail, Authorization (modal + supervisor queue tab).
- Login page + role-based hiding.
- **Exit:** pick a scenario, press play, watch beliefs/action/forecast move; inject gateway failure and see revision badge + discounted evidence.

### Sprint 6 — Twin Lab + Metrics (≈ 2–3 h)
- `Lab.tsx`: choose scenario/split/seed → two stacked synchronized charts, shaded identical prefix, ✔ "No guessing before split" check, time-to-action and cost-of-delay vs cost-of-false-alarm. Fault panel (dropdown + minute + inject).
- `metrics.py`: Brier, log loss, ECE (10 bins), total cost, false escalations, reversals; **two baselines** (anomaly-count threshold, fixed-threshold action). `Metrics.tsx`: KPI tiles, reliability diagram, cost bar chart.
- **Exit:** one click runs ~100 seeded episodes and shows engine vs baseline table.

### Sprint 7 — Demo hardening (≈ 1–2 h)
- Seed demo accounts and a "Demo" button that creates the 5 demo episodes in order.
- README with architecture diagram (reuse TRD mermaid) + limitations section (copy from old plan §9).
- Record a backup screen capture. Do two timed run-throughs of the demo script.

**Total ≈ 17–22 h raw; with Antigravity doing scaffolding/UI in parallel ≈ 12–16 h wall-clock.**

---

## 5. Cut list (do not build unless everything above is done)

ADWIN/BOCPD · Beta/hierarchical reliability learning · Dirichlet prior updates · TF-IDF rumor clustering · refresh-token rotation · MFA · lockout · WS tickets · judge JWT links · hash-chained audit · Docker · TimescaleDB · pgmpy · survival models · CAP export · Config editor screen · React Flow source map · LLM prose explanations.

If a judge asks: answer "designed in the TRD, scoped out of the prototype" — the docs already prove you thought it through.

---

## 6. Minimum test set (10 tests, ≈ 45 min total)

1. Belief sums to 1 every minute
2. Duplicate events don't change output
3. Shuffled arrival order, same event times → identical output
4. Same seed → byte-identical assessments
5. Twin prefix: events and beliefs/actions equal through split
6. Gateway failure → no ESCALATE, sensor_failure dominant
7. Cascade → reaches ALERT/ESCALATE within target lag
8. Cameras dropped → no "roads clear" inference, forecast slot abstains
9. Retracted event stops influencing belief; version increments
10. Supervisor == requester → 403 `two_person_rule`

---

## 7. Antigravity workflow (how to actually go fast)

1. Put all docs in `docs/` and tell the agent: *"Read everything in /docs. Where this FAST plan conflicts with the PRD/TRD, FAST plan wins."* Keep this file as `docs/07-Implementation-Plan-FAST.md`.
2. **One sprint = one agent task.** Paste the sprint block as the prompt and add: *"Make it run. Don't ask questions. State any assumption in a comment. Stop at the Exit criteria."*
3. Run Sprints 4's backend and Sprint 5's frontend shell **in parallel agents** once the `Assessment` JSON shape (TRD §3.2) is frozen — frontend can start from a fixture JSON file.
4. **Never delegate Sprint 2 blind.** Let the agent write it, then you read `engine.py` and the likelihood table yourself; this is the part judges will question.
5. After each sprint: run tests, commit, move on. No refactors until Sprint 7.
6. If a sprint overruns by 50%, cut scope from its bullets rather than extending the schedule.

---

## 8. Demo script (5 min, unchanged beats)

1. Frame it (30 s) — decision engine, simulated data banner
2. Ordinary noise (30 s) — WATCH holds
3. Gateway failure (60 s) — anomalies from one gateway, n_eff discount, sensor-failure belief, no escalation
4. **Twin test (100 s)** — identical to the split, then A = false alarm, B = cascade; show lag and cost
5. Faults (45 s) — cameras vanish: "roads not assumed clear", forecast abstains
6. Authorization (40 s) — ESCALATE → supervisor approves, "no broadcast"
7. Metrics (35 s) — calibration curve + cost vs baseline

## 9. Honest limitations (put in README)
Simulated data only · cost matrix is an explicit assumption · probabilities calibrated to the simulator, not real incidents · app recommends and records, never broadcasts.

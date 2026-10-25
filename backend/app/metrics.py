# backend/app/metrics.py
"""
Metrics and evaluation module for FIRST 10.
Computes:
- Multiclass Brier score
- Log Loss
- Expected Calibration Error (ECE) over 10 bins
- Total Decision Cost vs Baselines
- Unnecessary Action Reversals
- False Escalations
- Comparison against two baselines (Anomaly Count Threshold & Fixed Threshold)
"""

import math
import numpy as np
from typing import List, Dict, Any, Tuple
from app.engine import COST_MATRIX, ACTIONS, HYPOTHESES, run_episode
from app.sim import generate


def compute_brier_score(probabilities: List[List[float]], one_hot_truths: List[List[int]]) -> float:
    """Multiclass Brier score = 1/N * sum_i sum_k (p_ik - y_ik)^2."""
    if not probabilities:
        return 0.0
    p = np.array(probabilities)
    y = np.array(one_hot_truths)
    return float(np.mean(np.sum((p - y) ** 2, axis=1)))


def compute_log_loss(probabilities: List[List[float]], one_hot_truths: List[List[int]]) -> float:
    """Multiclass Log loss."""
    if not probabilities:
        return 0.0
    p = np.clip(np.array(probabilities), 1e-12, 1.0)
    y = np.array(one_hot_truths)
    return float(-np.mean(np.sum(y * np.log(p), axis=1)))


def compute_ece(confidences: List[float], correct_flags: List[int], n_bins: int = 10) -> Dict[str, Any]:
    """
    Expected Calibration Error (ECE) with 10 bins.
    Returns ece score and per-bin diagram data.
    """
    if not confidences:
        return {"ece": 0.0, "bins": []}

    bins = np.linspace(0.0, 1.0, n_bins + 1)
    bin_data = []
    total_samples = len(confidences)
    ece = 0.0

    for i in range(n_bins):
        b_low, b_high = bins[i], bins[i + 1]
        indices = [idx for idx, c in enumerate(confidences) if (b_low <= c < b_high or (i == n_bins - 1 and b_low <= c <= b_high))]
        count = len(indices)

        if count > 0:
            avg_conf = float(np.mean([confidences[j] for j in indices]))
            avg_acc = float(np.mean([correct_flags[j] for j in indices]))
            gap = abs(avg_acc - avg_conf)
            ece += (count / total_samples) * gap
        else:
            avg_conf = (b_low + b_high) / 2.0
            avg_acc = 0.0
            gap = 0.0

        bin_data.append({
            "bin": f"{int(b_low*100)}-{int(b_high*100)}%",
            "confidence": round(avg_conf, 3),
            "accuracy": round(avg_acc, 3),
            "count": count,
            "gap": round(gap, 3)
        })

    return {"ece": round(float(ece), 4), "bins": bin_data}


def run_anomaly_count_baseline(events: List[Dict[str, Any]], truth: str) -> Dict[str, Any]:
    """Baseline 1: Anomaly-count threshold without Bayesian grouping or hysteresis."""
    actions = []
    total_cost = 0.0
    max_min = max(e["sim_minute"] for e in events) if events else 0

    for m in range(max_min + 1):
        m_evts = [e for e in events if e["sim_minute"] == m]
        anom_count = sum(1 for e in m_evts if e.get("value", {}).get("anom", 0) == 1)

        # Naive rule
        if anom_count >= 10:
            act = "ESCALATE"
        elif anom_count >= 5:
            act = "ALERT"
        elif anom_count >= 2:
            act = "PREPARE"
        else:
            act = "WATCH"

        actions.append(act)
        total_cost += COST_MATRIX[act][truth]

    # Reversals
    reversals = 0
    for i in range(1, len(actions) - 1):
        if actions[i] != actions[i - 1] and actions[i] != actions[i + 1]:
            reversals += 1

    return {"actions": actions, "cost": total_cost, "reversals": reversals}


def run_fixed_threshold_baseline(events: List[Dict[str, Any]], truth: str) -> Dict[str, Any]:
    """Baseline 2: Fixed threshold on unweighted sensor counts."""
    actions = []
    total_cost = 0.0
    max_min = max(e["sim_minute"] for e in events) if events else 0

    for m in range(max_min + 1):
        m_evts = [e for e in events if e["sim_minute"] == m]
        anom_frac = sum(1 for e in m_evts if e.get("value", {}).get("anom", 0) == 1) / max(1, len(m_evts))

        if anom_frac > 0.40:
            act = "ESCALATE"
        elif anom_frac > 0.25:
            act = "ALERT"
        elif anom_frac > 0.10:
            act = "PREPARE"
        else:
            act = "WATCH"

        actions.append(act)
        total_cost += COST_MATRIX[act][truth]

    reversals = 0
    for i in range(1, len(actions) - 1):
        if actions[i] != actions[i - 1] and actions[i] != actions[i + 1]:
            reversals += 1

    return {"actions": actions, "cost": total_cost, "reversals": reversals}


def evaluate_suite(n_episodes: int = 20) -> Dict[str, Any]:
    """
    Run evaluation suite across seeded episodes and compare FIRST 10 engine vs Baselines.
    """
    scenarios = ["noise", "gateway_failure", "isolated_flood", "cascade"]

    engine_probs = []
    one_hot_truths = []
    confidences = []
    correct_flags = []

    engine_total_cost = 0.0
    engine_reversals = 0
    engine_false_escalations = 0

    baseline_anom_cost = 0.0
    baseline_anom_reversals = 0
    baseline_fixed_cost = 0.0
    baseline_fixed_reversals = 0

    for i in range(n_episodes):
        scen = scenarios[i % len(scenarios)]
        seed = 1000 + i
        events, truth = generate(scenario=scen, seed=seed, minutes=20)

        # 1. Run FIRST 10 Engine
        assessments = run_episode(events)

        truth_idx = HYPOTHESES.index(truth)
        truth_oh = [1 if k == truth_idx else 0 for k in range(4)]

        acts = []
        for a in assessments:
            b_vec = [a.belief.noise, a.belief.sensor_failure, a.belief.isolated, a.belief.cascade]
            engine_probs.append(b_vec)
            one_hot_truths.append(truth_oh)

            max_idx = int(np.argmax(b_vec))
            conf = b_vec[max_idx]
            confidences.append(conf)
            correct_flags.append(1 if max_idx == truth_idx else 0)

            act = a.action.controller_state
            acts.append(act)
            engine_total_cost += COST_MATRIX[act][truth]

            if act == "ESCALATE" and truth != "cascade":
                engine_false_escalations += 1

        for j in range(1, len(acts) - 1):
            if acts[j] != acts[j - 1] and acts[j] != acts[j + 1]:
                engine_reversals += 1

        # 2. Run Baselines
        b1 = run_anomaly_count_baseline(events, truth)
        baseline_anom_cost += b1["cost"]
        baseline_anom_reversals += b1["reversals"]

        b2 = run_fixed_threshold_baseline(events, truth)
        baseline_fixed_cost += b2["cost"]
        baseline_fixed_reversals += b2["reversals"]

    brier = compute_brier_score(engine_probs, one_hot_truths)
    log_loss = compute_log_loss(engine_probs, one_hot_truths)
    ece_result = compute_ece(confidences, correct_flags, n_bins=10)

    # Average metrics
    total_mins = len(engine_probs)
    return {
        "n_episodes": n_episodes,
        "total_minutes": total_mins,
        "brier_score": round(brier, 4),
        "log_loss": round(log_loss, 4),
        "ece": ece_result["ece"],
        "calibration_bins": ece_result["bins"],
        "comparison": {
            "first10_engine": {
                "name": "FIRST 10 (Bayesian + Hysteresis)",
                "total_cost": round(engine_total_cost, 1),
                "avg_cost_per_episode": round(engine_total_cost / n_episodes, 1),
                "reversals": engine_reversals,
                "false_escalations": engine_false_escalations
            },
            "anomaly_threshold_baseline": {
                "name": "Naive Anomaly-Count Threshold",
                "total_cost": round(baseline_anom_cost, 1),
                "avg_cost_per_episode": round(baseline_anom_cost / n_episodes, 1),
                "reversals": baseline_anom_reversals,
                "false_escalations": "N/A"
            },
            "fixed_threshold_baseline": {
                "name": "Fixed Unweighted Threshold",
                "total_cost": round(baseline_fixed_cost, 1),
                "avg_cost_per_episode": round(baseline_fixed_cost / n_episodes, 1),
                "reversals": baseline_fixed_reversals,
                "false_escalations": "N/A"
            }
        }
    }

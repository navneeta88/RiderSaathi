"""
train_trust_engine.py
Trains the unified Trust Score Engine for RiderSaathi claim decisions.

The Trust Score (0–1) is a calibrated meta-model that synthesises ALL
three upstream models into a single, explainable claim verdict.

Input dimensions:
  FROM RISK MODEL     — income_loss_pct, risk_probability, triggers_fired_count,
                        city_risk_index, curfew_active
  FROM BTS ENGINE     — bts_score, consistency_pts, clean_claim_pts,
                        gps_compliance_pts, doc_pts, flags_count
  FROM FRAUD DETECTOR — if_norm_score, clf_fraud_proba, fraud_flags_count,
                        location_risk, temporal_risk, activity_risk, behavioral_risk

Target:
  trust_score (0–1)   continuous
  decision            approve / review / reject   (derived, not learned)

Architecture:
  GradientBoosting regressor trained on synthetic ground-truth,
  then isotonic calibration to ensure output is a well-calibrated probability.

Thresholds:
  > 0.75  → APPROVE  (instant payout)
  0.50–0.75 → REVIEW  (soft verification)
  < 0.50  → REJECT   (auto-block)

Saves:
  trust_model.pkl
  trust_calibrator.pkl
  trust_scaler.pkl
  trust_metadata.json
"""

import json, pickle
import numpy as np
import pandas as pd
from sklearn.ensemble          import GradientBoostingRegressor
from sklearn.isotonic          import IsotonicRegression
from sklearn.preprocessing     import StandardScaler
from sklearn.model_selection   import train_test_split, cross_val_score
from sklearn.metrics           import mean_absolute_error, r2_score
from sklearn.calibration        import calibration_curve

np.random.seed(2024)
N = 15000

# ── Archetypes with realistic joint distributions ─────────────
archetypes = np.random.choice(
    ["genuine_trusted", "genuine_borderline",
     "fraud_gps", "fraud_ring", "fraud_serial", "fraud_vpn", "fraud_bot"],
    N,
    p=[0.42, 0.18, 0.10, 0.09, 0.09, 0.07, 0.05],
)

def col_by_arch(ranges: dict, n=N, noise=0.05):
    arr = np.zeros(n)
    for i, arch in enumerate(archetypes):
        lo, hi = ranges.get(arch, ranges.get("_default", (0, 1)))
        arr[i] = np.random.uniform(lo, hi)
    return arr

# ── Risk model outputs ─────────────────────────────────────────
income_loss_pct = col_by_arch({
    "genuine_trusted":    (0.15, 0.55),
    "genuine_borderline": (0.10, 0.45),
    "fraud_gps":          (0.05, 0.30),   # fraudsters claim during minor events
    "fraud_ring":         (0.08, 0.35),
    "fraud_serial":       (0.10, 0.40),
    "fraud_vpn":          (0.05, 0.25),
    "fraud_bot":          (0.05, 0.20),
})

risk_probability = np.clip(income_loss_pct * 1.8 * 100 + np.random.normal(0, 5, N), 5, 99)

city_risk_index = col_by_arch({
    "genuine_trusted":    (0.50, 0.90),
    "genuine_borderline": (0.45, 0.85),
    "_default":           (0.40, 0.80),
})

curfew_active = (np.random.rand(N) < 0.05).astype(float)
triggers_fired_count = np.random.choice([0,1,2,3], N, p=[0.30,0.40,0.20,0.10]).astype(float)

# ── BTS engine outputs ─────────────────────────────────────────
bts_score = col_by_arch({
    "genuine_trusted":    (78, 100),
    "genuine_borderline": (55,  85),
    "fraud_gps":          (20,  55),
    "fraud_ring":         (15,  50),
    "fraud_serial":       (25,  60),
    "fraud_vpn":          (20,  55),
    "fraud_bot":          (10,  45),
})

# Sub-scores derived from BTS (approximated)
consistency_pts   = np.clip(bts_score / 100 * 40 + np.random.normal(0, 2, N), 0, 40)
clean_claim_pts   = np.clip(bts_score / 100 * 25 + np.random.normal(0, 2, N), 0, 25)
gps_compliance_pts= np.clip(bts_score / 100 * 20 + np.random.normal(0, 1, N), 0, 20)
doc_pts           = np.clip(bts_score / 100 * 15 + np.random.normal(0, 1, N), 0, 15)
bts_flags_count   = col_by_arch({
    "genuine_trusted":    (0, 1),
    "genuine_borderline": (0, 3),
    "_default":           (2, 8),
})

# ── Fraud detector outputs ─────────────────────────────────────
if_norm_score = col_by_arch({
    "genuine_trusted":    (0.82, 0.99),
    "genuine_borderline": (0.55, 0.90),
    "fraud_gps":          (0.10, 0.45),
    "fraud_ring":         (0.08, 0.40),
    "fraud_serial":       (0.15, 0.50),
    "fraud_vpn":          (0.05, 0.35),
    "fraud_bot":          (0.05, 0.30),
})

clf_fraud_proba = col_by_arch({
    "genuine_trusted":    (0.00, 0.05),
    "genuine_borderline": (0.02, 0.20),
    "fraud_gps":          (0.75, 1.00),
    "fraud_ring":         (0.80, 1.00),
    "fraud_serial":       (0.70, 0.98),
    "fraud_vpn":          (0.78, 1.00),
    "fraud_bot":          (0.82, 1.00),
})

fraud_flags_count = col_by_arch({
    "genuine_trusted":    (0, 1),
    "genuine_borderline": (0, 2),
    "fraud_gps":          (2, 6),
    "fraud_ring":         (3, 7),
    "fraud_serial":       (2, 5),
    "fraud_vpn":          (2, 5),
    "fraud_bot":          (3, 8),
})

# Signal-level risk scores (0=low, 1=medium, 2=high) encoded as float
location_risk    = col_by_arch({"genuine_trusted":(0,0.5),"genuine_borderline":(0,1.2),"_default":(1,2)})
temporal_risk    = col_by_arch({"genuine_trusted":(0,0.5),"genuine_borderline":(0,1.5),"_default":(1,2)})
activity_risk    = col_by_arch({"genuine_trusted":(0,0.5),"genuine_borderline":(0,1.2),"_default":(1,2)})
behavioral_risk  = col_by_arch({"genuine_trusted":(0,0.5),"genuine_borderline":(0,1.5),"_default":(1,2)})

# ── Ground truth trust score ───────────────────────────────────
is_fraud = np.isin(archetypes, ["fraud_gps","fraud_ring","fraud_serial","fraud_vpn","fraud_bot"])
is_genuine_trusted    = archetypes == "genuine_trusted"
is_genuine_borderline = archetypes == "genuine_borderline"

# Base from fraud signal (most powerful)
trust_base = np.where(is_fraud,
    np.random.uniform(0.05, 0.40, N),
    np.where(is_genuine_trusted,
        np.random.uniform(0.72, 0.98, N),
        np.random.uniform(0.45, 0.80, N)
    )
)

# Modulate with BTS
bts_factor = (bts_score - 50) / 100      # -0.5 to +0.5
trust_raw  = trust_base + 0.08 * bts_factor

# Modulate with fraud flags (each flag lowers trust)
trust_raw -= fraud_flags_count * 0.03

# Curfew is a positive signal (real disruption → genuine claim)
trust_raw += curfew_active * 0.05

# Many triggers fired = genuine disruption signal
trust_raw += triggers_fired_count * 0.015

# Add calibrated noise
trust_raw += np.random.normal(0, 0.025, N)
trust_score_gt = np.clip(trust_raw, 0.0, 1.0)

# ── Build feature matrix ───────────────────────────────────────
FEATURES = [
    "income_loss_pct",      "risk_probability",     "city_risk_index",
    "curfew_active",        "triggers_fired_count",
    "bts_score",            "consistency_pts",      "clean_claim_pts",
    "gps_compliance_pts",   "doc_pts",              "bts_flags_count",
    "if_norm_score",        "clf_fraud_proba",      "fraud_flags_count",
    "location_risk",        "temporal_risk",        "activity_risk",
    "behavioral_risk",
]

X = np.column_stack([
    income_loss_pct, risk_probability, city_risk_index,
    curfew_active, triggers_fired_count,
    bts_score, consistency_pts, clean_claim_pts,
    gps_compliance_pts, doc_pts, bts_flags_count,
    if_norm_score, clf_fraud_proba, fraud_flags_count,
    location_risk, temporal_risk, activity_risk, behavioral_risk,
])
y = trust_score_gt

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler     = StandardScaler()
X_train_s  = scaler.fit_transform(X_train)
X_test_s   = scaler.transform(X_test)

# ── Train GradientBoosting ─────────────────────────────────────
print("Training Trust Score GradientBoosting...")
gb = GradientBoostingRegressor(
    n_estimators=300, max_depth=4, learning_rate=0.04,
    subsample=0.8, min_samples_leaf=8, random_state=42,
)
gb.fit(X_train_s, y_train)
y_pred_raw = np.clip(gb.predict(X_test_s), 0, 1)

mae_raw = mean_absolute_error(y_test, y_pred_raw)
r2_raw  = r2_score(y_test, y_pred_raw)
print(f"  Before calibration → MAE: {mae_raw:.4f}  R²: {r2_raw:.4f}")

# ── Isotonic calibration ───────────────────────────────────────
# Calibrate on a held-out chunk of training data
X_cal_s = X_train_s[:2000]
y_cal   = y_train[:2000]
y_cal_raw = np.clip(gb.predict(X_cal_s), 0, 1)

calibrator = IsotonicRegression(out_of_bounds="clip")
calibrator.fit(y_cal_raw, y_cal)

y_pred_cal = calibrator.transform(y_pred_raw)
mae_cal = mean_absolute_error(y_test, y_pred_cal)
r2_cal  = r2_score(y_test, y_pred_cal)
print(f"  After  calibration → MAE: {mae_cal:.4f}  R²: {r2_cal:.4f}")

# ── Decision accuracy ──────────────────────────────────────────
def decide(ts): return "approve" if ts>0.75 else "review" if ts>0.50 else "reject"

gt_decisions   = [decide(s) for s in y_test]
pred_decisions = [decide(s) for s in y_pred_cal]
decision_acc   = sum(g==p for g,p in zip(gt_decisions, pred_decisions)) / len(gt_decisions)
print(f"  Decision accuracy  → {decision_acc*100:.2f}%")

from collections import Counter
print(f"  GT distribution    → {dict(Counter(gt_decisions))}")
print(f"  Pred distribution  → {dict(Counter(pred_decisions))}")

# ── Feature importances ────────────────────────────────────────
fi = pd.DataFrame({"feature": FEATURES, "importance": gb.feature_importances_})
fi = fi.sort_values("importance", ascending=False)
print("\nFeature importances:")
print(fi.to_string(index=False))

# ── Cross-validation ───────────────────────────────────────────
cv_scores = cross_val_score(gb, X_train_s, y_train, cv=5, scoring="r2")
print(f"\nCV R²: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# ── Archetype spot-checks ──────────────────────────────────────
print("\n── Archetype spot-checks ──")
spot_checks = [
    # label, [income_loss, risk_prob, city_risk, curfew, triggers,
    #          bts, cons, clean, gps_c, doc, bts_flags,
    #          if_norm, clf_p, fraud_flags,
    #          loc_r, temp_r, act_r, beh_r]
    ("Ravi – genuine heavy rain",    [0.37,66,0.72,0,2, 92,38,23,18,13,0, 0.988,0.000,0, 0,0,0,0]),
    ("Priya – borderline worker",    [0.22,40,0.60,0,1, 73,28,16,14, 9,2, 0.720,0.060,1, 0,1,0,1]),
    ("Sunil – low BTS, claim spree", [0.18,32,0.65,0,1, 55,20,10,12, 8,4, 0.450,0.350,3, 1,1,1,1]),
    ("GPS spoof attacker",           [0.12,22,0.85,0,0, 35,12, 6, 8, 5,6, 0.095,0.990,5, 2,1,2,2]),
    ("Coordinated ring – cluster 20",[0.15,27,0.80,0,0, 28, 9, 4, 6, 4,7, 0.107,0.995,6, 1,2,2,2]),
    ("VPN + IP mismatch 200km",      [0.10,18,0.72,0,0, 38,14, 8,10, 6,5, 0.116,0.992,4, 0,1,1,2]),
    ("Bot flood – 2am",              [0.08,14,0.85,0,0, 25, 8, 3, 5, 4,7, 0.096,0.998,7, 2,2,2,2]),
    ("Mumbai curfew – real event",   [0.67,99,0.80,1,3, 88,36,22,18,13,0, 0.980,0.002,0, 0,0,0,0]),
]

for label, vec in spot_checks:
    v  = np.array(vec).reshape(1, -1)
    vs = scaler.transform(v)
    ts_raw = float(np.clip(gb.predict(vs)[0], 0, 1))
    ts_cal = float(calibrator.transform(np.array([ts_raw]))[0])
    dec    = decide(ts_cal)
    print(f"  {label:<42} ts={ts_cal:.3f}  {dec.upper()}")

# ── Save ───────────────────────────────────────────────────────
with open("trust_model.pkl",      "wb") as f: pickle.dump(gb,         f)
with open("trust_calibrator.pkl", "wb") as f: pickle.dump(calibrator, f)
with open("trust_scaler.pkl",     "wb") as f: pickle.dump(scaler,     f)

metadata = {
    "model_type":   "GradientBoostingRegressor + IsotonicCalibration",
    "features":     FEATURES,
    "target":       "trust_score",
    "thresholds": {
        "approve": "> 0.75  → instant payout",
        "review":  "0.50–0.75 → soft verification",
        "reject":  "< 0.50  → auto-block",
    },
    "metrics": {
        "mae_before_calibration": round(mae_raw, 4),
        "mae_after_calibration":  round(mae_cal, 4),
        "r2_before_calibration":  round(r2_raw, 4),
        "r2_after_calibration":   round(r2_cal, 4),
        "decision_accuracy_pct":  round(decision_acc * 100, 2),
    },
    "cv_r2": {
        "mean": round(float(cv_scores.mean()), 4),
        "std":  round(float(cv_scores.std()),  4),
    },
    "feature_importances": {
        row["feature"]: round(float(row["importance"]), 6)
        for _, row in fi.iterrows()
    },
    "input_sources": {
        "risk_model":     ["income_loss_pct","risk_probability","city_risk_index","curfew_active","triggers_fired_count"],
        "bts_engine":     ["bts_score","consistency_pts","clean_claim_pts","gps_compliance_pts","doc_pts","bts_flags_count"],
        "fraud_detector": ["if_norm_score","clf_fraud_proba","fraud_flags_count","location_risk","temporal_risk","activity_risk","behavioral_risk"],
    },
    "train_samples": len(X_train),
    "test_samples":  len(X_test),
    "scaler_mean":   scaler.mean_.tolist(),
    "scaler_scale":  scaler.scale_.tolist(),
}

with open("trust_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("\nSaved: trust_model.pkl, trust_calibrator.pkl, trust_scaler.pkl, trust_metadata.json")
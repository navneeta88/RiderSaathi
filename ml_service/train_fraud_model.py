"""
train_fraud_model.py
Trains the multi-layer fraud detection system for RiderSaathi.

Architecture:
  Layer 1 — Isolation Forest (unsupervised anomaly detection)
             Catches novel/unseen fraud patterns without labels.
  Layer 2 — GradientBoosting classifier (supervised)
             Trained on known fraud archetypes for high precision.
  Layer 3 — Ensemble trust score (0–1)
             Combines both scores + rule-based signals into final decision.

Decision thresholds:
  trust_score > 0.75  → AUTO APPROVE
  trust_score 0.50–0.75 → FLAG FOR REVIEW
  trust_score < 0.50  → AUTO REJECT

Saves:
  fraud_iforest.pkl       — Isolation Forest model
  fraud_clf.pkl           — GradientBoosting classifier
  fraud_scaler.pkl        — StandardScaler
  fraud_metadata.json     — metrics, thresholds, feature importances
"""

import json, pickle
import numpy as np
import pandas as pd
from sklearn.ensemble        import IsolationForest, GradientBoostingClassifier
from sklearn.preprocessing   import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics         import (classification_report, roc_auc_score,
                                     precision_recall_curve, confusion_matrix,
                                     average_precision_score)

# ── Load data ──────────────────────────────────────────────────
df = pd.read_csv("fraud_training_data.csv")

FEATURES = [
    "registered_zone_dist_km",
    "ip_location_dist_km",
    "location_jump_km",
    "is_vpn",
    "hour_of_claim",
    "days_since_last_claim",
    "claims_this_week",
    "claim_during_event",
    "orders_last_24h",
    "activity_drop_pct",
    "device_motion_score",
    "app_session_minutes",
    "bts_score",
    "claim_amount_vs_avg",
    "duplicate_ip_count",
    "network_cluster_size",
]

X = df[FEATURES].values
y = df["is_fraud"].values

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

scaler     = StandardScaler()
X_train_s  = scaler.fit_transform(X_train)
X_test_s   = scaler.transform(X_test)

# ── Layer 1: Isolation Forest ─────────────────────────────────
print("Training Isolation Forest...")
iforest = IsolationForest(
    n_estimators=200,
    contamination=0.12,      # mirrors true fraud rate
    max_samples="auto",
    max_features=0.8,
    random_state=42,
    n_jobs=-1,
)
iforest.fit(X_train_s)

# Raw anomaly scores: more negative = more anomalous
if_scores_train = iforest.score_samples(X_train_s)
if_scores_test  = iforest.score_samples(X_test_s)

# Normalise to 0–1 (1 = normal/genuine, 0 = anomalous/fraud)
def norm_if_score(scores, lo=None, hi=None):
    lo = lo or scores.min()
    hi = hi or scores.max()
    return np.clip((scores - lo) / (hi - lo + 1e-9), 0, 1)

if_lo = if_scores_train.min()
if_hi = if_scores_train.max()
if_norm_test = norm_if_score(if_scores_test, if_lo, if_hi)

# ── Layer 2: Supervised GradientBoosting ──────────────────────
print("Training GradientBoosting classifier...")
clf = GradientBoostingClassifier(
    n_estimators=250,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    min_samples_leaf=10,
    random_state=42,
)
clf.fit(X_train_s, y_train)
clf_proba_test = clf.predict_proba(X_test_s)[:, 1]   # P(fraud)

# ── Layer 3: Ensemble trust score ────────────────────────────
# trust_score = (IF normalised genuine score × 0.40) + (1 - clf fraud proba) × 0.60
# → 1.0 = very trustworthy, 0.0 = very suspicious
WEIGHT_IF  = 0.40
WEIGHT_CLF = 0.60

def trust_score(if_norm, clf_fraud_proba):
    return WEIGHT_IF * if_norm + WEIGHT_CLF * (1 - clf_fraud_proba)

ts_test = trust_score(if_norm_test, clf_proba_test)

# Decision using trust score (higher = more trustworthy)
def decide(ts):
    if ts > 0.75: return "approve"
    if ts > 0.50: return "review"
    return "reject"

decisions = np.array([decide(ts) for ts in ts_test])

# ── Evaluation ────────────────────────────────────────────────
# Convert trust score to fraud prediction (ts < 0.50 → fraud)
y_pred_ts    = (ts_test < 0.50).astype(int)
y_pred_clf   = clf.predict(X_test_s)
if_pred_raw  = iforest.predict(X_test_s)          # -1 = anomaly, 1 = normal
y_pred_if    = (if_pred_raw == -1).astype(int)    # 1 = predicted fraud

print("\n── Isolation Forest ──")
print(classification_report(y_test, y_pred_if, target_names=["genuine","fraud"], digits=3))

print("\n── GradientBoosting classifier ──")
print(classification_report(y_test, y_pred_clf, target_names=["genuine","fraud"], digits=3))

print("\n── Ensemble (trust score) ──")
print(classification_report(y_test, y_pred_ts, target_names=["genuine","fraud"], digits=3))

auc_clf = roc_auc_score(y_test, clf_proba_test)
auc_ts  = roc_auc_score(y_test, 1 - ts_test)
ap_clf  = average_precision_score(y_test, clf_proba_test)
ap_ts   = average_precision_score(y_test, 1 - ts_test)
print(f"\nROC-AUC  | Classifier: {auc_clf:.4f} | Ensemble: {auc_ts:.4f}")
print(f"Avg Prec | Classifier: {ap_clf:.4f} | Ensemble: {ap_ts:.4f}")

print("\nDecision distribution (ensemble):")
unique, counts = np.unique(decisions, return_counts=True)
for u, c in zip(unique, counts):
    print(f"  {u:<10}: {c} ({c/len(decisions)*100:.1f}%)")

# ── Feature importances ───────────────────────────────────────
fi = pd.DataFrame({"feature": FEATURES, "importance": clf.feature_importances_})
fi = fi.sort_values("importance", ascending=False)
print("\nFeature importances (GradientBoosting classifier):")
print(fi.to_string(index=False))

# ── Confusion matrix ──────────────────────────────────────────
cm = confusion_matrix(y_test, y_pred_ts)
print(f"\nConfusion matrix (ensemble):")
print(f"  TN={cm[0,0]}  FP={cm[0,1]}")
print(f"  FN={cm[1,0]}  TP={cm[1,1]}")

# ── Archetype breakdown ───────────────────────────────────────
test_idx = np.where(df.index.isin(
    df.sample(frac=0.2, random_state=42).index))[0]
# Just show per-archetype mean trust score from full dataset
print("\n── Per-archetype trust scores (sample) ──")
archetypes_test = [
    {"arch": "genuine",       "vec": [1.2, 2.0, 1.5, 0, 14, 60, 1, 1, 12, 55, 0.88, 45, 85, 1.0, 1, 1]},
    {"arch": "gps_spoof",     "vec": [22.0, 8.0, 35.0, 0, 10, 5, 3, 0, 1.5, 12, 0.12, 7, 35, 1.5, 1, 1]},
    {"arch": "coord_ring",    "vec": [2.0, 10.0, 3.0, 0, 11, 6, 4, 0, 4, 28, 0.40, 9, 30, 1.7, 15, 22]},
    {"arch": "serial_claimer","vec": [1.5, 3.0, 2.0, 0, 15, 3, 5, 1, 6, 25, 0.55, 12, 40, 2.2, 2, 2]},
    {"arch": "vpn_fake",      "vec": [1.0, 180.0, 2.0, 1, 3, 8, 2, 0, 3, 20, 0.50, 10, 38, 1.8, 1, 1]},
    {"arch": "bot_flood",     "vec": [3.0, 5.0, 4.0, 0, 2, 2, 6, 0, 2, 15, 0.30, 5, 25, 2.5, 4, 5]},
]
for ex in archetypes_test:
    v  = np.array(ex["vec"]).reshape(1, -1)
    vs = scaler.transform(v)
    if_s  = norm_if_score(iforest.score_samples(vs), if_lo, if_hi)[0]
    clf_p = clf.predict_proba(vs)[0, 1]
    ts    = trust_score(if_s, clf_p)
    dec   = decide(ts)
    print(f"  {ex['arch']:<18} trust={ts:.3f}  decision={dec}")

# ── Save ──────────────────────────────────────────────────────
with open("fraud_iforest.pkl", "wb") as f: pickle.dump(iforest, f)
with open("fraud_clf.pkl",     "wb") as f: pickle.dump(clf,     f)
with open("fraud_scaler.pkl",  "wb") as f: pickle.dump(scaler,  f)

from sklearn.metrics import precision_score, recall_score, f1_score
metadata = {
    "features": FEATURES,
    "model_layers": {
        "layer1": "IsolationForest (unsupervised, contamination=0.12)",
        "layer2": "GradientBoostingClassifier (supervised)",
        "layer3": "Ensemble trust score (IF×0.40 + clf×0.60)",
    },
    "weights": {"isolation_forest": WEIGHT_IF, "classifier": WEIGHT_CLF},
    "if_score_range": {"lo": float(if_lo), "hi": float(if_hi)},
    "thresholds": {
        "auto_approve": "> 0.75",
        "review":       "0.50 – 0.75",
        "auto_reject":  "< 0.50",
    },
    "metrics": {
        "roc_auc":          round(float(auc_ts), 4),
        "avg_precision":    round(float(ap_ts), 4),
        "precision_fraud":  round(float(precision_score(y_test, y_pred_ts)), 4),
        "recall_fraud":     round(float(recall_score(y_test, y_pred_ts)), 4),
        "f1_fraud":         round(float(f1_score(y_test, y_pred_ts)), 4),
    },
    "confusion_matrix": {"TN": int(cm[0,0]), "FP": int(cm[0,1]),
                         "FN": int(cm[1,0]), "TP": int(cm[1,1])},
    "feature_importances": {
        row["feature"]: round(float(row["importance"]), 5)
        for _, row in fi.iterrows()
    },
    "fraud_archetypes": ["gps_spoof", "coord_ring", "serial_claimer", "vpn_fake", "bot_flood"],
    "train_samples": len(X_train),
    "test_samples":  len(X_test),
    "scaler_mean":   scaler.mean_.tolist(),
    "scaler_scale":  scaler.scale_.tolist(),
}
with open("fraud_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("\nSaved: fraud_iforest.pkl, fraud_clf.pkl, fraud_scaler.pkl, fraud_metadata.json")
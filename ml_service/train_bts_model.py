"""
train_bts_model.py
Trains the Behavioral Trust Score (BTS) dynamic scoring engine.

Compares:
  - LinearRegression  (baseline)
  - GradientBoosting  (chosen for non-linear interactions in behaviour)

Saves:
  - bts_model.pkl
  - bts_scaler.pkl
  - bts_metadata.json
"""

import json
import pickle
import numpy as np
import pandas as pd
from sklearn.linear_model     import LinearRegression
from sklearn.ensemble         import GradientBoostingRegressor
from sklearn.preprocessing    import StandardScaler
from sklearn.model_selection  import train_test_split, cross_val_score
from sklearn.metrics          import mean_absolute_error, mean_squared_error, r2_score

# ── Load data ──────────────────────────────────────────────────
df = pd.read_csv('bts_training_data.csv')

FEATURES = [
    'days_worked_per_week',
    'avg_daily_hours',
    'weeks_on_platform',
    'total_claims',
    'fraudulent_claims',
    'gps_zone_violations',
    'aadhaar_verified',
    'pan_verified',
    'bank_verified',
    'late_logins',
    'order_completion_rate',
    'avg_rating',
    'sudden_activity_drops',
    'claim_gap_days_avg',
    'income_consistency',
]
TARGET = 'bts_score'

X = df[FEATURES].values
y = df[TARGET].values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler     = StandardScaler()
X_train_s  = scaler.fit_transform(X_train)
X_test_s   = scaler.transform(X_test)

# ── Train models ───────────────────────────────────────────────
lr  = LinearRegression()
lr.fit(X_train_s, y_train)
y_lr = np.clip(lr.predict(X_test_s), 0, 100)

gb = GradientBoostingRegressor(
    n_estimators=200, max_depth=4, learning_rate=0.05,
    subsample=0.8, random_state=42
)
gb.fit(X_train_s, y_train)
y_gb = np.clip(gb.predict(X_test_s), 0, 100)

def report(name, y_true, y_pred):
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    print(f"\n{name}")
    print(f"  MAE  : {mae:.3f}  (avg BTS error in points)")
    print(f"  RMSE : {rmse:.3f}")
    print(f"  R²   : {r2:.4f}")
    return dict(mae=round(mae,3), rmse=round(rmse,3), r2=round(r2,4))

lr_m = report("LinearRegression (baseline)", y_test, y_lr)
gb_m = report("GradientBoosting (chosen)",   y_test, y_gb)

# CV
cv_gb = cross_val_score(gb, X_train_s, y_train, cv=5, scoring='r2')
print(f"\nCV R² GradientBoosting: {cv_gb.mean():.4f} ± {cv_gb.std():.4f}")

# ── Feature importances ────────────────────────────────────────
fi = pd.DataFrame({'feature': FEATURES, 'importance': gb.feature_importances_})
fi = fi.sort_values('importance', ascending=False)
print("\nFeature importances (GradientBoosting):")
print(fi.to_string(index=False))

# ── Save ───────────────────────────────────────────────────────
with open('bts_model.pkl',  'wb') as f: pickle.dump(gb, f)
with open('bts_scaler.pkl', 'wb') as f: pickle.dump(scaler, f)

metadata = {
    'model_type': 'GradientBoostingRegressor',
    'features':   FEATURES,
    'target':     TARGET,
    'train_samples': len(X_train),
    'test_samples':  len(X_test),
    'metrics': {
        'linear_regression':   lr_m,
        'gradient_boosting':   gb_m,
    },
    'cv_r2': {
        'mean': round(float(cv_gb.mean()), 4),
        'std':  round(float(cv_gb.std()),  4),
    },
    'feature_importances': {
        row['feature']: round(float(row['importance']), 5)
        for _, row in fi.iterrows()
    },
    'scaler_mean':  scaler.mean_.tolist(),
    'scaler_scale': scaler.scale_.tolist(),
    'bts_tiers': [
        {'min': 90, 'max': 100, 'label': 'Trusted',     'premium_inr': 15},
        {'min': 80, 'max': 89,  'label': 'Reliable',    'premium_inr': 25},
        {'min': 70, 'max': 79,  'label': 'Standard',    'premium_inr': 40},
        {'min': 60, 'max': 69,  'label': 'Caution',     'premium_inr': 60},
        {'min': 0,  'max': 59,  'label': 'High Risk',   'premium_inr': 100},
    ],
}

with open('bts_metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print("\nSaved: bts_model.pkl, bts_scaler.pkl, bts_metadata.json")

# ── Quick sanity-check predictions ────────────────────────────
print("\n── Archetype spot-checks ──")
examples = [
    {
        'label': 'Ravi (trusted, 6 days, Aadhaar+PAN+bank, 0 fraud)',
        'vec':   [6, 9.0, 52, 2, 0, 0, 1, 1, 1, 0, 0.97, 4.7, 0, 180, 0.1],
    },
    {
        'label': 'Ankit (reliable, 5 days, partial docs, 1 fraud/8)',
        'vec':   [5, 7.5, 24, 8, 1, 1, 1, 0, 1, 1, 0.90, 4.2, 1, 45, 0.25],
    },
    {
        'label': 'Priya (borderline, 4 days, no PAN, 2 GPS viol)',
        'vec':   [4, 6.0, 12, 4, 0, 2, 1, 0, 0, 2, 0.78, 3.9, 2, 30, 0.45],
    },
    {
        'label': 'Sunil (risky, 2 days, fake GPS, 3 fraud)',
        'vec':   [2, 4.0,  6, 6, 3, 5, 0, 0, 0, 4, 0.55, 3.1, 3, 10, 0.75],
    },
    {
        'label': 'Fake GPS user (0 docs, 8 fraud/10)',
        'vec':   [1, 2.0,  2,10, 8, 8, 0, 0, 0, 7, 0.40, 2.8, 5,  5, 0.95],
    },
]

for ex in examples:
    v = np.array(ex['vec']).reshape(1, -1)
    vs = scaler.transform(v)
    score = float(np.clip(gb.predict(vs)[0], 0, 100))
    tier = next((t for t in metadata['bts_tiers'] if t['min'] <= score <= t['max']),
                metadata['bts_tiers'][-1])
    print(f"  {ex['label']}")
    print(f"    BTS = {score:.1f} → {tier['label']} (₹{tier['premium_inr']}/week)")
"""
train_model.py
Trains a Linear Regression model for RiderSaathi risk premium prediction.
Also trains a Ridge regression variant and compares both.

Saves:
  - risk_model.pkl        : trained LinearRegression model
  - scaler.pkl            : StandardScaler for input features
  - model_metadata.json   : feature names, metrics, coefficients
"""

import json
import pickle
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# ── Load data ──────────────────────────────────────────────────
df = pd.read_csv("training_data.csv")

FEATURES = [
    "rainfall_mm",
    "temperature_c",
    "aqi",
    "curfew_active",
    "platform",
    "city_risk_index",
    "hour_of_day",
    "day_of_week",
]
TARGET = "income_loss_pct"

X = df[FEATURES].values
y = df[TARGET].values

# ── Train / test split ─────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ── Scale features ─────────────────────────────────────────────
scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

# ── Train Linear Regression ────────────────────────────────────
lr = LinearRegression()
lr.fit(X_train_s, y_train)
y_pred_lr = lr.predict(X_test_s).clip(0, 1)

# ── Train Ridge (regularised) ──────────────────────────────────
ridge = Ridge(alpha=1.0)
ridge.fit(X_train_s, y_train)
y_pred_ridge = ridge.predict(X_test_s).clip(0, 1)

# ── Cross-validation scores ────────────────────────────────────
cv_scores_lr    = cross_val_score(lr,    X_train_s, y_train, cv=5, scoring="r2")
cv_scores_ridge = cross_val_score(ridge, X_train_s, y_train, cv=5, scoring="r2")

# ── Print evaluation ───────────────────────────────────────────
def metrics(name, y_true, y_pred):
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    print(f"\n{name}")
    print(f"  MAE  : {mae:.4f}  (avg absolute error in loss%)")
    print(f"  RMSE : {rmse:.4f}")
    print(f"  R²   : {r2:.4f}")
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4)}

lr_metrics    = metrics("LinearRegression", y_test, y_pred_lr)
ridge_metrics = metrics("Ridge Regression",  y_test, y_pred_ridge)

print(f"\nCV R² LinearRegression : {cv_scores_lr.mean():.4f} ± {cv_scores_lr.std():.4f}")
print(f"CV R² Ridge            : {cv_scores_ridge.mean():.4f} ± {cv_scores_ridge.std():.4f}")

# ── Feature importance via coefficients ───────────────────────
coef_df = pd.DataFrame({
    "feature": FEATURES,
    "coefficient": lr.coef_,
    "abs_importance": np.abs(lr.coef_),
}).sort_values("abs_importance", ascending=False)

print("\nFeature coefficients (LinearRegression):")
print(coef_df.to_string(index=False))

# ── Save model & scaler ────────────────────────────────────────
with open("risk_model.pkl",  "wb") as f: pickle.dump(lr, f)
with open("scaler.pkl",      "wb") as f: pickle.dump(scaler, f)

# ── Save metadata ──────────────────────────────────────────────
metadata = {
    "model_type": "LinearRegression",
    "features": FEATURES,
    "target": TARGET,
    "train_samples": len(X_train),
    "test_samples": len(X_test),
    "metrics": {
        "linear_regression": lr_metrics,
        "ridge": ridge_metrics,
    },
    "cv_r2": {
        "linear_regression": {
            "mean": round(float(cv_scores_lr.mean()), 4),
            "std":  round(float(cv_scores_lr.std()),  4),
        },
        "ridge": {
            "mean": round(float(cv_scores_ridge.mean()), 4),
            "std":  round(float(cv_scores_ridge.std()),  4),
        },
    },
    "coefficients": {
        row["feature"]: round(float(row["coefficient"]), 6)
        for _, row in coef_df.iterrows()
    },
    "scaler_mean":  scaler.mean_.tolist(),
    "scaler_scale": scaler.scale_.tolist(),
}

with open("model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("\nSaved: risk_model.pkl, scaler.pkl, model_metadata.json")
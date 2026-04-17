"""
train_zone_model.py
Trains the RiderSaathi Risk Zone Prediction & Analytics engine.

Uses the daily city data (zone_training_data.csv) and aggregates to weekly.
Trains:
  Model A — GradientBoosting regressor  → predicted_risk_score (0–1)
  Model B — GradientBoosting classifier → risk_level (low / medium / high)
  Model C — GradientBoosting regressor  → expected_claims_next_week

Also computes rich analytics:
  - City heatmap table (current week snapshot)
  - 12-week rolling risk trend per city
  - Season breakdown
  - Trigger contribution table

Saves:
  zone_risk_model.pkl
  zone_clf_model.pkl
  zone_claims_model.pkl
  zone_scaler.pkl
  zone_metadata.json
  zone_analytics.json   ← pre-computed analytics for fast dashboard serving
"""

import json, pickle, warnings
import numpy as np
import pandas as pd
from sklearn.ensemble        import GradientBoostingRegressor, GradientBoostingClassifier
from sklearn.preprocessing   import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics         import (mean_absolute_error, r2_score,
                                     classification_report, accuracy_score)
warnings.filterwarnings("ignore")

# ── Load & aggregate daily → weekly ───────────────────────────
df_daily = pd.read_csv("zone_training_data.csv", parse_dates=["date"])

df_daily["week"] = df_daily["date"].dt.isocalendar().week.astype(int)
df_daily["year"] = df_daily["date"].dt.year
df_daily["month"]= df_daily["date"].dt.month

# Weekly aggregation
CITY_BASE_RISK = {
    "Delhi":0.85,"Mumbai":0.80,"Noida":0.72,"Bengaluru":0.55,
    "Hyderabad":0.50,"Chennai":0.60,"Kolkata":0.75,
    "Pune":0.48,"Jaipur":0.65,"Lucknow":0.70,
}
df_daily["city_base_risk"] = df_daily["city"].map(CITY_BASE_RISK)

agg = df_daily.groupby(["city","year","week"]).agg(
    avg_rainfall_mm   = ("rainfall_mm",         "mean"),
    max_rainfall_mm   = ("rainfall_mm",         "max"),
    avg_temp_c        = ("temperature_c",        "mean"),
    max_temp_c        = ("temperature_c",        "max"),
    avg_aqi           = ("aqi",                  "mean"),
    max_aqi           = ("aqi",                  "max"),
    curfew_days       = ("curfew_active",         "sum"),
    city_base_risk    = ("city_base_risk",        "first"),
    month             = ("month",                "first"),
    risk_score_mean   = ("next_day_risk_score",   "mean"),
    risk_score_max    = ("next_day_risk_score",   "max"),
).reset_index()

agg = agg.sort_values(["city","year","week"]).reset_index(drop=True)

# Lag features (previous 1 & 2 weeks)
for col in ["avg_rainfall_mm","avg_temp_c","avg_aqi","risk_score_mean"]:
    agg[f"{col}_lag1"] = agg.groupby("city")[col].shift(1)
    agg[f"{col}_lag2"] = agg.groupby("city")[col].shift(2)

agg["disruption_streak"] = (
    agg.groupby("city")["risk_score_mean"]
    .transform(lambda s: s.gt(0.30).rolling(4, min_periods=1).sum())
)
agg["is_monsoon"]       = agg["month"].isin([6,7,8,9]).astype(int)
agg["city_density_idx"] = agg["city"].map({
    "Delhi":0.95,"Mumbai":0.90,"Noida":0.70,"Bengaluru":0.65,"Hyderabad":0.60,
    "Chennai":0.70,"Kolkata":0.85,"Pune":0.55,"Jaipur":0.60,"Lucknow":0.65,
})
agg["platform_coverage"] = agg["city"].map({
    "Delhi":5,"Mumbai":5,"Noida":4,"Bengaluru":5,"Hyderabad":4,
    "Chennai":4,"Kolkata":4,"Pune":3,"Jaipur":3,"Lucknow":3,
})

# Target: next week's risk score
agg["target_risk"]   = agg.groupby("city")["risk_score_mean"].shift(-1)
agg["target_claims"] = (agg["target_risk"] * 150 * agg["city_density_idx"] + 20).round()

# Risk level label
def rl(s):
    if s >= 0.55: return "high"
    if s >= 0.30: return "medium"
    return "low"

agg["target_risk_level"] = agg["target_risk"].apply(lambda x: rl(x) if pd.notna(x) else np.nan)
for col in [c for c in agg.columns if "lag" in c or "streak" in c]:
    agg[col] = agg.groupby("city")[col].transform(lambda s: s.fillna(s.median()))
agg = agg.dropna(subset=["target_risk"]).copy()

FEATURES = [
    "avg_rainfall_mm",     "max_rainfall_mm",     "avg_rainfall_mm_lag1",
    "avg_rainfall_mm_lag2","avg_temp_c",           "max_temp_c",
    "avg_temp_c_lag1",     "avg_aqi",              "max_aqi",
    "avg_aqi_lag1",        "curfew_days",          "city_base_risk",
    "city_density_idx",    "platform_coverage",    "month",
    "is_monsoon",          "disruption_streak",    "risk_score_mean",
    "risk_score_mean_lag1","risk_score_mean_lag2",
]

X = agg[FEATURES].values
y_risk   = agg["target_risk"].values
y_level  = agg["target_risk_level"].values
y_claims = agg["target_claims"].values.astype(float)

le = LabelEncoder()
y_level_enc = le.fit_transform(y_level)

X_tr, X_te, yr_tr, yr_te, yl_tr, yl_te, yc_tr, yc_te = train_test_split(
    X, y_risk, y_level_enc, y_claims, test_size=0.20, random_state=42
)

scaler    = StandardScaler()
X_tr_s    = scaler.fit_transform(X_tr)
X_te_s    = scaler.transform(X_te)

# ── Model A: risk score regressor ─────────────────────────────
print("Training risk score model...")
m_risk = GradientBoostingRegressor(
    n_estimators=300, max_depth=4, learning_rate=0.04, subsample=0.8, random_state=42
)
m_risk.fit(X_tr_s, yr_tr)
yhat_risk = np.clip(m_risk.predict(X_te_s), 0, 1)
mae_r = mean_absolute_error(yr_te, yhat_risk)
r2_r  = r2_score(yr_te, yhat_risk)
print(f"  Risk score   MAE={mae_r:.4f}  R²={r2_r:.4f}")

# ── Model B: risk level classifier ────────────────────────────
print("Training risk level classifier...")
m_clf = GradientBoostingClassifier(
    n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.8, random_state=42
)
m_clf.fit(X_tr_s, yl_tr)
yhat_lvl = m_clf.predict(X_te_s)
acc = accuracy_score(yl_te, yhat_lvl)
print(f"  Risk level   Accuracy={acc:.4f}")
print(classification_report(yl_te, yhat_lvl,
      target_names=le.classes_, digits=3, zero_division=0))

# ── Model C: claims forecaster ────────────────────────────────
print("Training claims forecast model...")
m_claims = GradientBoostingRegressor(
    n_estimators=200, max_depth=3, learning_rate=0.05, subsample=0.8, random_state=42
)
m_claims.fit(X_tr_s, yc_tr)
yhat_cl = np.clip(m_claims.predict(X_te_s), 0, None)
mae_c = mean_absolute_error(yc_te, yhat_cl)
r2_c  = r2_score(yc_te, yhat_cl)
print(f"  Claims forecast MAE={mae_c:.2f}  R²={r2_c:.4f}")

# ── Feature importances ────────────────────────────────────────
fi_df = pd.DataFrame({"feature": FEATURES, "importance": m_risk.feature_importances_})
fi_df = fi_df.sort_values("importance", ascending=False)
print("\nTop feature importances (risk score model):")
print(fi_df.head(10).to_string(index=False))

# ── Pre-compute analytics for dashboard ───────────────────────
latest = agg.sort_values("week").groupby("city").tail(1).copy()
latest["pred_risk"]   = np.clip(m_risk.predict(scaler.transform(latest[FEATURES].values)), 0, 1)
latest["pred_level"]  = le.inverse_transform(m_clf.predict(scaler.transform(latest[FEATURES].values)))
latest["pred_claims"] = np.clip(m_claims.predict(scaler.transform(latest[FEATURES].values)), 0, None).round()

# 12-week trend per city
trends = {}
for city in agg["city"].unique():
    cdf = agg[agg["city"] == city].tail(14).copy()
    if len(cdf) < 2:
        continue
    Xc  = scaler.transform(cdf[FEATURES].values)
    cdf["pred_risk"] = np.clip(m_risk.predict(Xc), 0, 1)
    trends[city] = [
        {"week": int(r["week"]), "year": int(r["year"]),
         "month": int(r["month"]),
         "actual": round(float(r["risk_score_mean"]), 4),
         "predicted": round(float(r["pred_risk"]), 4),
         "risk_level": rl(float(r["pred_risk"]))}
        for _, r in cdf.iterrows()
    ]

# Season breakdown
season_map = {12:"Winter",1:"Winter",2:"Winter",
              3:"Pre-Monsoon",4:"Pre-Monsoon",5:"Pre-Monsoon",
              6:"Monsoon",7:"Monsoon",8:"Monsoon",9:"Monsoon",
              10:"Post-Monsoon",11:"Post-Monsoon"}
agg["season"] = agg["month"].map(season_map)
season_stats  = (agg.groupby("season")["risk_score_mean"]
                   .agg(["mean","max","count"])
                   .rename(columns={"mean":"avg_risk","max":"peak_risk","count":"weeks"})
                   .round(4).to_dict("index"))

# Trigger contribution (correlation-based)
trigger_corr = {}
for feat in ["avg_rainfall_mm","avg_temp_c","avg_aqi","curfew_days"]:
    trigger_corr[feat] = round(float(np.corrcoef(agg[feat], agg["target_risk"])[0,1]), 4)

# City heatmap snapshot
heatmap = []
for _, row in latest.iterrows():
    heatmap.append({
        "city":           row["city"],
        "pred_risk_score":round(float(row["pred_risk"]),  4),
        "pred_risk_level":row["pred_level"],
        "pred_claims":    int(row["pred_claims"]),
        "city_base_risk": round(float(row["city_base_risk"]), 2),
        "avg_rainfall":   round(float(row["avg_rainfall_mm"]), 1),
        "avg_temp":       round(float(row["avg_temp_c"]), 1),
        "avg_aqi":        round(float(row["avg_aqi"]), 1),
        "curfew_days":    int(row["curfew_days"]),
    })
heatmap.sort(key=lambda x: x["pred_risk_score"], reverse=True)

analytics = {
    "generated_at":   pd.Timestamp.now().isoformat(),
    "city_heatmap":   heatmap,
    "weekly_trends":  trends,
    "season_stats":   season_stats,
    "trigger_corr":   trigger_corr,
    "top_risk_city":  heatmap[0]["city"],
    "cities_high":    [h["city"] for h in heatmap if h["pred_risk_level"] == "high"],
    "cities_medium":  [h["city"] for h in heatmap if h["pred_risk_level"] == "medium"],
    "cities_low":     [h["city"] for h in heatmap if h["pred_risk_level"] == "low"],
}

# ── Save everything ───────────────────────────────────────────
with open("zone_risk_model.pkl",   "wb") as f: pickle.dump(m_risk,   f)
with open("zone_clf_model.pkl",    "wb") as f: pickle.dump(m_clf,    f)
with open("zone_claims_model.pkl", "wb") as f: pickle.dump(m_claims, f)
with open("zone_scaler.pkl",       "wb") as f: pickle.dump(scaler,   f)
with open("zone_label_encoder.pkl","wb") as f: pickle.dump(le,       f)

with open("zone_analytics.json", "w") as f:
    json.dump(analytics, f, indent=2)

zone_meta = {
    "features":     FEATURES,
    "models": {
        "risk_score":  {"type":"GradientBoostingRegressor","mae":round(mae_r,4),"r2":round(r2_r,4)},
        "risk_level":  {"type":"GradientBoostingClassifier","accuracy":round(acc,4)},
        "claims":      {"type":"GradientBoostingRegressor","mae":round(mae_c,2),"r2":round(r2_c,4)},
    },
    "risk_thresholds": {"high":">=0.55","medium":"0.30–0.54","low":"<0.30"},
    "cities":          list(CITIES.keys()) if "CITIES" in dir() else list(agg["city"].unique()),
    "feature_importances": {
        row["feature"]: round(float(row["importance"]), 6)
        for _, row in fi_df.iterrows()
    },
    "label_classes":  le.classes_.tolist(),
    "scaler_mean":    scaler.mean_.tolist(),
    "scaler_scale":   scaler.scale_.tolist(),
    "train_samples":  len(X_tr),
    "test_samples":   len(X_te),
}

CITIES = {
    "Delhi":0.85,"Mumbai":0.80,"Noida":0.72,"Bengaluru":0.55,
    "Hyderabad":0.50,"Chennai":0.60,"Kolkata":0.75,
    "Pune":0.48,"Jaipur":0.65,"Lucknow":0.70,
}
zone_meta["cities"] = list(CITIES.keys())

with open("zone_metadata.json","w") as f:
    json.dump(zone_meta, f, indent=2)

print("\nSaved: zone_risk_model.pkl, zone_clf_model.pkl, zone_claims_model.pkl")
print(       "       zone_scaler.pkl, zone_label_encoder.pkl")
print(       "       zone_metadata.json, zone_analytics.json")
print(f"\nCity heatmap (next week forecast):")
for h in heatmap:
    bar = "█" * int(h["pred_risk_score"]*20)
    print(f"  {h['city']:<12} {h['pred_risk_score']:.3f} {bar:<20} {h['pred_risk_level'].upper():<8} ~{h['pred_claims']} claims")
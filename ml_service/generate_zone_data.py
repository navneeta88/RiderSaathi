"""
generate_zone_data.py
Generates 2 years of daily city-level risk history for 10 Indian cities.

Each row = one city × one day snapshot.

Features:
  - city, date, day_of_week, week_of_year, month
  - rainfall_mm, temperature_c, aqi
  - curfew_active, festival_day, exam_day (school/board)
  - active_workers, claims_filed, claims_approved, claims_rejected
  - avg_income_loss_pct, avg_trust_score
  - rain_7d_avg, temp_7d_avg, aqi_7d_avg   (rolling averages)
  - rain_lag1 .. rain_lag3, aqi_lag1..3     (lagged features)

Target:
  - next_day_risk_score  0.0–1.0  (what we forecast)
"""

import numpy as np
import pandas as pd
from datetime import date, timedelta

np.random.seed(2024)

CITIES = {
    "Delhi":     {"lat": 28.61, "lng": 77.23, "base_risk": 0.85, "monsoon_mult": 2.5},
    "Mumbai":    {"lat": 19.08, "lng": 72.88, "base_risk": 0.80, "monsoon_mult": 3.2},
    "Noida":     {"lat": 28.54, "lng": 77.39, "base_risk": 0.72, "monsoon_mult": 2.2},
    "Bengaluru": {"lat": 12.97, "lng": 77.59, "base_risk": 0.55, "monsoon_mult": 1.8},
    "Hyderabad": {"lat": 17.38, "lng": 78.49, "base_risk": 0.50, "monsoon_mult": 1.9},
    "Chennai":   {"lat": 13.08, "lng": 80.27, "base_risk": 0.60, "monsoon_mult": 2.1},
    "Kolkata":   {"lat": 22.57, "lng": 88.36, "base_risk": 0.75, "monsoon_mult": 2.8},
    "Pune":      {"lat": 18.52, "lng": 73.86, "base_risk": 0.48, "monsoon_mult": 1.7},
    "Jaipur":    {"lat": 26.91, "lng": 75.79, "base_risk": 0.65, "monsoon_mult": 1.6},
    "Lucknow":   {"lat": 26.85, "lng": 80.95, "base_risk": 0.70, "monsoon_mult": 2.0},
}

# Approximate monsoon months per city
MONSOON = {
    "Delhi": (6,9), "Noida": (6,9), "Jaipur": (7,9), "Lucknow": (6,9),
    "Mumbai": (6,9), "Pune": (6,9),
    "Bengaluru": (5,10), "Hyderabad": (6,10),
    "Chennai": (10,12),
    "Kolkata": (6,9),
}

START = date(2023, 1, 1)
END   = date(2024, 12, 31)
DAYS  = (END - START).days + 1

rows = []

for city, meta in CITIES.items():
    base_risk = meta["base_risk"]
    mon_mult  = meta["monsoon_mult"]
    mon_start, mon_end = MONSOON[city]

    rain_arr, temp_arr, aqi_arr = [], [], []

    for i in range(DAYS):
        d = START + timedelta(days=i)
        m = d.month

        # Seasonal rainfall (monsoon spike)
        in_monsoon = mon_start <= m <= mon_end
        rain_base  = 25 * mon_mult if in_monsoon else 2
        rain       = float(np.random.exponential(rain_base))

        # Occasional heavy events
        if in_monsoon and np.random.rand() < 0.08:
            rain += np.random.uniform(60, 140)
        rain = min(rain, 220)

        # Temperature: hot summers, cool winters
        temp_base = 38 if m in (4,5,6) else 12 if m in (12,1,2) else 28
        temp = float(np.clip(np.random.normal(temp_base, 4), 8, 48))

        # AQI: worst in Nov-Jan for north Indian cities, moderate otherwise
        aqi_bad = city in ("Delhi","Noida","Lucknow","Jaipur")
        aqi_base = 280 if (aqi_bad and m in (11,12,1)) else 120 if aqi_bad else 80
        aqi = float(np.clip(np.random.normal(aqi_base, 40), 50, 500))

        rain_arr.append(rain); temp_arr.append(temp); aqi_arr.append(aqi)

    # Build rolling and lag features
    rain_s = pd.Series(rain_arr)
    temp_s = pd.Series(temp_arr)
    aqi_s  = pd.Series(aqi_arr)

    rain_7d = rain_s.rolling(7, min_periods=1).mean()
    temp_7d = temp_s.rolling(7, min_periods=1).mean()
    aqi_7d  = aqi_s.rolling(7, min_periods=1).mean()

    for i in range(DAYS - 1):   # -1 because we need "next day" target
        d   = START + timedelta(days=i)
        m   = d.month
        dow = d.weekday()
        woy = d.isocalendar()[1]

        rain = rain_arr[i]; temp = temp_arr[i]; aqi = aqi_arr[i]

        curfew  = 1 if np.random.rand() < 0.015 else 0
        festival= 1 if np.random.rand() < 0.04  else 0
        exam_day= 1 if (m in (3,4,10,11) and np.random.rand()<0.06) else 0

        # Workers & claims (simulate platform data)
        base_workers = int(np.random.normal(1200, 150))
        activity_drop = min(rain/150 + max(temp-42,0)/10 + max(aqi-300,0)/500, 0.9)
        if curfew: activity_drop = min(activity_drop + 0.7, 0.95)
        active_w = max(50, int(base_workers * (1 - activity_drop)))

        claims = int(active_w * np.random.uniform(0.02, 0.08))
        approved = int(claims * np.random.uniform(0.70, 0.92))
        rejected = claims - approved

        avg_loss = float(np.clip(
            base_risk * 0.3
            + (rain / 150) * 0.35
            + max(temp - 42, 0) / 8 * 0.20
            + max(aqi - 300, 0) / 400 * 0.15
            + curfew * 0.45
            + np.random.normal(0, 0.04),
            0, 1
        ))
        avg_trust = float(np.clip(np.random.normal(0.72, 0.10), 0.1, 0.99))

        # Next-day risk score (target)
        next_rain = rain_arr[i+1]; next_aqi = aqi_arr[i+1]; next_temp = temp_arr[i+1]
        next_curfew = 1 if np.random.rand() < 0.015 else 0
        next_risk = float(np.clip(
            base_risk * 0.12
            + (next_rain / 150) * 0.38
            + max(next_temp - 42, 0) / 8 * 0.22
            + max(next_aqi - 300, 0) / 400 * 0.18
            + next_curfew * 0.40
            + festival * 0.05
            + np.random.normal(0, 0.03),
            0, 1
        ))

        rows.append({
            "city": city, "lat": meta["lat"], "lng": meta["lng"],
            "date": d.isoformat(), "day_of_week": dow, "week_of_year": woy, "month": m,
            "rainfall_mm": round(rain, 2), "temperature_c": round(temp, 2), "aqi": round(aqi, 1),
            "curfew_active": curfew, "festival_day": festival, "exam_day": exam_day,
            "active_workers": active_w, "claims_filed": claims,
            "claims_approved": approved, "claims_rejected": rejected,
            "avg_income_loss_pct": round(avg_loss, 4),
            "avg_trust_score": round(avg_trust, 4),
            "rain_7d_avg": round(float(rain_7d.iloc[i]), 2),
            "temp_7d_avg": round(float(temp_7d.iloc[i]), 2),
            "aqi_7d_avg":  round(float(aqi_7d.iloc[i]),  1),
            "rain_lag1": round(rain_arr[max(0,i-1)], 2),
            "rain_lag2": round(rain_arr[max(0,i-2)], 2),
            "rain_lag3": round(rain_arr[max(0,i-3)], 2),
            "aqi_lag1":  round(aqi_arr[max(0,i-1)], 1),
            "aqi_lag2":  round(aqi_arr[max(0,i-2)], 1),
            "aqi_lag3":  round(aqi_arr[max(0,i-3)], 1),
            "next_day_risk_score": round(next_risk, 4),
        })

df = pd.DataFrame(rows)
df.to_csv("zone_training_data.csv", index=False)
print(f"Generated {len(df):,} city-day records across {len(CITIES)} cities")
print(f"Date range: {df.date.min()} → {df.date.max()}")
print(f"\nAvg risk by city:")
print(df.groupby("city")["next_day_risk_score"].mean().sort_values(ascending=False).round(3))
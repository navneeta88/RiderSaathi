"""
generate_data.py
Generates realistic synthetic training data for RiderSaathi risk model.

Features:
  - rainfall_mm       : 0–200 mm
  - temperature_c     : 20–48 °C
  - aqi               : 50–450
  - curfew_active     : 0 or 1
  - platform          : zomato=0, swiggy=1, zepto=2, amazon=3, dunzo=4
  - city_risk_index   : 0.0–1.0 (encoded city base risk)
  - hour_of_day       : 0–23
  - day_of_week       : 0–6

Target:
  - income_loss_pct   : 0.0–1.0  (fraction of weekly income lost)
"""

import numpy as np
import pandas as pd

np.random.seed(42)
N = 5000

# --- City base risk (higher = more disruption-prone) ---
CITIES = {
    "Delhi":     0.85,
    "Mumbai":    0.80,
    "Noida":     0.72,
    "Bengaluru": 0.55,
    "Hyderabad": 0.50,
    "Chennai":   0.60,
    "Kolkata":   0.75,
    "Pune":      0.48,
    "Jaipur":    0.65,
    "Lucknow":   0.70,
}
CITY_NAMES  = list(CITIES.keys())
CITY_RISKS  = list(CITIES.values())

city_idx       = np.random.randint(0, len(CITY_NAMES), N)
city_risk      = np.array([CITY_RISKS[i] for i in city_idx])

rainfall_mm    = np.random.exponential(20, N).clip(0, 200)
temperature_c  = np.random.normal(34, 6, N).clip(20, 48)
aqi            = np.random.exponential(120, N).clip(50, 450)
curfew_active  = (np.random.rand(N) < 0.05).astype(float)
platform       = np.random.randint(0, 5, N).astype(float)
hour_of_day    = np.random.randint(0, 24, N).astype(float)
day_of_week    = np.random.randint(0, 7, N).astype(float)

# --- Simulate income_loss_pct with realistic domain logic ---
loss = np.zeros(N)

# Rainfall contribution (non-linear: >80mm = severe)
loss += np.where(rainfall_mm > 80, 0.35, rainfall_mm / 80 * 0.15)

# Heat contribution (>42°C dangerous)
loss += np.where(temperature_c > 42, 0.20, np.maximum(0, (temperature_c - 35) / 7 * 0.12))

# AQI contribution (>300 = unsafe)
loss += np.where(aqi > 300, 0.22, np.maximum(0, (aqi - 150) / 150 * 0.10))

# Curfew = near-total loss
loss += curfew_active * 0.45

# City base risk
loss += city_risk * 0.10

# Night hours (10pm–5am) have lower baseline activity → higher relative loss
night_mask = ((hour_of_day >= 22) | (hour_of_day <= 5))
loss += night_mask.astype(float) * 0.04

# Weekends slightly less disruption-sensitive
weekend_mask = (day_of_week >= 5)
loss -= weekend_mask.astype(float) * 0.03

# Add realistic noise
loss += np.random.normal(0, 0.04, N)

# Clip to [0, 1]
loss = np.clip(loss, 0.0, 1.0)

df = pd.DataFrame({
    "rainfall_mm":    rainfall_mm,
    "temperature_c":  temperature_c,
    "aqi":            aqi,
    "curfew_active":  curfew_active,
    "platform":       platform,
    "city_risk_index": city_risk,
    "hour_of_day":    hour_of_day,
    "day_of_week":    day_of_week,
    "income_loss_pct": loss,
})

df.to_csv("training_data.csv", index=False)
print(f"Generated {N} training samples.")
print(df.describe().round(3))
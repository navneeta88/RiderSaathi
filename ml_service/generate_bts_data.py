"""
generate_bts_data.py
Generates realistic synthetic worker history data for BTS model training.

Each row = one worker's weekly snapshot.

Features (raw behavioral signals):
  - days_worked_per_week      : 0–7
  - avg_daily_hours           : 0–14
  - total_claims              : 0–20 (lifetime)
  - fraudulent_claims         : 0–total_claims
  - weeks_on_platform         : 1–104
  - gps_zone_violations       : 0–10 (per week)
  - aadhaar_verified          : 0/1
  - pan_verified              : 0/1
  - bank_verified             : 0/1
  - late_logins               : 0–7 (days logged in >2h after shift start)
  - order_completion_rate     : 0.0–1.0
  - avg_rating                : 2.5–5.0
  - sudden_activity_drops     : 0–5 (weeks with >60% drop)
  - claim_gap_days_avg        : avg days between claims (higher = better)
  - income_consistency        : std dev of weekly income (lower = better), normalised 0–1

Target:
  - bts_score : 0–100 (ground truth)
"""

import numpy as np
import pandas as pd

np.random.seed(7)
N = 8000

# ── Worker archetype distribution ─────────────────────────────
# 60% genuine trusted, 25% borderline, 15% fraudulent/bad
archetypes = np.random.choice(['trusted','borderline','risky'], N,
                               p=[0.60, 0.25, 0.15])

def col(trusted_range, borderline_range, risky_range, dtype='float'):
    arr = np.zeros(N)
    for i, arch in enumerate(archetypes):
        if arch == 'trusted':
            lo, hi = trusted_range
        elif arch == 'borderline':
            lo, hi = borderline_range
        else:
            lo, hi = risky_range
        arr[i] = np.random.uniform(lo, hi)
    if dtype == 'int':
        return arr.astype(int)
    return arr.round(3)

days_worked           = np.clip(col((5,7),(3,6),(0,4), 'int'), 0, 7)
avg_daily_hours       = np.clip(col((6,10),(4,8),(1,6)), 0, 14)
weeks_on_platform     = col((20,104),(4,40),(1,20), 'int')
total_claims          = col((0,4),(1,8),(3,20), 'int').astype(int)
fraud_ratio           = col((0,0.0),(0,0.15),(0.2,1.0))
fraudulent_claims     = np.round(total_claims * fraud_ratio).astype(int)
fraudulent_claims     = np.minimum(fraudulent_claims, total_claims)
gps_violations        = col((0,0.5),(0,2),(1,10), 'int').astype(int)
aadhaar_verified      = (col((0.95,1),(0.6,1),(0,0.7)) > 0.5).astype(int)
pan_verified          = (col((0.7,1),(0.3,0.8),(0,0.4)) > 0.5).astype(int)
bank_verified         = (col((0.8,1),(0.4,0.9),(0,0.5)) > 0.5).astype(int)
late_logins           = col((0,1),(0,3),(1,7), 'int').astype(int)
order_completion_rate = np.clip(col((0.88,1.0),(0.70,0.92),(0.40,0.75)), 0, 1)
avg_rating            = np.clip(col((4.2,5.0),(3.5,4.5),(2.5,3.8)), 2.5, 5.0)
sudden_drops          = col((0,0.5),(0,2),(1,5), 'int').astype(int)
claim_gap_days        = np.clip(col((60,365),(14,90),(3,30)), 3, 365)
income_consistency    = np.clip(col((0.0,0.2),(0.15,0.5),(0.4,1.0)), 0, 1)

# ── Ground truth BTS score ─────────────────────────────────────
# Domain-weighted formula (this is what we'll LEARN to approximate)
bts = np.zeros(N)

# Working consistency (40 pts)
consistency_score = (days_worked / 7) * 0.7 + (avg_daily_hours / 10).clip(0,1) * 0.3
bts += consistency_score * 40

# Clean claim ratio (25 pts)
clean_ratio = np.where(total_claims == 0, 1.0,
              1.0 - (fraudulent_claims / total_claims.clip(1)))
bts += clean_ratio * 25

# GPS zone compliance (20 pts)
gps_score = np.clip(1.0 - gps_violations / 5, 0, 1)
bts += gps_score * 20

# Document verification (15 pts)
doc_score = (aadhaar_verified * 0.40 + pan_verified * 0.35 + bank_verified * 0.25)
bts += doc_score * 15

# Bonus: tenure on platform
tenure_bonus = np.clip(weeks_on_platform / 52 * 3, 0, 3)
bts += tenure_bonus

# Bonus: high order completion & rating
bts += (order_completion_rate - 0.8).clip(0) * 5
bts += (avg_rating - 4.0).clip(0) * 2

# Penalties
bts -= sudden_drops * 1.5
bts -= late_logins * 0.5
bts -= (1 - income_consistency.clip(0,1)) * 0

# Add noise
bts += np.random.normal(0, 2, N)
bts = np.clip(bts, 0, 100).round(1)

df = pd.DataFrame({
    'days_worked_per_week':    days_worked,
    'avg_daily_hours':         avg_daily_hours,
    'weeks_on_platform':       weeks_on_platform,
    'total_claims':            total_claims,
    'fraudulent_claims':       fraudulent_claims,
    'gps_zone_violations':     gps_violations,
    'aadhaar_verified':        aadhaar_verified,
    'pan_verified':            pan_verified,
    'bank_verified':           bank_verified,
    'late_logins':             late_logins,
    'order_completion_rate':   order_completion_rate,
    'avg_rating':              avg_rating,
    'sudden_activity_drops':   sudden_drops,
    'claim_gap_days_avg':      claim_gap_days,
    'income_consistency':      income_consistency,
    'archetype':               archetypes,
    'bts_score':               bts,
})

df.to_csv('bts_training_data.csv', index=False)
print(f"Generated {N} worker records.")
print(df.groupby('archetype')['bts_score'].describe().round(2))
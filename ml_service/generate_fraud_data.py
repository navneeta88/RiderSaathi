"""
generate_fraud_data.py
Generates synthetic claim-level data for Isolation Forest fraud detection.

Each row = one claim submission event.

Signal categories (multi-layer detection):

  LOCATION SIGNALS
  - gps_lat / gps_lng               : claim location
  - registered_zone_dist_km         : distance from worker's registered zone
  - ip_location_dist_km             : distance between GPS and IP-derived location
  - location_jump_km                : distance from previous GPS ping (last 10 min)
  - is_vpn                          : 1 if VPN/proxy detected

  TEMPORAL SIGNALS
  - hour_of_claim                   : 0–23
  - days_since_last_claim           : 0–365
  - claims_this_week                : 0–7
  - claim_during_event              : 1 if filed during active disruption window

  ACTIVITY SIGNALS
  - orders_last_24h                 : deliveries in last 24 hours
  - activity_drop_pct               : % drop vs personal 4-week average
  - device_motion_score             : 0–1 (1 = accelerometer matches claimed movement)
  - app_session_minutes             : time in app during claim period

  BEHAVIORAL SIGNALS
  - bts_score                       : current BTS (from BTS engine)
  - claim_amount_vs_avg             : ratio of this claim to worker's average
  - duplicate_ip_count              : other workers claiming from same IP
  - network_cluster_size            : fraud graph cluster size (1 = isolated)

Target:
  - is_fraud : 0 (genuine) or 1 (fraudulent)
"""

import numpy as np
import pandas as pd

np.random.seed(99)
N = 12000
FRAUD_RATE = 0.12   # 12% fraud in training data

n_fraud   = int(N * FRAUD_RATE)
n_genuine = N - n_fraud

def sample(lo, hi, n, noise=0.05):
    base = np.random.uniform(lo, hi, n)
    return base + np.random.normal(0, (hi - lo) * noise, n)

# ── GENUINE CLAIMS ─────────────────────────────────────────────
g = n_genuine
genuine = pd.DataFrame({
    "registered_zone_dist_km": np.abs(sample(0, 2.5, g)),
    "ip_location_dist_km":     np.abs(sample(0, 4.0, g)),
    "location_jump_km":        np.abs(sample(0, 3.0, g)),
    "is_vpn":                  (np.random.rand(g) < 0.02).astype(float),
    "hour_of_claim":           np.random.choice(
                                   list(range(7,22)), g,
                                   p=[0.04,0.07,0.09,0.11,0.12,0.12,
                                      0.11,0.10,0.08,0.07,0.05,0.02,0.01,0.005,0.005]),
    "days_since_last_claim":   np.clip(np.random.exponential(60, g), 3, 365),
    "claims_this_week":        np.random.choice([0,1,2], g, p=[0.65,0.28,0.07]),
    "claim_during_event":      (np.random.rand(g) < 0.80).astype(float),
    "orders_last_24h":         np.clip(np.random.normal(12, 4, g), 0, 35),
    "activity_drop_pct":       np.clip(np.random.normal(55, 15, g), 10, 95),
    "device_motion_score":     np.clip(np.random.normal(0.85, 0.08, g), 0, 1),
    "app_session_minutes":     np.clip(np.random.normal(45, 15, g), 5, 120),
    "bts_score":               np.clip(np.random.normal(82, 9, g), 40, 100),
    "claim_amount_vs_avg":     np.clip(np.random.normal(1.0, 0.15, g), 0.5, 2.0),
    "duplicate_ip_count":      np.random.choice([1,2], g, p=[0.95, 0.05]),
    "network_cluster_size":    np.random.choice([1,2,3], g, p=[0.88, 0.09, 0.03]),
    "is_fraud": 0,
})

# ── FRAUDULENT CLAIMS ──────────────────────────────────────────
f = n_fraud

# Mix of fraud archetypes
arch = np.random.choice(
    ['gps_spoof','coord_ring','serial_claimer','vpn_fake','bot_flood'],
    f, p=[0.30, 0.25, 0.20, 0.15, 0.10]
)

fraud = pd.DataFrame({
    "registered_zone_dist_km": np.where(arch == 'gps_spoof',
        np.abs(sample(8, 40, f)),
        np.abs(sample(0, 5, f))),
    "ip_location_dist_km": np.where(arch == 'vpn_fake',
        np.abs(sample(50, 500, f)),
        np.abs(sample(5, 30, f))),
    "location_jump_km": np.where(arch == 'gps_spoof',
        np.abs(sample(15, 80, f)),
        np.abs(sample(0, 6, f))),
    "is_vpn": np.where(arch == 'vpn_fake', 1.0,
        (np.random.rand(f) < 0.25).astype(float)),
    "hour_of_claim": np.where(arch == 'bot_flood',
        np.random.randint(0, 6, f),         # bots work at night
        np.random.randint(0, 24, f)).astype(float),
    "days_since_last_claim": np.where(arch == 'serial_claimer',
        np.clip(np.random.exponential(4, f), 1, 14),
        np.clip(np.random.exponential(20, f), 1, 60)),
    "claims_this_week": np.where(arch == 'serial_claimer',
        np.random.choice([3,4,5,6,7], f),
        np.random.choice([2,3,4], f)).astype(float),
    "claim_during_event": (np.random.rand(f) < 0.45).astype(float),  # often no real event
    "orders_last_24h": np.where(arch == 'gps_spoof',
        np.clip(np.random.normal(1, 1, f), 0, 4),    # no real work
        np.clip(np.random.normal(5, 3, f), 0, 12)),
    "activity_drop_pct": np.where(arch == 'gps_spoof',
        np.clip(np.random.normal(15, 8, f), 0, 40),  # no drop = no real disruption
        np.clip(np.random.normal(30, 15, f), 5, 70)),
    "device_motion_score": np.where(arch == 'gps_spoof',
        np.clip(np.random.normal(0.15, 0.10, f), 0, 0.4),
        np.clip(np.random.normal(0.45, 0.15, f), 0, 0.7)),
    "app_session_minutes": np.clip(np.random.normal(8, 5, f), 0, 30),
    "bts_score": np.clip(np.random.normal(38, 18, f), 0, 75),
    "claim_amount_vs_avg": np.clip(np.random.normal(1.6, 0.4, f), 0.8, 3.5),
    "duplicate_ip_count": np.where(arch == 'coord_ring',
        np.random.choice([5,8,12,20], f),
        np.random.choice([1,2,3], f)).astype(float),
    "network_cluster_size": np.where(arch == 'coord_ring',
        np.random.choice([8,15,25,40], f),
        np.random.choice([2,4,6], f)).astype(float),
    "is_fraud": 1,
})
fraud["fraud_archetype"] = arch

genuine["fraud_archetype"] = "genuine"

df = pd.concat([genuine, fraud], ignore_index=True).sample(frac=1, random_state=42)
df.to_csv("fraud_training_data.csv", index=False)

print(f"Generated {len(df)} claim records ({n_fraud} fraud, {n_genuine} genuine)")
print(f"Fraud rate: {n_fraud/len(df)*100:.1f}%")
print(f"\nFraud archetype distribution:")
print(df[df.is_fraud==1]['fraud_archetype'].value_counts())
print(f"\nFeature stats by label:")
features = ["registered_zone_dist_km","location_jump_km","device_motion_score","claims_this_week","bts_score"]
print(df.groupby('is_fraud')[features].mean().round(2))
"""
app.py  —  RiderSaathi ML Service
Exposes the Linear Regression risk model and BTS scoring engine as REST APIs.

Endpoints:
  POST /predict            Single risk + premium prediction
  POST /predict/batch      Batch risk predictions
  GET  /model/info         Risk model metadata & feature importances

  POST /bts/score          Compute BTS score for a worker
  POST /bts/score/batch    Batch BTS scoring
  POST /bts/update         Simulate weekly BTS update (delta + decay)
  GET  /bts/model/info     BTS model metadata & feature importances

  GET  /health             Health check (both models)
"""

import json
import pickle
import os
import numpy as np
from flask import Flask, request, jsonify

try:
    from flask_cors import CORS
    _cors_available = True
except ImportError:
    _cors_available = False

app = Flask(__name__)
if _cors_available:
    CORS(app)

# ── Load risk model ────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, "risk_model.pkl"),      "rb") as f: model  = pickle.load(f)
with open(os.path.join(BASE_DIR, "scaler.pkl"),          "rb") as f: scaler = pickle.load(f)
with open(os.path.join(BASE_DIR, "model_metadata.json"), "r") as f: metadata = json.load(f)

# ── Load BTS model ─────────────────────────────────────────────
with open(os.path.join(BASE_DIR, "bts_model.pkl"),   "rb") as f: bts_model  = pickle.load(f)
with open(os.path.join(BASE_DIR, "bts_scaler.pkl"),  "rb") as f: bts_scaler = pickle.load(f)
with open(os.path.join(BASE_DIR, "bts_metadata.json"), "r") as f: bts_meta  = json.load(f)

FEATURES = metadata["features"]

# City name → risk index mapping
CITY_RISK = {
    "Delhi":     0.85, "Mumbai":    0.80, "Noida":     0.72,
    "Bengaluru": 0.55, "Hyderabad": 0.50, "Chennai":   0.60,
    "Kolkata":   0.75, "Pune":      0.48, "Jaipur":    0.65,
    "Lucknow":   0.70,
}
DEFAULT_CITY_RISK = 0.65  # fallback for unknown city

# Platform name → int
PLATFORM_MAP = {
    "zomato": 0, "swiggy": 1, "zepto": 2,
    "amazon": 3, "dunzo": 4,
}

# BTS → premium tier
BTS_TIERS = [
    (90, 100, 15),
    (80,  89, 25),
    (70,  79, 40),
    (60,  69, 60),
    (0,   59, 100),
]

def bts_to_premium(bts: float) -> int:
    for lo, hi, p in BTS_TIERS:
        if lo <= bts <= hi:
            return p
    return 100


def parse_features(data: dict) -> np.ndarray:
    """Extract and validate feature vector from request payload."""
    city_raw  = str(data.get("city", "")).strip().title()
    plat_raw  = str(data.get("platform", "")).strip().lower()

    city_risk = CITY_RISK.get(city_raw, DEFAULT_CITY_RISK)
    platform  = float(PLATFORM_MAP.get(plat_raw, 2))  # default zepto=2

    vec = [
        float(data.get("rainfall_mm",   0)),
        float(data.get("temperature_c", 32)),
        float(data.get("aqi",           100)),
        float(bool(data.get("curfew_active", False))),
        platform,
        city_risk,
        float(data.get("hour_of_day",   12)),
        float(data.get("day_of_week",   2)),
    ]
    return np.array(vec).reshape(1, -1), city_risk


def build_prediction(raw_input: dict, weekly_income: float, bts: float = 85.0) -> dict:
    """Run the model and compute final premium."""
    vec, city_risk = parse_features(raw_input)

    scaled = scaler.transform(vec)
    loss_pct = float(np.clip(model.predict(scaled)[0], 0.0, 1.0))

    # Risk probability: scale loss_pct to a 0–100 probability
    risk_probability = round(min(loss_pct * 1.8 * 100, 99), 1)

    # Raw risk premium  = income × loss% × risk_prob × margin
    margin          = 1.20
    raw_premium     = weekly_income * loss_pct * (risk_probability / 100) * margin

    # BTS-adjusted final premium
    final_premium   = bts_to_premium(bts)

    # Expected payout = 40% of weekly income
    payout          = round(weekly_income * 0.40)

    # Determine risk level label
    if loss_pct >= 0.40:
        risk_level = "high"
    elif loss_pct >= 0.20:
        risk_level = "medium"
    else:
        risk_level = "low"

    # Dominant trigger explanation
    triggers_fired = []
    if raw_input.get("curfew_active"):
        triggers_fired.append("curfew_active")
    if float(raw_input.get("rainfall_mm", 0)) > 80:
        triggers_fired.append("heavy_rainfall")
    if float(raw_input.get("temperature_c", 0)) > 42:
        triggers_fired.append("extreme_heat")
    if float(raw_input.get("aqi", 0)) > 300:
        triggers_fired.append("high_aqi")

    return {
        "risk": {
            "income_loss_pct":   round(loss_pct * 100, 2),
            "risk_probability":  risk_probability,
            "risk_level":        risk_level,
            "city_risk_index":   round(city_risk, 2),
            "triggers_fired":    triggers_fired,
        },
        "premium": {
            "raw_risk_premium":  round(raw_premium),
            "bts_score":         round(bts, 1),
            "final_premium_inr": final_premium,
            "expected_payout_inr": payout,
            "weekly_income_inr": int(weekly_income),
        },
        "formula": {
            "income_loss_pct":   f"{round(loss_pct * 100, 1)}%",
            "risk_probability":  f"{risk_probability}%",
            "margin":            "20%",
            "bts_tier":          f"BTS {round(bts)} → ₹{final_premium}/week",
        },
        "model": "LinearRegression",
    }


# ── Routes ─────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
        return jsonify({
        "status": "ok",
        "models": {
            "risk_model": "LinearRegression",
            "bts_model": "GradientBoostingRegressor"
        },
        "risk_features": len(FEATURES),
        "bts_features": len(bts_meta["features"])
    })

@app.route("/model/info", methods=["GET"])
def model_info():
    coefficients = metadata["coefficients"]
    max_abs = max(abs(v) for v in coefficients.values()) or 1
    importances = [
        {
            "feature":      k,
            "coefficient":  v,
            "importance_pct": round(abs(v) / max_abs * 100, 1),
        }
        for k, v in sorted(coefficients.items(), key=lambda x: abs(x[1]), reverse=True)
    ]
    return jsonify({
        "model_type":    metadata["model_type"],
        "features":      FEATURES,
        "metrics":       metadata["metrics"],
        "cv_r2":         metadata["cv_r2"],
        "train_samples": metadata["train_samples"],
        "importances":   importances,
        "cities":        CITY_RISK,
        "bts_tiers":     [{"min": lo, "max": hi, "premium_inr": p} for lo, hi, p in BTS_TIERS],
    })


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    weekly_income = float(data.get("weekly_income", 4000))
    bts           = float(data.get("bts",           85.0))

    if weekly_income <= 0:
        return jsonify({"error": "weekly_income must be > 0"}), 400

    result = build_prediction(data, weekly_income, bts)
    return jsonify(result)


@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    data = request.get_json(force=True)
    if not isinstance(data, list):
        return jsonify({"error": "Provide a JSON array of prediction requests"}), 400

    results = []
    for item in data[:50]:  # cap at 50
        wi  = float(item.get("weekly_income", 4000))
        bts = float(item.get("bts", 85.0))
        try:
            results.append({"input": item, "result": build_prediction(item, wi, bts)})
        except Exception as e:
            results.append({"input": item, "error": str(e)})

    return jsonify({"count": len(results), "predictions": results})


if __name__ == "__main__":
    print("RiderSaathi ML Service running on http://localhost:5001")
    print(f"Model R²: {metadata['metrics']['linear_regression']['r2']}")
    app.run(port=5001, debug=True)


# ══════════════════════════════════════════════════════════════
#  BTS ENGINE
# ══════════════════════════════════════════════════════════════

BTS_FEATURES = bts_meta["features"]

def tier_from_score(score: float) -> dict:
    for t in bts_meta["bts_tiers"]:
        if t["min"] <= score <= t["max"]:
            return t
    return bts_meta["bts_tiers"][-1]


def score_worker(data: dict) -> dict:
    """Run BTS model on a worker's behavioral data."""
    vec = np.array([
        float(data.get("days_worked_per_week",    5)),
        float(data.get("avg_daily_hours",         7)),
        float(data.get("weeks_on_platform",       12)),
        float(data.get("total_claims",             2)),
        float(data.get("fraudulent_claims",        0)),
        float(data.get("gps_zone_violations",      0)),
        float(bool(data.get("aadhaar_verified",    True))),
        float(bool(data.get("pan_verified",        False))),
        float(bool(data.get("bank_verified",       False))),
        float(data.get("late_logins",              0)),
        float(data.get("order_completion_rate",    0.90)),
        float(data.get("avg_rating",               4.2)),
        float(data.get("sudden_activity_drops",    0)),
        float(data.get("claim_gap_days_avg",       60)),
        float(data.get("income_consistency",       0.2)),
    ]).reshape(1, -1)

    scaled = bts_scaler.transform(vec)
    score  = float(np.clip(bts_model.predict(scaled)[0], 0, 100))
    tier   = tier_from_score(score)

    # Breakdown: rule-based sub-scores for explainability
    days         = float(data.get("days_worked_per_week", 5))
    hours        = float(data.get("avg_daily_hours", 7))
    total_c      = max(float(data.get("total_claims", 2)), 1e-9)
    fraud_c      = float(data.get("fraudulent_claims", 0))
    gps_viol     = float(data.get("gps_zone_violations", 0))
    aadhaar      = float(bool(data.get("aadhaar_verified", True)))
    pan          = float(bool(data.get("pan_verified", False)))
    bank         = float(bool(data.get("bank_verified", False)))
    drops        = float(data.get("sudden_activity_drops", 0))
    late         = float(data.get("late_logins", 0))
    ocr          = float(data.get("order_completion_rate", 0.90))
    rating       = float(data.get("avg_rating", 4.2))

    consistency_pts = round(((days / 7) * 0.7 + min(hours / 10, 1) * 0.3) * 40, 1)
    claim_pts       = round((1 - fraud_c / total_c) * 25, 1)
    gps_pts         = round(max(0, 1 - gps_viol / 5) * 20, 1)
    doc_pts         = round((aadhaar * 0.4 + pan * 0.35 + bank * 0.25) * 15, 1)

    flags = []
    if fraud_c / total_c > 0.3:      flags.append("high_fraud_ratio")
    if gps_viol >= 3:                 flags.append("frequent_gps_violations")
    if drops >= 3:                    flags.append("sudden_activity_drops")
    if late >= 4:                     flags.append("persistent_late_logins")
    if not aadhaar:                   flags.append("aadhaar_unverified")
    if ocr < 0.70:                    flags.append("low_order_completion")
    if rating < 3.5:                  flags.append("low_rating")

    return {
        "bts_score":      round(score, 1),
        "tier":           tier["label"],
        "premium_inr":    tier["premium_inr"],
        "breakdown": {
            "working_consistency": {"score": consistency_pts, "max": 40, "weight": "40%"},
            "clean_claim_ratio":   {"score": claim_pts,       "max": 25, "weight": "25%"},
            "gps_compliance":      {"score": gps_pts,         "max": 20, "weight": "20%"},
            "document_verified":   {"score": doc_pts,         "max": 15, "weight": "15%"},
        },
        "flags":          flags,
        "model":          "GradientBoostingRegressor",
    }


@app.route("/bts/score", methods=["POST"])
def bts_score():
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "No JSON body"}), 400
    return jsonify(score_worker(data))


@app.route("/bts/score/batch", methods=["POST"])
def bts_score_batch():
    data = request.get_json(force=True)
    if not isinstance(data, list):
        return jsonify({"error": "Provide a JSON array of worker objects"}), 400
    results = []
    for worker in data[:100]:
        try:
            results.append({
                "worker_id": worker.get("worker_id", "unknown"),
                "result": score_worker(worker),
            })
        except Exception as e:
            results.append({"worker_id": worker.get("worker_id"), "error": str(e)})
    return jsonify({"count": len(results), "scores": results})


@app.route("/bts/update", methods=["POST"])
def bts_update():
    """
    Simulate a weekly BTS update using exponential decay + new-week delta.
    Mimics a production system that re-scores every 7 days.

    Body:
      current_bts      : float   current score (required)
      worker_data      : dict    this week's behavioral signals (required)
      decay_factor     : float   0.0–1.0, default 0.85 (weight for new score)
    """
    data         = request.get_json(force=True)
    current_bts  = float(data.get("current_bts", 80))
    worker_data  = data.get("worker_data", {})
    decay        = float(data.get("decay_factor", 0.85))  # how much new week matters

    if not worker_data:
        return jsonify({"error": "worker_data is required"}), 400

    new_result   = score_worker(worker_data)
    new_score    = new_result["bts_score"]

    # Weighted blend: (1-decay) × old + decay × new
    blended      = round((1 - decay) * current_bts + decay * new_score, 1)
    blended      = float(np.clip(blended, 0, 100))
    delta        = round(blended - current_bts, 1)
    direction    = "improved" if delta > 0.5 else "declined" if delta < -0.5 else "stable"

    tier         = tier_from_score(blended)

    return jsonify({
        "previous_bts":   round(current_bts, 1),
        "new_week_bts":   new_score,
        "updated_bts":    blended,
        "delta":          delta,
        "direction":      direction,
        "tier":           tier["label"],
        "premium_inr":    tier["premium_inr"],
        "decay_factor":   decay,
        "breakdown":      new_result["breakdown"],
        "flags":          new_result["flags"],
    })


@app.route("/bts/model/info", methods=["GET"])
def bts_model_info():
    fi = bts_meta["feature_importances"]
    max_fi = max(fi.values()) or 1
    importances = [
        {"feature": k, "importance": v, "importance_pct": round(v / max_fi * 100, 1)}
        for k, v in sorted(fi.items(), key=lambda x: x[1], reverse=True)
    ]
    return jsonify({
        "model_type":    bts_meta["model_type"],
        "features":      BTS_FEATURES,
        "metrics":       bts_meta["metrics"],
        "cv_r2":         bts_meta["cv_r2"],
        "train_samples": bts_meta["train_samples"],
        "importances":   importances,
        "bts_tiers":     bts_meta["bts_tiers"],
    })


# ── Health (updated to show both models) ──────────────────────




# ══════════════════════════════════════════════════════════════
#  FRAUD DETECTION ENGINE
# ══════════════════════════════════════════════════════════════

with open(os.path.join(BASE_DIR, "fraud_iforest.pkl"),  "rb") as f: fraud_iforest = pickle.load(f)
with open(os.path.join(BASE_DIR, "fraud_clf.pkl"),      "rb") as f: fraud_clf     = pickle.load(f)
with open(os.path.join(BASE_DIR, "fraud_scaler.pkl"),   "rb") as f: fraud_scaler  = pickle.load(f)
with open(os.path.join(BASE_DIR, "fraud_metadata.json"),"r")  as f: fraud_meta    = json.load(f)

FRAUD_FEATURES = fraud_meta["features"]
IF_LO = fraud_meta["if_score_range"]["lo"]
IF_HI = fraud_meta["if_score_range"]["hi"]
W_IF  = fraud_meta["weights"]["isolation_forest"]
W_CLF = fraud_meta["weights"]["classifier"]

FRAUD_RULES = [
    ("gps_spoof",      lambda d: d["registered_zone_dist_km"] > 10 or d["location_jump_km"] > 20),
    ("vpn_detected",   lambda d: d["is_vpn"]),
    ("coord_ring",     lambda d: d["network_cluster_size"] > 5 or d["duplicate_ip_count"] > 4),
    ("serial_claimer", lambda d: d["claims_this_week"] >= 4 or d["days_since_last_claim"] < 5),
    ("no_disruption",  lambda d: not d["claim_during_event"] and d["orders_last_24h"] > 0),
    ("bot_pattern",    lambda d: d["hour_of_claim"] < 5 and d["app_session_minutes"] < 5),
    ("motion_mismatch",lambda d: d["device_motion_score"] < 0.25),
    ("low_activity",   lambda d: d["orders_last_24h"] < 2 and d["activity_drop_pct"] < 20),
]

def _norm_if(raw_score):
    return float(np.clip((raw_score - IF_LO) / (IF_HI - IF_LO + 1e-9), 0, 1))

def _trust_score(if_norm, clf_fraud_proba):
    return float(W_IF * if_norm + W_CLF * (1.0 - clf_fraud_proba))

def _decide(ts):
    if ts > 0.75: return "approve"
    if ts > 0.50: return "review"
    return "reject"


def check_claim(data: dict) -> dict:
    """Run full 3-layer fraud detection on a single claim event."""

    d = {
        "registered_zone_dist_km": float(data.get("registered_zone_dist_km", 1.0)),
        "ip_location_dist_km":     float(data.get("ip_location_dist_km",     2.0)),
        "location_jump_km":        float(data.get("location_jump_km",        1.0)),
        "is_vpn":                  float(bool(data.get("is_vpn", False))),
        "hour_of_claim":           float(data.get("hour_of_claim",          13)),
        "days_since_last_claim":   float(data.get("days_since_last_claim",  45)),
        "claims_this_week":        float(data.get("claims_this_week",        1)),
        "claim_during_event":      float(bool(data.get("claim_during_event", True))),
        "orders_last_24h":         float(data.get("orders_last_24h",        10)),
        "activity_drop_pct":       float(data.get("activity_drop_pct",      50)),
        "device_motion_score":     float(data.get("device_motion_score",   0.85)),
        "app_session_minutes":     float(data.get("app_session_minutes",    40)),
        "bts_score":               float(data.get("bts_score",             80)),
        "claim_amount_vs_avg":     float(data.get("claim_amount_vs_avg",   1.0)),
        "duplicate_ip_count":      float(data.get("duplicate_ip_count",     1)),
        "network_cluster_size":    float(data.get("network_cluster_size",   1)),
    }

    vec    = np.array([d[f] for f in FRAUD_FEATURES]).reshape(1, -1)
    vec_s  = fraud_scaler.transform(vec)

    # Layer 1: Isolation Forest
    if_raw   = fraud_iforest.score_samples(vec_s)[0]
    if_norm  = _norm_if(if_raw)
    if_label = "normal" if fraud_iforest.predict(vec_s)[0] == 1 else "anomaly"

    # Layer 2: Supervised classifier
    clf_proba     = float(fraud_clf.predict_proba(vec_s)[0, 1])
    clf_label     = "fraud" if clf_proba > 0.5 else "genuine"

    # Layer 3: Ensemble trust score
    ts       = _trust_score(if_norm, clf_proba)
    decision = _decide(ts)

    # Rule-based signal flags
    flags_fired = [name for name, rule in FRAUD_RULES if rule(d)]

    # Signal-level breakdown (for explainability)
    signals = {
        "location": {
            "zone_distance_km":  d["registered_zone_dist_km"],
            "ip_distance_km":    d["ip_location_dist_km"],
            "jump_km":           d["location_jump_km"],
            "vpn_detected":      bool(d["is_vpn"]),
            "risk": "high" if d["registered_zone_dist_km"] > 10 or d["location_jump_km"] > 20 else
                    "medium" if d["registered_zone_dist_km"] > 4 else "low",
        },
        "temporal": {
            "claims_this_week":        int(d["claims_this_week"]),
            "days_since_last_claim":   d["days_since_last_claim"],
            "claim_during_event":      bool(d["claim_during_event"]),
            "risk": "high" if d["claims_this_week"] >= 4 else
                    "medium" if d["claims_this_week"] >= 2 else "low",
        },
        "activity": {
            "orders_last_24h":     d["orders_last_24h"],
            "activity_drop_pct":   d["activity_drop_pct"],
            "device_motion_score": round(d["device_motion_score"], 3),
            "risk": "high" if d["device_motion_score"] < 0.25 else
                    "medium" if d["device_motion_score"] < 0.55 else "low",
        },
        "behavioral": {
            "bts_score":            d["bts_score"],
            "claim_amount_vs_avg":  round(d["claim_amount_vs_avg"], 2),
            "network_cluster_size": int(d["network_cluster_size"]),
            "duplicate_ip_count":   int(d["duplicate_ip_count"]),
            "risk": "high" if d["bts_score"] < 50 or d["network_cluster_size"] > 5 else
                    "medium" if d["bts_score"] < 70 else "low",
        },
    }

    return {
        "decision":    decision,
        "trust_score": round(ts, 4),
        "layers": {
            "isolation_forest": {
                "raw_score":    round(float(if_raw), 4),
                "norm_score":   round(if_norm, 4),
                "label":        if_label,
            },
            "classifier": {
                "fraud_probability": round(clf_proba, 4),
                "label":             clf_label,
            },
        },
        "flags":   flags_fired,
        "signals": signals,
        "message": {
            "approve": "Claim verified. Payout authorised.",
            "review":  "Claim flagged for manual verification.",
            "reject":  "Claim rejected: fraud indicators detected.",
        }[decision],
    }


@app.route("/fraud/check", methods=["POST"])
def fraud_check():
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "No JSON body"}), 400
    return jsonify(check_claim(data))


@app.route("/fraud/check/batch", methods=["POST"])
def fraud_check_batch():
    data = request.get_json(force=True)
    if not isinstance(data, list):
        return jsonify({"error": "Provide a JSON array of claim events"}), 400
    results = []
    for claim in data[:100]:
        try:
            results.append({
                "claim_id": claim.get("claim_id", "unknown"),
                "result":   check_claim(claim),
            })
        except Exception as e:
            results.append({"claim_id": claim.get("claim_id"), "error": str(e)})
    summary = {
        "approve": sum(1 for r in results if r.get("result", {}).get("decision") == "approve"),
        "review":  sum(1 for r in results if r.get("result", {}).get("decision") == "review"),
        "reject":  sum(1 for r in results if r.get("result", {}).get("decision") == "reject"),
    }
    return jsonify({"count": len(results), "summary": summary, "results": results})


@app.route("/fraud/model/info", methods=["GET"])
def fraud_model_info():
    fi = fraud_meta["feature_importances"]
    max_fi = max(fi.values()) or 1
    importances = [
        {"feature": k, "importance": v, "importance_pct": round(v / max_fi * 100, 1)}
        for k, v in sorted(fi.items(), key=lambda x: x[1], reverse=True)
    ]
    return jsonify({
        "model_layers":     fraud_meta["model_layers"],
        "weights":          fraud_meta["weights"],
        "thresholds":       fraud_meta["thresholds"],
        "metrics":          fraud_meta["metrics"],
        "confusion_matrix": fraud_meta["confusion_matrix"],
        "features":         FRAUD_FEATURES,
        "importances":      importances,
        "fraud_archetypes": fraud_meta["fraud_archetypes"],
    })



# ══════════════════════════════════════════════════════════════
#  TRUST SCORE ENGINE  —  unified claim decision layer
# ══════════════════════════════════════════════════════════════

# ── Trust model — graceful fallback if not yet trained ────────
trust_model = trust_calibrator = trust_scaler = trust_meta = None
TRUST_FEATURES = []
try:
    with open(os.path.join(BASE_DIR, "trust_model.pkl"),      "rb") as f: trust_model      = pickle.load(f)
    with open(os.path.join(BASE_DIR, "trust_calibrator.pkl"), "rb") as f: trust_calibrator = pickle.load(f)
    with open(os.path.join(BASE_DIR, "trust_scaler.pkl"),     "rb") as f: trust_scaler     = pickle.load(f)
    with open(os.path.join(BASE_DIR, "trust_metadata.json"),  "r")  as f: trust_meta       = json.load(f)
    TRUST_FEATURES = trust_meta["features"]
    print("[Trust Engine] ✅ Loaded trust model")
except FileNotFoundError as _te:
    print(f"[Trust Engine] ⚠️  Trust model files not found — run train_trust_engine.py to generate them.")
    print("[Trust Engine]    /claim/evaluate will return a fallback heuristic response until models are present.")

# Grace buffer: a single low-trust flag never auto-rejects a high-BTS worker
GRACE_BTS_THRESHOLD  = 80.0   # workers above this get a review instead of reject
GRACE_TRUST_MINIMUM  = 0.38   # floor below which grace doesn't apply

# Appeal reasons that can be submitted
VALID_APPEAL_REASONS = {
    "network_outage", "device_issue", "gps_error",
    "new_location", "weather_emergency", "false_vpn_detection",
}


def _risk_level_to_float(level: str) -> float:
    return {"low": 0.0, "medium": 1.0, "high": 2.0}.get(level, 0.0)


def evaluate_claim(data: dict) -> dict:
    """
    Full pipeline:
      1. Extract / call risk model outputs
      2. Extract / call BTS outputs
      3. Extract / call fraud detector outputs
      4. Feed all into Trust Score meta-model
      5. Apply grace buffer for high-BTS workers
      6. Emit structured decision with full audit trail
    """

    # ── 1. Risk model inputs (accept pre-computed or raw) ──────
    income_loss_pct      = float(data.get("income_loss_pct",     0.30))
    risk_probability     = float(data.get("risk_probability",    50.0))
    city_risk_index      = float(data.get("city_risk_index",     0.65))
    curfew_active        = float(bool(data.get("curfew_active",  False)))
    triggers_fired       = data.get("triggers_fired", [])
    triggers_fired_count = float(len(triggers_fired) if isinstance(triggers_fired, list)
                                 else data.get("triggers_fired_count", 0))

    # ── 2. BTS inputs ─────────────────────────────────────────
    bts_score          = float(data.get("bts_score",          80.0))
    consistency_pts    = float(data.get("consistency_pts",    round(bts_score / 100 * 40, 1)))
    clean_claim_pts    = float(data.get("clean_claim_pts",    round(bts_score / 100 * 25, 1)))
    gps_compliance_pts = float(data.get("gps_compliance_pts", round(bts_score / 100 * 20, 1)))
    doc_pts            = float(data.get("doc_pts",            round(bts_score / 100 * 15, 1)))
    bts_flags          = data.get("bts_flags", [])
    bts_flags_count    = float(len(bts_flags) if isinstance(bts_flags, list)
                               else data.get("bts_flags_count", 0))

    # ── 3. Fraud detector inputs ───────────────────────────────
    if_norm_score    = float(data.get("if_norm_score",    0.85))
    clf_fraud_proba  = float(data.get("clf_fraud_proba",  0.02))
    fraud_flags      = data.get("fraud_flags", [])
    fraud_flags_count= float(len(fraud_flags) if isinstance(fraud_flags, list)
                             else data.get("fraud_flags_count", 0))
    location_risk    = _risk_level_to_float(data.get("location_risk",  "low"))
    temporal_risk    = _risk_level_to_float(data.get("temporal_risk",  "low"))
    activity_risk    = _risk_level_to_float(data.get("activity_risk",  "low"))
    behavioral_risk  = _risk_level_to_float(data.get("behavioral_risk","low"))

    # ── 4. Build feature vector and score ─────────────────────
    vec = np.array([
        income_loss_pct, risk_probability, city_risk_index,
        curfew_active, triggers_fired_count,
        bts_score, consistency_pts, clean_claim_pts,
        gps_compliance_pts, doc_pts, bts_flags_count,
        if_norm_score, clf_fraud_proba, fraud_flags_count,
        location_risk, temporal_risk, activity_risk, behavioral_risk,
    ]).reshape(1, -1)

    # If trust model not yet trained, use heuristic fallback
    if trust_model is None or trust_scaler is None or trust_calibrator is None:
        # Heuristic: combine fraud, bts, and risk signals
        fraud_penalty = clf_fraud_proba * 0.5 + (1 - if_norm_score) * 0.3
        bts_bonus     = (bts_score / 100) * 0.4
        ts_cal  = float(np.clip(0.5 + bts_bonus - fraud_penalty, 0.0, 1.0))
        ts_raw  = ts_cal
    else:
        vec_s   = trust_scaler.transform(vec)
        ts_raw  = float(np.clip(trust_model.predict(vec_s)[0], 0, 1))
        ts_cal  = float(trust_calibrator.transform(np.array([ts_raw]))[0])
        ts_cal  = float(np.clip(ts_cal, 0.0, 1.0))

    # ── 5. Grace buffer ────────────────────────────────────────
    raw_decision = ("approve" if ts_cal > 0.75
                    else "review" if ts_cal > 0.50
                    else "reject")
    grace_applied = False

    if (raw_decision == "reject"
            and bts_score >= GRACE_BTS_THRESHOLD
            and ts_cal >= GRACE_TRUST_MINIMUM):
        final_decision = "review"
        grace_applied  = True
    else:
        final_decision = raw_decision

    # ── 6. Payout calculation ──────────────────────────────────
    weekly_income      = float(data.get("weekly_income", 4000))
    payout_if_approved = round(weekly_income * 0.40)
    premium_inr        = bts_to_premium(bts_score)

    # ── 7. Factor explanations (top drivers) ──────────────────
    if trust_meta and TRUST_FEATURES:
        fi = trust_meta["feature_importances"]
        feature_vals = dict(zip(TRUST_FEATURES, vec[0]))
        drivers = sorted(
            [{"feature": k, "value": round(float(feature_vals[k]), 3),
              "importance": round(fi.get(k, 0) * 100, 1)}
             for k in TRUST_FEATURES],
            key=lambda x: x["importance"], reverse=True
        )[:5]
    else:
        drivers = [{"feature": "heuristic_mode", "value": round(ts_cal, 3), "importance": 100.0}]

    # Collect all flags
    all_flags = (
        ([f"fraud:{f}" for f in fraud_flags] if isinstance(fraud_flags, list) else []) +
        ([f"bts:{f}"   for f in bts_flags]   if isinstance(bts_flags,   list) else []) +
        ([f"trigger:{t}" for t in triggers_fired] if isinstance(triggers_fired, list) else [])
    )

    return {
        "trust_score":     round(ts_cal, 4),
        "decision":        final_decision,
        "grace_applied":   grace_applied,
        "payout_inr":      payout_if_approved if final_decision == "approve" else 0,
        "weekly_premium_inr": premium_inr,
        "message": {
            "approve": f"Claim approved. ₹{payout_if_approved} will be disbursed within 2 hours.",
            "review":  "Claim under soft verification. You will be notified within 24 hours.",
            "reject":  "Claim rejected due to anomalous signals. You may appeal within 7 days.",
        }[final_decision],
        "audit": {
            "risk_model":     {"income_loss_pct": round(income_loss_pct, 3),
                               "risk_probability": round(risk_probability, 1),
                               "curfew_active": bool(curfew_active),
                               "triggers_fired": triggers_fired},
            "bts_engine":     {"bts_score": round(bts_score, 1),
                               "consistency_pts": round(consistency_pts, 1),
                               "clean_claim_pts": round(clean_claim_pts, 1),
                               "gps_compliance_pts": round(gps_compliance_pts, 1),
                               "doc_pts": round(doc_pts, 1),
                               "flags": bts_flags},
            "fraud_detector": {"if_norm_score": round(if_norm_score, 4),
                               "clf_fraud_proba": round(clf_fraud_proba, 4),
                               "fraud_flags": fraud_flags,
                               "signal_risks": {
                                   "location": data.get("location_risk", "low"),
                                   "temporal": data.get("temporal_risk", "low"),
                                   "activity": data.get("activity_risk", "low"),
                                   "behavioral": data.get("behavioral_risk", "low"),
                               }},
            "trust_engine":   {"raw_score": round(ts_raw, 4),
                               "calibrated_score": round(ts_cal, 4),
                               "raw_decision": raw_decision,
                               "final_decision": final_decision,
                               "grace_applied": grace_applied},
        },
        "top_drivers": drivers,
        "all_flags":   all_flags,
    }


@app.route("/claim/evaluate", methods=["POST"])
def claim_evaluate():
    """
    Unified claim evaluation endpoint.
    Accepts outputs from all three upstream models (or raw signals)
    and returns a single trust score + decision.

    Full example body:
    {
      "worker_id":         "W1234",
      "weekly_income":     4000,
      "income_loss_pct":   0.37,
      "risk_probability":  66.0,
      "city_risk_index":   0.72,
      "curfew_active":     false,
      "triggers_fired":    ["heavy_rainfall"],
      "bts_score":         92,
      "if_norm_score":     0.988,
      "clf_fraud_proba":   0.000,
      "fraud_flags":       [],
      "location_risk":     "low",
      "temporal_risk":     "low",
      "activity_risk":     "low",
      "behavioral_risk":   "low"
    }
    """
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "No JSON body"}), 400

    result = evaluate_claim(data)
    result["worker_id"] = data.get("worker_id", "unknown")
    result["claim_id"]  = data.get("claim_id",  "unknown")
    return jsonify(result)


@app.route("/claim/evaluate/batch", methods=["POST"])
def claim_evaluate_batch():
    data = request.get_json(force=True)
    if not isinstance(data, list):
        return jsonify({"error": "Provide a JSON array of claim objects"}), 400

    results = []
    summary = {"approve": 0, "review": 0, "reject": 0, "total_payout_inr": 0}

    for claim in data[:100]:
        try:
            r = evaluate_claim(claim)
            r["worker_id"] = claim.get("worker_id", "unknown")
            r["claim_id"]  = claim.get("claim_id",  "unknown")
            results.append(r)
            summary[r["decision"]] += 1
            summary["total_payout_inr"] += r["payout_inr"]
        except Exception as e:
            results.append({"claim_id": claim.get("claim_id"), "error": str(e)})

    return jsonify({"count": len(results), "summary": summary, "results": results})


@app.route("/claim/appeal", methods=["POST"])
def claim_appeal():
    """
    Submit an appeal for a rejected claim.
    Nudges the trust score upward by reason strength and re-decides.

    Body: { "claim_id": "...", "reason": "gps_error", <original claim fields> }
    """
    data   = request.get_json(force=True)
    reason = str(data.get("reason", "")).strip().lower()

    if reason not in VALID_APPEAL_REASONS:
        return jsonify({
            "error": f"Invalid appeal reason. Valid: {sorted(VALID_APPEAL_REASONS)}"
        }), 400

    # Reason strength: how much to nudge trust upward
    nudge = {
        "gps_error":             0.12,
        "false_vpn_detection":   0.15,
        "network_outage":        0.10,
        "device_issue":          0.08,
        "new_location":          0.06,
        "weather_emergency":     0.10,
    }.get(reason, 0.05)

    original = evaluate_claim(data)
    original_ts  = original["trust_score"]
    appealed_ts  = float(np.clip(original_ts + nudge, 0, 1))
    appealed_dec = ("approve" if appealed_ts > 0.75
                    else "review" if appealed_ts > 0.50
                    else "reject")

    weekly_income      = float(data.get("weekly_income", 4000))
    payout_if_approved = round(weekly_income * 0.40)

    return jsonify({
        "claim_id":          data.get("claim_id", "unknown"),
        "worker_id":         data.get("worker_id", "unknown"),
        "appeal_reason":     reason,
        "trust_nudge":       round(nudge, 3),
        "original_score":    round(original_ts, 4),
        "original_decision": original["decision"],
        "appealed_score":    round(appealed_ts, 4),
        "appealed_decision": appealed_dec,
        "payout_inr":        payout_if_approved if appealed_dec == "approve" else 0,
        "message": {
            "approve": f"Appeal accepted. ₹{payout_if_approved} will be disbursed.",
            "review":  "Appeal noted. A human agent will review within 48 hours.",
            "reject":  "Appeal insufficient. Please contact support.",
        }[appealed_dec],
    })


@app.route("/trust/model/info", methods=["GET"])
def trust_model_info():
    if trust_meta is None:
        return jsonify({"error": "Trust model not trained yet. Run train_trust_engine.py"}), 503
    fi = trust_meta["feature_importances"]
    max_fi = max(fi.values()) or 1
    importances = [
        {"feature": k, "importance": v, "pct": round(v / max_fi * 100, 1)}
        for k, v in sorted(fi.items(), key=lambda x: x[1], reverse=True)
    ]
    return jsonify({
        "model_type":     trust_meta["model_type"],
        "features":       TRUST_FEATURES,
        "input_sources":  trust_meta["input_sources"],
        "thresholds":     trust_meta["thresholds"],
        "metrics":        trust_meta["metrics"],
        "cv_r2":          trust_meta["cv_r2"],
        "grace_buffer": {
            "bts_threshold":  GRACE_BTS_THRESHOLD,
            "trust_minimum":  GRACE_TRUST_MINIMUM,
            "description":    "Workers with BTS >= 80 and trust >= 0.38 are routed to review instead of reject.",
        },
        "appeal_reasons": sorted(VALID_APPEAL_REASONS),
        "importances":    importances,
    })


# ── Final health route (all 4 engines) ────────────────────────
@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service":  "RiderSaathi ML Service",
        "version":  "4.0",
        "engines": ["risk_model","bts_engine","fraud_detector","trust_score_engine"],
        "endpoints": [
            "POST /predict",             "POST /predict/batch",  "GET /model/info",
            "POST /bts/score",           "POST /bts/score/batch","POST /bts/update",  "GET /bts/model/info",
            "POST /fraud/check",         "POST /fraud/check/batch","GET /fraud/model/info",
            "POST /claim/evaluate",      "POST /claim/evaluate/batch",
            "POST /claim/appeal",        "GET  /trust/model/info",
            "GET  /health",
        ],
    })



# ══════════════════════════════════════════════════════════════
#  RISK ZONE PREDICTION & ANALYTICS ENGINE
# ══════════════════════════════════════════════════════════════

with open(os.path.join(BASE_DIR, "zone_risk_model.pkl"),   "rb") as f: zone_risk_model   = pickle.load(f)
with open(os.path.join(BASE_DIR, "zone_clf_model.pkl"),    "rb") as f: zone_clf_model    = pickle.load(f)
with open(os.path.join(BASE_DIR, "zone_claims_model.pkl"), "rb") as f: zone_claims_model = pickle.load(f)
with open(os.path.join(BASE_DIR, "zone_scaler.pkl"),       "rb") as f: zone_scaler       = pickle.load(f)
with open(os.path.join(BASE_DIR, "zone_label_encoder.pkl"),"rb") as f: zone_label_enc    = pickle.load(f)
with open(os.path.join(BASE_DIR, "zone_metadata.json"),    "r")  as f: zone_meta         = json.load(f)
with open(os.path.join(BASE_DIR, "zone_analytics.json"),   "r")  as f: zone_analytics    = json.load(f)

ZONE_FEATURES = zone_meta["features"]

CITY_META = {
    "Delhi":     {"lat":28.61,"lng":77.23,"base_risk":0.85,"density":0.95,"platforms":5},
    "Mumbai":    {"lat":19.08,"lng":72.88,"base_risk":0.80,"density":0.90,"platforms":5},
    "Noida":     {"lat":28.54,"lng":77.39,"base_risk":0.72,"density":0.70,"platforms":4},
    "Bengaluru": {"lat":12.97,"lng":77.59,"base_risk":0.55,"density":0.65,"platforms":5},
    "Hyderabad": {"lat":17.38,"lng":78.49,"base_risk":0.50,"density":0.60,"platforms":4},
    "Chennai":   {"lat":13.08,"lng":80.27,"base_risk":0.60,"density":0.70,"platforms":4},
    "Kolkata":   {"lat":22.57,"lng":88.36,"base_risk":0.75,"density":0.85,"platforms":4},
    "Pune":      {"lat":18.52,"lng":73.86,"base_risk":0.48,"density":0.55,"platforms":3},
    "Jaipur":    {"lat":26.91,"lng":75.79,"base_risk":0.65,"density":0.60,"platforms":3},
    "Lucknow":   {"lat":26.85,"lng":80.95,"base_risk":0.70,"density":0.65,"platforms":3},
}

def _zone_risk_label(score: float) -> str:
    if score >= 0.55: return "high"
    if score >= 0.30: return "medium"
    return "low"

def _build_zone_vec(data: dict, city: str) -> np.ndarray:
    cm = CITY_META.get(city, {"base_risk":0.65,"density":0.65,"platforms":3})
    m  = int(data.get("month", 6))
    return np.array([
        float(data.get("avg_rainfall_mm",     10)),
        float(data.get("max_rainfall_mm",     25)),
        float(data.get("avg_rainfall_mm_lag1", 8)),
        float(data.get("avg_rainfall_mm_lag2", 6)),
        float(data.get("avg_temp_c",          32)),
        float(data.get("max_temp_c",          36)),
        float(data.get("avg_temp_c_lag1",     31)),
        float(data.get("avg_aqi",            120)),
        float(data.get("max_aqi",            160)),
        float(data.get("avg_aqi_lag1",       115)),
        float(data.get("curfew_days",          0)),
        float(cm["base_risk"]),
        float(cm["density"]),
        float(cm["platforms"]),
        float(m),
        float(m in [6,7,8,9]),
        float(data.get("disruption_streak",    0)),
        float(data.get("risk_score_mean",     0.15)),
        float(data.get("risk_score_mean_lag1",0.14)),
        float(data.get("risk_score_mean_lag2",0.13)),
    ]).reshape(1, -1)


@app.route("/zone/predict", methods=["POST"])
def zone_predict():
    """
    Predict next-week risk for a single city.
    Body: { "city": "Delhi", "avg_rainfall_mm": 45, "month": 7, ... }
    """
    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "No JSON body"}), 400

    city = str(data.get("city", "Delhi")).strip().title()
    if city not in CITY_META:
        return jsonify({"error": f"Unknown city. Valid: {list(CITY_META.keys())}"}), 400

    vec   = _build_zone_vec(data, city)
    vec_s = zone_scaler.transform(vec)

    risk_score  = float(np.clip(zone_risk_model.predict(vec_s)[0], 0, 1))
    risk_level  = zone_label_enc.inverse_transform(zone_clf_model.predict(vec_s))[0]
    pred_claims = int(np.clip(zone_claims_model.predict(vec_s)[0], 0, None))

    # Which triggers are active?
    triggers = []
    if float(data.get("avg_rainfall_mm", 0)) > 80:  triggers.append("heavy_rainfall")
    if float(data.get("max_temp_c",       0)) > 42:  triggers.append("extreme_heat")
    if float(data.get("avg_aqi",          0)) > 300: triggers.append("high_aqi")
    if int  (data.get("curfew_days",      0)) > 0:   triggers.append("curfew")

    cm = CITY_META[city]
    return jsonify({
        "city":            city,
        "lat":             cm["lat"],
        "lng":             cm["lng"],
        "predicted_risk_score": round(risk_score, 4),
        "predicted_risk_level": risk_level,
        "predicted_claims_next_week": pred_claims,
        "active_triggers": triggers,
        "city_base_risk":  cm["base_risk"],
        "recommendation":  (
            "Increase claim reserves by 30%"   if risk_level == "high" else
            "Monitor daily and alert field agents" if risk_level == "medium" else
            "Normal operations"
        ),
        "model": "GradientBoostingRegressor + GradientBoostingClassifier",
    })


@app.route("/zone/predict/batch", methods=["POST"])
def zone_predict_batch():
    """Predict for multiple cities at once."""
    data = request.get_json(force=True)
    if not isinstance(data, list):
        return jsonify({"error": "Provide a JSON array of city objects"}), 400

    results = []
    for item in data[:20]:
        city = str(item.get("city","")).strip().title()
        if city not in CITY_META:
            results.append({"city": city, "error": "Unknown city"})
            continue
        vec   = _build_zone_vec(item, city)
        vec_s = zone_scaler.transform(vec)
        rs  = float(np.clip(zone_risk_model.predict(vec_s)[0], 0, 1))
        rl  = zone_label_enc.inverse_transform(zone_clf_model.predict(vec_s))[0]
        pc  = int(np.clip(zone_claims_model.predict(vec_s)[0], 0, None))
        results.append({"city": city, "risk_score": round(rs,4),
                        "risk_level": rl, "pred_claims": pc})

    results.sort(key=lambda x: x.get("risk_score", 0), reverse=True)
    return jsonify({"count": len(results), "cities": results})


@app.route("/zone/heatmap", methods=["GET"])
def zone_heatmap():
    """Returns pre-computed city risk heatmap with lat/lng for map rendering."""
    heatmap = []
    for entry in zone_analytics["city_heatmap"]:
        city = entry["city"]
        cm   = CITY_META.get(city, {})
        heatmap.append({**entry, "lat": cm.get("lat"), "lng": cm.get("lng")})
    return jsonify({
        "heatmap":        heatmap,
        "top_risk_city":  zone_analytics["top_risk_city"],
        "cities_high":    zone_analytics["cities_high"],
        "cities_medium":  zone_analytics["cities_medium"],
        "cities_low":     zone_analytics["cities_low"],
        "generated_at":   zone_analytics["generated_at"],
    })


@app.route("/zone/trends", methods=["GET"])
def zone_trends():
    """14-week risk trend per city."""
    city = request.args.get("city", "").strip().title()
    if city and city in zone_analytics["weekly_trends"]:
        return jsonify({"city": city, "trend": zone_analytics["weekly_trends"][city]})
    return jsonify({"trends": zone_analytics["weekly_trends"]})


@app.route("/zone/analytics", methods=["GET"])
def zone_analytics_route():
    """Full analytics payload — season stats, trigger correlations, heatmap."""
    return jsonify({
        "season_stats":    zone_analytics["season_stats"],
        "trigger_corr":    zone_analytics["trigger_corr"],
        "city_heatmap":    zone_analytics["city_heatmap"],
        "top_risk_city":   zone_analytics["top_risk_city"],
        "summary": {
            "total_cities":   len(CITY_META),
            "high_risk":      len(zone_analytics["cities_high"]),
            "medium_risk":    len(zone_analytics["cities_medium"]),
            "low_risk":       len(zone_analytics["cities_low"]),
        },
        "models": zone_meta["models"],
    })


@app.route("/zone/model/info", methods=["GET"])
def zone_model_info():
    fi = zone_meta["feature_importances"]
    max_fi = max(fi.values()) or 1
    return jsonify({
        "models":          zone_meta["models"],
        "features":        ZONE_FEATURES,
        "risk_thresholds": zone_meta["risk_thresholds"],
        "cities":          zone_meta["cities"],
        "importances": [
            {"feature": k, "importance": v, "pct": round(v/max_fi*100, 1)}
            for k, v in sorted(fi.items(), key=lambda x: x[1], reverse=True)
        ],
    })
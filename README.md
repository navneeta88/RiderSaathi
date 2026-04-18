# RiderSaathi
# AI-POWERED INCOME PROTECTION FOR INDIA’S GIG WORKERS
## 📖 Table of Contents

| # | Section |
|---|---------|
| 1 | [PROJECT OVERVIEW](#PROJECT-OVERVIEW) |
| 2 | [INSPIRATION](#INSPIRATION) |
| 3 | [PROBLEM STATEMENT](#PROBLEM-STATEMENT) |
| 4 | [OUR SOLUTION](#OUR-SOLUTION) |
| 5 | [TARGET PERSONA](#TARGET-PERSONA) |
| 6 | [WHAT IT DOES](#WHAT-IT-DOES) |
| 7 | [TECH STACK](#TECH-STACK) |
| 8 | [WEEKLY PREMIUM MODEL (CONCEPT)](#WEEKLY-PREMIUM-MODEL-CONCEPT) |
| 9 | [WEEKLY PREMIUM CALCULATION](#WEEKLY-PREMIUM-CALCULATION) |
| 10 | [SYSTEM WORKFLOW](#SYSTEM-WORKFLOW) |
| 11 | [SYSTEM ARCHITECHTURE](#SYSTEM-ARCHITECHTURE) |
| 12 | [JUSTIFICATION](#JUSTIFICATION) |
| 13 | [MULTI LAYER FRAUD DETECTION AND ADVERSARIAL DEFENSE](#MULTI-LAYER-FRAUD-DETECTION-AND-ADVERSARIAL-DEFENSE) |
| 14 | [WHAT NEXT](#WHAT-NEXT) |
| 15 | [BUILT WITH](#BUILT-WITH) |
| 16 | [DEMO AND REPOSITORY](#DEMO-AND-REPOSITORY) |
## PROJECT OVERVIEW

Our platform provides **AI-enabled parametric insurance** to safeguard delivery partners against income loss caused by uncontrollable external disruptions such as extreme weather, curfews, and app downtime.  

The system is **fully automated, fraud-resistant**, and priced on a **weekly basis** to align with gig workers’ earnings cycles.

---

## INSPIRATION

Gig workers in India (Zomato, Swiggy, Zepto, Amazon, Dunzo, etc.) face unpredictable income loss due to external disruptions. Currently, there is **no safety net** for their lost earnings.  

We designed a system that **protects genuine workers while preventing fraudulent claims**, ensuring fair and affordable coverage.

---
## PROBLEM STATEMENT
India’s gig delivery workers (Zomato, Swiggy, Zepto, Amazon, etc.) face significant income loss (20–30%) due to uncontrollable external disruptions such as:

🌧 Heavy Rain

🔥 Extreme Heat

🌫 High Pollution (AQI)

🚫 Curfews / Local Closures

Currently, there is no structured financial protection system for such income loss

## OUR SOLUTION
RiderSaathi AI is an AI-powered parametric insurance platform that:

Provides weekly income protection

Uses real-time disruption triggers

Automates claim generation and payout

Ensures fraud-free validation

## TARGET PERSONA
🚴 Food Delivery Partner (Zomato/Swiggy)

Example: Ravi (Age 26, Noida)

Weekly Income: ₹4000

Works long outdoor hours

Faces disruption-based income loss

👉 Loss during bad weeks: ₹1000–₹1500



## WHAT IT DOES

- **Automated Weekly Premium Calculation** based on environmental risk and worker behavior  

- **Behavioral Trust Score (BTS)** rewards honesty and consistency
  
- **Multi-Layer Fraud Detection** and Adversarial Defense
  
- **Instant Claim Payouts** for verified income loss
  
- **Analytics Dashboard** showing worker coverage, claims, and predictive risk

---

## TECH STACK

- **Frontend:** HTML, CSS, JavaScript
  
- **Backend:** Node.js (Express)
  
- **Database:** MongoDB
  
- **AI/ML:** Python (Flask API)  
  - Linear Regression for risk prediction
      
  - Isolation Forest for anomaly detection
     
- **Payments:** Razorpay Test/Sandbox
  
- **APIs:** Weather API (mock), Traffic/Platform API (mock)
---

## WEEKLY PREMIUM MODEL CONCEPT

Our weekly premium model is designed to be **fair, dynamic, and worker-centric**:

1. **Base Risk Assessment** – Calculates expected income loss from environmental or external disruptions (weather, curfews, traffic).  
2. **Behavioral Trust Score (BTS)** – Adjusts the premium based on worker behavior: consistency, claims history, GPS compliance, and document verification.  
3. **Dynamic Weekly Adjustment** – Premiums are recalculated every week to reflect:  
   - Changes in external risk (e.g., seasonal floods, extreme heat)  
   - Worker’s recent activity and claim behavior  
4. **Fraud Mitigation Factor** – Ensures suspicious users pay higher premiums or require manual claim review, protecting the insurance pool.  

> This ensures **trusted workers pay less**, while the system remains sustainable and secure.

--- 


## WEEKLY PREMIUM CALCULATION

### 1️⃣ EXTERNAL RISK-BASED PREMIUM

Risk Premium = Weekly Income × Expected Loss % × Risk Probability × (1 + Margin)

**Example:**

- Weekly Income = ₹4000  
- Expected Loss % = 30% → 0.3  
- Risk Probability = 50% → 0.5  
- Margin = 20% → 0.2  

Risk Premium = 4000 × 0.3 × 0.5 × 1.2 = ₹720  

---

### 2️⃣ BEHAVIORAL TRUST SCORE (BTS)

BTS = (Working Consistency × 40%)  
    + (Clean Claim Ratio × 25%)  
    + (GPS Zone Compliance × 20%)  
    + (Document Verification × 15%)

**Example: Ravi Kumar**

| METRIC | SCORE |
|--------|-------|
| Consistent 6 days/week → 40/40 | 40 |
| 2 valid claims, 0 fraudulent → 25/25 | 25 |
| Always in registered zone → 18/20 | 18 |
| Aadhaar verified only → 9/15 | 9 |

BTS TOTAL = 40 + 25 + 18 + 9 = 92/100 → TRUSTED  

---

### 3️⃣ MAPPING BTS TO WEEKLY PREMIUM

| BTS SCORE | WEEKLY PREMIUM (₹) |
|-----------|------------------|
| 90–100   | 15 |
| 80–89    | 25 |
| 70–79    | 40 |
| 60–69    | 60 |
| <60      | 100 |

---

### FINAL RESULT EXAMPLES

| WORKER        | BTS | RAW RISK PREMIUM | FINAL PREMIUM |
|---------------|-----|-----------------|--------------|
| Ravi Kumar    | 92  | 720             | 15           |
| Ankit Sharma  | 85  | 720             | 25           |
| Priya Singh   | 75  | 720             | 40           |
| Sunil Patel   | 65  | 720             | 60           |
| Fake GPS User | 50  | 720             | 100          |

> High BTS → Lower premium  
> Low BTS → Higher premium  

---
## SYSTEM WORKFLOW


User registers

Weekly policy is created

AI calculates premium


System monitors disruptions
Trigger event occurs

Backend verifies:

* 📍 Location
  
* 📉 Activity drop
* Claim auto-generated
* 💳 Instant payout processed (simulated)
  ## SYSTEM ARCHITECHTURE
  ![System Architecture](SYSTEM%20ARCHITECTURE.jpeg)
  ![system architecture 2](system%20architecture%202.jpeg)
  ## JUSTIFICATION
Based on real-world delivery disruption patterns

Uses probability-based risk modeling

Ensures financial sustainability

Aligns with weekly earning cycle of gig workers

⚡ Parametric Triggers

> Trigger

> Condition
> Impact

🌧 Rainfall
> 80mm

Work stops

🔥 Temperature
> 42°C

Reduced hours

🌫 AQI
> 300

Unsafe conditions

🚫 Curfew

>Zone closure

No deliveries


🤖 AI/ML Integration

🔹 Risk Prediction

Inputs: Weather, historical data, location

Output: Risk probability + premium

🔹 Fraud Detection

We detect:

* 📍 Fake GPS location
* 📉 Abnormal activity drop
* 🔁 Duplicate claims

Methods:

>Rule-based checks

>Isolation Forest (planned)

## MULTI LAYER FRAUD DETECTION AND ADVERSARIAL DEFENSE


#### 1. Location Verification
- GPS vs registered delivery zone
- IP-based location validation
- Network consistency checks

#### 2. Temporal Consistency
- Detects unrealistic movement patterns
- Flags sudden long-distance jumps in short time

#### 3. Sensor Fusion Validation
- Uses device motion data (accelerometer)
- Flags cases where GPS shows movement but device is stationary

#### 4. Activity Validation
- Verifies recent delivery activity
- Flags claims with no prior work activity

#### 5. Behavioral Intelligence
- Compares current behavior with historical patterns
- Detects unusual claim activity

#### 6. Network Intelligence
- Detects IP mismatch and VPN usage
- Identifies multiple users from same network

#### 7. Graph-Based Fraud Detection
- Links users based on:
  - IP address
  - Claim timing
  - Location similarity
- Detects coordinated fraud groups

#### 8. AI Anomaly Detection
- Uses Isolation Forest to detect:
  - GPS anomalies
  - Activity anomalies
  - Claim pattern anomalies

---

### ⚡ Trust Score Engine
Each claim is assigned a **Trust Score (0–1)** based on:
- Sensor consistency
- Behavioral patterns
- Network reliability
- Fraud risk signals

---

### ⚙️ Decision Engine
Based on Trust Score:
- **> 0.75** → Instant Approval
- **0.5 – 0.75** → Verification Required
- **< 0.5** → Rejected

---

### ⚖️ UX Protection (Fairness Layer)
To ensure genuine users are not penalized:
- Grace buffer for temporary issues
- Soft verification instead of immediate rejection
- Clear user feedback (e.g., “Verification in progress”)
- Appeal mechanism for flagged claims

---

### 🛡️ Final Defense Layers
1. Real-time multi-signal validation  
2. AI-based trust scoring  
3. Fraud graph detection  

---

### 🚀 Result
- Prevents GPS spoofing  
- Detects coordinated fraud attacks  
- Protects honest workers  
- Ensures system sustainability  

---

🔐 Designed to withstand adversarial attacks in real-world environments

---
![multi layer fraud detection](multi%20layer%20fraud%20detection.jpeg)


## WHAT NEXT
- Integrate **real weather, traffic, and platform APIs**  
- Enable **instant payouts using Razorpay/UPI sandbox**  
- Expand **predictive analytics for high-risk zones**  

---

## BUILT WITH
HTML, CSS, JavaScript, Node.js, MongoDB, Python (Flask, scikit-learn), Razorpay Sandbox, Mock APIs  

---

## DEMO AND REPOSITORY
- **GitHub Repository:**(https://github.com/navneeta88/RiderSaathi)
- **Demo Link:**
- https://rider-saathi-beta.vercel.app/
- **Demo Video:** (https://www.youtube.com/watch?si=1BMg38Hbj1HqSmlt&v=2ic6aMXlTtE&feature=youtu.be)
- https://drive.google.com/file/d/1FrkqScAl39jDFGmVO47CrhagUvtqj6IS/view?usp=drivesdk
- https://drive.google.com/file/d/1KzDy2WOQiHkvNzkaW3rnYgGRfLJ-9b37/view?usp=drivesdk
- https://drive.google.com/file/d/19UW4xJN3AdT95c9Jo20l5xJOLHa0NNrt/view?usp=drivesdk  

---

# Mace Implementation Specification (Technical)

## 1. Static Configuration
| Property | ID | Value | Type |
| :--- | :--- | :--- | :--- |
| **Base Capacity** | `BASE_CAP` | 6 | Integer |
| **Base Multiplier** | `BASE_VAL` | 0.02 | Float (2%) |
| **Generation Rate** | `GEN_RATE` | 2 | Integer |

## 2. Perk Progression Tables

### Tree 1: Shock
| Level | Capacity Modifier (`CAP_MOD`) | Damage Value Modifier (`VAL_MOD`) |
| :--- | :--- | :--- |
| 1 | -1 | +0.01 (1%) |
| 2 | -2 | +0.02 (2%) |
| 3 | -3 | +0.03 (3%) |
| 4 | -4 | +0.04 (4%) |
| 5 | -5 | +0.05 (5%) |

### Tree 2: Awe
| Level | Capacity Modifier (`CAP_MOD`) | Damage Value Modifier (`VAL_MOD`) |
| :--- | :--- | :--- |
| 1 | +1 | +0.002 (0.2%) |
| 2 | +2 | +0.004 (0.4%) |
| 3 | +3 | +0.006 (0.6%) |
| 4 | +4 | +0.008 (0.8%) |
| 5 | +5 | +0.010 (1.0%) |

---

## 3. Calculation Engine

### A. Initialization
```pseudo
current_cap = BASE_CAP + shock.CAP_MOD + awe.CAP_MOD
current_val = BASE_VAL + shock.VAL_MOD + awe.VAL_MOD
total_accumulated = 0
```

### B. Per-Turn Logic
Execute these steps in order for every strike after Shock & Awe has unlocked Reverberation.

1.  **Update History:** `total_accumulated += GEN_RATE`
2.  **Activation Check:** If `total_accumulated < current_cap` return `0`.
3.  **Calculate Instant Overflow:**
    * `instant_overflow = clamp(total_accumulated - current_cap, 0, GEN_RATE)`
4.  **Calculate Final Multiplier:**
    * `damage_multiplier = (current_cap + instant_overflow) * current_val`

---

## 4. State Verification Tables

### Shock (Level 5 Mastery)
* **Cap:** 1
* **Value:** 0.07

| Turn | Total Accumulated | Instant Overflow | Damage Bonus |
| :--- | :--- | :--- | :--- |
| 1 | 2 | 1 | (1 + 1) * 0.07 = **14%** |
| 2 | 4 | 2 | (1 + 2) * 0.07 = **21%** |
| 3 | 6 | 2 | (1 + 2) * 0.07 = **21%** |

### Awe (Level 5 Mastery)
* **Cap:** 11
* **Value:** 0.03

| Turn | Total Accumulated | Instant Overflow | Damage Bonus |
| :--- | :--- | :--- | :--- |
| 1–5 | 2–10 | 0 | **0%** |
| 6 | 12 | 1 | (11 + 1) * 0.03 = **36%** |
| 7 | 14 | 2 | (11 + 2) * 0.03 = **39%** |

### Combined (Shock V + Awe V)
* **Cap:** 6
* **Value:** 0.08

| Turn | Total Accumulated | Instant Overflow | Damage Bonus |
| :--- | :--- | :--- | :--- |
| 1 | 2 | 0 | **0%** |
| 2 | 4 | 0 | **0%** |
| 3 | 6 | 0 | (6 + 0) * 0.08 = **48%** |
| 4 | 8 | 2 | (6 + 2) * 0.08 = **64%** |

---

## 5. Technical Constraints
1.  **Persistent State:** The Reverberation `total_accumulated` variable must persist for the duration of the combat encounter.
2.  **Stat Minimums:** `current_cap` must have a floor of `1`.
3.  **Overflow Definition:** Overflow is strictly transient. Stacks that exceed `current_cap` are never added to the permanent tank state; they only influence the `damage_multiplier` for the current calculation frame.
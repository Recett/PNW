# Tactical Analysis: The Reciprocity Rapier - Perk Specialization

## 1. Core Mathematical Model
The effectiveness of the Reciprocity Rapier is determined by the **Reflection Output**, which converts incoming Enemy Weight ($E$) into offensive force.

$$Reflection = M \cdot \left( \frac{B \cdot P \cdot E}{B \cdot P + E} \right)$$

* **$P$ (Power):** The user's base offensive capacity.
* **$M$ (Multiplier):** Dictates the raw destructive potential of the reflection.
* **$B$ (Stability):** Dictates the structural integrity and efficiency of the spear under load.
* **$E$ (Enemy Weight):** The external force acting upon the denominator.

---

## 2. Perk Progression (Back-Loaded)
The progression is aggressively back-loaded to prevent "Hybrid Stagnation." Players must commit to a mastery rank (Level 5) to unlock the specialized scaling necessary for high-tier combat.

| Perk Level | **Impale Tree (M)** | **Brace Tree (B)** | Progression State |
| :--- | :--- | :--- | :--- |
| **0** | 1.00 | 1.0 | Standard Issue |
| **1** | 1.05 | 1.2 | Minimal Gain |
| **2** | 1.15 | 1.5 | Minor Adjustment |
| **3** | 1.35 | 2.5 | Hybrid Ceiling |
| **4** | 1.80 | 15.0 | Structural Shift |
| **5** | **2.50** | **100.0** | **Mastery Spike** |

---

## 3. Specialized Archetypes (At Level 5)

### The Impale Specialist ($V\,0$)
* **Stats:** $M=2.5, B=1.0$
* **Tactical Focus:** **The Bully.** Maximizes output against enemies within the user's weight class ($E \approx P$).
* **Performance:**
    * **At $E=P$:** Reflects **$1.25E$**.
    * **At $E=3P$:** Reflects **$0.62E$**.
* **Outcome:** Dominate early exchanges but suffer "Structural Collapse" against heavy targets.

### The Brace Specialist ($0\,V$)
* **Stats:** $M=1.0, B=100.0$
* **Tactical Focus:** **The Giant Slayer.** Maintains near-perfect efficiency regardless of enemy weight.
* **Performance:**
    * **At $E=P$:** Reflects **$0.99E$**.
    * **At $E=3P$:** Reflects **$0.97E$**.
* **Outcome:** Sacrifice burst potential against equals to ensure consistent victory against extreme threats.

---

## 4. Efficiency Analysis (Reflection / E)
The following table compares the **Hybrid (III III)**, the **Bully (V I)**, and the **Tank (I V)** across the critical weight spectrum.

| Target Class | Enemy Weight ($E$) | **III III** (Hybrid) | **I V** (Tank) | **V I** (Bully) |
| :--- | :--- | :--- | :--- | :--- |
| **Minimum** | $1.0P$ | $0.96E$ | $1.04E$ | **1.36E** |
| **Baseline** | $1.5P$ | $0.84E$ | $1.04E$ | **1.11E** |
| **Extreme** | $3.0P$ | $0.61E$ | **1.02E** | $0.71E$ |

---

## 5. Summary of Balance
1.  **Specialization Reward:** The **I V** Tank reflects **67% more force** than the Hybrid at the Extreme ($3P$). 
2.  **Bully Premium:** The **V I** Bully reflects **41% more force** than the Hybrid at the Minimum ($1P$).
3.  **The Dead Zone:** The Hybrid (III III) is mathematically inferior at all critical points. It is too fragile to scale and lacks the multiplier to bully, serving as a cautionary state for unspecialized builds.

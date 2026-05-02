# System Specification: Automated Naval Siege Event (v4)
**Document Type:** Bot Logic & Architecture Blueprint  
**Event Duration:** ~4-5 Hours (Real-time Sunday Event)

---

## 1. Global State & Component Health

The event tracks structural integrity via Component Health Points (HP). Internal zones (Armory/Officer Quarters) have 0 HP and do not contribute to the Victory Trigger; they function as tactical overrides.

### 1.1 Player Ship (Defensive Entity)
Total Player Ship Baseline: 1000 HP.

| Location | Max HP | Derived Variable | Function in Combat |
| :--- | :--- | :--- | :--- |
| **Player Top Deck** | 400 | `ally_sailors` | `HP / 4` (Max 100). Grants flat damage reduction to players. |
| **Player Cannon Deck**| 400 | `player_cannon_power`| `HP * 0.125` (Max 50). Shots fired in Phase D. |
| **Player Rigging** | 200 | `player_mobility` | `(HP * 0.2) + 80` (Max 120). Evasion against enemy Volleys. |

### 1.2 Enemy Ship (Offensive Entity)
Total Enemy Ship Victory Pool: 1200 HP.

| Location | Max HP | Derived Variable | Function in Combat |
| :--- | :--- | :--- | :--- |
| **Enemy Main Deck** | 600 | `enemy_spawn_rate` | Determines reinforcement volume for the next Clash phase. |
| **Enemy Cannon Deck**| 400 | `enemy_cannon_power`| Determines shot count fired at the player ship. |
| **Enemy Rigging** | 200 | `enemy_mobility` | Dictates enemy base evasion rate against player artillery. |

---

## 2. Enemy Ship Locations

### 2.1 Exterior Combat Zones (Victory Pool Components)

#### **Main Deck**
* **Enemy Pool:** Sailor, Man-at-Arms, Master-at-Arms (Boss), Captain (Apex Boss).
* **Spawn:** Initial Wave + Continuous Reinforcement.
* **Fight Mechanic:** Aggressive. Units initiate combat to inflate the Overrun tally.
* **Hazard (Volley Crossfire):** 40% probability for players to take 10 flat damage per turn.
* **Goal:** Numerical superiority to deal 50 damage to `MainDeck_HP` per 30-min cycle.

#### **Cannon Deck**
* **Enemy Pool:** Sailor, Master Gunner (Boss).
* **Spawn:** Fixed Initial Number. No reinforcements once cleared.
* **Fight Mechanic:** Passive/Functional. Enemies prioritize firing; players must initiate to stop the battery.
* **Hazard (Powder Flash):** Critical hits can ignite powder for 20 secondary structural damage.
* **Goal:** Sabotage guns to deal 60 damage to `EnemyCannonDeck_HP`.

#### **Rigging**
* **Enemy Pool:** Skirmisher, Bosun (Boss).
* **Spawn:** Continuous Reinforcement.
* **Fight Mechanic:** Aggressive. Skirmishers lock players into 1v1s to prevent line-cutting.
* **Hazard (Mast Snap):** Failure of Evasion check during structural damage results in 20 fall damage.
* **Goal:** Sever shrouds to deal 30 damage to `EnemyRigging_HP`.

### 2.2 Internal Tactical Zones (0 HP / Tactical Overrides)

#### **Armory**
* **Access:** Requires Main Deck to be "Secured" (`Player_Count >= Enemy_Count`).
* **Enemy Pool:** Man-at-Arms, First Mate (Boss).
* **Fight Mechanic:** Defensive Barricade. Enemies wait for player initiation.
* **Override:** Capturing the Armory disables **Continuous Reinforcement** for the Enemy Ship.

#### **Officer Quarters**
* **Access:** Requires Main Deck to be "Secured."
* **Enemy Pool:** The Captain (Apex Boss).
* **Fight Mechanic:** Command Wall. High-lethality stat-check.
* **Override:** Capturing this zone disables the **Aggressive** fight mechanic for all common enemies. Remaining enemies become **Passive/Functional**.

---

## 3. Player Ship Locations (Defensive)

#### **Player Top Deck**
* **Enemy Pool:** Sailor (Boarders), First Mate (Boss).
* **Spawn:** Continuous Reinforcement (via Enemy Rigging).
* **Fight Mechanic:** Aggressive. Enemies prioritize increasing the Overrun count.
* **Hazard (Shrapnel):** 5–10 damage if ship mobility fails against enemy fire.
* **Goal:** Prevent Overrun to protect `TopDeck_HP` and `ally_sailors` (Damage Reduction).

#### **Player Cannon Deck**
* **Enemy Pool:** Sailor (Boarders).
* **Spawn:** Continuous Reinforcement.
* **Fight Mechanic:** Aggressive. Boarders target gun crews to disable artillery.
* **Hazard (Enclosed Crossfire):** 20% chance per combat to damage gun mounts, reducing `player_cannon_power`.
* **Goal:** Prevent Overrun to protect `CannonDeck_HP` and artillery efficiency.

#### **Player Rigging**
* **Enemy Pool:** Skirmisher (Boarders).
* **Spawn:** Continuous Reinforcement.
* **Fight Mechanic:** Aggressive. Targets the stays and lines to ground the ship.
* **Hazard (High Wind):** Players take a -2 penalty to Accuracy due to ship sway.
* **Goal:** Prevent Overrun to protect `Rigging_HP` and `player_mobility`.

---

## 4. Phase-Based Zone Resolution (The Tally)

At minute 30, the bot calculates:
`Control State = Player_Count >= Enemy_Count` (Secured) OR `Enemy_Count > Player_Count` (Overrun).

### 4.1 Defensive Zones (Player Ship)
* **If Overrun:** Enemy boarders sabotage the component.
    * `TopDeck_HP` loses 50 HP.
    * `CannonDeck_HP` loses 50 HP.
    * `Rigging_HP` loses 30 HP.

### 4.2 Offensive Exterior Zones (Enemy Ship)
* **If Secured:** Players inflict direct damage (Main Deck: 50, Cannon: 60, Rigging: 30).
* **If Overrun:** The component holds. If the Main Deck is Overrun, it recovers +20 HP.

### 4.3 Internal Zones
* **If Secured:** The Tactical Override (Reinforcement Cutoff or Command Disruption) is activated.

---

## 5. End State Triggers

* **Victory:** `(EnemyMainDeck_HP + EnemyCannonDeck_HP + EnemyRigging_HP) <= 0`.
* **Defeat:** `(TopDeck_HP + CannonDeck_HP + Rigging_HP) <= 0`.
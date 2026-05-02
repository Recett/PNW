# System Specification: Automated Naval Siege Event (v5)
**Document Type:** Bot Logic & Architecture Blueprint  
**Event Duration:** ~4-5 Hours (Real-time Sunday Event)

---

## 1. Global State & Component Health (1500 HP Scale)

The event tracks structural integrity via Component Health Points (HP). Internal zones (Armory/Officer Quarters) have 0 HP and do not contribute to the Victory Trigger; they function as tactical overrides to disable enemy capabilities.

### 1.1 Player Ship (Defensive Entity)
Total Player Ship Baseline: 1000 HP.

| Location | Max HP | Derived Variable | Function in Combat |
| :--- | :--- | :--- | :--- |
| **Player Top Deck** | 400 | `ally_sailors` | `HP / 4` (Max 100). Grants flat damage reduction to players. |
| **Player Cannon Deck**| 400 | `player_cannon_power`| `HP * 0.125` (Max 50). Shots fired in Phase D. |
| **Player Rigging** | 200 | `player_mobility` | `(HP * 0.2) + 80` (Max 120). Evasion against enemy Volleys. |

### 1.2 Enemy Ship (Offensive Entity)
Total Enemy Ship Victory Pool: 1500 HP.

| Location | Max HP | Derived Variable | Function in Combat |
| :--- | :--- | :--- | :--- |
| **Enemy Main Deck** | 800 | `enemy_spawn_rate` | Determines reinforcement volume; **Gateway** to interior. |
| **Enemy Cannon Deck**| 500 | `enemy_cannon_power`| Determines number of shots fired in Phase D. |
| **Enemy Rigging** | 200 | `enemy_mobility` | **Boarding Source**; determines enemy evasion rate. |

---

## 2. Tactical Zone Logic

### 2.1 The Gateway Rule
* **Main Deck Constraint:** The ship's interior (Armory and Officer Quarters) is locked behind the Main Deck.
* **Access:** Players may only move to internal zones if the Enemy Main Deck is **Secured** (`Player_Count >= Enemy_Count`).
* **Hazard:** If the Main Deck is lost (becomes Overrun) while players are inside, they are "Trapped" and take a -2 penalty to Accuracy until the deck is re-secured.

### 2.2 Tactical Overrides (Internal Zones)
These zones have 0 HP. Securing them (maintaining a "Secured" state for one full 30-minute cycle) activates a permanent toggle.

* **Armory:** Securing this zone disables **Continuous Reinforcement**. Enemies killed in the 1v1 Clash will no longer be replaced in the next cycle.
* **Officer Quarters:** Securing this zone causes all remaining common enemies to switch from **Aggressive** to **Passive**. They will no longer initiate 1v1s unless attacked.

---

## 3. Zone Objectives & Combat Roles

#### **Enemy Rigging (The Anchor)**
* **Combat Goal:** Severing Shrouds.
* **Strategic Role:** This is the spawn point for all enemy boarders on the player ship. Clearing this zone stops the flow of boarders.
* **Victory Contribution:** Holds 200 HP of the 1500 HP total.

#### **Enemy Cannon Deck**
* **Combat Goal:** Spiking the Guns.
* **Strategic Role:** Directly reduces the damage the player ship takes during the Maneuver/Volley phase.
* **Victory Contribution:** Holds 500 HP of the 1500 HP total.

---

## 4. Phase-Based Zone Resolution (The Tally)

At minute 30, the bot calculates the `Control State`:

### 4.1 Defensive Zones (Player Ship)
* **If Overrun:** Enemy boarders sabotage the component.
    * `TopDeck_HP` loses 50 HP.
    * `CannonDeck_HP` loses 50 HP.
    * `Rigging_HP` loses 30 HP.

### 4.2 Offensive Exterior Zones (Enemy Ship)
* **If Secured:** Players inflict direct structural damage.
    * **Main Deck:** 50 Damage (and allows internal access).
    * **Cannon Deck:** 60 Damage.
    * **Rigging:** 30 Damage.
* **If Overrun:** The component holds. If the Main Deck is Overrun, it recovers +20 HP (repairs).

### 4.3 Internal Zones
* **If Secured:** The Tactical Override (Reinforcement Cutoff or Command Disruption) is activated for the duration of the event.

---

## 5. End State Triggers

* **Victory Trigger:** `(EnemyMainDeck_HP + EnemyCannonDeck_HP + EnemyRigging_HP) <= 0`.
* **Defeat Trigger:** `(TopDeck_HP + CannonDeck_HP + Rigging_HP) <= 0`.
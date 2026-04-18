# System Specification: Automated Naval Siege Event (v3)
**Document Type:** Bot Logic & Architecture Blueprint  
**Target Architecture:** Discord Bot (Automated Event Moderation)  
**Event Duration:** ~4-5 Hours (Real-time Sunday Event)

---

## 1. Global State & Derived Variables (Scaled)

The event is tracked via independent Component Health Points (HP). 
Total Player Ship Baseline: 1000 HP. Total Enemy Ship Baseline: 1500 HP.

### 1.1 Player Ship (Defensive Entity)
| Component | Max HP | Derived Variable | Calculation | Function in Combat |
| :--- | :--- | :--- | :--- | :--- |
| **Top Deck** | 400 | `ally_sailors` | `TopDeck_HP / 4` (Max 100) | Grants flat damage reduction to players in 1v1 combat. |
| **Cannon Deck**| 400 | `player_cannon_power`| `CannonDeck_HP * 0.125` (Max 50) | Determines number of 10-damage shots fired at the enemy. |
| **Rigging** | 200 | `player_mobility` | `(Rigging_HP * 0.2) + 80` (Max 120)| Dictates base evasion rate against enemy Volleys. |

### 1.2 Enemy Ship (Offensive Entity)
| Component | Max HP | Derived Variable | Calculation | Function in Combat |
| :--- | :--- | :--- | :--- | :--- |
| **Main Deck** | 600 | `enemy_spawn_rate` | `MainDeck_HP / 600` (%) | Multiplier for the number of enemies spawned per wave against Vanguard. |
| **Cannon Deck**| 400 | `enemy_cannon_power` | `EnemyCannonDeck_HP * 0.375` (Max 150)| Determines number of 10-damage shots fired at the Player Ship. |
| **Rigging** | 200 | `enemy_mobility` | `EnemyRigging_HP * 0.4` (Max 80) | Dictates base evasion rate against player Volleys. |
| **Armory** | 150 | `enemy_lethality` | `Armory_HP / 150` (%) | Interior Zone. Multiplier applied to enemy damage stats in 1v1 combat. |
| **Officer Qtrs**| 150 | `enemy_command` | `OfficerQtrs_HP > 0` | Interior Zone. Reaching 0 triggers the Victory End State. |

---

## 2. Phase Architecture

### Phase A: Deployment (5 Minutes)
* Players use `/deploy [Zone]` to lock their character to a specific deck.
* **Vanguard Restriction:** A minimum number of players must deploy to the Enemy Main Deck. If 0, the Diver Team cannot access Interior Zones.

### Phase B: The Clash (30 Minutes)
* The bot spawns the enemy wave based on current deck variables. 
* Players use `/engage [Enemy_ID]` to trigger the instant 1-on-1 combat calculation. 
* *Purpose:* Players fight exclusively to remove enemy IDs from the zone before Phase C. No structural damage is applied during this phase.

### Phase C: Zone Resolution (5 Minutes)
* Combat is locked. The bot runs the **Tally Protocol** (See Section 4) to determine the control state of every zone. All Component HP damage is applied here.

### Phase D: Maneuver & Volley (10 Minutes)
* The bot executes the automated artillery exchange based on the newly resolved deck variables.

---

## 3. The Maneuver Phase Math: Volley & Evasion

### Step 3.1: Shot Generation
* `Player_Shots = floor(player_cannon_power / 10)`
* `Enemy_Shots = floor(enemy_cannon_power / 10)`
* *Each shot deals a flat 10 Damage.*

### Step 3.2: Evasion Target Calculation
**Enemy Firing at Player:**
* `Hit_Chance = 75 + (enemy_mobility - player_mobility)`

**Player Firing at Enemy:**
* `Hit_Chance = 75 + (player_mobility - enemy_mobility)`
* *(Hit_Chance is clamped to a maximum of 95% and minimum of 20%)*

### Step 3.3: Component Targeting
For every shot that successfully hits, the bot rolls `1d10` to assign the 10 damage:
* **Roll 1 - 4 (40%):** Hits Top Deck / Enemy Main Deck
* **Roll 5 - 8 (40%):** Hits Cannon Deck / Enemy Cannon Deck
* **Roll 9 - 10 (20%):** Hits Rigging / Enemy Rigging

---

## 4. Phase-Based Zone Resolution (The Tally)

At minute 30, the bot counts the remaining entities in each zone. 
`Control State = Player_Count >= Enemy_Count` (Secured) OR `Enemy_Count > Player_Count` (Overrun).

### 4.1 Defensive Zones (Player Ship)
* **If Secured:** The zone holds. No structural damage is taken.
* **If Overrun:** The enemy boarders successfully sabotage the deck. 
    * `TopDeck_HP` loses 50 HP.
    * `CannonDeck_HP` loses 50 HP.
    * `Rigging_HP` loses 30 HP.

### 4.2 The Vanguard Zone (Enemy Main Deck)
* **If Secured:** The Vanguard pushes the line. `MainDeck_HP` loses 50 HP, lowering the spawn volume for the next Clash phase. The Bridgehead is held for the Diver Team.
* **If Overrun:** The Vanguard is pushed back. The Enemy Main Deck recovers +20 HP. The Diver Team Trap Penalty is activated.

### 4.3 Interior Zones (Enemy Cannon Deck, Armory, Officer Qtrs)
* **If Secured:** The Diver Team executes their sabotage objective.
    * `EnemyCannonDeck_HP` loses 60 HP.
    * `Armory_HP` loses 50 HP.
    * `OfficerQtrs_HP` loses 50 HP.
* **If Overrun:** The Strike Team fails to breach the objective. No damage is applied to the Interior Zone components.

---

## 5. End State Triggers

* **Victory Trigger:** `(EnemyMainDeck_HP + EnemyCannonDeck_HP + EnemyRigging_HP + Armory_HP + OfficerQtrs_HP) <= 0`.
* **Defeat Trigger:** `CannonDeck_HP <= 0` AND `TopDeck_HP <= 0`. 
* **Timeout Trigger:** `Player_Total_HP - (Enemy_Total_HP * 0.5)`.

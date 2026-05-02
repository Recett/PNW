# Battle of HMS Divine — System Reference

## Ships

**HMS Divine (Defensive)** — 1000 HP total

| Component | Max HP | Derived Variable | Formula |
|---|---|---|---|
| Top Deck | 400 | `ally_sailors` | `HP / 4` |
| Cannon Deck | 300 | `player_cannon_power` | `HP` |
| Rigging | 300 | `player_mobility` | `HP / 2` |

**Arbrance Vessel (Offensive)** — 1500 HP total

| Component | Max HP | Derived Variable | Formula |
|---|---|---|---|
| Main Deck | 800 | `enemy_spawn_rate` | `HP / 16` |
| Cannon Deck | 450 | `enemy_cannon_power` | `HP` |
| Rigging | 250 | `enemy_mobility` | `HP / 2` |

---

## Combat Formulas

**Cannon power** equals the cannon deck HP directly. It represents the maximum damage output of a full volley — all shots landing.

**Shots per volley** = `cannon_power / 10`. Each shot deals a fixed 10 damage.

**Hit rate**:
```
hit_rate = (attacker_mobility + 50) / (attacker_mobility + defender_mobility + 100)
```

At full rigging (HMS Divine 150, Arbrance 125):
- HMS Divine hit rate: 200/375 = **53.3%**
- Arbrance hit rate: 175/375 = **46.7%**

**Expected volley damage** = `cannon_power × hit_rate`

| | HMS Divine | Arbrance |
|---|---|---|
| cannon_power | 300 | 450 |
| Shots | 30 | 45 |
| Hit rate (full rigging) | 53.3% | 46.7% |
| Expected volley damage | 160 | 210 |

---

## Shot Distribution

Cannon fire distributes randomly across components each volley.

| Component | Distribution |
|---|---|
| Main body (Top Deck / Main Deck) | 50% |
| Cannon Deck | 30% |
| Rigging | 20% |

**Expected damage per component per volley at full strength:**

HMS Divine receiving Arbrance fire (~21 expected hits):

| Component | HP | Expected damage |
|---|---|---|
| Top Deck | 400 | 105 |
| Cannon Deck | 300 | 63 |
| Rigging | 300 | 42 |

Arbrance receiving HMS Divine fire (~16 expected hits):

| Component | HP | Expected damage |
|---|---|---|
| Main Deck | 800 | 80 |
| Cannon Deck | 450 | 48 |
| Rigging | 250 | 32 |

---

## Cycle Structure

The battle runs in 30-minute cycles across 4–5 hours — roughly 8–10 cycles total.

**Decision** — Players act across zones for 30 minutes. Stamina is available. Actions cost stamina.

**Forced withdrawal** — At the end of each Decision phase all players are pulled back to HMS Divine regardless of position. No exceptions.

**Cannon exchange** — Both ships fire on each other. Shots are distributed across components per the distribution table above. Each shot resolves against hit rate. Hits deal 10 damage to the struck component.

**Resolution** — Control State calculated per zone. Structural damage from boarding applied. Morale updated. Chaos events fire.

**Interlude** — York posts his situation update. Stamina restores fully. Transient states clear. Next cycle begins.

---

## Player Actions

Players on HMS Divine defend their own zones. Players who have crossed to the Arbrance vessel attack its zones. Three types of action are available in any zone.

**Combat engagement** — 1v1 fight against an enemy in the current zone. Standard combat rules apply. Stamina cost is the standard combat cost.

**Traversal** — Movement between adjacent zones. Moving into or out of a hostile zone triggers a mandatory breakthrough check. Stamina cost is lower than combat.

**Zone objective** — Interaction with the structural or tactical component of the current zone. Stamina cost is moderate. Whether it succeeds depends on Attentional Mass.

---

## Morale — Main Deck Axis

The Arbrance Main Deck runs a Morale axis from -100 to +100. Enemy headcount there is effectively infinite — success is measured by pushing Morale, not clearing the deck.

Player victories increment Morale. Player deaths and enemy maneuvers decrement it.

**Gateway Lock** — Below +50 Morale, interior zones are inaccessible. Players cannot move freely to the Cannon Deck, Armory, or Officer Quarters.

**Momentum Breakthrough** — Before Morale crosses +50, a successful combat engagement on the Main Deck triggers a background probability check. On pass: Line Break. The player is displaced into an adjacent lower zone.

---

## Below-Deck Objectives

Players who reach interior zones operate behind enemy lines. Combat difficulty escalates exponentially with each engagement — they must execute the objective and retreat before being overwhelmed.

| Zone | Objective | Effect |
|---|---|---|
| Cannon Deck | Spike the guns | Reduces Arbrance cannon damage in the next exchange |
| Armory | Sever supply line | Removes `[Supplied]` buff from Main Deck enemies globally |
| Officer Quarters | Assassinate commander | Boss entity. HP resets on retreat — must be completed in one deployment. Permanently reduces `enemy_spawn_rate` on success. |

---

## Fog of War

Exact enemy counts are hidden. York's posts use contextual descriptors:

- *Swarming* — high density, high ambush risk
- *Holding the Line* — stable formation
- *Thinning* — formation breaking
- *Scattered* — low density

**Smoke** — high combat volume in enclosed lower decks pushes the zone into Smoke state. Descriptors suspended until the Interlude clears it.

---

## Battlefield Chaos

Each Resolution may fire one chaos event.

**Ambush** — a standard combat engagement resolves as Encirclement. Player is flanked into high-stakes multi-target resolution.

**Tactical Displacement** — if Main Deck takes heavy casualties, surviving enemies relocate to lower zones. Adjacent decks flood without warning.

**Dynamic NPC Crisis** — a combat engagement or objective resolution triggers a parallel crisis involving a named NPC. Player must divert their next action to secure the NPC or suffer a permanent Morale penalty.

Hale's death arrives as a Dynamic NPC Crisis. Players cannot prevent it. York reports it in the following Interlude.

---

## Zone Resolution

At the end of each Decision phase the bot calculates Control State per zone.

**HMS Divine zones — if overrun:**

| Component | HP Loss |
|---|---|
| Top Deck | -50 |
| Cannon Deck | -50 |
| Rigging | -30 |

**Arbrance zones — if secured:**

| Component | Damage Dealt |
|---|---|
| Main Deck | 50 |
| Cannon Deck | 60 |
| Rigging | 30 |

---

## End State

Arbrance vessel does not survive any outcome. The battle ends with their ship destroyed regardless of how it goes.

**Defeat trigger** — `TopDeck_HP + CannonDeck_HP + Rigging_HP ≤ 0`. HMS Divine lost before Arbrance goes down.

All other outcomes resolve at battle end with Arbrance destroyed.

---

## Outcome Tiers

Determined purely by HMS Divine HP remaining at battle end.

| Tier | HMS Divine HP | Consequence |
|---|---|---|
| 1 | > 700 | Minimal damage. Players who reached Officer Quarters recovered something from the commander's body. Contents unknown. Vorne survives. |
| 2 | 400–700 | Hull requires repair project. Something left behind in the lower decks — deliberate or accidental unclear. Vorne survives. |
| 3 | 200–400 | Significant hull damage. Supplies partially seized during the engagement. Vorne survives. |
| 4 | 1–200 | Hull severely damaged. Maximum supply loss. Something left behind. Vorne alive, condition unelaborated. |
| 5 | ≤ 0 | HMS Divine lost. Vorne's fate unknown. |

---

## York's Role

York posts each Interlude. He reports component HP in plain terms, Morale descriptor, what he observed during the cycle, and what the Arbrance vessel appears to be doing. He does not recommend actions.

Hale's death appears in one Interlude post. One sentence. The battle continues.

---

## Open Items

- Morale increment and decrement values per action type
- Reinforcement injection schedule per `enemy_spawn_rate` tier
- Officer Quarters boss stat block
- Contents of recovered and left-behind objects per outcome tier
- Vorne's exact condition in tier 4

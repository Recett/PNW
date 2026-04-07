# Combat System Reference

Source: `src/utility/combatUtility.js` and `src/utility/characterUtility.js`

---

## Table of Contents
1. [Overview](#overview)
2. [Stat Calculation](#stat-calculation)
3. [Food Buffs](#food-buffs)
4. [Initiative System](#initiative-system)
5. [Hit Rate Formula](#hit-rate-formula)
6. [Crit Formula](#crit-formula)
7. [Damage Formula](#damage-formula)
8. [Shield System](#shield-system)
9. [Ambient Effects](#ambient-effects)
10. [Post-Combat Rewards](#post-combat-rewards)
11. [Skill XP Formulas](#skill-xp-formulas)
12. [Battle Report Output](#battle-report-output)

---

## Overview

Combat is a **tick-based simulation** between a player and a single enemy. Both sides act simultaneously via an initiative tracker. The outcome (victory/defeat) is fully determined before any result is shown to the player.

Entry point: `mainCombat(playerId, enemyId, options)`

Stats are recalculated fresh before every combat by `calculateCombatStat` (defense stats) then `calculateAttackStat` (attack stats). Defense must be calculated first so the overweight penalty is available to attack stat calculation.

---

## Stat Calculation

### Defense / Combat Stats (`calculateCombatStat`)

| Stat | Formula |
|---|---|
| Max HP | `40 + CON × 6` |
| Max Stamina | `60 + CON` |
| Defense | Sum of `defense` from all equipped armor pieces |
| Speed | `AGI` (after overweight penalty, then food buff) |
| Evade | `AGI` (after overweight penalty, then food buff) |
| Max Weight | `STR` |

**Overweight Penalty** (applied when `currentWeight > maxWeight`):

$$P = \frac{(currentWeight - maxWeight)^2 \times 1.5}{currentWeight}$$

The penalty is subtracted from AGI. Effective AGI is floored at 0. The same penalty value is also subtracted from weapon accuracy in attack stat calculation.

### Attack Stats (`calculateAttackStat`, one row per equipped weapon)

| Stat | Formula |
|---|---|
| Attack | `weapon.base_damage + floor(weapon.scaling × STR)` |
| Accuracy | `max(0, floor(DEX × weapon.hit_mod) − overweightPenalty)` |
| Critical | `floor(DEX × 0.4)` (per-1000 scale) |
| Cooldown | `max(0, weapon.cooldown − floor(sqrt(AGI)))` |

> `overweightPenalty` is the same formula as the AGI reduction above but is **not** floored before being subtracted from accuracy.

**Dual Wield Penalty:** When two non-shield weapons are equipped (mainhand + offhand non-shield, or multiple non-shields), accuracy is **halved** for each weapon — unless any equipped weapon has the `No Dualwielding Penalty` tag. Shields in the offhand do **not** trigger the dual-wield penalty.

**Unarmed** (no weapons equipped):

| Stat | Value |
|---|---|
| Attack | `STR` |
| Accuracy | `0` (always misses unless food buffs are present) |
| Critical | `floor(DEX × 0.4)` |
| Cooldown | `max(0, 60 − floor(sqrt(AGI)))` |

---

## Initiative System

Combat runs for up to **400 ticks**. On every tick each attack tracker gains initiative equal to its `speed`. When `initiative >= cooldown`, the attack fires.

```
On each tick:
  tracker.initiative += tracker.speed

  while tracker.initiative >= tracker.cooldown:
    → fire the attack
    tracker.initiative -= tracker.cooldown
```

Fast weapons with low cooldowns can fire **multiple times per tick** if enough initiative accumulates.

**Starting initiative** is randomised between `0` and `speed − 1` to prevent both sides always attacking on the same tick.

**Player speed** comes from `CharacterCombatStat.speed` (AGI after overweight penalty + food buff).  
**Enemy speed** comes from `enemy.stat.speed`.

Combat ends early when all actors on one side reach 0 HP.

### Longbow — First Strike

If a player attack's `initBonus > 0` (currently only longbows: `8 × DEX`), that value is added to the tracker's starting initiative on top of the random roll. The very first firing of such a weapon is labelled **"First Strike"** in the battle report.

### Enemy `pick_one` Tag

If the enemy YAML entry has the tag `pick_one` and defines multiple attacks, one attack is randomly selected at the start of combat and only that attack is used for the entire fight.

---

## Hit Rate Formula

```
tohit = attack.accuracy
evd   = target.evade

rate  = evd / tohit
```

| Condition | Result |
|---|---|
| `tohit == 0` | Always miss (`rate = Infinity ≥ 4`) |
| `rate >= 4` | Always miss (`hitRate = 0`) |
| `rate < 1` | `hitRate > 100` — capped at 100 by the roll check |
| `0 < rate < 4` | Scaled by the formula below |

**Hit rate formula** when `0 < rate < 4`:

$$x = \frac{rate - 1}{3}$$

$$hitRate = \frac{1 - x}{1 + x} \times 100$$

A random integer from 0–99 is drawn. The attack hits if `roll < hitRate`.

**Intuition:**

| `rate` (evd / tohit) | Hit rate |
|---|---|
| 0.5 | ~133% → always hits |
| 1 | 100% |
| 2 | 50% |
| 3 | 25% |
| 4 | 0% |

---

## Crit Formula

Critical chance is on a **per-1000 scale** (e.g., a `crit` value of 600 = 60% before adjustment).

```
critRate = attack.crit × (hitRate / 100)   ← Scaled by hit probability
critResist = target.critResistance × 10    ← Converts % to per-1000

critRoll = random(0.0, 1000.0)

if critRoll < critRate:
    if critRoll < critResist:
        → CRIT RESISTED (treated as normal hit)
    else:
        → CRITICAL HIT
else:
    → Normal hit
```

**Critical resistance** occupies the low end of the crit roll window. Because the same roll is used for both checks, a resist converts the crit into a normal hit without preventing it.

---

## Damage Formula

All damage goes through `calculateDamage(attacker, tracker, target, ignoreDefense, critMultiplier)`.

### DEX/STR Variance (player only)

Before defense is applied, the raw attack value is randomised based on the player's DEX-to-STR ratio. This only applies when the attacker has both `str` and `dex` defined.

$$ratio = \frac{DEX}{STR}$$

$$t = \text{clamp}\!\left(0,1,\ \frac{ratio - 0.5}{1.5}\right)$$

$$minFraction = 0.5 + 0.5 \times t$$

$$attackVal = \text{random}\!\left(\lfloor raw \times minFraction \rfloor,\ raw\right)$$

| DEX / STR ratio | Minimum attack fraction | Effect |
|---|---|---|
| 0.5 | 50% | High variance — can deal half damage |
| 1.0 | 83% | Moderate variance |
| 2.0 | 100% | No variance — always full damage |

Enemies have no DEX/STR values (`str` and `dex` are `null`), so their damage has no variance.

### Normal Hit

$$damage = \lfloor \max(0,\ attackVal - defense) \rfloor$$

### Critical Hit

$$damage = \lfloor \max(0,\ attackVal) \times 2 \rfloor$$

Crits **ignore defense entirely** and deal 2× the randomised attack value.

### Crit Resisted

Same as a normal hit. The `critResistedDamage` value logged is:

$$critResistedDamage = critDamage - normalDamage$$

This represents the damage prevented by the resistance.

---

## Shield System

Shields are weapons with `subtype = "shield"`. Instead of dealing damage, a successful shield action adds to the **attacker's** shield buffer.

### Granting Shield

```
On hit:
  attacker.shieldStrength += tracker.attack
```

No damage is dealt to the target. Crits are not possible on shield actions.

**Greatshield** is identified by a `greatshield` tag on the item. This affects how absorbed damage depletes the buffer (see below).

### Shield Damage Absorption

When the **target** has `shieldStrength > 0`:

```
shieldAbsorbed = min(target.shieldStrength, incomingDamage)
finalDamage    = incomingDamage − shieldAbsorbed
```

| Shield Type | Shield remaining after hit |
|---|---|
| Regular shield | `0` — fully consumed on any hit regardless of damage |
| Greatshield | `shieldStrength − shieldAbsorbed` — only reduced by the amount absorbed |

---

## Ambient Effects

Ambient effects are named environmental hazards defined in the `AMBIENT_EFFECTS` table inside `combatUtility.js`. They are opt-in: `mainCombat` must be called with `options.ambientEffect = '<name>'`.

### Bilge Miasma (`bilge_gas`)

Fires every **50 ticks**. On each trigger the player makes a CON save:

$$DC = \min(1000,\ CON \times 50)$$

A d1000 roll (1–1000) is drawn. The save **passes** if `roll ≤ DC`.

**On failure:**

$$damage = miasmaStacks \times \left\lfloor \frac{maxHP}{100} \right\rfloor$$

Then `miasmaStacks` is incremented by 1.

- Stacks and damage increase with each failed save.
- Stacks persist in `CharacterStatus` (source: `'bilge'`) and survive across multiple combats.
- Stacks are cleared (row deleted) if they reach 0 after combat.

At CON = 20 the DC is capped at 1000, guaranteeing a pass on every trigger.

---

## Post-Combat Rewards

Rewards are only granted when the **player wins** (enemy HP = 0, player HP > 0).

### When the Player Loses (HP = 0)

A `knocked_out` debuff is applied (`CharacterStatus`, scope: `persistent`, expires in **12 hours**).

### Gold

Fixed value from `enemy.reward.gold`. Added directly to character gold.

### Item Drops

Enemy drops are taken from both `reward.item[]` and top-level `drop[]` arrays. Each entry has a `chance` (0–1) and `quantity`. A random roll determines whether each item drops.

### Character Experience

$$XP = \max\!\left(1,\ \left\lfloor \frac{100}{\sqrt{playerLevel}} \times \left(\frac{mobLevel}{playerLevel}\right)^{1.2} \right\rfloor \right)$$

- Higher mob level relative to player level → more XP.
- Lower player level → more base XP per kill.
- Scales smoothly so grinding lower-level enemies eventually yields diminishing returns.

---

## Skill XP Formulas

Skill XP uses a logarithmic formula so bulk damage produces rapidly diminishing returns.

### Weapon Skill XP

Applied **per weapon** based on total damage dealt with that weapon during the fight.

$$XP = \left\lfloor \frac{\log_{10}(damage + 1) \times 100}{skillLevel + 1} \right\rfloor$$

Skill is matched to the weapon's `subtype` (e.g., Sword, Axe, Unarmed). For shields, `damage` is replaced with total **shield granted + shield absorbed** during the fight.

### Armor Skill XP

Applied **per armor subtype** based on total damage mitigated while wearing that armor type.

$$XP_{base} = \left\lfloor \frac{\log_{10}(totalMitigation + 1) \times 100}{skillLevel + 1} \right\rfloor$$

$$XP = XP_{base} \times armorPieceCount$$

**Total Mitigation** is the sum of three components:

| Component | How it's counted |
|---|---|
| `damageDodged` | For each **missed** enemy attack: `max(0, attackValue − playerDefense)` |
| `damageReduced` | For each **non-crit hit**: `attackValue − damageReceived` |
| `critResistedTotal` | For each resisted crit: `critDamage − normalDamage` |

Note: Dodge XP is counted *after armor* — higher defense means less XP from pure evasion.

---

## Battle Report Output

`writeBattleReport(combatLog, actors, lootResults, combatLogSetting)` generates the Discord message.

- Consecutive attacks from the same attacker with the same weapon are **grouped** into a single block.
- If the report exceeds **4000 characters** (Discord embed limit):
  - `short` mode (default): shows first 6 and last 6 action lines, truncates the middle.
  - `long` mode: paginates into multiple messages.

The report sections are:

```
⚔️ BATTLE REPORT ⚔️
[Action lines]

🏆 BATTLE OUTCOME 🏆
💰 REWARDS 💰     (only on player victory)
🗡️ SKILL XP 🗡️   (only if weapon XP gained)
🛡️ ARMOR XP 🛡️   (only if armor XP gained)
```

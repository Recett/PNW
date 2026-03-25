# Combat System Reference

Source: `src/utility/combatUtility.js` and `src/utility/characterUtility.js`

---

## Table of Contents
1. [Overview](#overview)
2. [Stat Calculation](#stat-calculation)
3. [Initiative System](#initiative-system)
4. [Hit Rate Formula](#hit-rate-formula)
5. [Crit Formula](#crit-formula)
6. [Damage Formula](#damage-formula)
7. [Shield System](#shield-system)
8. [Post-Combat Rewards](#post-combat-rewards)
9. [Skill XP Formulas](#skill-xp-formulas)
10. [Battle Report Output](#battle-report-output)

---

## Overview

Combat is a **tick-based simulation** between a player and a single enemy. Both sides act simultaneously via an initiative tracker. The outcome (victory/defeat) is fully determined by the simulation before any result is shown to the player.

Entry point: `mainCombat(playerId, enemyId)`

---

## Stat Calculation

Stats are recalculated fresh before every combat by `calculateCombatStat` and `calculateAttackStat`.

### Defense / Combat Stats

| Stat | Formula |
|---|---|
| Max HP | `40 + CON × 6` |
| Max Stamina | `60 + CON` |
| Defense | Sum of `defense` from all equipped armor pieces |
| Speed | AGI (after overweight penalty) |
| Evade | AGI (after overweight penalty) |
| Max Weight | STR |

**Overweight Penalty** (applied when `currentWeight > maxWeight`):

$$P = \frac{(currentWeight - maxWeight)^2 \times 1.5}{currentWeight}$$

The resulting penalty is subtracted from AGI. Effective AGI is floored at 0.

### Attack Stats (per equipped weapon)

| Stat | Formula |
|---|---|
| Attack | `weapon.base_damage + floor(weapon.scaling × STR)` |
| Accuracy | `floor(DEX × weapon.hit_mod) − overweightPenalty` |
| Critical | `floor(DEX × 0.4)` (per-1000 scale) |
| Cooldown | `max(0, weapon.cooldown − floor(sqrt(AGI)))` |

**Dual Wield Penalty:** When two weapons are equipped (mainhand + offhand, or multiple weapons), accuracy is halved for each weapon — unless any equipped weapon has the `No Dualwielding Penalty` tag.

**Unarmed** (no weapons equipped):

| Stat | Value |
|---|---|
| Attack | STR |
| Accuracy | 0 |
| Critical | `floor(DEX × 0.4)` |
| Cooldown | `max(0, 60 − floor(sqrt(AGI)))` |

---

## Initiative System

Combat runs for up to **100 ticks**. On every tick, each attack tracker gains initiative equal to its `speed`. When `initiative >= cooldown`, the attack fires.

```
On each tick:
  tracker.initiative += tracker.speed

  while tracker.initiative >= tracker.cooldown:
    → fire the attack
    tracker.initiative -= tracker.cooldown
```

This means fast weapons with low cooldown can fire **multiple times per tick** if initiative accumulates enough.

**Starting initiative** is randomised between `0` and `speed − 1` to prevent both sides always attacking on the same tick.

**Player speed** comes from `CharacterCombatStat.agi` (after overweight penalty).
**Enemy speed** comes from `enemy.stats.speed`.

Combat ends early when all actors on one side reach 0 HP.

---

## Hit Rate Formula

```
tohit = attack.accuracy
evd   = target.evade

rate  = evd / tohit
```

| Condition | Result |
|---|---|
| `tohit == 0` | Always hit (hitRate = 100) |
| `rate >= 4` | Always miss (hitRate = 0) |
| `1 ≤ rate < 4` | Scaled by sigmoid-like formula (see below) |
| `rate < 1` | hitRate > 100 (capped at 100 by roll logic) |

**Hit rate formula** when `0 < rate < 4`:

$$x = \frac{rate - 1}{3}$$

$$hitRate = \frac{1 - x}{1 + x} \times 100$$

A random roll from 0–99 is drawn. The attack hits if `roll < hitRate`.

**Intuition:**
- `rate = 1` (evade = accuracy) → 100% hit rate
- `rate = 2` → 50% hit rate
- `rate = 4` → 0% hit rate

---

## Crit Formula

Critical chance is on a **per-1000 scale** (e.g., a `crit` value of 600 = 60% before adjustment).

```
critRate = attack.crit × (hitRate / 100)   ← Scaled by hit probability
critResist = target.critResistance × 10    ← Converts % to per-1000

critRoll = random(0, 1000)

if critRoll < critRate:
    if critRoll < critResist:
        → CRIT RESISTED (treated as normal hit)
    else:
        → CRITICAL HIT
else:
    → Normal hit
```

**Critical resistance** occupies the low end of the crit roll window. Because the same roll is used for both the crit check and the resist check, a resist effectively converts the crit into a normal hit. It does **not** prevent the hit.

---

## Damage Formula

All damage goes through `calculateDamage(attacker, tracker, target, ignoreDefense, critMultiplier)`.

### Normal Hit

$$damage = \lfloor \max(0,\ attack - defense) \times 1 \rfloor$$

### Critical Hit

$$damage = \lfloor \max(0,\ attack) \times 2 \rfloor$$

Crits **ignore defense entirely** and deal 2× the unmitigated attack value.

### Crit Resisted

$$damage = \lfloor \max(0,\ attack - defense) \times 1 \rfloor$$

Same as a normal hit. The `critResistedDamage` value logged is:

$$critResistedDamage = critDamage - normalDamage$$

This represents the damage that was prevented by the resistance.

---

## Shield System

Shields are weapons with `subtype = "shield"`. Instead of dealing damage, a successful shield action grants the **attacker** a shield buffer.

### Granting Shield (Shield Weapon Attacks)

```
On hit:
  attacker.shieldStrength += tracker.attack
```

No damage is dealt. Crits are not possible on shield actions.

**Greatshield** is identified by a `greatshield` tag on the item. The distinction affects how the shield absorbs damage (see below).

### Shield Damage Absorption (Incoming Damage to a Shielded Target)

When the **target** has a `shieldStrength > 0`:

```
shieldAbsorbed = min(target.shieldStrength, incomingDamage)
finalDamage = incomingDamage − shieldAbsorbed
```

| Shield Type | Shield Remaining After Hit |
|---|---|
| Regular shield | `0` (fully consumed on any hit) |
| Greatshield | `shieldStrength − shieldAbsorbed` (only reduced by absorbed amount) |

Shield absorption is logged per hit for the battle report.

---

## Post-Combat Rewards

Rewards are only granted when the **player wins** (enemy HP = 0, player HP > 0).

### Gold

Fixed value from `enemy.reward.gold`. Added directly to character gold.

### Item Drops

Each drop entry has a `chance` (0–1) and `quantity`. A random roll determines whether each item drops.

### Character Experience

$$XP = \max\!\left(1,\ \left\lfloor \frac{100}{\sqrt{playerLevel}} \times \left(\frac{mobLevel}{playerLevel}\right)^{1.2} \right\rfloor \right)$$

- Higher mob level relative to player level → more XP.
- Lower player level → more base XP per kill.
- Scales smoothly so grinding lower-level enemies eventually yields diminishing returns.

---

## Skill XP Formulas

Skill XP uses a logarithmic formula so that bulk damage produces rapidly diminishing returns.

### Weapon Skill XP

Applied **per weapon** based on total damage dealt with that weapon during the fight.

$$XP = \left\lfloor \frac{\log_{10}(damage + 1) \times 100}{skillLevel + 1} \right\rfloor$$

Skill is matched to the weapon's `subtype` (e.g., Sword, Axe, Unarmed). Shields track total **shield granted + shield absorbed** instead of raw damage.

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
- If the report exceeds 2000 characters (Discord limit):
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

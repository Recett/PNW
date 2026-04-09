# Parry Mechanic — Design Reference

## Identity

Parry is the Rapier's core defensive mechanic. It is not damage negation — it is deflection. The hit lands, but parry changes how much of it gets through. A successful parry is the entry condition for Riposte; the defensive reduction is the secondary benefit.

---

## ParryPower

```
ParryPower = Equipment base stat + (DEX × scaling) + (Rapier skill level × 4%)
```

Rapier skill contribution drops to 1% per level when a Rapier is unequipped.

---

## Parry Chance Formula

```
Ratio = Damage / (ParryPower × 2)

P_parry = 0.60 ^ max(Ratio, 1)
```

- When Damage ≤ ParryPower × 2: Ratio < 1, clamped to 1. P_parry = 60% (ceiling).
- As Damage scales above that threshold, parry chance degrades exponentially.
- No artificial cap needed — the formula handles high-damage enemies naturally.

---

## On Successful Parry

| Roll | Damage Reduced |
|------|---------------|
| 60%  | 50%           |
| 30%  | 75%           |
| 10%  | 100%          |

Reduction applies **pre-mitigation** (before armor defense).

**Expected reduction on a successful parry:** 62.5%
**Expected damage taken at full PP (60% parry chance):** 62.5% of the original hit (37.5% reduction overall)

---

## ParryPower Degradation

Each incoming hit degrades ParryPower to **30% of its current value**.

| Hit | PP Remaining |
|-----|-------------|
| 1st | 100%        |
| 2nd | 30%         |
| 3rd | 9%          |
| 4th+ | ~0%        |

**Reset:** ParryPower returns to full when the player's attack fires — hit or miss. The act of swinging resets stance.

This produces two distinct natural counters without explicit statement:

- **Fast enemies** land multiple hits before player attack fires — guard collapses under volume even if each hit is weak.
- **Heavy enemies** get one shot at full PP — the ratio formula handles that.

---

## Stat Relationships

- **DEX** drives ParryPower directly. Primary stat for Rapier builds.
- **STR** is required for heavy armor. A player investing in both spreads stats thin — the STR/DEX tension self-limits the combination without a hard rule.
- **AGI** speeds up attack cooldown, resetting PP more frequently. Counterintuitively beneficial — fast guard reset is coherent with the Rapier fantasy. The old assumption that high AGI hurts Rapier does not apply under this system.

---

## Stress Test Summary

| Scenario | Behavior |
|----------|----------|
| Fast weak enemy | Guard collapses by hit 3–4 despite low per-hit damage. Volume is punishing. |
| Slow heavy enemy | Full PP on every hit. Ratio formula degrades parry chance against massive hits. |
| Fast heavy enemy | Both counters activate simultaneously. Parry is nearly bypassed by hit 3. |

---

## Open Items

- Exact DEX scaling value (the multiplier in ParryPower formula) — not yet set.
- Exact equipment base stat range — not yet set.
- Riposte counter-attack interaction with the pre-mitigation parry result (Follow Through perk implies this matters).

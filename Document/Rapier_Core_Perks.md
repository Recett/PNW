# Rapier — Core Perk Design

## Architecture

Two trees: Parry and Riposte. Parry raises Pmax (parry chance ceiling). Riposte enables and scales the counter-attack on successful parry. Both trees unlock linearly — must unlock I before II.

Equip costs are standalone. Each perk's cost is paid independently; prior tiers do not need to be equipped to equip a later one.

Player budget: 1 point per level. At level 60 (tree completion), budget is 60. At level 100 (cap), budget is 100.

---

## Parry Tree

Raises Pmax. Base Pmax without any Parry investment: **40%**.

| Name | ID | Unlock Level | Equip Cost | Effect |
|------|----|-------------|------------|--------|
| En Garde | rapier-en-garde | 1 | 5 | Unlocks the Parry mechanic. Pmax: 40%. |
| Parry I | rapier-parry-1 | 6 | 10 | Pmax: 44%. |
| Parry II | rapier-parry-2 | 20 | 15 | Pmax: 48%. |
| Parry III | rapier-parry-3 | 36 | 22 | Pmax: 52%. |
| Parry IV | rapier-parry-4 | 50 | 30 | Pmax: 56%. |
| Parry V | rapier-parry-5 | 58 | 50 | Pmax: 60%. |

---

## Riposte Tree

Enables counter-attack on successful parry. Without any Riposte investment, a successful parry produces no counter-attack.

| Name | ID | Unlock Level | Equip Cost | Multiplier |
|------|----|-------------|------------|------------|
| Riposte I | rapier-riposte-1 | 12 | 10 | 50% |
| Riposte II | rapier-riposte-2 | 28 | 15 | 70% |
| Riposte III | rapier-riposte-3 | 44 | 22 | 90% |
| Riposte IV | rapier-riposte-4 | 54 | 30 | 120% |
| Riposte V | rapier-riposte-5 | 60 | 50 | 150% |

Multiplier applies to the player's normal attack damage. Defense is subtracted after multiplication.

---

## Build Snapshots at Level 100 (budget: 100)

| Build | Perks equipped | Cost | Remaining |
|-------|---------------|------|-----------|
| Pure Parry V | En Garde + Parry V | 5 + 50 = 55 | 45 |
| Pure Riposte V | En Garde + Riposte V | 5 + 50 = 55 | 45 |
| Split III/III | En Garde + Parry III + Riposte III | 5 + 22 + 22 = 49 | 51 |
| Dip (Parry V + Riposte I) | En Garde + Parry V + Riposte I | 5 + 50 + 10 = 65 | 35 |
| Both maxed | En Garde + Parry V + Riposte V | 5 + 50 + 50 = 105 | — impossible — |

---

## Expected Output Reference

Expected Riposte per incoming enemy hit = Pmax × Riposte multiplier × normal attack damage.

| Parry tier (Pmax) | Riposte tier (mult) | Expected Riposte per hit |
|-------------------|---------------------|--------------------------|
| Base (40%) | I (50%) | 0.20× |
| Parry III (52%) | III (90%) | 0.47× |
| Base (40%) | V (150%) | 0.60× |
| Parry V (60%) | V (150%) | 0.90× |

---

## Notes

- Middle tiers (Riposte II–III) have thin marginal gains (+20 each). Monitor in playtesting for players skipping directly from I to IV.
- En Garde is the entry cost for the entire weapon identity. Players who skip it have no parry mechanic at all.
- Build perk budget (remaining after core investment) ranges 35–51 at level 100. Build perk costs must be designed within this range.

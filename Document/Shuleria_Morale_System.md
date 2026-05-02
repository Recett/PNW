# Battle of HMS Divine — Morale System Reference

## Timing

| Phase | Duration |
|---|---|
| Player phase | 1 hour |
| Cannon phase | 8 hours |

The game start at -40 morale.

---

## Scale

-100 to +100.

Zero is the natural resting state of an uncontested battle. Positive morale reflects players pushing into enemy territory and winning. Negative morale reflects players losing ground.

---

## Generation

Per-kill morale values assigned to enemies. Higher enemies in further locations drop more.

| Enemy | Morale on kill |
|---|---|
| Sailor | +1 |
| Cutthroat | +1 |
| Boarder | +2 |
| Man-at-Arms | +2 |
| Crossbowman | +2 |
| Swashbuckler | +2 |
| Veteran Sailor | +3 |
| Boss (unique per voyage) | +10 |

Boss enemies: Boatswain, Master-at-Arms, Master Gunner, First Mate, Ship's Captain, Quartermaster.

Each boss kill permanently reduces the morale drain baseline by 2 for the remainder of the battle. Maximum reduction: 12 (all 6 bosses killed).

Avoiding a challenge entirely: -2 flat regardless of enemy.
Defeated in combat: -3 flat regardless of enemy.

---

## Drain

Applied per player phase. Two components.

**Baseline drain:** -20 unconditional. Applies regardless of morale level or player activity. Minimum viable activity (~10 fights) barely offsets this. A completely inactive phase loses 20 morale.

**Progressive drain:** `morale × 0.30`

**Total drain per player phase:**

| Morale | Baseline | Progressive | Total | Generation to hold |
|---|---|---|---|---|
| 30 | -20 | -9 | -29 | 29 |
| 50 | -20 | -15 | -35 | 35 |
| 70 | -20 | -21 | -41 | 41 |
| 100 | -20 | -30 | -50 | 50 |

Every 100 hp lost on Abrence ship Top Deck add +2, and every 100 hp lost on HMS Divine Top Deck add -2


---

## Negative Morale

No passive recovery. Players must fight to climb out.

Drain slows with depth — not as a reward, but because the floor exists.

| Morale | Dampening factor | Effective drain per phase |
|---|---|---|
| 0 to -20 | 1.0 | -20 |
| -21 to -40 | 0.8 | -16 |
| -41 to -60 | 0.6 | -12 |
| -61 to -80 | 0.4 | -8 |
| -81 to -100 | 0.2 | -4 |

A completely inactive server floors at -100 and stays there. Hull damage fires every cannon phase throughout.

---

## Location Modifiers

Morale is read as effective morale at the target location. Entry requires effective morale ≥ 0.

| Location | Modifier | Morale required to enter |
|---|---|---|
| Lower Deck (homebase) | 0 | None |
| Arbrance Main Deck | -25 | 25 |
| Arbrance Below Deck | -40 | 40 |

Entering a location before effective morale is positive means more negative combat events than positive ones. Entering early is a choice — take risk now to push morale faster, or wait until the location is safer.

Reaching Arbrance Below Deck requires sustained above-average performance across multiple player phases. At average performance stabilizing around 30, players cannot reach it without a coordinated push.

---

## Damage

Applied once per cannon phase based on morale at that moment.

**Formula:** `damage = morale^1.5 / 20`

Negative morale mirrors symmetrically — same formula, damage hits HMS Divine instead of Arbrance. Damage is applied to Top Deck
Rigging take 1/4 of the damage to Top Deck

---

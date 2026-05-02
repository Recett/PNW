# Battle of HMS Divine 窶・Implementation Audit
**Date:** 2026-04-27  
**Scope:** Code vs. design intent. Reference doc (`Shuleria_Battle_HMS_Divine.md`) treated as one input among several, not as sole ground truth.

---

## Audit Method

All findings were derived by reading the live code directly:
- `src/utility/battleUtility.js`
- `src/commands/adventuring/fight.js`
- `src/commands/adventuring/act.js`
- `src/commands/admin/battle.js`
- `src/utility/cronUtility.js`
- `src/content/events/hms_divine_orientation.yaml`
- `src/content/events/hms_divine_objectives.yaml`
- `src/content/events/hms_divine_interlude.yaml`
- `src/content/events/hms_divine_end.yaml`

The spec doc and implementation tracker are cited as supporting context only.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| 笨・| Correctly implemented and matches design |
| 笞・・| Partially implemented or uncertain |
| 笶・| Not implemented |
| 閥 | Actively incorrect 窶・code does the wrong thing |

---

## Section 1 窶・Cannon Exchange

| Item | Status | Notes |
|---|---|---|
| Hit rate formula: `(atk_mob + 50) / (atk_mob + def_mob + 100)` | 笨・| Exact match in `simulateVolley` |
| `attackerMobility = riggingHp / 2` | 笨・| Correct in `runCannonExchange` |
| Shots per volley = `cannonPower / 10` | 笨・| Matches spec |
| Shot distribution: 50% top deck, 30% cannon, 20% rigging | 笨・| Matches spec (`roll < 0.5`, `roll < 0.8`) |
| Each shot = fixed 10 damage | 笨・| Correct |
| HP initial values (HMS: 400/300/300, Arb: 800/450/250) | 笨・| Correct in `_setInitialFlags` |
| Cannon exchange fires each cycle | 笨・| Step 2 in `performHMSDivineBattleCycle` |
| Armory wave wins reduce arb cannon power in exchange | 笨・| `getArmoryCannonDebuff()` returns 0–20% damage reduction based on `arb_armory_secured` (20% flat if secured) or wins (2% per win). Applied in `runCannonExchange`. `arb_supply_severed` fully removed from codebase; superseded by armory wave system (2026-04-30). |

---

## Section 2 窶・Cycle Flow

| Item | Status | Notes |
|---|---|---|
| 30-minute cycle via cron | 笨・| `battleCycleJob` at `0,30 * * * *` |
| Forced withdrawal fires first | 笨・| Step 1 of `performHMSDivineBattleCycle` |
| Cannon exchange fires after withdrawal | 笨・| Step 2 |
| Morale decay -5 per cycle | 笨・| Step 3 |
| Cycle counter increments | 笨・| Step 4 |
| York cycle report posted | 笨・| Step 5 |
| End condition checked | 笨・| Step 6 |
| Per-cycle trackers reset | 笨・| Step 7 (`resetCycleTrackers()`). `arb_supply_severed` no longer reset here — flag removed from codebase. |
| Resolution phase (Control State, zone damage) | 笶・| Not present anywhere in cycle. See Section 5. |
| Interlude stamina restore | 笶・| `performCronJob` excludes HMS/Arbrance players from regen but no separate full-restore is added at interlude. Players in battle zones never get stamina back. |
| Chaos events | 笶・| Not implemented (see Section 6) |

---

## Section 3 窶・Cross-Ship Movement & Boarding

| Item | Status | Notes |
|---|---|---|
| Player registration with NPC for offense/defense | 笶・| York's hub has no register/volunteer option. It only provides zone briefings. |
| Programmatic assignment to Arbrance zones at phase start | 笶・| `assignPlayersToZones` only rallies all players to `BOONG_SINH_HOAT_ID`. It does not assign anyone to Arbrance. |
| 10-minute orientation window between cycles | 笶・| No timer, no gate, no flag. The cycle is one continuous 30-minute window. |
| Free `/move` boarding paths between ships | 笨・| `sealBattleLocations` adds `Boong Trﾃｪn 竊・arb_main_deck` (one-way) and `HMS Rigging 竊・Arb Rigging` (bidirectional). Players cross via `/move` 窶・this is the intended boarding path design. |
| Vanguard mechanic (TBD) | 笶・| Never designed further. No code. |

---

## Section 4 窶・Morale & Gateway Lock

| Item | Status | Notes |
|---|---|---|
| Morale range -100 to +100 | 笨・| Clamped correctly in `updateMorale` |
| Morale decay -5 per cycle | 笨・| In `performHMSDivineBattleCycle` |
| Morale increments on player combat victory | 笶・| `/fight` does not call `updateMorale` on win. Morale only ever decays. |
| Morale decrements on player death | 笶・| Not implemented |
| Fog of war descriptors (Swarming / Holding the Line / Thinning / Scattered) | 笞・・| `getMoraleDescriptor` exists but the thresholds are reversed from spec intent. Spec: Swarming = high enemy density = bad for players = low/negative morale. Code: Swarming = morale 竕･ 50 = high positive morale. The morale axis direction may need clarification. |
| Gateway lock: interior zones inaccessible below +50 morale | 笶・| Neither `/act` nor `/fight` nor `/move` checks morale before allowing interior zone access. |
| Momentum Breakthrough: Line Break on Main Deck victory | 笶・| No post-combat hook in `/fight` for `arb_main_deck`. |

---

## Section 5 窶・Zone Resolution

| Item | Status | Notes |
|---|---|---|
| Control State calculation per zone at end of Decision phase | 笶・| No implementation anywhere. |
| HMS zone overrun 竊・HP loss (Top -50, Cannon -50, Rigging -30) | 笶・| Not implemented. |
| Arbrance zone secured 竊・damage dealt (Main 50, Cannon 60, Rigging 30) | 笶・| Not implemented. |
| Zone resolution step in cycle between forcedWithdrawal and cannon exchange | 笶・| The cycle goes: withdrawal 竊・cannon exchange 竊・morale decay. No resolution step. |

---

## Section 6 窶・Battlefield Chaos

| Item | Status | Notes |
|---|---|---|
| Chaos event roll each resolution | 笶・| Not implemented |
| Ambush event | 笶・| Not implemented |
| Tactical Displacement event | 笶・| Not implemented |
| Dynamic NPC Crisis event | 笶・| Not implemented |
| Hale's death as hard-coded cycle NPC crisis | 笶・| No cycle check for Hale. Note: the spec names the commander "Hale" but `hms-assassinate-commander` targets a character York also names "Hale" 窶・the plot NPC and the enemy boss appear to share identity. This needs clarification before the crisis is implemented. |

---

## Section 7 窶・Below-Deck Objectives (/act)

| Item | Status | Notes |
|---|---|---|
| Cannon Deck: spike guns 竊・stat check 竊・reduce arb cannon HP | 笨・| `hms-spike-guns`: strength check, -30 `arb_cannon_deck_hp` on success |
| Armory: sever supply 竊・routes to armory wave encounter system | 笨・| `hms-sever-supply` event: flag action removed; only XP reward (200) remains. Cannon debuff now handled by `getArmoryCannonDebuff()` via armory wave wins. Superseded (2026-04-30). |
| Officer Quarters: assassinate Hale 竊・combat 竊・flag + HP reduction | 笨・| `/act` routes to `hms-assassinate-commander`; success sets `arb_commander_slain = 1` and reduces `arb_main_deck_hp` by 100 |
| Commander HP resets on retreat (must be one-run kill) | 笶・| Hale uses a standard enemy (`arbrance-commander`). No persistent HP tracking across attempts. The "HP resets on retreat" mechanic is not enforced. |
| `/act` available only in interior Arbrance zones | 笨・| `ZONE_OBJECTIVE_MAP` has no entry for `arb_main_deck` or `arb_rigging`; those return "no objective available" |
| Stamina cost variance by action type | 笞・・| Flat `STAMINA_COST = 3` for all `/act` actions including the commander fight |

---

## Section 8 窶・End Conditions & Outcome Tiers

| Item | Status | Notes |
|---|---|---|
| Defeat trigger: HMS total HP 竕､ 0 | 笨・| `checkEndConditions` checks `hmsTotalHp <= 0` |
| Max cycles (10) triggers end | 笨・| `cycleCount >= 10` |
| Arbrance destroyed trigger | 笨・| `arbTotalHp <= 0` |
| Tier thresholds (>700 / 400窶・00 / 200窶・00 / 1窶・00 / 竕､0) | 笨・| `getEndTierEventId` matches spec |
| End tier events posted | 笨・| `endBattle` fires `hms-divine-battle-end-announce` + tier event |
| `hms_divine_sunk` flag set on defeat | 笞・・| `_setInitialFlags` initializes it to 0, but nothing ever sets it to 1. `endBattle` selects `end-tier5` if `reason === 'hms_sunk'` but never writes the flag. The flag exists in state but is always 0 even during and after a sunk outcome. |
| All players moved to Strange Shore on battle end | 笨・| `forcedWithdrawal` covers all battle zones (HMS zones 4窶・, all Arbrance zones, HMS Rigging) 窶・every player is moved to the `hms_divine_strange_shore` location (created by `ensureStrangeShoreLocation` if absent). No zone is excluded. |

---

## Section 9 窶・York Orientation Hub

| Item | Status | Notes |
|---|---|---|
| York routed to `york-battle-hub` during battle | 笨・| `york-approach` in prologue YAML routes to hub when `hms_divine_battle_initialized = 1` |
| Zone briefings (main deck, cannon, armory, officer quarters, defense) | 笨・| All 5 briefings implemented |
| Status overview | 笨・| `york-battle-status` implemented (static text, not dynamic HP readout) |
| Register for offense/defense | 笶・| No such option exists in the hub |
| York's Interlude post uses dynamic HP/morale values | 笶・| `york-cycle-report` is static text. It does not pull actual HP or morale values. York always says the same thing regardless of battle state. |

---

## Section 10 窶・HMS Defense (HMS Zones)

| Item | Status | Notes |
|---|---|---|
| HMS zone IDs defined (4窶・ + rigging) | 笨・| `HMS_ZONE_IDS = [4,5,6,7,8]` + dynamic rigging |
| Players rallied to rally point on battle start | 笨・| `assignPlayersToZones` moves everyone to `BOONG_SINH_HOAT_ID` |
| HMS zones have any defense objective mechanic | 笶・| No `/act` equivalent for HMS zones. No `/defend` command. The `hms-divine-fortify` event is a stub comment only. |
| Enemy attacks on HMS zones drive HP loss (aside from cannon exchange) | 笶・| HP loss on HMS zones only comes from cannon exchange. There is no boarding attack mechanic where Arbrance enemies damage zone HP via player-adjacent combat. |

---

## Summary 窶・Counts

| Status | Count |
|---|---|
| 笨・Correctly implemented | 24 |
| 笞・・Partial / uncertain | 5 |
| 笶・Not implemented | 21 |
| 閥 Actively incorrect | 1 |

---

## Priority Issues (Decisions Needed Before Live)

These are items where the code actively does the wrong thing or a core game loop is broken:

1. **閥 Cross-ship free movement via `/move`** 窶・`Boong Trﾃｪn 竊・arb_main_deck` and `HMS Rigging 竊・Arb Rigging` links must be removed from `sealBattleLocations`. The boarding mechanism needs to be designed (NPC registration flow or otherwise).

2. **笶・Stamina never restores during battle** 窶・Players in HMS/Arbrance zones are excluded from cron regen and no interlude restore exists. After 2窶・ cycles every player is at 0 stamina and cannot act.

3. **笶・Morale never increases** 窶・Only decays -5 per cycle. Player combat victories have no effect. Morale will always reach -100 by cycle 10 regardless of player performance.

4. ~~**Supply severed has no effect**~~ **Superseded (2026-04-30)** — `arb_supply_severed` fully removed from codebase. Cannon debuff now handled by `getArmoryCannonDebuff()` via armory wave wins (see Section 1 and tracker §19).

5. **笶・Zone Resolution missing** 窶・The entire Resolution phase is absent. HMS zones can never be "overrun" and Arbrance zones can never be "secured" for structural damage purposes. The battle is effectively decided by cannon exchange alone.

6. **笶・York's cycle report is static** 窶・Always posts the same text. Fog of war and situational reporting are absent.

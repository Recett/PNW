# Battle of HMS Divine 窶・Implementation Tracker

Reference design: `Document/Shuleria_Battle_HMS_Divine.md`

---

## How to use this document

Each entry states the design requirement, what the code actually does, where to find it, and what is missing. Use this to audit whether the implementation matches the spec.

| Symbol | Meaning |
|---|---|
| 笨・| Matches spec |
| 噺 | Partial 窶・something is missing |
| 笶・| Not implemented |
| 笞・・| Intentional deviation or unresolved question |

---

## 1 窶・Ship HP Structure

**Design says:** HMS Divine has 3 components (Top Deck 400, Cannon Deck 300, Rigging 300). Arbrance has 3 components (Main Deck 800, Cannon Deck 450, Rigging 250).

**Code does:** `_setInitialFlags()` in `battleUtility.js` sets all 6 flags when the battle starts.

**Verify:** In `battleUtility.js`, search `_setInitialFlags` 窶・check the 6 HP values.

**Status:** 笨・Values match spec exactly.

---

## 2 窶・Cannon Exchange Formula

**Design says:** `shots = cannon_power / 10`. `hit_rate = (attacker_mobility + 50) / (attacker_mobility + defender_mobility + 100)`. Mobility = `rigging_hp / 2`. Shot distribution: 50% top deck, 30% cannon deck, 20% rigging. Each hit = 10 damage.

**Code does:** `simulateVolley(cannonPower, attackerMobility, defenderMobility)` in `battleUtility.js`. Called by `runCannonExchange()` which derives `mobility = floor(riggingHp / 2)` for each side.

**Verify:** In `simulateVolley()` 窶・check shots calculation, hitRate formula, distribution thresholds. In `runCannonExchange()` 窶・check `riggingHp / 2`.

**Status:** 笨・Formula matches spec exactly.

---

## 3 窶・Battle Cycle Execution

**Design says:** Each cycle runs: Decision (players act) 竊・Cannon Exchange 竊・Resolution 竊・Interlude (York posts, transient states clear).

**Code does:** `performHMSDivineBattleCycle(client)` in `battleUtility.js`. Steps in order:
1. `resolveZones()` 窶・boarding damage
2. `runCannonExchange()` 窶・cannon fire
2a. Post cannon volley announcement via event (`hms-divine-cannon-volley`)
3. `updateMorale(-5)` 窶・morale decay
4. increment `hms_divine_cycle_count`
5. Post York cycle report via event (`york-cycle-report`)
6. `checkEndConditions()` 窶・end battle if max cycles or HP 竕､ 0
7. `resetCycleTrackers()` 窶・clear per-cycle transient flags

Cron schedule: `'0 */8 * * *'` (every 8 hours) in `cronUtility.js`.

**Verify:** In `performHMSDivineBattleCycle` 窶・step order. In `cronUtility.js` 窶・search `battleCycleJob`.

**Status:** 笞・・Three deviations from spec:

> **Gap A 窶・Cycle frequency is 12 hours, not 30 minutes.**  
> Cron: `'0 */8 * * *'` (every 8 hours). Matches `Shuleria_Morale_System.md` cannon phase timing.



---

## 4 窶・Zone Resolution (Boarding Damage)

**Design says:** At Resolution, if Arbrance zones are occupied 竊・damage to that zone's HP. If HMS zones are overrun 竊・HMS HP loss.

**Code does:** `resolveZones()` in `battleUtility.js`. Iterates all 5 Arbrance zones; for the 3 that have an HP flag (Main Deck, Cannon Deck, Rigging), if at least one player is present, reduces that flag: Main Deck 竏・0, Cannon Deck 竏・0, Rigging 竏・0. Armory and Officer Quarters are skipped 窶・they have no HP flag.

**Verify:** In `resolveZones()` 窶・check `ZONE_DAMAGE` map and which HP flags are modified.

**Status:** 噺

> **Gap 窶・HMS zone overrun not implemented.**  
> `resolveZones()` only processes Arbrance zones. The equivalent check for HMS Divine zones (HMS Top Deck 竏・0, Cannon Deck 竏・0, Rigging 竏・0 when those zones have Arbrance sailors) is not present.

---

## 5 窶・Morale Axis

**Design says:** Morale runs 竏・00 to +100. Player combat victories increment morale. Player deaths decrement it. Passive decay per phase. Gateway Lock: below morale threshold, interior zones (Cannon Deck, Armory, Officer Quarters) are inaccessible.

**Code does:**
- `updateMorale(delta)` in `battleUtility.js` 窶・clamps to [竏・00, +100], saves to `global.hms_divine_morale`.
- **Starting morale:** `竏・0` (set in `_setInitialFlags`).
- **Hourly drain:** `calcMoraleDrain(morale)` in `cronUtility.js` `performBattleHourlyTasks()` 窶・positive morale drains at `竏・20 + morale ﾃ・0.30)`; negative morale drains at dampened flat rates by bracket (竏・0 / 竏・6 / 竏・2 / 竏・ / 竏・).
- **Per-cycle flat decay removed.** `performHMSDivineBattleCycle` no longer calls `updateMorale(-5)`.
- **Combat victories:** `/fight` (fight.js) calls `updateMorale(ENEMY_MORALE_VALUES[enemyId] ?? 1)` on win, `updateMorale(-3)` on loss. Encounter fights in `interactionCreate.js` do the same. Auto-resolved expired encounters in `resolveExpiredEncounters()` also call `updateMorale`.
- **Enemy kill values:** common=+1/+2, elite=+3, boss=+10 (table: `ENEMY_MORALE_VALUES`). Full list: `sailor`=1, `cutthroat`=1, `boarder`=2, `man_at_arms`=2, `crossbowman`=2, `swashbuckler`=2, `veteran_sailor`=3; bosses (`enemy_boatswain`, `master_at_arms`, `master_gunner`, `enemy_first_mate`, `enemy_captain`, `quartermaster`) = 10 each.
- **Boss drain reduction:** each boss kill increments `hms_divine_drain_reduction` by 2. `calcMoraleDrain` subtracts this from the baseline (max reduction 12 from 6 bosses). All three kill paths apply this: `fight.js`, `interactionCreate.js`, `resolveExpiredEncounters`.
- **Gateway Lock (enforced):** in `interact.js` confirm handler, destination zone tags are checked against `ZONE_MORALE_REQUIREMENTS`. If current morale < threshold, movement is blocked. Thresholds: `arb_main_deck`=25, `arb_rigging`=25, `arb_cannon_deck`=40, `arb_armory`=40, `arb_officer_quarters`=40.
- **Retreat penalty:** if a player leaves an Arbrance zone (`ARBRANCE_TAG`) while a `PendingEncounter` with `status='pending'` targets them in that exact zone, `updateMorale(-2)` is applied.
- **Cannon exchange morale:** `runCannonExchange` computes HP-based morale delta (every 100 HP dealt to Arbrance main deck = +2; to HMS top deck = 竏・) and applies morale-based bonus damage to the weaker side's deck and rigging.
- **Morale-based speed bonus (implemented):** `getMoraleSpeedMultipliers(locationId)` in `battleUtility.js` computes per-location speed multipliers. Effective morale = `rawMorale - entranceThreshold` (threshold is 0 for HMS player zones, 20 for Main Deck/Rigging, 40 for Cannon Deck/Armory/Officer Quarters). Below -20 effective morale: enemies gain +5% speed per 20-point tier (`floor((-effectiveMorale-20)/20)+1` steps). Above +20: players gain the same. Applied at all combat entry points: `interactionCreate.js` encounter fight handler, `battleUtility.js` auto-resolve (`resolveExpiredEncounters`), and `eventUtility.js` `processCombat` (battle-active gated). `combatUtility.js` `mainCombat` now supports `options.enemySpeedMultiplier` alongside the existing `options.playerSpeedMultiplier`.

**Status:** 笨・Fully implemented.

---

## 6 窶・Momentum Breakthrough

**Design says:** Before morale crosses +50, a successful combat on Main Deck triggers a background probability check. On pass 竊・Line Break: player is displaced into an adjacent lower zone.

**Code does:** Nothing. `/fight` has no post-victory hook specific to the `arb_main_deck` zone.

**Verify:** In `fight.js` 窶・no zone-specific post-combat logic.

**Status:** 笶・Not implemented.

---

## 7 窶・`/fight` Command

**Design says:** Player engages 1v1 combat against an enemy in their current zone. Standard stamina cost.

**Code does:** `src/commands/adventuring/fight.js`
- Gates: `unregistered` flag, `hms_divine_battle_active` flag, player must be in an Arbrance zone.
- Stamina cost: flat 5 (`STAMINA_COST = 5`).
- Picks enemy via `pickEnemyForZone(zoneTag)`.
- Runs `combatUtil.mainCombat(userId, enemyId, { riggingAttackers })`.
- Rigging covering fire: players in `arb_rigging` with a bow assist `arb_main_deck` fights as `riggingAttackers`.

**Verify:** In `fight.js` 窶・check `battleActive` flag guard, `arbranceZones` check, stamina deduction, `mainCombat` call, and `riggingAttackers` logic.

**Status:** ✅ Core mechanic matches spec. Morale updated on win/loss (see §5). See §6 (no breakthrough trigger).

### 7a — Officer Cabin 3v3 Assault (arb_officer_quarters)

**Design says:** When `/fight` is used in the Officer Quarters zone, a multi-player party mechanic triggers instead of a standard 1v1. Up to 3 players assign roles (Fight Captain, Fight First Mate, Fight Head Guard). A shared party board shows in the channel. Any role-holder presses Confirm to start all fights simultaneously.

**Code does:** `src/commands/adventuring/fight.js` — `handleOfficerCabinFight()` and helpers.
`src/events/interactionCreate.js` — `handleOfficerCabinInteraction()`.
`src/utility/battleUtility.js` — `OFFICER_ROLES`, `officerCabinSessions`.

- **Zone branch:** If `currentZone.id === arbranceIds.arb_officer_quarters`, `handleOfficerCabinFight` is called instead of the normal fight path.
- **Session state:** Module-level `officerCabinSessions` Map (key = location ID). Session shape: `{ sessionId, assignments: {captain, first_mate, head_guard}, names: {...}, channelId, messageId, timeout }`.
- **Session timeout:** 10 minutes via `setTimeout`; cleared on confirm or cancel.
- **Ephemeral role picker:** Each player gets a private ephemeral embed listing available roles. Buttons: `ocabin_select|captain`, `ocabin_select|first_mate`, `ocabin_select|head_guard`, `ocabin_release`. Handled by an in-collector listener in `handleOfficerCabinFight`; not routed through `interactionCreate.js`.
- **Shared party board:** `updateOfficerSharedMessage()` posts/edits a channel embed showing current role assignments and two buttons: `ocabin_confirm|<sessionId>` and `ocabin_cancel|<sessionId>`.
- **Confirm flow (`handleOfficerCabinInteraction`):**
  1. Presser must hold an assigned role; otherwise returns error.
  2. Buttons disabled immediately via `interaction.deferUpdate()` + board message deleted.
  3. Session cleared from Map.
  4. Already-defeated officers are skipped (reads `captain.defeatFlag`, `first_mate.defeatFlag`, `head_guard.defeatFlag`).
  5. Stamina: deduct 5 per fighter; if insufficient, apply `speedMultiplier: 0.7` penalty.
  6. All three fighters and all three enemies share **one initiative tracker** via `combatUtil.teamCombat(teamPairs)`. Fixed pairings: captain↔enemy_captain, first_mate↔enemy_first_mate, head_guard↔quartermaster. Combat ends when all actors on one team reach 0 HP.
  7. One combined battle report posted to channel (colour: green if all won, amber if partial, red if all lost).
  8. Win → `updateMorale(+10)` + `setFlag(def.defeatFlag, 1)` + `setFlag('hms_divine_drain_reduction', cur+2)`.
  9. Loss → `updateMorale(-3)`.
  10. If all 3 officers defeated → `setFlag('global.arb_commander_slain', 1)` + victory embed.
  11. KO'd players moved to `BOONG_SINH_HOAT_ID` (6).
- **Cancel flow:** Timeout cleared, session deleted, shared message updated to "Assault abandoned."
- **Enemies used:** `enemy_captain`, `enemy_first_mate`, `quartermaster` (Head Guard). All in `src/content/enemies/sailor.yaml`.
- **Morale values:** 10 each (per `ENEMY_MORALE_VALUES` in battleUtility.js).
- **Drain reduction:** +2 per officer kill (same as other boss kills, §5).

**Status:** ✅ Fully implemented.

---

## 8 — `/act` Command

**Design says:** Zone objective action. Stamina cost moderate. Success depends on zone: Cannon Deck = spike guns, Armory = sever supply, Officer Quarters = assassinate commander.

**Code does:** `src/commands/adventuring/act.js`
- Gates: same as `/fight`.
- Zone 竊・event mapping: `arb_cannon_deck` 竊・`hms-spike-guns`, `arb_armory` 竊・`hms-sever-supply`, `arb_officer_quarters` 竊・`hms-assassinate-commander`.
- Flat stamina cost: 5 (`STAMINA_COST = 5`).
- Commander already slain check: reads `arb_commander_slain` flag; returns error if already done.
- `/act` on `arb_main_deck` or `arb_rigging` returns "no objective here" 窶・correct per spec.

**Verify:** In `act.js` 窶・`ZONE_OBJECTIVE_MAP` constant, stamina deduction, `commanderSlain` guard, `processEvent` call.

**Status:** 笨・Core mechanic matches spec. Gateway Lock enforced via movement gate in interact.js (see ﾂｧ5).

---

## 9 窶・Movement During Battle

**Design says:** Players traverse adjacent zones. Cost lower than combat.

**Code does:** `/interact move` (`src/commands/adventuring/interact.js`). Movement within battle zones costs 5 stamina. Rigging-to-rigging traversal costs 10.

Additional behavior implemented (2026-04-29):
- **Preview + confirm flow:** *(TODO 窶・current implementation not agreed upon, needs redesign)*
- **Boong Sinh Hoat exit restriction:** Players cannot leave location ID 6 (Living Quarters / Boong Sinh Hoat) if their current HP is below 50% of max HP. Enforced at confirm time via `currentLocation.id === BOONG_SINH_HOAT_ID` check.

**Verify:** In `interact.js` 窶・`collector.on('collect')` for the select menu calls `btnCollector.on('collect')` for confirm button, which checks `BOONG_SINH_HOAT_ID` HP gate, then stamina, then calls `moveCharacterToLocation`.

**Status:** 噺

> **Gap 窶・Hostile zone entry check not implemented.**  
> Design specifies a mandatory check (stat roll or breakthrough check) when moving into or out of a hostile zone. `interact.js` deducts stamina and moves the player but does not apply any hostile-entry consequence.

---

## 10 窶・Random Encounter System

**Design says:** Enemies periodically spawn, target a player, show a message with a Fight button. The targeted player can fight for free. Any other player can intercept at a stamina cost. If not resolved, the fight occurs automatically against the original target after 30 minutes.

**Code does:**
- Cron: `encounterSpawnJob` (`cronUtility.js`, `'0,30 * * * *'`) runs every 30 minutes. Calls `resolveExpiredEncounters(guild)` then `spawnEncounters(guild)`.
- `spawnEncounters(battleUtility.js)`: iterates `SPAWN_ZONE_DEFS` — 4 zones: `arb_main_deck`, `arb_rigging`, `hms_divine_rigging` (tag-resolved), and HMS Top Deck (`BOONG_TREN_ID = 4`, id-resolved). For each zone with players present: `ENCOUNTER_ENEMY_CHANCE = 0.7` → enemy encounter, else → hazard.
- **Undefended `arb_rigging`:** if `arb_rigging` has no players, the would-be spawn count of `musket_shot` hazards is fired at random players on `arb_main_deck` instead (snipers have line-of-sight from the undefended rigging). If `arb_main_deck` is also empty, nothing happens.
- **Enemy encounter path:** Creates a `PendingEncounter` row (model: `src/models/encounter/pendingEncounterModel.js`), posts embed with Fight button (`customId: encounter_fight|<id>`) to zone channel. TTL = 30 minutes (`ENCOUNTER_TTL_MS`).
- **Fight button handler** (`interactionCreate.js` `handleEncounterFightInteraction`): loads `PendingEncounter`, checks status/expiry. Targeted player fights free; all others deduct 5 stamina (`STAMINA_COST = 5` in `interactionCreate.js`). Runs `combatUtil.mainCombat`, posts result to zone channel, strips buttons, sets `status = 'resolved'`.
- **Auto-resolve** (`resolveExpiredEncounters`, `battleUtility.js`): finds encounters past `expires_at` with `status = 'pending'`; strips buttons from original message; runs `mainCombat(target_player_id, enemy_id)`; posts result; sets `status = 'resolved'`.
- **Hazard path** (`resolveHazard`, `battleUtility.js`): immediate d1000 stat check vs `difficulty_mod ﾃ・stat ﾃ・10`. Fail 竊・HP damage. Posts flavor text. Hazard definitions in `src/content/hazards/hms_divine_hazards.yaml`.

**Verify:**
- `spawnEncounters()` 窶・check `SPAWN_ZONE_DEFS` (4 zones), `ENCOUNTER_ENEMY_CHANCE`, embed structure.
- `resolveExpiredEncounters()` 窶・check `expires_at` comparison, `mainCombat` call, result embed, status update.
- `handleEncounterFightInteraction()` 窶・check `isTarget` logic, stamina deduction, result post.
- `resolveHazard()` 窶・check stat lookup, roll formula, damage range.
- `hms_divine_hazards.yaml` 窶・musket_shot (stat: agi, diff: 1.5, dmg: 8窶・5), cannon_debris (stat: con, diff: 1.5, dmg: 10窶・8).

**Status:** 笞・・Core paths implemented. One value remains unconfirmed:

> **Unconfirmed 窶・Intercept stamina cost.**  
> Non-target players pay 5 stamina to join an encounter fight. This value was never specified in the design.

**Confirmed fixes:**
- Spawn zones: `SPAWN_ZONE_DEFS` now covers 4 zones (main deck + rigging of both ships) per user statement. HMS Top Deck uses id-based lookup (`BOONG_TREN_ID = 4`) since it has no tag.
- Enemy/hazard ratio: `ENCOUNTER_ENEMY_CHANCE = 0.7` (70/30) per user confirmation.

---

## 11 窶・Enemy Spawn Rate Formula

**Design says:** `enemy_spawn_rate = arb_main_deck_hp / 16`. Killing the commander permanently reduces this.

**Code does:** `spawnEncounters()` hardcodes 1 encounter per zone per tick. No HP-based calculation. `arb_commander_slain` flag exists but is not read in `spawnEncounters`.

**Verify:** In `spawnEncounters()` 窶・no reference to `arb_main_deck_hp` or commander flag.

**Status:** 笶・Formula not implemented. Spawn rate is always 1 per zone per tick.

---

## 12 窶・Chaos Events (Tactical Displacement, Dynamic NPC Crisis)

**Design says:** Each Resolution may roll one chaos event from a pool: Ambush (encirclement), Tactical Displacement (survivors relocate), Dynamic NPC Crisis (NPC event fires).

**Code does:** `fight.js` fires a 15% post-win roll on the main deck. Pool includes 3 random encounters (Wounded Ally, Breach, Pinned Gunner) which serve as Ambush/NPC Crisis events, plus boss intros and armory-opening. All events defined in `hms_divine_opportunity.yaml`. Tactical Displacement rejected.

**Status:** ✅ Implemented. Random encounter pool = chaos event pool. Dispatch wired in `fight.js`.

---

## 13 窶・Hale Death Event

**Design says:** Hale's death arrives as a Dynamic NPC Crisis at a fixed cycle. Players cannot prevent it. York reports it in the following Interlude.

**Code does:** Nothing. No cycle-count check in `performHMSDivineBattleCycle` for a Hale event.

**Verify:** In `battleUtility.js`, search `hale` 窶・no matches.

**Status:** 笶・Not implemented.

---

## 14 窶・End State / Outcome Tiers

**Design says:** Battle ends at max cycles or when HMS total HP 竕､ 0. Outcome tier 1窶・ determined by HMS HP remaining at battle end (tier 5 = HMS sunk).

**Code does:** `checkEndConditions()` in `battleUtility.js` reads `hms_divine_sunk` flag and total HMS HP. `getEndTierEventId(hmsTotalHp)` maps HP to a tier event ID. `endBattle()` fires the tier event and posts to STORYBOARD channel.

**Verify:** `checkEndConditions()`, `getEndTierEventId()` in `battleUtility.js`. Five tier event IDs in `src/content/events/hms_divine_end.yaml`.

**Status:** 笨・Tier logic matches spec.

---

## 15 窶・York's Interlude Report

**Design says:** After each Resolution, York posts component HP, morale descriptor, and cycle observations. Does not recommend player actions.

**Code does:** `performHMSDivineBattleCycle` calls `runActionsOnly('york-cycle-report', ...)` as step 5. Event content in `src/content/events/hms_divine_interlude.yaml`.

**Verify:** `york-cycle-report` event YAML 窶・check it reads HP flags and uses morale-tier language. Manual check required (YAML text audit not done here).

**Status:** 笨・(YAML text content not audited.)

---

## 16 窶・York Dialogue Redirect During Battle

**Design says:** While battle is active, approaching York redirects to a battle-specific briefing rather than normal dialogue.

**Code does:** `york-approach` event in `prologue_hms_divine_dialogue.yaml` has a check at `execution_order: -1` on flag `hms_divine_battle_initialized = 1` 竊・routes to `york-battle-hub`. The `hms_divine_orientation.yaml` defines York's 6-option battle hub.

**Verify:** In `prologue_hms_divine_dialogue.yaml` 窶・find the `hms_divine_battle_initialized` check on `york-approach`. In `hms_divine_orientation.yaml` 窶・`york-battle-hub` event.

**Status:** 笨・

---

## 17 窶・Battle-Zone Stamina / HP Regen

**Design says:** Standard town regen is suspended during battle. Players in safe zones recover HP.

**Code does:** `performBattleHourlyTasks()` in `cronUtility.js`:
- +10% stamina per hour for all players in any HMS/Arbrance zone.
- +10% HP per hour for players in Boong Sinh Hoat (location ID 6) only.
- Standard town regen cron skips players in battle zones via `battleRegenExclusion` SQL fragment.

**Verify:** In `cronUtility.js` 窶・`battleRegenExclusion`, `performBattleHourlyTasks`.

**Status:** 笨・Regen rules implemented.

---

## 18 窶・Runtime Location Setup

**Design says:** Arbrance zones exist as discrete locations accessible via the existing move system.

**Code does:**
- `ensureArbranceLocations()` creates 5 Arbrance `location_bases` rows (type=battle, hidden=true) — idempotent. Zones: `arb_main_deck`, `arb_cannon_deck`, `arb_armory`, `arb_officer_quarters`, `arb_rigging`.
- `sealBattleLocations()` un-hides all Arbrance zones and HMS Rigging (sets `hidden=false`) so they appear in `/interact move`. Adds Arbrance zones to `location_clusters` (cluster_arbrance). Adds `location_links`: Boong Trên → arb_main_deck (one-directional boarding entry), Boong Trên ↔ HMS Rigging (bidirectional), HMS Rigging ↔ arb_rigging (bidirectional).
- `relocateNpcsForBattle()` moves York (location_contains) from location 5 → 6 at battle start.
- `unsealBattleLocations()` re-hides Arbrance zones and HMS Rigging (`hidden=true`), removes cluster memberships, and destroys all battle links.
- `restoreNpcLocations()` reverses York's relocation on `/battle end`.

**Bug fixed (2026-05-02):** Arbrance zones and HMS Rigging were created with `hidden=true` but `sealBattleLocations()` did not un-hide them. `/interact move` filters out hidden locations, so players could never navigate to any dynamic battle zone. Fixed by adding `hidden=false` updates in `sealBattleLocations()` and `hidden=true` rollback in `unsealBattleLocations()`.

**Verify:** `battleUtility.js` — `ensureArbranceLocations`, `sealBattleLocations`, `relocateNpcsForBattle`, `unsealBattleLocations`.

**Status:** ✅

---

## 19 窶・Armory Wave System

**Design says:** If players are inside `arb_armory`, spawn a wave of enemies (budget 1.0). After each wave win, budget increases by 0.5. Level 3/4 enemies cost 1.0; level 5 enemies cost 1.5. Each wave win grants +N morale (where N = cumulative win count). At 10 wave wins the armory is secured: 20% enemy damage debuff becomes global and the armory is locked out. A random event (15% chance post-combat win) can grant one-time armory access bypassing the morale requirement.

**Code does:**
- `ARMORY_WAVE_ENEMY_POOL` in `battleUtility.js` 窶・pool of 3 enemy types with spawn weights.
- `buildArmoryWave(budget)` 窶・fills a wave list from the pool within budget. lv3/4 = cost 1.0, lv5+ = cost 1.5 (via `getArmoryEnemyCost`).
- `spawnArmoryWave(guild)` 窶・checks: battle active, armory not secured, players present, no active pending wave. Creates `PendingEncounter` rows with `wave_id` (monotonic counter from `global.arb_armory_wave_counter`) and posts fight buttons to armory channel. **No longer called by `spawnEncounters()` or any cron job** 窶・driven entirely by `setTimeout`.
- `checkArmoryWaveCompletion(guild, waveId)` 窶・called from `interactionCreate.js` on fight button win and from `resolveExpiredEncounters` on expiry. If all encounters for the wave are resolved and all `outcome = 'win'`: increments `global.arb_armory_wins`, increases `global.arb_armory_budget_x10` by 5, calls `updateMorale(+wins)`, sets `global.arb_armory_secured = 1` if wins 竕･ 10, posts announcement embed.
- `getArmoryDamageMultiplier(locationId)` 窶・returns 0.8 if armory secured (global), 0.8 if the fight location is the armory, otherwise 1.0. Used in `fight.js`, `interactionCreate.js`, and `resolveExpiredEncounters`.
- `interact.js` 窶・blocks armory entry if `global.arb_armory_secured = 1`. The `arb_armory_access_token` bypass is **not implemented in code** 窶・the `arb-armory-opening` YAML event uses a direct `type: move` action that bypasses `interact.js` entirely, making the token redundant.
- `fight.js` 窶・15% chance post-win on the main deck. Builds a pool from: `arb-armory-opening` (only if armory/cannon deck not yet secured AND morale < 40), three one-time boss intros (excluded once global defeat flag is set), and three repeatable random encounter intros (`arb-renc-wounded-ally-intro`, `arb-renc-breach-intro`, `arb-renc-pinned-gunner-intro`). Picks one at random from the pool and fires it via `eventUtil.processEvent`.

**Flags used:**
| Flag | Initial Value | Purpose |
|---|---|---|
| `global.arb_armory_wins` | 0 | Cumulative wave wins |
| `global.arb_armory_secured` | 0 | 1 = armory secured; entry blocked, 20% debuff global |
| `global.arb_armory_budget_x10` | 10 (= 1.0) | Wave budget ﾃ・10 (integer storage); +5 per win |
| `global.arb_armory_wave_counter` | 0 | Monotonic wave ID counter |

**Character flag:** `arb_armory_access_token` (value 1 = has token) 窶・one-time armory entry bypass.

**Schema change:** `pending_encounters` table 窶・added `wave_id INTEGER NULL` and `outcome STRING NULL`. Requires `node dbObject --alter` to apply.

**Wave timing architecture (2026-05-01, actual implementation):**
- `scheduleArmoryWave(guild, delayMs)` 窶・module-level helper. Calls `setTimeout` with `spawnArmoryWave` as callback. Guild is captured via closure. Does **not** store `_armoryWaveTimer` or `_armoryGuild` module variables; no `clearTimeout` on prior timers.
- `_armoryWaveTimer` / `_armoryGuild` 窶・**not implemented**. Stale timer protection is handled instead by the `next_run` gate in `spawnArmoryWave` (see below).
- `onArmoryPlayerArrived` 窶・if no timer is running (first player in), writes `CronLog` (`status: 'running'`, `next_run = now + 30 min`), then calls `scheduleArmoryWave(guild, 30 * 60 * 1000)`. Fires `arb-armory-occupied` to the battle channel via `runActionsOnly`. The `setTimeout` fires wave 1 exactly 30 minutes later.
- After each successful spawn 窶・`spawnArmoryWave` writes updated `CronLog` (`next_run = now + 30 min`), then calls `scheduleArmoryWave(guild, 30 * 60 * 1000)`. Each subsequent wave fires exactly 30 minutes after the previous one.
- `onArmoryPlayerDeparted` 窶・sets `CronLog status: 'stopped', next_run: null`. Fires `arb-armory-retaken` to the battle channel via `runActionsOnly`. Also posts a local abandonment embed to the armory channel. Does NOT `clearTimeout` (no handle stored). Any orphaned timer will fire `spawnArmoryWave`, which returns early if no players are present, or if a subsequent player arrived and set a future `next_run` the gate blocks the stale fire.
- `next_run` gate in `spawnArmoryWave` 窶・`if (waveLog && waveLog.next_run && new Date(waveLog.next_run) > new Date()) return null` 窶・aborts if the scheduled time is still in the future. This prevents stale timers from double-firing when a new timer has been scheduled.
- **Restart recovery** (in `startCronJob`, `cronUtility.js` ~line 791): reads `CronLog` for `job_name = 'armory_wave_spawn'`. If `status = 'running'` and `next_run` is set: if `next_run` is in the past 竊・calls `spawnArmoryWave(guild)` immediately (catch-up); if `next_run` is in the future 竊・calls `scheduleArmoryWave(guild, remaining)` to restore the exact timer.
- `armoryWaveJob` (per-minute cron) 窶・**removed**. `cronUtility.js` no longer declares, starts, or exports this job.

**Verified 2026-05-XX:** All section-19 paths confirmed present. `battleUtility.js` 窶・all armory wave functions present. `fight.js` 窶・15% pool confirmed. `interact.js` 窶・secured block present; access token bypass not implemented (redundant 窶・YAML event uses direct move). `interactionCreate.js` 窶・`outcome = 'win'` + `checkArmoryWaveCompletion` present. `combatUtility.js` 窶・`enemyDamageMultiplier` applied. `cronUtility.js` 窶・restart recovery present at line 791; `armoryWaveJob` absent. **Bug fixed:** duplicate event IDs (`arb-armory-opening`, `arb-armory-enter`, `arb-cannon-enter`) removed from `hms_divine_armory.yaml`; canonical definitions remain in `hms_divine_opportunity.yaml` only. **Gap closed:** `arb-armory-occupied`, `arb-armory-retaken`, `arb-armory-secured` added to `hms_divine_opportunity.yaml` and wired via `runActionsOnly` in `onArmoryPlayerArrived`, `onArmoryPlayerDeparted`, and `checkArmoryWaveCompletion` (`willSecure` branch) respectively.

**Status:** 笨・

---

## 20 窶・End-of-Battle Player Relocation (Strange Shore)

**Design says:** At battle end, every player still in a battle zone is moved out 窶・no exceptions.

**Code does:** `endBattle()` calls `forcedWithdrawal(guild)`. That function calls `ensureStrangeShoreLocation()` which creates a `LocationBase` row (`name = 'Strange Shore'`, `hidden = false`) the first time it runs and stores the resulting ID in `global.strange_shore_location_id` via `setFlag`. Subsequent calls read that flag and look the row up by primary key. It then collects all players across every active battle zone 窶・`HMS_ZONE_IDS` (4窶・), all Arbrance zones, and the HMS Rigging zone 窶・and moves each one to Strange Shore via `locationUtil.moveCharacterToLocation`. Strange Shore is a permanent, non-hidden location; players can navigate away from it normally after the battle.

**Verify:** `forcedWithdrawal()` and `ensureStrangeShoreLocation()` in `battleUtility.js`. Global flag: `global.strange_shore_location_id`.

**Status:** 笨・

---

## Global Flags Reference

All battle state lives in `global_flags`. No new columns were added to any character or event table.

| Flag | Set by | Initial Value | Purpose |
|---|---|---|---|
| `global.hms_divine_battle_active` | `_setInitialFlags()` | 0 竊・1 | Gate for all battle commands and cron jobs |
| `global.hms_divine_battle_initialized` | `_setInitialFlags()` | 0 竊・1 | Gate for York dialogue redirect |
| `global.hms_divine_cycle_count` | incremented each cycle | 0 | Ends battle at 10 cycles |
| `global.hms_divine_phase_start_ts` | `_setInitialFlags()` | unix ts | Battle start timestamp |
| `global.hms_divine_top_deck_hp` | `_setInitialFlags()`, `runCannonExchange()` | 400 | HMS Divine Top Deck HP |
| `global.hms_divine_cannon_deck_hp` | `_setInitialFlags()`, `runCannonExchange()` | 300 | HMS Divine Cannon Deck HP |
| `global.hms_divine_rigging_hp` | `_setInitialFlags()`, `runCannonExchange()` | 300 | HMS Divine Rigging HP |
| `global.arb_main_deck_hp` | `_setInitialFlags()`, `resolveZones()`, `runCannonExchange()` | 800 | Arbrance Main Deck HP |
| `global.arb_cannon_deck_hp` | `_setInitialFlags()`, `resolveZones()`, `runCannonExchange()` | 450 | Arbrance Cannon Deck HP |
| `global.arb_rigging_hp` | `_setInitialFlags()`, `resolveZones()`, `runCannonExchange()` | 250 | Arbrance Rigging HP |
| `global.hms_divine_morale` | `updateMorale()` 窶・hourly drain, combat win/loss, cannon exchange, retreat penalty | 竏・0 | 竏・00 to +100 morale axis |
| `global.arb_commander_slain` | objective event | 0 | 1 after `/act` completes commander fight |
| ~~`global.arb_supply_severed`~~ | ~~objective event; reset each cycle~~ | — | **Removed (2026-04-30).** Superseded by armory wave system; cannon debuff now via `getArmoryCannonDebuff()` and `arb_armory_wins`/`arb_armory_secured`. |
| `global.hms_divine_sunk` | outcome event | 0 | 1 if HMS reaches 竕､0 HP |
| `global.hms_divine_supply_loss` | outcome tier events | 0 | 0窶・ severity |
| `hms_divine_drain_reduction` | boss kill paths (`fight.js`, `interactionCreate.js`, `resolveExpiredEncounters`) | 0 | Cumulative drain reduction; +2 per boss killed, max 12 |
| `global.arb_armory_wins` | `checkArmoryWaveCompletion()` | 0 | Cumulative armory wave wins |
| `global.arb_armory_secured` | `checkArmoryWaveCompletion()` at 10 wins | 0 | 1 = armory secured; blocks entry, globalises 20% debuff |
| `global.arb_armory_budget_x10` | `_setInitialFlags()`, `checkArmoryWaveCompletion()` | 10 | Wave budget ﾃ・10; starts at 1.0, +0.5 per win |
| `global.arb_armory_wave_counter` | `spawnArmoryWave()` | 0 | Monotonic counter for wave IDs |
| `global.arb_main_deck_foothold` | `_setInitialFlags()`, `arb-main-deck-breach-victory` event | 0 | 1 after boarding push completes; blocks re-trigger |

---

## Startup Checklist

1. `node deploy-commands.js` 窶・register `/fight`, `/act`, `/battle` with Discord
2. `node dbObject --alter` 窶・creates `pending_encounters` table (wait 5+ minutes)
3. Set `BATTLE` channel ID in `src/config/channels.js`
4. Set `STORYBOARD` channel ID if not already set
5. `/battle init` 窶・creates Arbrance locations and seals the field (no announcements)
6. Verify with `/battle status`
7. `/battle start` 窶・sets all flags, moves York, posts announcement

---
## 21 — Main Deck Boarding Push

**Design says:** The first player to move onto the enemy main deck (`arb_main_deck`) while the battle is active is presented with a warning that enemies are waiting on the other side. If they confirm, they fight 3 sequential waves with -20% accuracy on all player attacks. They can retreat between rounds. If they win all 3 rounds, a server-wide announcement fires and no further player moving to main deck will see this challenge.

**Code does:**

**Trigger (interact.js):** When the player selects `arb_main_deck` as their move destination, the pre-move check fires BEFORE `moveCharacterToLocation`:
- `global.hms_divine_battle_active` — must be 1
- `global.arb_main_deck_foothold` — must be 0

If both conditions hold, fires `arb-main-deck-breach-warning` via `interaction.client.eventUtil.processEvent` and returns early — the player is NOT yet moved. The event chain is responsible for moving the player on victory.

**Event chain (hms_divine_main_deck.yaml):**
1. `arb-main-deck-breach-warning` — Warning scene. Sets character flag `boarding_disoriented = 1`. Options: "Push through" → round 1 combat; "Fall back" → retreat.
2. `arb-main-deck-breach-round-1-combat` — Enemy: `sailor`. Accuracy penalty active via `boarding_disoriented` flag set in step 1. Victory → round 1 victory scene. Defeat → defeat scene.
3. `arb-main-deck-breach-round-1-victory` — +1 morale. Options: press on (round 2) or fall back.
4. `arb-main-deck-breach-round-2-combat` — Enemy: `boarder`. Accuracy penalty still active. Victory → round 2 victory scene.
5. `arb-main-deck-breach-round-2-victory` — +2 morale. Options: press on (round 3) or fall back.
6. `arb-main-deck-breach-round-3-combat` — Enemy: `veteran_sailor`; `special_rules: { foothold_announcement: true }`. Accuracy penalty still active. Victory → foothold victory.
7. `arb-main-deck-breach-victory` — Sets `global.arb_main_deck_foothold = 1`; +5 morale; clears `boarding_disoriented = 0`; moves player to `flag:location_id_arb_main_deck`. The `foothold_announcement: true` on the final combat triggers `battleUtil.postMainDeckFootholdAnnouncement(guild)`.
8. `arb-main-deck-breach-defeat` — -3 morale; clears `boarding_disoriented = 0`; move to location 6 (living quarters).
9. `arb-main-deck-breach-retreat` — Silent; clears `boarding_disoriented = 0`; move to location 4 (HMS Top Deck).

**Accuracy penalty mechanic (combatUtility.js):**
- `mainCombat` reads the character flag `boarding_disoriented` (flag_value > 0) before building actor stats.
- If set, multiplies `options.playerAccuracyMultiplier` by `0.8` (-20% accuracy on all player attacks) for the duration of that combat.
- The flag is set at the start of the warning event and cleared in all three exit paths (victory, defeat, retreat), so it never persists past the boarding push sequence.

**Announcement (battleUtility.js):**
- `postMainDeckFootholdAnnouncement(guild)` — reads `channel.battle` from `SystemSetting`; posts an embed with title "Foothold Established!" to the battle channel.

**Flag:**
- `global.arb_main_deck_foothold` — initialised to `0` in `_setInitialFlags()`. Set to `1` by the `arb-main-deck-breach-victory` event action. Once `1`, the trigger in `interact.js` no longer fires.
- `character.boarding_disoriented` — set to `1` by warning event, cleared to `0` by all exit paths. Signals combatUtility to apply the accuracy penalty for the current combat.

**Status:** ✅ Fully implemented.

---
## Gap Summary

| ﾂｧ | Gap | Status |
|---|---|---|
| 3A | Cycle frequency: cron fires every 8 hours, matching cannon phase spec | 笨・Fixed |

| 4 | HMS zone overrun 竊・HMS HP loss not in `resolveZones()` | 笶・|
| 5A | Player combat win/loss does not call `updateMorale` | 笨・Closed |
| 5B | Morale Gateway Lock not checked in movement | 笨・Closed |
| 6 | Momentum Breakthrough not in `/fight` | 笶・|
| 9 | Hostile zone entry check not in `/interact move` | 笨・Closed |
| 11 | Spawn rate formula (`arb_main_deck_hp / 16`) not implemented | 笶・|
| 12 | Chaos event pool (Ambush, Displacement, NPC Crisis) not implemented | 笶・|
| 13 | Hale death event not implemented | 笶・|
| 20 | End-of-battle relocation to Strange Shore | 笨・|

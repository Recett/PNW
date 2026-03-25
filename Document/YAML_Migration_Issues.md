# YAML Migration - Issues, Oddities & Unresolved Matters

## BUGS (Will cause incorrect behavior at runtime)

### 1. ~~`location.lock` field missing from YAML - location exit filter broken~~ SOLVED
- **Severity**: HIGH
- **File**: `src/events/interactionCreate.js:274`
- **Problem**: The `handleLocationExit` function checks `loc.lock` to filter out locked locations. After migration, `loc` comes from `contentStore.locations.findByPk()`, but the `lock` field was **never exported to YAML**. So `loc.lock` is always `undefined`, and `!loc.lock` is always `true`. Result: **all locations appear unlocked** in the exit button filter.
- **Root cause**: `src/scripts/exportToYaml.js` (line 418-428) does not include `lock` in the location YAML schema.
- **Note**: `lock` is runtime state set by admin commands (`/location lock`). It's a write field that changes at runtime, so it arguably should NOT be in YAML at all. The admin `location.js` command still writes/reads `lock` from the Sequelize DB, which interactionCreate.js no longer reads.
- **Resolution**: Used option (A) - read `lock` from `LocationBase` in Sequelize for the exit button filter. The lock check now queries the DB directly via `LocationBase.findByPk(locId)` instead of reading from YAML contentStore. This correctly treats `lock` as runtime DB state.

### 2. ~~`action.event_id` always `undefined` in YAML actions~~ SOLVED
- **Severity**: MEDIUM (logging only)
- **File**: `src/utility/eventUtility.js:1067, 1093`
- **Problem**: `executeFlagAction` reads `action.event_id` for virtue flag logging (`eventLogger.logFlagAction`). YAML actions are embedded inside their parent event and don't carry an `event_id` field. The log always shows `'unknown'`.
- **Resolution**: Added `eventId` as a third parameter to `executeFlagAction(action, session, eventId)`. The caller `executeActionsByTrigger` already had `eventId` — now it passes it through. Removed stale `action.event_id` references.

### 3. ~~Stale PC entries in YAML location data~~ SOLVED
- **Severity**: LOW (latent, not currently causing issues)
- **File**: `src/content/locations/all_locations.yaml`
- **Problem**: 6 PC entries exist in `contains` arrays (type: "PC") representing player positions at export time. These are frozen snapshots of runtime state.
- **Resolution**: Location data was reverted back to the database (issue #10). No code reads YAML location `contains` arrays anymore — `getObjects()`, `getNPCs()`, `getEnemies()` all query `LocationContain` from the DB. The stale YAML entries are inert.

---

## ODDITIES (Code smells, not bugs)

### 4. ~~Duplicate `VARIABLE_SOURCE` import~~ SOLVED
- **File**: `src/utility/eventUtility.js:12, 29`
- **Problem**: `VARIABLE_SOURCE` is imported twice - once standalone at line 12, and again in the destructured constants block at line 29. The second import shadows the first. No runtime error since both resolve to the same module.
- **Resolution**: Removed the standalone import at line 12. The destructured block at line 29 covers it.

### 5. ~~Ad-hoc properties on Sequelize instances in explore.js~~ SOLVED
- **File**: `src/commands/adventuring/explore.js:259-272`
- **Problem**: `spawn.resourceNodeTemplate` and `spawn.enemyTemplate` are set directly on Sequelize model instances. This works in JavaScript but is fragile - these properties won't appear in `.toJSON()` or `.get({ plain: true })`, and could be lost on `.reload()` or `.save()`.
- **Resolution**: Converted to plain objects via `.get({ plain: true })` with template attached in a `.map()` spread, replacing the mutation loop.

### 6. ~~Cached YAML objects are mutable shared references~~ SOLVED
- **Problem**: `contentStore.findByPk()` returns the same object reference every time. If any code mutates a field (e.g., `location.someField = value`), it corrupts the cache for all subsequent reads.
- **Resolution**: Added `deepFreeze()` to `contentStore.js` that recursively freezes every record at load time via `_add()`. All YAML content is now immutable. Consumers that need to mutate must shallow-copy first (e.g., `{ ...obj }`).

### 7. ~~`findAll({})` vs `findAll()` vs `all()` inconsistency~~ SOLVED
- **Files**: Various (specialEventUtility.js, register.js)
- **Problem**: Some code calls `contentStore.X.findAll({})` with empty object, some calls `.all()`. Both work correctly but the intent is unclear.
- **Resolution**: Standardized all `findAll({})` calls to `findAll()`. Three instances fixed in `specialEventUtility.js` (x2) and `register.js` (x1).

---

## UNRESOLVED / DEFERRED ITEMS

### 8. ~~EventCheck data never exported to YAML~~ SOLVED
- **Root cause**: The `EventCheck` table had malformed JSON in `flag_data` fields (unquoted keys). The export script was modified by the user to skip EventCheck entirely with the comment: "EventCheck skipped -- JSON data is not codified, will be handled later."
- **Investigation found**: The `event_checks` table **never existed in the database** — the model was defined in code but never synced. The only consumer was `processSpecialEventCheck` in `explore.js`, which was part of a dead special event system (`SpecialEventBase`, `LocationSpecialEvent`, etc.) whose models and tables also never existed. This entire code path would crash at runtime.
- **Resolution**: Removed the dead special event DB system from `explore.js` (5 non-existent model imports, `handleSpecialEvent`, `processSpecialEventCheck`, `performCheck`, `checkOptionAvailability` — ~175 lines). Higher-rarity explores now fall through to regular instance generation. Commented out `EventCheck` model and its relationship in `dbObject.js`. The YAML-based `processChecks` in `eventUtility.js` remains ready for when check data is authored in YAML event files.

### 9. ~~`raidManager.js` still uses `EnemyBase`/`EnemyBaseStat` as Sequelize includes~~ SOLVED
- **File**: `src/utility/raidManager.js` (~10 `include: EnemyBase` joins)
- **Problem**: Raid queries like `RaidMonster.findAll({ include: EnemyBase })` still used Sequelize includes to join enemy content data with runtime raid state.
- **Resolution**: Added `resolveEnemy(enemyId)` and `attachEnemyData(records)` helpers to `RaidManager`. All 10 include sites replaced with post-query contentStore resolution via `record.dataValues.enemy`. Fixed field names: `enemy.lv` → `enemy.level`, `enemy.baseStat?.health` → `enemy.stats?.health`. Removed `EnemyBase` imports from consumer files (`raid.js`, `testraid.js`, `raidmanage.js`, `testcombat.js`). Archived `EnemyBase`, `EnemyBaseStat` models and all their relationships in `dbObject.js`.

### 10. ~~Admin commands still write to Sequelize DB, not YAML~~ SOLVED (for locations)
- **Files**: `src/commands/admin/location.js`, `src/commands/admin/duplicateLocation.js`
- **Problem**: These commands create/update/delete `LocationBase`, `LocationLink`, `LocationCluster` in the SQLite database. But runtime reads came from YAML contentStore. So any location created or modified via admin commands was NOT visible to the runtime system until the YAML was regenerated.
- **Same issue for**: Any admin tool that creates events, enemies, NPCs, items, etc. in the DB.
- **Resolution (locations)**: Reverted location data back to the database. All runtime code now reads from `LocationBase`, `LocationLink`, `LocationCluster`, `LocationContain` in Sequelize, matching what admin commands write to. Removed `locations` from `contentStore.js`. This resolves the dual-source problem for locations since they have mutable fields (`lock`, `channel`, `role`) that admins modify at runtime. The issue remains open for other content types (events, enemies, NPCs, items).

### 11. ~~`NpcStock.decrement()` diverges from YAML~~ SOLVED
- **File**: `src/utility/eventUtility.js` (shop purchase handler)
- **Problem**: When a player buys from a shop, `NpcStock.decrement()` reduces the stock count in the database. But the initial stock display reads from YAML (`npc.stocks`). After a purchase, the YAML still shows the original stock count while the DB has the decremented value.
- **Resolution**: Redesigned stock tracking. YAML `npc.stocks[].amount` holds the max stock (immutable). DB `npc_stock` table (model renamed to `NpcPurchase`) tracks total purchased count per NPC+item. Remaining stock = YAML max minus DB purchased. On purchase, `NpcPurchase.findOrCreate` + `increment('purchased')` replaces the old `NpcStock.decrement('amount')`. Shop display queries DB purchases and calculates remaining at open time. `NpcStock` renamed to `NpcPurchase` in `npcModel.js`, `dbObject.js`, `eventUtility.js`, and `exportToYaml.js`.

### 12. ~~`LocationContain` for static content is now dual-sourced~~ SOLVED
- **Problem**: `LocationContain` in the DB still had rows for NPC/object/enemy placements (from before the migration). The runtime was reading static placements from YAML `contains` arrays instead. The DB rows were stale.
- **Resolution**: Location data reverted back to the database. `getObjects()`, `getNPCs()`, `getEnemies()` in `locationUtility.js` now read from `LocationContain` table again, so the DB rows are the authoritative source. No more dual-sourcing.

### 13. ~~`dbObject.js` still defines and syncs all content models~~ SOLVED
- **File**: `src/dbObject.js`
- **Problem**: All content models were still defined in `dbObject.js` and synced to the database on startup.
- **Note**: DB sync (`sequelize.sync`) was already guarded by `require.main === module` — it only runs when executed directly via `node dbObject --alter`, never on startup when imported as a module. So the "synced on startup" concern was unfounded.
- **Resolution**: Commented out 27 content model definitions, their relationships, and their exports. Remaining active models:
  - `EnemyInstance` — used by explore.js for enemy spawning
  - `EventBase` — used by importsheet.js
  - `NpcPurchase` — runtime purchase tracking (shop system + weekly cron reset)
  - All character, location, raid, town, house, trade models — runtime state
  - Note: `EnemyBase` and `EnemyBaseStat` were initially kept for raid system includes, then archived when issue #9 migrated raidManager to contentStore.
- Also removed dead `ItemLib` import from `interactionCreate.js` (`tradeUtility.initModels` never used it).

### 14. Field name mapping reference
The export script renamed several DB fields for YAML. Code consumers must use the YAML names:

| DB field | YAML field | Affected tables |
|----------|-----------|-----------------|
| `tag` (JSON) | `tags` | ItemLib, SkillLib, PerkLib, QuestLib, EnemyBase, LocationBase, EventBase |
| `lv` | `level` | EnemyBase |
| `next_event_id` | `next` | EventBase, EventOption |
| `victory_event_id` | `on_victory` | EventCombat |
| `defeat_event_id` | `on_defeat` | EventCombat |
| `draw_event_id` | `on_draw` | EventCombat |
| `enemy_base_id` | `enemy` | EventCombat, EventEnemy |
| `option_id` | `id` | EventOption |
| `check_name` | `name` | EventCheck |
| `check_type` | `type` | EventCheck |
| `success_event_id` | `on_success` | EventCheck |
| `failure_event_id` | `on_failure` | EventCheck |
| `item_id` | `item` | EventActionItem |
| `location_id` | `location` | EventActionMove |
| `npc_id` | `npc` | EventActionShop |
| `enemy_id` | `enemy` | EventEnemy |

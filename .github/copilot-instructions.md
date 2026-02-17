# Discord RPG Bot - AI Agent Instructions

## Architecture Overview

This is a **Discord.js v14 bot** for a text-based RPG game using **SQLite + Sequelize ORM**.

### Core Structure
```
src/
├── index.js           # Bot client setup, command loader
├── dbObject.js        # Central database: ALL models instantiated & exported here
├── commands/          # Slash commands grouped by category (admin/, adventuring/, utility/, town/)
├── models/            # Sequelize model definitions (character/, event/, lib/, npc/, location/, etc.)
├── utility/           # Business logic utilities (characterUtility, eventUtility, combatUtility, etc.)
├── events/            # Discord.js event handlers (interactionCreate, ready, etc.)
```

### Key Design Patterns

**1. Central DB Export (`dbObject.js`)**
- ALL Sequelize models are instantiated here with relationships defined
- Import models from `@root/dbObject.js`, never directly from model files
- Run `node dbObject --alter` to sync schema changes

**2. Module Aliases (defined in `src/package.json`)**
```javascript
const { CharacterBase } = require('@root/dbObject.js');  // Database models
const characterUtil = require('@utility/characterUtility.js');  // Utilities
```

**3. Command Structure**
- Each command exports `{ data: SlashCommandBuilder, execute: async (interaction) => {} }`
- Use `InteractionContextType.Guild` for guild-only commands
- Use `MessageFlags.Ephemeral` for private replies
- Check character flags before command execution (e.g., `unregistered` flag blocks gameplay)

**4. Event System (`eventUtility.js`)**
- Events are data-driven from `event_*` tables
- Actions use enums from `eventConstants.js`: `FLAG_TYPE`, `CHECK_TYPE`, `TRIGGER_CONDITION`, `SHOP_TYPE`
- Session-based processing with collector pattern for Discord interactions

**5. Separation of Concerns (CRITICAL)**
- **Delegate operations to dedicated utilities** - avoid direct database queries in business logic
- **characterUtility** → Character data, stats, flags, inventory management
- **itemUtility** → Item details, weapon/armor associations (use `getItemWithDetails` instead of querying WeaponLib/ArmorLib)
- **locationUtility** → Location data, navigation, movement
- **combatUtility** → Combat calculations, battle mechanics
- **eventUtility** → Event processing, session management
- Example: In `characterUtility.equipCharacterItem`, use `itemUtility.getItemWithDetails(itemId)` instead of `WeaponLib.findOne({ where: { item_id: itemId } })`

## Code Style (ESLint enforced)
- **Tabs** for indentation
- **Single quotes** for strings
- **Trailing commas** in multiline
- **Stroustrup brace style** (`else` on new line)
- No trailing spaces

## Common Workflows

**Add new slash command:**
1. Create file in `src/commands/<category>/commandName.js`
2. Run `node deploy-commands.js` to register with Discord

**Add new database table:**
1. Define model in appropriate `src/models/<domain>/` file
2. Export from that file, import and instantiate in `dbObject.js`
3. Define relationships in `dbObject.js`
4. Run `node dbObject --alter`

**IMPORTANT - Database Sync Operations:**
- `node dbObject --alter` takes **5+ minutes** to complete - be patient!
- **DO NOT retry or assume it failed** - wait for the full timeout
- Use minimum 300000ms (5 min) timeout when running dbObject sync
- Running it again while still in progress causes database locks and crashes
- After schema changes, prefer telling user to run sync manually to avoid timeout issues
- **Do not run ANY other database operations** while sync is in progress

**Modify character data:**
```javascript
const characterUtil = require('@utility/characterUtility.js');
await characterUtil.updateCharacterFlag(userId, 'flagName', value);
await characterUtil.modifyCharacterStat(userId, 'gold', 100, 'add');
await characterUtil.addCharacterItem(characterId, itemId, quantity);
```

**Temporary Scripts & Files:**
- When creating diagnostic/helper scripts for investigation, prefix with `temp_` (e.g., `temp_check-data.js`)
- These can be safely deleted after use without checking with the user
- Migration scripts requested by user should NOT be prefixed with `temp_` (keep them for reference)
- At the end of a debugging session, offer to clean up temporary files
- Permanent scripts in `src/scripts/` should have descriptive names without `temp_` prefix

## Database Structure

**Database Location:** `src/database.sqlite` (SQLite3)

### Table Naming Convention
**CRITICAL:** Sequelize automatically pluralizes table names!
- Model name: `CharacterBase` → Table name: `character_bases`
- Model name: `EventBase` → Table name: `event_bases`
- Model name: `ItemLib` → Table name: `item_libs`

**Always use the PLURAL form when:**
- Writing raw SQL queries
- Checking table existence
- Debugging database issues

### Core Table Categories

**Character System (`character_*`):**
- `character_bases` - Core character data (id, name, stats, location_id, etc.)
- `character_items` - Inventory (character_id, item_id, amount, equipped)
- `character_flags` - Character-specific flags (character_id, flag_name, flag_value)
- `character_perks` - Acquired perks (character_id, perk_id, level)
- `character_skills` - Learned skills (character_id, skill_id, level, xp)
- `character_combat_stats` - Calculated defense stats (hp, eva, def, shield, etc.)
- `character_attack_stats` - Calculated attack stats (speed, cooldown, damage, etc.)
- `character_equipments` - Currently equipped items by slot
- `character_quests` - Quest progress tracking
- `character_relations` - NPC relationship values
- `character_settings` - User preferences
- `character_statuses` - Active status effects
- `character_threads` - Associated Discord threads

**Event System (`event_*`):**
- `event_bases` - Event templates (id, name, description, event_type, next_event_id, is_active, tags, metadata)
- `event_messages` - Discord message display (event_id, title, text, avatar, illustration, npc_speaker)
- `event_checks` - Validation conditions (event_id, check_type, flag_data, stat_data, item_data, etc.)
- `event_options` - Player choices (event_id, option_text, emoji, next_event_id, weight)
- `event_combats` - Combat encounters (event_id, enemy_id, combat_type)
- `event_enemies` - Enemy previews for player decisions (event_id, enemy_id, preview_text)

**Event Action Tables (`event_action_*`):**
- `event_action_flags` - Set/modify flags (event_id/option_id, flag_type, flag_name, flag_value)
- `event_action_items` - Give/take items (event_id/option_id, item_id, quantity, operation)
- `event_action_stats` - Modify stats (event_id/option_id, stat_name, stat_value, operation)
- `event_action_moves` - Move character (event_id/option_id, location_id, movement_type)
- `event_action_events` - Chain to another event (event_id/option_id, target_event_id, trigger_condition)
- `event_action_shops` - Open shop interface (event_id/option_id, npc_id, shop_type)
- `event_action_statuses` - Apply status effects (event_id/option_id, status_id, operation)
- `event_action_variables` - Set session variables (event_id/option_id, variable_name, variable_source)

**Location System (`location_*`):**
- `location_bases` - Location definitions (id, name, description, channel, role, tag, metadata)
- `location_links` - Navigation connections between locations (from_location_id, to_location_id)
- `location_clusters` - Grouped locations that share visibility (cluster_id, location_id)
- `location_contains` - What's at each location (location_id, type, entity_id, entity_name)
- `location_enemies` - Enemy spawns (location_id, enemy_id, spawn_rate, max_count)
- `location_events` - Location-triggered events (location_id, event_id, trigger_type)
- `location_instances` - Instanced location data (instance_id, base_location_id, owner_id)

**Library Tables (`*_lib`):**
- `item_libs` - Item definitions (id, name, description, type, value, tag, metadata)
- `weapon_libs` - Weapon stats (item_id, attack, speed, crit_rate, etc.)
- `armor_libs` - Armor stats (item_id, defense, hp_bonus, eva_bonus, etc.)
- `perk_libs` - Perk definitions (id, name, description, max_level, effects)
- `skill_libs` - Skill definitions (id, name, description, base_stat, effects)
- `quest_libs` - Quest templates (id, name, description, rewards)
- `resource_node_libs` - Gathering node definitions
- `project_libs` - Town project templates
- `special_libs` - Special abilities/actions

**NPC System (`npc_*`):**
- `npc_bases` - NPC definitions (id, name, description, avatar, location_id, tag)
- `npc_stocks` - Shop inventory (npc_id, item_id, price, stock_amount)
- `npc_perks` - Teachable perks (npc_id, perk_id, cost, requirements)

**Enemy System (`enemy_*`):**
- `enemy_bases` - Enemy templates (id, name, description, avatar, type, tag)
- `enemy_base_stats` - Base stats (enemy_id, hp, attack, defense, etc.)
- `enemy_attacks` - Attack definitions (enemy_id, attack_id, speed, cooldown)
- `enemy_instances` - Spawned enemies (instance_id, enemy_id, current_hp, location_id)
- `enemy_abilities` - Active abilities (enemy_id, ability_id)
- `enemy_ability_libs` - Ability definitions
- `enemy_attack_libs` - Attack template definitions

**Other Systems:**
- `global_flags` - Server-wide flags (flag_name, flag_value)
- `cron_schedules` - Scheduled tasks (task_name, cron_expression, enabled)
- `cron_logs` - Task execution history
- `system_settings` - Bot configuration (setting_name, setting_value)
- `raids` - Active raid instances
- `trades` - Player-to-player trades

### Key Relationships
- `character_bases.id` (Discord user ID) → PRIMARY KEY for all character_* tables
- `character_bases.location_id` → `location_bases.id`
- `character_items.item_id` → `item_libs.id`
- `character_items.item_id` → `weapon_libs.item_id` OR `armor_libs.item_id` (extended properties)
- `event_bases.id` → `event_messages.event_id`, `event_checks.event_id`, etc.
- `event_options.event_id` → `event_bases.id`
- `event_options.next_event_id` → `event_bases.id` (event chaining)
- `location_contains.entity_id` → depends on `type` (PC, NPC, ENEMY, OBJECT)

### Database Querying Best Practices

**Finding Events by Tag:**
```javascript
const EventBase = require('@root/dbObject.js').EventBase;
const allEvents = await EventBase.findAll({ where: { is_active: true } });
const taggedEvents = allEvents.filter(evt => 
	evt.tags && Array.isArray(evt.tags) && evt.tags.includes('desired_tag')
);
```

**Finding Locations by Tag:**
```javascript
const LocationBase = require('@root/dbObject.js').LocationBase;
const allLocations = await LocationBase.findAll();
const starterLocation = allLocations.find(loc =>
	loc.tag && Array.isArray(loc.tag) && loc.tag.includes('starter')
);
```

**Common Query Patterns:**
```javascript
// Get character with specific flag
const CharacterFlag = require('@root/dbObject.js').CharacterFlag;
const flag = await CharacterFlag.findOne({ 
	where: { character_id: userId, flag_name: 'unregistered' } 
});

// Get all items in inventory
const CharacterItem = require('@root/dbObject.js').CharacterItem;
const items = await CharacterItem.findAll({ where: { character_id: userId } });

// Get equipped items only
const equipped = await CharacterItem.findAll({ 
	where: { character_id: userId, equipped: true } 
});
```

### Important Database Gotchas

1. **Event IDs contain underscores** - When creating Discord component customIds, use `|` as delimiter instead of `_` to avoid parsing conflicts with event IDs like `event_waylan_york_a`

2. **JSON fields** - `tags`, `metadata`, `flag_data`, etc. are stored as JSON. Always check `Array.isArray()` before using array methods.

3. **Discord IDs are strings** - `character_id`, `id` in character_bases are VARCHAR, not integers

4. **Plural table names** - Model `EventBase` maps to table `event_bases`, not `event_base`

5. **Flag values are strings** - Even numeric flags are stored as strings in character_flags and must be parsed

6. **Discord UI constraints** - Be mindful of Discord's limitations:
   - Select menu option labels: **100 characters max** (automatically truncated in eventUtility.js)
   - Select menu option descriptions: **100 characters max**
   - Button labels: **80 characters max**
   - Embed titles: **256 characters max**
   - Embed descriptions: **4096 characters max**
   - Event option text should be kept under 95 characters to account for numbering prefix (e.g., "1. ")

## Combat System (`combatUtility.js`)

**Initiative Tracker Pattern:**
- Tick-based combat simulation via `runInitTracker(actors, options)`
- Each actor has attacks with `speed` (initiative gain per tick) and `cooldown` (threshold to trigger)
- Attacks fire when `initiative >= cooldown`, then reset

**Key Functions:**
```javascript
const combatUtil = require('@utility/combatUtility.js');

// Prepare combat stats (updates DB)
await combatUtil.getAttackStat(characterId);   // Returns CharacterAttackStat[]
await combatUtil.getDefenseStat(characterId);  // Returns CharacterCombatStat

// Run full combat
const result = await combatUtil.mainCombat(attacker, defender, options);

// Format for Discord
const report = combatUtil.writeBattleReport(combatLog, actors);
```

**Skill Trigger Hooks:**
- `handleCombatBeginSkills(attacker, target, options)` - Before combat starts
- `handleBeforeAttackSkills(attacker, target, tracker, options)` - Before each attack
- `handleAfterAttackSkills(attacker, target, tracker, result)` - After each attack
- `handleCombatEndSkills(attacker, target, result)` - After combat ends

**Combat Mechanics:**
- Hit rate: `evd / tohit` ratio determines miss chance
- Crit: Per-1000 scale (600 = 60%), can be resisted by `critResistance`
- Shield: Absorbs damage, regular shields fully consumed on hit, greatshields only reduce by damage absorbed
- Damage formula: `max(1, attack - defense)` with crit multiplier (2x, ignores defense)

## Location & Navigation (`locationUtility.js`)

**Core Concepts:**
- `location_base` - Locations with name, channel, role
- `location_link` - Connections between locations (for `/move` command)
- `location_cluster` - Groups of linked locations
- `location_contain` - Tracks what's at each location (PCs, NPCs, enemies, objects)

**Key Functions:**
```javascript
const locationUtil = require('@utility/locationUtility.js');

// Get location data
const location = await locationUtil.getLocationBase(locationId);
const location = await locationUtil.getLocationByChannel(channelId);
const location = await locationUtil.getLocationByName(name);

// Get location contents
const { objects, pcs, npcs, enemies } = await locationUtil.getLocationContents(locationId);

// Navigation
const linkedLocations = await locationUtil.getLinkedLocations(locationId);
const clusterLocations = await locationUtil.getLocationinCluster(locationId);

// Move character (updates CharacterBase.location_id, LocationContain, and Discord roles)
await locationUtil.moveCharacterToLocation(characterId, newLocationId, guild);
```

**Location Types (from `gamecon.json`):**
- `gamecon.PC` - Player character
- `gamecon.NPC` - Non-player character
- `gamecon.ENEMY` - Enemy entity
- `gamecon.OBJECT` - Interactive object

## Testing
- Use `/testnewchar` for quick test character creation (10 in all stats)
- Use `/register` for full character registration flow (8 in all stats, starts registration process)
# YAML Schema Reference - Discord RPG Bot

This document provides a comprehensive reference for all YAML file structures used in the Discord RPG Bot project. All YAML files are located in `src/content/` and follow specific schemas for different game content types.

## File Structure Overview

```
src/content/
├── enemies/all_enemies.yaml         # Enemy definitions and stats
├── events/all_events.yaml          # Story events, dialogues, and actions
├── house_upgrades/all_house_upgrades.yaml  # Town house upgrade definitions
├── items/
    ├── weapons.yaml                 # Weapon definitions and stats
    ├── armor.yaml                   # Armor definitions and stats
    ├── other_items.yaml             # Consumables, materials, quest items
    └── all_items.yaml               # [DEPRECATED] Previously combined all items
├── npcs/all_npcs.yaml              # Non-player characters
├── objects/all_objects.yaml         # Interactive objects
├── perks/all_perks.yaml            # Character perks and abilities
├── projects/all_projects.yaml       # Town projects
├── quests/all_quests.yaml          # Quest definitions
├── resource_nodes/all_resource_nodes.yaml  # Gathering nodes
├── skills/all_skills.yaml          # Character skills
├── specials/all_specials.yaml      # Special abilities/actions
├── statuses/all_statuses.yaml      # Status effect definitions
└── locations/all_locations.yaml     # [DEPRECATED] Game world locations - now in database
```

## 1. Events Schema (`all_events.yaml`)

The most complex schema, handling story events, dialogues, combat, and player actions.

### Basic Event Structure
```yaml
events:
  - id: "unique_event_id"                    # Required: Unique identifier
    name: "Event Display Name"               # Required: Human-readable name
    description: "Event description"         # Optional: Internal description
    event_type: "story"                      # Required: story, dialogue, combat
    tag:                                    # Optional: Array of tags
      - "tag_name"
    next: "next_event_id"                    # Optional: Auto-chain to next event
    silent: true                             # Optional: Skip user interaction
```

### Event Message Structure
```yaml
    message:
      text: "Message content with ${variables}"  # Required: Display text
      npc_speaker: "npc_id"                     # Optional: Speaking NPC
      message_type: "normal"                    # Optional: normal, whisper, shout
      title: "Message Title"                    # Optional: Custom title
      avatar: "image_url"                       # Optional: Custom avatar
      illustration: "image_url"                 # Optional: Additional image
```

### Event Options Structure
```yaml
    option:
      - id: "event_id-option-1"                # Required: Unique option ID
        text: "Option text with ${variables}"   # Required: Display text
        next: "next_event_id"                  # Optional: Event to chain to
        display_order: 1                       # Required: Sort order
        emoji: "🔥"                           # Optional: Option emoji
        weight: 100                           # Optional: Selection weight
```

### Event Actions Structure
```yaml
    action:
      - type: "flag"                          # Action type
        flag_name: "flag_name"                # Flag to modify
        flag_value: "value"                   # Value to set/add
        flag_operation: "set"                 # set, add, subtract
        flag_type: "Local"                    # Local, Global, Character
      - type: "item"                          # Give/take items
        item_id: "item_id"
        quantity: 1
        operation: "give"                     # give, take
      - type: "stat"                          # Modify character stats
        stat_name: "gold"
        value: 100
        operation: "add"                      # set, add, subtract
      - type: "move"                          # Move character
        location_id: "location_id"
        movement_type: "teleport"             # teleport, walk
      - type: "event"                         # Trigger another event
        target_event_id: "event_id"
        trigger_condition: "immediate"         # immediate, delayed
      - type: "shop"                          # Open shop interface
        npc_id: "npc_id"
        shop_type: "general"                  # general, weapon, armor
      - type: "status"                        # Apply/remove status effect
        status_name: "status_name"             # Status condition to apply (e.g. "poisoned", "blessed")
        status_type: "temporary"               # Optional: temporary, permanent, etc.
        status_value: "5"                      # Optional: intensity/duration value
        operation: "add"                       # add, remove, clear_all
      - type: "variable"                      # Set session variables
        variable_name: "var_name"              # Name to store value as
        source_type: "stat"                    # stat, flag, item_count, literal, expression, input, chat_input
        source_name: "gold"                   # Optional: stat/flag/item name to read
        expression: "${var_a + var_b}"        # Optional: for literal/expression types
        input_label: "Enter value"            # Optional: label text for input/chat_input types
        input_placeholder: "e.g., 50"         # Optional: placeholder hint for input types
```

### Combat Event Structure
```yaml
    combat:
      combat_type: "a"                        # Combat type identifier
      enemy: "enemy_id"                       # Enemy to fight
      on_victory: "victory_event_id"          # Event on win
      on_defeat: "defeat_event_id"           # Event on loss
```

### Event Checks Structure
```yaml
    check:
      - check_type: "flag"                    # flag, stat, item, location
        flag_data:
          flag_name: "flag_name"
          flag_value: "required_value"
          comparison: "equals"                # equals, greater, less
        stat_data:
          stat_name: "gold"
          value: 100
          comparison: "greater_equal"
        item_data:
          item_id: "item_id"
          quantity: 1
          comparison: "greater_equal"
        success_event: "success_event_id"     # Event if check passes
        failure_event: "failure_event_id"     # Event if check fails
```

### Variable Placeholders
Events support variable substitution:
- `${player_name}` - Character name
- `${player_fullname}` - Character full name
- `${2p}` - Second person pronoun
- `${location_name}` - Current location name
- Custom variables set by actions

## 2. Items Schema

Items have been split into separate files for better organization:
- `weapons.yaml` - Weapons and shields
- `armor.yaml` - Armor pieces (head, body, legs)
- `other_items.yaml` - Consumables, materials, quest items (currently empty)

### Weapons Schema (`weapons.yaml`)

Defines all weapons including melee weapons, ranged weapons, and shields.

### Basic Weapon Structure
```yaml
weapons:
  - id: "unique_item_id"                     # Required: Numeric string ID
    name: "Weapon Name"                      # Required: Display name
    description: "Weapon description"        # Optional: Flavor text
    item_type: "weapon"                      # Required: Always "weapon"
    value: 100                              # Optional: Base gold value
    weight: 5                               # Optional: Inventory weight
    tag:                                   # Optional: Array of tags
      - "starter_weapon"
      - "two_handed"
```

### Weapon Structure
```yaml
    weapon:
      slot: "mainhand"                       # Required: mainhand, offhand, twohand
      subtype: "sword"                       # Required: dagger, sword, rapier, spear, axe, mace, shortbow, longbow, shield
      base_damage: 10                       # Required: Base damage value
      scaling: 0.3                          # Required: Stat scaling multiplier (0.0-1.0)
      hit_mod: 0.75                         # Required: Hit chance modifier (0.0-1.0)
      cooldown: 100                         # Required: Attack speed (lower = faster)
```

### Armor Schema (`armor.yaml`)

Defines all armor pieces including head, body, and leg protection.

#### Basic Armor Structure
```yaml
armor:
  - id: "unique_item_id"                     # Required: Numeric string ID
    name: "Armor Name"                       # Required: Display name
    description: "Armor description"         # Optional: Flavor text
    item_type: "armor"                       # Required: Always "armor"
    value: 100                              # Optional: Base gold value
    weight: 5                               # Optional: Inventory weight
    tag:                                   # Optional: Array of tags
      - "starter"
      - "light_armor"
```

#### Armor Properties
```yaml
    armor:
      slot: "body"                           # Required: head, body, leg
      subtype: "light"                       # Required: light, medium, heavy
      defense: 5                            # Required: Defense value
      defense_percent: 0                    # Optional: Percentage damage reduction
      crit_resistance: 0                    # Optional: Critical hit resistance
```

### Other Items Schema (`other_items.yaml`)

Currently a placeholder for future consumables, materials, and quest items.

#### Basic Other Item Structure
```yaml
other_items:
  - id: "unique_item_id"                     # Required: Numeric string ID
    name: "Item Name"                        # Required: Display name
    description: "Item description"          # Optional: Flavor text
    item_type: "consumable"                  # Required: consumable, misc, material, quest_item
    value: 100                              # Optional: Base gold value
    weight: 5                               # Optional: Inventory weight
    tag:                                   # Optional: Array of tags
      - "base_ingredient"
      - "stackable"
    special:                               # Optional: Item-specific data (JSON blob)
      use_type: "immediate"                # e.g. immediate, combat, out_of_combat
      effects: []                          # Item effects (structure depends on item_type)
```

## 3. NPCs Schema (`all_npcs.yaml`)

Defines non-player characters, their shop inventories, and teachable perks. This file is the **source of truth** — `stocks` and `perks` are defined here in YAML and loaded into the database at runtime via contentStore.

### NPC Structure
```yaml
npcs:
  - id: "npc_unique_id"                     # Required: Unique identifier (e.g. npc_1234567890)
    name: "NPC Name"                       # Required: Short/display name
    fullname: "Full Display Name"          # Optional: Full display name
    unknown_name: "Hooded Figure"          # Optional: Name shown before player meets NPC
    avatar: "https://..."                  # Optional: Character portrait URL
    description: "Physical description"    # Optional: Appearance/flavour text
    npc_type: "merchant"                   # Optional: NPC role category (villager, merchant, guard, etc.)
    start_event: "event_id"               # Optional: Event triggered on first interaction
    age: 30                               # Optional: Age (used for Vietnamese pronoun system)
    gender: "male"                         # Optional: "male"|"female" (default: male)
    status: "active"                       # Optional: "active"|"inactive"
    stocks:                               # Optional: Shop inventory (loaded into npc_stocks DB table)
      - item: "item_id"                   # Item ID
        purchased: 0                      # How many units have been purchased (purchase counter)
    perks:                                # Optional: Teachable perks (loaded into npc_perks DB table)
      - perk: "perk_id"                   # Perk ID
        stamina_cost: 5                   # Stamina cost for the player to learn
        required_building_id: 1           # Optional: Building required to unlock
        required_building_level: 1        # Optional: Minimum building level required
```

## 4. Objects Schema (`all_objects.yaml`)

Defines interactive objects in the world (doors, chests, signs, etc.).

```yaml
objects:
  - id: "obj_unique_id"                    # Required: Unique identifier
    name: "Object Name"                   # Required: Display name
    unknown_name: "??"                   # Optional: Name before player identifies it
    avatar: "https://..."                 # Optional: Object image URL
    illustration: "https://..."           # Optional: Secondary image URL
    type: "chest"                         # Optional: Object category
    start_event: "event_id"              # Optional: Event triggered on interaction
    status: "active"                      # Optional: "active"|"inactive"
```

## 5. Enemies Schema (`all_enemies.yaml`)

Defines hostile creatures and combat encounters.

```yaml
enemies:
  - id: "1001"                             # Required: Numeric string ID
    name: "Enemy Name"                    # Required: Display name
    unknown_name: "??"                   # Optional: Name when unidentified
    level: 1                             # Required: Enemy difficulty level
    enemy_type: "minion"                 # Optional: minion, soldier, elite, boss
    tag:                                 # Optional: Classification array
      - "goblin"
      - "easy"
    reward:                              # Optional: Victory rewards (JSON)
      gold: 50
      exp: 25
      items:
        - id: "item_id"
          chance: 0.3                    # Drop chance (0.0-1.0)
          quantity: 1
    special:                             # Optional: Special behaviour (JSON)
      ability: "regenerate"
      rate: 5
      condition: "below_50_hp"
    stats:                               # Required: Combat statistics
      health: 100                        # Required: Max HP
      defense: 5                         # Required: Physical damage reduction (flat)
      defense_percent: 0                 # Optional: Percentage damage reduction
      crit_resistance: 0                 # Optional: Critical hit resistance
      evade: 10                          # Required: Evasion chance
      speed: 20                          # Required: Combat speed/initiative
```

## 6. Skills Schema (`all_skills.yaml`)

Defines learnable skills, mostly weapon/armor mastery types. Skills are tied to equipment subtypes and grant `bonus_value` at each level.

```yaml
skills:
  - id: "1"                               # Required: Numeric string ID
    name: "Sword Mastery"                 # Required: Display name
    description: "Mastery of sword combat" # Optional: Description
    parent_skill_id: "5"                  # Optional: Parent skill ID (for skill trees)
    bonus: "damage"                       # Optional: What stat/aspect this skill improves
    bonus_value: 0                        # Required: Bonus value granted per level
    tag:                                 # Optional: Classification array
      - "weapon_mastery"
```

## 7. Perks Schema (`all_perks.yaml`)

Defines character perks unlocked through skill progression.

```yaml
perks:
  - id: "1"                               # Required: Numeric string ID
    name: "Power Strike"                  # Required: Display name
    description: "Deal increased damage"  # Optional: Perk description
    category: "offense"                   # Optional: Perk category
    skill_id: "9"                         # Required: Associated skill ID
    skill_level_required: 3              # Required: Minimum skill level to unlock
    power: 3                             # Optional: Perk strength/tier rating
    cost: 2                              # Optional: Perk point cost to acquire
    timing: "on_attack"                  # Optional: When the perk triggers
    special:                             # Optional: Effect definitions (JSON)
      damage_multiplier: 1.5
    tag:                                 # Optional: Classification array
      - "combat"
```

## 8. Quests Schema (`all_quests.yaml`)

```yaml
quests:
  - id: "1"                               # Required: Numeric string ID
    name: "Quest Name"                    # Required: Display name
    description: "Quest description"      # Optional: Flavor text
    type: "main"                          # Optional: main, side, daily, etc.
    reward:                              # Optional: Completion rewards (JSON)
      gold: 100
      exp: 50
      items:
        - id: "item_id"
          quantity: 1
    requirement:                         # Optional: Unlock requirements (JSON)
      level: 5
      quest_id: "prerequisite_quest_id"
    tag:                                 # Optional: Classification array
      - "main_story"
```

## 9. Resource Nodes Schema (`all_resource_nodes.yaml`)

Defines gathering nodes in the world.

```yaml
resource_nodes:
  - id: "1"                               # Required: Auto-increment integer
    name: "Iron Ore Vein"                 # Required: Display name
    description: "A vein of iron ore"     # Optional: Flavor text
    node_type: "mining"                   # Required: Node category (mining, foraging, etc.)
    resource_item_id: "item_id"           # Required: Item yielded when gathered
    min_yield: 1                         # Optional: Minimum items per gather (default: 1)
    max_yield: 3                         # Optional: Maximum items per gather (default: 1)
    respawn_time: 300                    # Optional: Seconds until node respawns (default: 300)
    required_tool: "pickaxe"             # Optional: Tool required to gather
    skill_required: "mining"             # Optional: Skill required
    skill_level: 1                       # Optional: Minimum skill level required
    depletion_chance: 20                 # Optional: % chance node depletes on gather
    interaction_text: "You approach..."  # Optional: Text when player interacts
    success_text: "You gather..."        # Optional: Text on successful gather
    failure_text: "You fail to gather..." # Optional: Text on failed gather
    avatar: "https://..."                # Optional: Node image URL
    tag:                                 # Optional: Classification array
      - "ore"
```

## 10. Projects Schema (`all_projects.yaml`)

Defines town construction/research projects.

```yaml
projects:
  - id: "1"                               # Required: Numeric string ID
    name: "Project Name"                  # Required: Display name
    description: "Project description"    # Optional: Flavor text
    category: "infrastructure"            # Required: Project category
    cost: 500                            # Optional: Gold cost (default: 0)
    level: 1                             # Optional: Project tier/level (default: 1)
    completion_time: 3600               # Optional: Seconds to complete (default: 0)
    icon: "https://..."                  # Optional: Project icon URL
    resource_requirements:               # Optional: Materials needed (JSON)
      wood: 50
      stone: 30
    prerequisites:                       # Optional: Required prior projects (JSON array)
      - "project_id_1"
    tag:                                 # Optional: Classification array
      - "town"
```

## 11. House Upgrades Schema (`all_house_upgrades.yaml`)

Defines player house improvement options.

```yaml
house_upgrades:
  - id: "1"                               # Required: Numeric string ID
    name: "Upgrade Name"                  # Required: Display name
    description: "Upgrade description"    # Optional: Flavor text
    category: "storage"                   # Required: Upgrade category
    upgrade_type: "permanent"             # Required: Upgrade classification
    cost: 200                            # Optional: Gold cost (default: 0)
    required_house_level: 1             # Optional: Min house level required (default: 1)
    completion_time: 1800               # Optional: Seconds to complete (default: 0)
    is_active: true                      # Optional: Whether upgrade is available
    icon: "https://..."                  # Optional: Upgrade icon URL
    resource_requirements:               # Optional: Materials needed (JSON)
      wood: 20
    prerequisites:                       # Optional: Required prior upgrades (JSON array)
      - "upgrade_id_1"
    effects:                             # Optional: What the upgrade does (JSON)
      storage_slots: 10
    tag:                                 # Optional: Classification array
      - "storage"
```

## 12. Specials Schema (`all_specials.yaml`)

Defines special abilities and combat actions.

```yaml
specials:
  - name: "special_power_strike"          # Required: Unique identifier (primary key — looked up by name)
    description: "A powerful strike"      # Optional: Description
    type: "active"                        # Required: active, passive, triggered
    cooldown: 3                          # Optional: Turns between uses (default: 0)
    cost: 10                             # Optional: Resource cost (default: 0)
    icon: "https://..."                  # Optional: Ability icon URL
    effect:                              # Optional: Effect definition (JSON)
      damage_multiplier: 2.0
      target: "single"
    tag:                                 # Optional: Classification array
      - "combat"
      - "melee"
```

## 13. Statuses Schema (`all_statuses.yaml`)

Defines status effects that can be applied to characters during combat or through events.

```yaml
statuses:
  - id: "bleed"                          # Required: Kebab-case unique identifier (primary key)
    name: "Bleeding"                     # Required: Display name
    description: "Deals damage each tick."  # Optional

    # --- Classification ---
    category: "debuff"                   # Required: buff | debuff | neutral
    scope: "combat"                      # Required: combat | persistent

    # --- Effect ---
    stat_target: "hp"                    # Optional: Which stat is affected
    value_type: "flat"                   # Optional: flat | percent

    # --- Potency ---
    default_potency: 5                   # Optional: Default effect magnitude (default: 1)
    max_potency: 30                      # Optional: null = no cap
    stackable: false                     # Optional: Whether stacks accumulate (default: false)

    # --- Duration ---
    duration_unit: "tick"                # Required: tick | player_turn | enemy_turn | hit_received | battle | seconds | permanent
    default_duration: 3                  # Optional: null = permanent

    # --- Resist ---
    difficulty: 1.0                      # Optional: Resist check difficulty
    resist_timing: "on_apply"            # Optional: on_apply | on_tick | both
```

### Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes | Kebab-case. Primary key used in event actions and character statuses. e.g. `"bleed"`, `"veteran-mark"` |
| `name` | `string` | yes | Display name shown to players |
| `description` | `string` | — | Internal description |
| `category` | `string` | yes | `buff` \| `debuff` \| `neutral` |
| `scope` | `string` | yes | `combat` = lasts only during a fight; `persistent` = survives between battles |
| `stat_target` | `string` | — | Stat the effect modifies (e.g. `hp`, `attack`, `defense`) |
| `value_type` | `string` | — | `flat` = absolute value; `percent` = percentage of stat |
| `default_potency` | `number` | — | Effect magnitude when not overridden at application time (default: `1`) |
| `max_potency` | `number` | — | Cap on potency from stacking. Omit or `null` = no cap |
| `stackable` | `boolean` | — | Whether multiple applications accumulate potency (default: `false`) |
| `duration_unit` | `string` | yes | `tick` \| `player_turn` \| `enemy_turn` \| `hit_received` \| `battle` \| `seconds` \| `permanent` |
| `default_duration` | `integer` | — | Number of `duration_unit` intervals. Omit or `null` = permanent |
| `difficulty` | `number` | — | Resist check threshold. Higher = harder to resist |
| `resist_timing` | `string` | — | When resist is checked: `on_apply` \| `on_tick` \| `both` |

> **Note:** Status effects are applied via event actions using `type: status` with `status_name` referencing this `id`. The `event_action_statuses` table in the DB also references this id via `status_name`.

## 14. Deprecated Schemas

### ~~Locations (`all_locations.yaml`)~~ **[DEPRECATED - NOW IN DATABASE]**

> **Note**: Location data has been migrated from YAML to database storage. This schema is kept for historical reference only.

Previously defined the game world geography and navigation through YAML files.

#### Basic Location Structure (Historical)
```yaml
locations:
  - id: "unique_location_id"                # Required: Numeric string ID
    name: "Location Name"                   # Required: Display name
    description: "Location description"      # Optional: Detailed description
    type: "town"                           # Optional: town, dungeon, wilderness
    channel: "discord_channel_id"          # Required: Associated Discord channel
    role: "discord_role_id"                # Required: Associated Discord role
```

#### Location Navigation (Historical)
```yaml
    links:                                 # Optional: Connected locations
      - "location_id_1"
      - "location_id_2"
    cluster: "cluster_id"                  # Optional: Location group identifier
```

#### Location Tags (Historical)
```yaml
    tag:                                  # Optional: Location properties
      - "starter"                          # Starting location
      - "kitchen"                          # Has cooking facilities
      - "shop"                            # Has merchants
      - "interview"                       # Interview location
      - "safe_zone"                       # No combat allowed
```

#### Location Contents (Historical)
```yaml
    contains:                              # Optional: What's at this location
      - object_id: "npc_id"               # Entity ID
        type: "npc"                       # Entity type: npc, PC, enemy, object
      - object_id: "player_discord_id"
        type: "PC"
```

#### Location Events (Historical)
```yaml
    events:                               # Optional: Location-triggered events
      - event_id: "event_id"
        trigger_type: "on_enter"          # on_enter, on_exit, periodic
        conditions:                       # Optional: Trigger conditions
          - type: "flag"
            flag_name: "visited"
            flag_value: "false"
```

**Migration Status**: ✅ **COMPLETED** - Location data now managed through database models (LocationBase, LocationLink, LocationContain, etc.)

### ~~Items (`all_items.yaml`)~~ **[SPLIT INTO SEPARATE FILES]**

> **Note**: The monolithic items file has been split into separate files for better organization and maintainability.

Previously contained all items (weapons, armor, consumables) in a single file. Now organized as:
- `weapons.yaml` - All weapon definitions including melee, ranged, and shields (items 1-10)
- `armor.yaml` - All armor pieces for head, body, and legs (items 11-21)
- `other_items.yaml` - Placeholder for consumables, materials, quest items (currently empty)

**Migration Status**: ✅ **COMPLETED** - Items successfully split by category and loading system upgraded with:
- ✅ **Async Loading**: Parallel file loading for better performance
- ✅ **File Caching**: Intelligent caching with modification time checking  
- ✅ **Lazy Loading**: On-demand loading for less critical collections
- ✅ **Hot Reloading**: Development-friendly content reloading
- ✅ **Memory Management**: Cache cleanup and memory monitoring

## Common Patterns and Conventions

### ID Conventions
- **Items**: Numeric strings ("1", "2", "1001")
- **Locations**: Numeric strings ("1", "2", "3")
- **NPCs**: Prefixed strings ("npc_1770154169882")
- **Events**: Descriptive strings ("event_waylan_york_a", "event_1770152866067")
- **Enemies**: Numeric strings, with ranges (1-999 for story, 1000+ for random)

### Tag Usage
Tags are arrays of strings used for:
- **Items**: `["starter_weapon", "base_ingredient", "craftable"]`
- **Locations**: `["starter", "kitchen", "shop", "safe_zone"]`
- **Events**: `["begin_interview", "completion_check"]`
- **Enemies**: `["goblin", "easy", "fire_element"]`

### Discord Integration
- **channel**: Discord channel ID (string)
- **role**: Discord role ID (string)
- **object_id**: Can be Discord user ID for player characters

### Variable Substitution
Text fields support variable substitution with `${variable_name}`:
- `${player_name}` - Character name
- `${player_fullname}` - Full character name
- `${2p}` - Second person pronoun
- `${location_name}` - Current location

### Multilingual Support
The game appears to support Vietnamese text, with extensive use of Vietnamese descriptions and dialogue.

## Notes for Developers

1. **ID Uniqueness**: Ensure all IDs are unique within their respective categories
2. **Reference Integrity**: Always verify that referenced IDs exist (locations, NPCs, items, events)
3. **Tag Consistency**: Use consistent tag naming conventions across files
4. **Discord IDs**: Discord IDs are numeric strings and should be treated as strings, not integers
5. **Array Fields**: Tags, links, contains, and similar fields are arrays even with single values
6. **Optional Fields**: Many fields are optional - include only what's needed
7. **Localization**: Text content appears to be in Vietnamese - maintain language consistency

## File Management

- All YAML files use `.yaml` extension
- Files are located in `src/content/[category]/all_[category].yaml`
- Use proper YAML indentation (2 spaces recommended)
- Strings with special characters, colons, or multiline content should be quoted
- Use YAML multiline operators (`|`, `>`) for long text blocks

---

*Last Updated: March 25, 2026*
*Discord RPG Bot - YAML Schema Reference v1.0*
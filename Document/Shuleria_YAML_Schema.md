# SHULERIA — YAML Content Schema Specification

*Version 1.0 · March 2026*

> This document defines the canonical YAML schema for all authored content in Shuleria.
> The bot loads YAML at startup into memory. The database stores player state only.
> When in doubt, refer to this document — not the database schema.

---

## 0. Conventions

### 0.1 General Rules

These rules apply to every YAML file in the project without exception.

IDs are kebab-case strings. They are permanent — once set, never changed. Renaming an ID breaks any reference to it.

**String Quoting Guidelines:**
- Simple strings: Use unquoted (`name: Simple Text`)
- Numeric IDs: Quote to force string type (`id: "123"`)
- Boolean-like values: Quote to force string type (`flag_value: "true"`)
- Special characters: Quote when containing colons, brackets, or YAML reserved words (`text: "Yes: definitely"`)
- Multiline text: Use YAML block scalar (`|`) operator

Fields marked optional may be omitted entirely. Do not include them with null or empty values.

The special and tag fields have an open vocabulary — new keys may be added as design grows. Their shape is fixed; their contents are not.

### 0.2 Flag Scopes

Flags are referenced throughout event definitions. Every flag reference must declare its scope explicitly using the prefixes below.

```yaml
global.<name>    # Server-wide persistent flag
char.<name>      # Per-character persistent flag
local.<name>     # Current event execution only — not stored
```

### 0.3 Value Expressions

Numeric fields that accept expressions use the ${...} syntax. Expressions may reference local variables set by earlier steps in the same event.

```yaml
value: 10              # literal
value: "${roll * 2}"   # expression using local variable
value: "-${damage}"    # negative expression
```

### 0.4 File Organisation

Each content type lives in its own directory. One file per logical grouping (e.g. one file per zone for encounters, one file per enemy family for enemies).

```yaml
content/
  enemies/
    forest_creatures.yaml
    plain_creatures.yaml
  events/
    prologue_hms_divine.yaml
    first_quest_forest.yaml
  items/
    weapons.yaml
    consumables.yaml
  locations/
    peninsula.yaml
```


---

## 1. Enemy Schema

An enemy definition covers everything needed to instantiate and run a combat encounter: identity, base stats, attacks, and abilities. Enemy instances (live HP, combat state) remain in the database.

### 1.1 Top-Level Structure

```yaml
enemies:
  - id: grey-wolf
    name: Grey Wolf
    unknown_name: Large Predator   # optional: shown before identified
    avatar: grey_wolf.png          # optional
    level: 3
    enemy_type: beast                # beast | humanoid | construct | undead | boss
    start_event: wolf_encounter_start  # optional: event to fire when combat begins
    status: active                   # active | disabled
    tags:                            # open vocabulary
      - nocturnal
      - predator
    special:                         # open keyword:value pairs
      PackHunter: 2                  # gains +2 attack per wolf ally present
    stats:
      health: 120
      defense: 5
      defense_percent: 0
      crit_resistance: 0
      evade: 8
      speed: 14.0
    reward:                          # optional
      gold: 40
      exp: 80
      items:
        - id: wolf-pelt
          chance: 0.6
          quantity: 1
        - id: wolf-fang
          chance: 0.25
          quantity: 2
    attacks:
      - id: bite
        name: Bite
        base_damage: 18
        accuracy: 0.85
        critical_chance: 12
        cooldown: 90
        description: A lunging bite at the throat.
      - id: rend
        name: Rend
        base_damage: 12
        accuracy: 0.90
        critical_chance: 5
        cooldown: 45
    abilities:
      - id: pack-instinct
        name: Pack Instinct
        description: Calls for reinforcement when below 50% HP.
        effect: summon_ally
        value: 1
        target: self
        cooldown: 0
```

### 1.2 Field Reference — Enemy Base

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. Referenced by events and items. |
| `name` | `string` | yes | Display name shown after identification. |
| `unknown_name` | `string` | — | Name shown before identification. Defaults to name. |
| `avatar` | `string` | — | Filename of avatar image. |
| `level` | `integer` | yes | Base level. Used for scaling and encounter gating. |
| `enemy_type` | `string` | yes | beast | humanoid | construct | undead | boss |
| `start_event` | `string` | — | Event ID to fire at combat start. |
| `status` | `string` | yes | active | disabled |
| `tags` | `list` | — | Open string list. Used for filtering and conditions. |
| `special` | `map` | — | Keyword:value pairs. Each keyword maps to a code handler. |
| `stats` | `map` | yes | See stats sub-fields below. |
| `reward` | `map` | — | Gold, exp, and item drops on defeat. |
| `attacks` | `list` | yes | One or more attack definitions. |
| `abilities` | `list` | — | Zero or more ability definitions. |


### 1.3 Field Reference — Stats

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `health` | `integer` | yes | Maximum HP. |
| `defense` | `integer` | yes | Flat damage reduction. |
| `defense_percent` | `integer` | yes | Percentage damage reduction. 0–100. |
| `crit_resistance` | `integer` | yes | Reduces incoming critical hit chance. |
| `evade` | `integer` | yes | Flat evasion value. |
| `speed` | `float` | yes | Initiative speed. Higher = acts sooner. |


### 1.4 Field Reference — Attack

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Unique within the enemy. |
| `name` | `string` | yes | Display name. |
| `base_damage` | `integer` | yes | Base damage before modifiers. |
| `accuracy` | `float` | yes | 0.0–1.0 hit chance. |
| `critical_chance` | `integer` | yes | Critical hit chance as integer percentage. |
| `cooldown` | `float` | yes | Cooldown in seconds before reuse. |
| `description` | `string` | — | Flavour text shown in combat log. |


### 1.5 Field Reference — Ability

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Unique within the enemy. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Flavour text. |
| `effect` | `string` | yes | Effect keyword. Maps to a code handler. |
| `value` | `integer` | yes | Parameter for the effect handler. |
| `target` | `string` | yes | self | player | all |
| `cooldown` | `integer` | yes | Turns before reuse. 0 = no cooldown. |


---

## 2. Event Schema

An event is a flat document. It has a base, and any combination of optional components attached to it: a message, checks, combat, enemy previews, options, and actions. Components are independent. All actions fire together, ordered by position in the actions list.

### 2.1 Base

The base holds identity and routing. All other components are optional and attach to the event by id.

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Author note only. Not shown to players. |
| `event_type` | `string` | — | Organisational label. Open vocabulary. |
| `next` | `string` | — | Default next event if no component specifies otherwise. |
| `silent` | `boolean` | — | If true, event processes without displaying anything. Default false. |
| `is_active` | `boolean` | — | If false, event cannot be triggered. Default true. |
| `tags` | `list` | — | Open string list. |
| `metadata` | `map` | — | Open map for any data not covered by other fields. |

### 2.2 Message

Optional. One message per event. Handles all Discord display. If absent, event produces no visible output.

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | — | Embed title. |
| `text` | `string` | — | Main body text. Supports expressions. |
| `avatar` | `string` | — | Avatar image filename. |
| `illustration` | `string` | — | Illustration image filename. |
| `npc_speaker` | `string` | — | NPC ID of the speaker, if any. |
| `message_type` | `string` | — | Display style hint. Open vocabulary. |

### 2.3 Checks

Optional. One or more checks per event. Each check is an independent branching mechanism — it evaluates a condition and routes to a success or failure event. Entirely separate from option visibility conditions.

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | yes | Unique within the event. |
| `type` | `string` | yes | flag | stat | item | skill | level | random |
| `flag_data` | `map` | — | type:flag — fields: flag_name, flag_value, is_global_flag, flag_comparison (optional). |
| `stat_data` | `map` | — | type:stat — fields: stat_name, stat_comparison, stat_value, use_dice_roll. |
| `item_data` | `list` | — | type:item — list of {item_id, required_quantity}. |
| `skill_data` | `map` | — | type:skill — fields: skill_id, required_level. |
| `level_data` | `map` | — | type:level — fields: required_level. |
| `random_data` | `map` | — | type:random — fields: success_chance (0.0-1.0). |
| `difficulty_modifier` | `integer` | — | Applied to dice-roll checks. Default 0. |
| `is_required` | `boolean` | — | If false, failure does not block event progression. Default true. |
| `silent` | `boolean` | — | If true, result not shown to player. Default true. |
| `success_message` | `string` | — | Shown on pass when not silent. |
| `failure_message` | `string` | — | Shown on fail when not silent. |
| `on_success` | `string` | — | Event ID to route to on pass. |
| `on_failure` | `string` | — | Event ID to route to on fail. |
| `execution_order` | `integer` | — | Order among checks. Default 0. |

#### Flag Comparisons

Flag checks support comparison operators via the optional `flag_comparison` field. If omitted, defaults to `equal` for backwards compatibility.

**Supported Comparisons:**
- `equal` — Flag value exactly matches (default)
- `greater_than` — Flag value is greater than specified value  
- `less_than` — Flag value is less than specified value
- `greater_equal` — Flag value is greater than or equal to specified value
- `less_equal` — Flag value is less than or equal to specified value
- `not_equal` — Flag value does not match specified value

**Flag Comparison Examples:**
```yaml
checks:
  # Basic equality check (backwards compatible)
  - name: met_npc
    type: flag
    flag_data:
      flag_name: char.met_hale
      flag_value: 1
      is_global_flag: false
      # No flag_comparison specified = defaults to 'equal'
    
  # Quest progress check
  - name: progressed_enough  
    type: flag
    flag_data:
      flag_name: char.quest_progress
      flag_value: 5
      flag_comparison: greater_equal
      is_global_flag: false
    
  # Global server state check
  - name: server_active
    type: flag  
    flag_data:
      flag_name: global.event_active
      flag_value: 0
      flag_comparison: not_equal
      is_global_flag: true
      
  # Attempt counter check
  - name: too_many_attempts
    type: flag
    flag_data:
      flag_name: char.login_attempts  
      flag_value: 3
      flag_comparison: greater_than
      is_global_flag: false
```

### 2.4 Combat

Optional. One combat per event. Starts a combat encounter and routes to different events based on outcome.

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `combat_type` | `string` | — | Combat mode. Open vocabulary. |
| `enemy` | `string` | yes | Enemy ID from enemy schema. |
| `environment_effects` | `map` | — | Open map of environmental modifiers. |
| `victory_message` | `string` | — | Shown on player victory. |
| `defeat_message` | `string` | — | Shown on player defeat. |
| `draw_message` | `string` | — | Shown on draw. |
| `on_victory` | `string` | — | Event ID fired on victory. |
| `on_defeat` | `string` | — | Event ID fired on defeat. |
| `on_draw` | `string` | — | Event ID fired on draw. |
| `special_rules` | `map` | — | Open map of special combat rules. |

### 2.5 Enemies

Optional. One or more enemy previews per event. Displays enemy information before a decision or combat.

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enemy_type` | `string` | — | enemy | npc. Default enemy. |
| `enemy` | `string` | yes | Enemy ID from enemy schema. |
| `display_name` | `string` | — | Overrides enemy default name. |
| `display_description` | `string` | — | Overrides enemy default description. |
| `display_avatar` | `string` | — | Overrides enemy default avatar. |
| `display_illustration` | `string` | — | Overrides enemy default illustration. |
| `show_health` | `boolean` | — | Default true. |
| `show_level` | `boolean` | — | Default true. |
| `show_stats` | `list` | — | List of stat names to reveal. |
| `show_abilities` | `list` | — | List of ability IDs to reveal. |
| `show_weaknesses` | `list` | — | List of weakness types to reveal. |
| `show_resistances` | `list` | — | List of resistance types to reveal. |
| `threat_level` | `string` | — | Threat label shown to player. |
| `preview_notes` | `string` | — | Additional notes shown to player. |
| `warning_message` | `string` | — | Warning text shown to player. |
| `display_order` | `integer` | — | Order among enemy previews. Default 0. |
| `is_hidden` | `boolean` | — | If true, not shown by default. Default false. |
| `reveal_conditions` | `map` | — | Open map of conditions that reveal this preview. |

### 2.6 Options

Optional. One or more player choices per event. Each option routes to a next event when selected.

**Visibility Conditions:** `required_checks` and `hidden_checks` are self-contained inline condition data that control when options appear to players. They support the same check types as event-level checks: flag, stat, item, skill, level. Random checks are not supported for options.

- **required_checks**: All conditions must pass for the option to appear
- **hidden_checks**: If any condition passes, the option is hidden

**Inline Check Examples:**

```yaml
options:
  - id: strength-option
    text: "Force open the door"
    required_checks:
      - type: stat
        stat_data:
          stat_name: strength
          stat_comparison: greater_equal
          stat_value: 15
    next: door-forced-open

  - id: rich-option  
    text: "Buy the expensive item"
    required_checks:
      - type: stat
        stat_data:
          stat_name: gold
          stat_comparison: greater_equal
          stat_value: "${item_cost}"  # Supports expressions
    next: purchase-expensive

  - id: sneaky-option
    text: "Pick the lock quietly"
    required_checks:
      - type: skill
        skill_data:
          skill_id: lockpicking
          required_level: 3
    hidden_checks:
      - type: flag
        flag_data:
          flag_name: char.is_clumsy
          flag_value: 1
          flag_comparison: equal  # Default comparison
          is_global_flag: false
    next: lockpick-attempt

  - id: veteran-option
    text: "Draw upon years of experience (only if experienced)"
    required_checks:
      - type: flag
        flag_data:
          flag_name: char.quest_count
          flag_value: 5
          flag_comparison: greater_equal
          is_global_flag: false
    next: veteran-solution

  - id: inventory-option
    text: "Use your rope and grappling hook"
    required_checks:
      - type: item
        item_data:
          - item_id: rope
            required_quantity: 1
          - item_id: grappling-hook
            required_quantity: 1
    next: climb-window

  - id: high-level-option
    text: "Draw upon years of experience" 
    required_checks:
      - type: level
        level_data:
          required_level: 10
    next: veteran-solution
```

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Unique within the event. |
| `text` | `string` | yes | Full option text shown in embed. Also used as button label if `button_label` is absent. |
| `button_label` | `string` | — | Short label for the button (max ~40 chars). Overrides truncated `text` on the button. |
| `description` | `string` | — | Hint text shown below label. |
| `next` | `string` | — | Event ID triggered when option is selected. |
| `required_checks` | `list` | — | Inline condition data. All must pass for option to appear. See examples above. |
| `hidden_checks` | `list` | — | Inline condition data. If any passes, option is hidden. See examples above. |
| `is_default` | `boolean` | — | Default choice if player does not respond. Default false. |
| `is_destructive` | `boolean` | — | Flags option as dangerous. Default false. |
| `cooldown_seconds` | `integer` | — | Seconds before option can be selected again. Default 0. |
| `display_order` | `integer` | — | Position in option list. Default 0. |

### 2.7 Actions

Optional. One or more actions per event. All types are merged into a single list in YAML, distinguished by type. Position in the list determines execution order.

All actions share: type, silent (default true), custom_message (optional).

```yaml
actions:

  - type: flag
    flag_name: char.met_hale
    flag_value: 1
    flag_operation: set          # set | add | subtract | toggle
    flag_type: character         # character | global | local  
    silent: true
    custom_message: null
    output_variable: null

  - type: flag
    flag_name: char.quest_progress
    flag_value: 1
    flag_operation: add          # Increment quest progress
    flag_type: character
    silent: false
    custom_message: "Quest progress increased!"
    output_variable: new_progress

  - type: item
    item: wolf-pelt
    quantity: "1"
    operation: give          # give | take
    silent: false
    custom_message: "You take the pelt."
    output_variable: null

  - type: stat
    stat_name: hp
    value: "-8"
    operation: add           # add | set | multiply
    silent: true
    custom_message: null
    output_variable: damage_taken

  - type: move
    location: peninsula-camp
    movement_type: normal    # normal | forced | teleport
    silent: true
    custom_message: null

  - type: event
    next: hale-aftermath
    delay_seconds: 0
    silent: true
    custom_message: null

  - type: status
    status_name: poisoned
    status_type: temporary   # buff | debuff | temporary | permanent
    status_value: "3"
    operation: add           # add | remove | clear_all
    silent: true
    custom_message: null

  - type: variable
    variable_name: original_hp
    source_type: stat        # stat | flag | item_count | literal | expression | input | chat_input
    source_name: hp
    expression: null
    is_global_flag: false
    silent: true
    custom_message: null
    input_label: null
    input_placeholder: null
    input_default: null
    is_numeric: false

  - type: shop
    npc: york-waylan
    shop_type: item          # item | perk | both
    trigger_condition: immediate   # immediate | on_confirm
    silent: false
    custom_message: null

  - type: narrate
    channel: storyboard     # Key from src/config/channels.js (case-insensitive)
    title: "The Bilge Falls Silent"   # Optional embed title
    text: |                 # Required embed body text
      Full narrative text here.
      Supports multi-line block scalar.
    color: 0x2f3136        # Optional embed color. Default 0x2f3136
```

### 2.8 Action Field Reference

type: flag

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `flag_name` | `string` | yes | Flag name including scope prefix. e.g. char.met_hale. |
| `flag_value` | `string` | yes | Value to set/add/subtract. String to support expressions. |
| `flag_operation` | `string` | yes | set | add | subtract | toggle |
| `flag_type` | `string` | yes | character | global | local |
| `output_variable` | `string` | — | Session variable name to store result. |

type: item

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `item` | `string` | yes | Item ID from item schema. |
| `quantity` | `string` | yes | Amount. String to support expressions. |
| `operation` | `string` | yes | give | take |
| `output_variable` | `string` | — | Session variable name to store quantity affected. |

type: stat

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `stat_name` | `string` | yes | Stat name to modify. |
| `value` | `string` | yes | Amount. String to support expressions. |
| `operation` | `string` | yes | add | set | multiply |
| `output_variable` | `string` | — | Session variable name to store new value or change. |

type: move

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `location` | `string` | yes | Location ID from location schema. |
| `movement_type` | `string` | — | normal | forced | teleport |

type: event

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `next` | `string` | yes | Event ID to chain to. |
| `delay_seconds` | `integer` | — | Seconds before firing. Default 0. |

type: status

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `status_name` | `string` | yes | Status condition name. e.g. poisoned, stunned. |
| `status_type` | `string` | yes | buff | debuff | temporary | permanent |
| `status_value` | `string` | — | Duration or magnitude. String to support expressions. |
| `operation` | `string` | yes | add | remove | clear_all |

type: variable

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `variable_name` | `string` | yes | Name to store the variable as in session. |
| `source_type` | `string` | yes | stat | flag | item_count | literal | expression | input | chat_input |
| `source_name` | `string` | — | Stat name, flag name, or item ID to read from. |
| `expression` | `string` | — | Literal value or expression. |
| `is_global_flag` | `boolean` | — | If source_type is flag, whether it is a global flag. |
| `input_label` | `string` | — | Prompt text for input types. |
| `input_placeholder` | `string` | — | Hint text in input field. |
| `input_default` | `string` | — | Default value if player does not respond. |
| `is_numeric` | `boolean` | — | If true, parse input as number. Default false. |

type: shop

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `npc` | `string` | yes | NPC ID whose shop to open. |
| `shop_type` | `string` | yes | item | perk | both |
| `trigger_condition` | `string` | yes | immediate | on_confirm |

type: narrate

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `channel` | `string` | yes | Channel key from `src/config/channels.js` (case-insensitive). e.g. `storyboard`, `announcement`. |
| `title` | `string` | — | Embed title. Optional. |
| `text` | `string` | yes | Embed description. Supports multi-line YAML block scalar. |
| `color` | `integer` | — | Embed sidebar color as hex integer. Default `0x2f3136`. |

### 2.9 Complete Example

```yaml
events:
  - id: wolf-encounter
    name: Wolf Encounter
    event_type: combat
    next: null
    silent: false
    tags: [forest, combat]

    message:
      title: Grey Wolf
      text: A wolf steps out from the treeline. It has not decided yet.
      message_type: encounter

    checks:
      - name: scouted
        type: flag
        flag_data:
          flag_name: char.scouted_wolf
          flag_value: "true"
          is_global_flag: false
        is_required: false
        silent: true
        execution_order: 0

    enemies:
      - enemy: grey-wolf
        show_health: true
        show_level: true
        display_order: 0

    options:
      - id: fight
        text: Fight
        next: wolf-combat
        required_checks: []
        hidden_checks: []
        is_destructive: true
        display_order: 0

      - id: flee
        text: Flee
        next: wolf-flee
        required_checks: []
        hidden_checks:
          - type: flag
            flag_data:
              flag_name: char.cornered
              flag_value: "true"
              is_global_flag: false
        display_order: 1

      - id: observe
        text: Observe quietly
        next: wolf-observe
        required_checks:
          - type: flag
            flag_data:
              flag_name: char.scouted_wolf
              flag_value: "true"
              is_global_flag: false
        hidden_checks: []
        display_order: 2

    actions:
      - type: flag
        flag_name: char.encountered_wolf
        flag_value: "true"
        flag_operation: set
        flag_type: character
        silent: true
```


---

## 3. Item Schema

Items are defined in itemLib. Weapon and armor stats are embedded inline under the item entry — the importer splits them into their respective tables. The special field uses keywords registered in specialLib.

### 3.1 Top-Level Structure

```yaml
items:
  - id: longbow
    name: Longbow
    description: A tall yew bow. Rewards patience.
    item_type: weapon
    value: 120
    weight: 2
    tags: [ranged, two-handed]
    special:
      Range: 8
    weapon:                  # present only when item_type is weapon
      slot: main_hand
      subtype: bow
      base_damage: 22
      scaling: 14
      hit_mod: 5
      cooldown: 3

  - id: rapier
    name: Rapier
    item_type: weapon
    value: 95
    weight: 1
    tags: [melee, one-handed, finesse]
    special:
      Parry: 15
    weapon:
      slot: main_hand
      subtype: sword
      base_damage: 16
      scaling: 10
      hit_mod: 8
      cooldown: 2

  - id: iron-chestplate
    name: Iron Chestplate
    item_type: armor
    value: 80
    weight: 5
    tags: [heavy]
    armor:                   # present only when item_type is armor
      slot: chest
      subtype: plate
      defense: 12
      defense_percent: 5
      crit_resistance: 8

  - id: health-potion
    name: Health Potion
    description: Restores a moderate amount of HP.
    item_type: consumable
    value: 30
    weight: 0
    tags: [consumable]
```

### 3.2 Field Reference — Item Base

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Flavour text shown in item inspect. |
| `item_type` | `string` | yes | weapon | armor | consumable | material | quest | misc |
| `value` | `integer` | yes | Gold value for shops and drops. |
| `weight` | `integer` | yes | Carry weight. Use 0 for weightless. |
| `tags` | `list` | — | Open string list. |
| `special` | `map` | — | Keyword:value pairs. Keywords must exist in specialLib. |
| `weapon` | `map` | — | Weapon stats. Required when item_type is weapon. See 3.3. |
| `armor` | `map` | — | Armor stats. Required when item_type is armor. See 3.4. |


### 3.3 Field Reference — weapon

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `slot` | `string` | yes | Equipment slot. e.g. main_hand | off_hand | two_hand |
| `subtype` | `string` | — | Weapon category. Open vocabulary. e.g. bow | sword | axe |
| `base_damage` | `integer` | yes | Base damage before scaling. |
| `scaling` | `integer` | yes | Stat scaling modifier. |
| `hit_mod` | `integer` | yes | Hit chance modifier. |
| `cooldown` | `integer` | yes | Cooldown in seconds between attacks. |


### 3.4 Field Reference — armor

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `slot` | `string` | yes | Equipment slot. e.g. head | chest | legs | hands | feet |
| `subtype` | `string` | — | Armor category. Open vocabulary. e.g. plate | leather | cloth |
| `defense` | `integer` | yes | Flat damage reduction. |
| `defense_percent` | `integer` | yes | Percentage damage reduction. 0–100. |
| `crit_resistance` | `integer` | yes | Reduces incoming critical hit chance. |


---

## 4. Special Library Schema

specialLib is the keyword registry. Every keyword used in item.special, enemy.special, or perk.special must have a corresponding entry here. The entry defines the handler skeleton — when the effect fires and what shape the effect data takes. The value provided in the item or perk is the parameter passed to that handler.

specialLib is not fully finalized. New keywords are added as design grows. The shape below is fixed; the keyword vocabulary is open.

### 4.1 Top-Level Structure

```yaml
specials:
  - name: Range
    description: "Multiplies Dexterity by value and adds to initiative at battle start."
    type: combat             # combat | passive | active | utility
    timing: battle_start     # on_equip | battle_start | battle_end | before_turn | after_turn
    effect:
      stat_source: dexterity
      operation: multiply_add_initiative
    cooldown: 0
    cost: 0
    icon: range.png
    tags: [ranged, initiative]

  - name: Parry
    description: "Increases chance to parry incoming attacks."
    type: combat
    timing: before_turn
    effect:
      stat_target: parry_chance
      operation: add
    cooldown: 0
    cost: 0
    tags: [defensive, melee]

  - name: Poison
    description: "Inflicts poison on hit."
    type: combat
    timing: after_turn
    effect:
      status: poisoned
      operation: apply
    cooldown: 3
    cost: 0
    tags: [debuff, dot]
```

### 4.2 Field Reference — Special

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | yes | Keyword. Must be unique. Matches keywords used in item.special, enemy.special, perk.special. |
| `description` | `string` | — | Human-readable explanation of what the keyword does. |
| `type` | `string` | yes | combat | passive | active | utility |
| `timing` | `string` | yes | on_equip | battle_start | battle_end | before_turn | after_turn |
| `effect` | `map` | yes | Handler skeleton. Shape defined per keyword. Open map — not finalized. |
| `cooldown` | `integer` | yes | Cooldown in turns or seconds. 0 = no cooldown. |
| `cost` | `integer` | yes | Resource cost to activate. 0 = free. |
| `icon` | `string` | — | Icon filename. |
| `tags` | `list` | — | Open string list. |


---

## 5. Skill Schema

Skills form a tree. Each skill may have a parent skill. A skill with no parent is a root skill. All skills are authored flat — the tree is reconstructed from parent references.

### 5.1 Top-Level Structure

```yaml
skills:
  - id: combat
    name: "Combat"
    description: "Proficiency in direct confrontation."
    parent: null             # root skill
    bonus: attack
    bonus_value: 2
    tags: [combat]

  - id: swordsmanship
    name: "Swordsmanship"
    description: "Mastery of blade technique."
    parent: combat           # child of combat
    bonus: hit_mod
    bonus_value: 3
    tags: [combat, melee]

  - id: archery
    name: "Archery"
    description: "Precision with ranged weapons."
    parent: combat
    bonus: range_damage
    bonus_value: 4
    tags: [combat, ranged]
```

### 5.2 Field Reference — Skill

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Flavour text. |
| `parent` | `string` | — | Parent skill ID. Null for root skills. |
| `bonus` | `string` | yes | Stat or effect this skill improves. Open vocabulary. |
| `bonus_value` | `integer` | yes | Amount of bonus per skill level. |
| `tags` | `list` | — | Open string list. |


---

## 6. Perk Schema

Perks are skill-gated abilities players can unlock. Each perk requires a specific skill at a specific level. The special field uses the same keyword system as items.

### 6.1 Top-Level Structure

```yaml
perks:
  - id: power-strike
    name: "Power Strike"
    description: "Channel strength into a single devastating blow."
    category: combat
    skill: swordsmanship
    skill_level_required: 3
    power: 15
    cost: 20
    timing: before_turn      # on_equip | battle_start | battle_end | before_turn | after_turn
    special:
      Stagger: 2
    tags: [melee, offensive]
```

### 6.2 Field Reference — Perk

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Flavour text. |
| `category` | `string` | yes | Organisational category. Open vocabulary. |
| `skill` | `string` | yes | Skill ID required to unlock this perk. |
| `skill_level_required` | `integer` | yes | Minimum skill level required. |
| `power` | `integer` | yes | Base power value of the perk effect. |
| `cost` | `integer` | — | Resource cost to activate. 0 = free. |
| `timing` | `string` | yes | on_equip | battle_start | battle_end | before_turn | after_turn |
| `special` | `map` | — | Keyword:value pairs. Keywords must exist in specialLib. |
| `tags` | `list` | — | Open string list. |


---

## 7. Quest Schema

Quests are authored content with fixed reward and requirement shapes. Requirements use the same syntax as the check step (section 2.3) — the same types, the same fields, the same branching. Rewards cover XP, skill XP, items, further quests, and status buffs.

### 7.1 Top-Level Structure

```yaml
quests:
  - id: first-blood
    name: "First Blood"
    description: "Prove yourself in combat."
    type: combat             # combat | exploration | delivery | story | repeatable
    tags: [prologue, combat]
    requirement:
      - type: stat
        stat_data:
          stat_name: level
          stat_comparison: gte
          stat_value: 1
      - type: flag
        flag_data:
          flag_name: prologue_complete
          flag_value: "true"
          is_global_flag: false
    reward:
      xp: 200
      skill_xp:
        - skill: combat
          amount: 50
        - skill: swordsmanship
          amount: 25
      items:
        - item: iron-sword
          amount: 1
        - item: health-potion
          amount: 2
      quests:
        - second-blood
      status:
        - buff: veteran_mark
          duration: permanent
```

### 7.2 Field Reference — Quest

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Flavour text shown in quest log. |
| `type` | `string` | yes | combat | exploration | delivery | story | repeatable |
| `tags` | `list` | — | Open string list. |
| `requirement` | `list` | — | List of conditions using check syntax (section 2.3). All must pass to accept quest. |
| `reward` | `map` | yes | Reward granted on completion. See 7.3. |


### 7.3 Field Reference — reward

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `xp` | `integer` | — | Experience points awarded. |
| `skill_xp` | `list` | — | List of skill:amount pairs. Each grants XP to a specific skill. |
| `items` | `list` | — | List of item:amount pairs granted on completion. |
| `quests` | `list` | — | List of quest IDs unlocked on completion. |
| `status` | `list` | — | List of status buffs applied. Each has buff name and duration. |


---

## 8. Resource Node Schema

Resource nodes are harvestable objects placed in locations. They define what item they yield, how much, how fast they respawn, and what skill or tool is required.

### 8.1 Top-Level Structure

```yaml
resource_nodes:
  - id: ironwood-tree
    name: "Ironwood Tree"
    description: "A dense hardwood tree. The grain resists an ordinary axe."
    node_type: tree          # tree | rock | plant | water | special
    resource_item: ironwood-log
    min_yield: 1
    max_yield: 3
    respawn_time: 300        # seconds
    required_tool: woodcutting-axe   # optional
    skill_required: woodcutting      # optional
    skill_level: 2
    depletion_chance: 20     # % chance node depletes after harvest
    interaction_text: "A towering ironwood. Your axe will need to be up to the task."
    success_text: "You split the trunk cleanly. The log is dense and heavy."
    failure_text: "The wood resists. You walk away empty-handed."
    avatar: ironwood_tree.png
    tags: [wood, rare]
```

### 8.2 Field Reference — Resource Node

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Flavour text. |
| `node_type` | `string` | yes | tree | rock | plant | water | special |
| `resource_item` | `string` | yes | Item ID of what this node yields. |
| `min_yield` | `integer` | yes | Minimum items per harvest. |
| `max_yield` | `integer` | yes | Maximum items per harvest. |
| `respawn_time` | `integer` | yes | Seconds before node is harvestable again. |
| `required_tool` | `string` | — | Item ID of tool required. Omit if no tool needed. |
| `skill_required` | `string` | — | Skill ID required. Omit if no skill needed. |
| `skill_level` | `integer` | — | Minimum skill level required. Default 0. |
| `depletion_chance` | `integer` | — | Percentage chance node depletes after harvest. Default 0. |
| `interaction_text` | `string` | — | Shown when player interacts with node. |
| `success_text` | `string` | — | Shown on successful harvest. |
| `failure_text` | `string` | — | Shown on failed harvest. |
| `avatar` | `string` | — | Image filename. |
| `tags` | `list` | — | Open string list. |


---

## 9. Project Schema

Projects are server-wide construction or research efforts. They have resource costs, prerequisites, and a completion time. The river crossing design from the first quest is an example of a project.

### 9.1 Top-Level Structure

```yaml
projects:
  - id: river-crossing
    name: "River Crossing"
    description: "Construct a bridge across the peninsula river."
    category: infrastructure
    cost: 500
    resource_requirements:
      ironwood-log: 20
      rope: 10
    level: 1
    prerequisites:
      - ruined-village-cleared
    completion_time: 86400   # seconds
    icon: bridge.png
    tags: [infrastructure, peninsula]
```

### 9.2 Field Reference — Project

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Flavour text shown in project list. |
| `category` | `string` | yes | Organisational category. Open vocabulary. |
| `cost` | `integer` | yes | Gold cost. 0 if free. |
| `resource_requirements` | `map` | — | item_id:amount pairs of materials required. |
| `level` | `integer` | yes | Project tier or level requirement. |
| `prerequisites` | `list` | — | List of project IDs that must be completed first. |
| `completion_time` | `integer` | yes | Time in seconds to complete. |
| `icon` | `string` | — | Icon filename. |
| `tags` | `list` | — | Open string list. |


---

## 10. House Upgrade Schema

House upgrades are player-owned improvements to their personal space. Each upgrade has a type, resource cost, required house level, and effects. Prerequisites are other upgrade IDs.

### 10.1 Top-Level Structure

```yaml
house_upgrades:
  - id: stone-walls
    name: "Stone Walls"
    description: "Replace timber framing with dressed stone."
    category: structure
    upgrade_type: permanent  # permanent | temporary | cosmetic
    cost: 200
    resource_requirements:
      stone-block: 30
      mortar: 10
    required_house_level: 2
    effects:
      defense_bonus: 5
      storage_bonus: 10
    prerequisites:
      - timber-walls
    completion_time: 3600
    icon: stone_walls.png
    tags: [structure, defensive]
```

### 10.2 Field Reference — House Upgrade

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. |
| `name` | `string` | yes | Display name. |
| `description` | `string` | — | Flavour text. |
| `category` | `string` | yes | Organisational category. Open vocabulary. |
| `upgrade_type` | `string` | yes | permanent | temporary | cosmetic |
| `cost` | `integer` | yes | Gold cost. 0 if free. |
| `resource_requirements` | `map` | — | item_id:amount pairs of materials required. |
| `required_house_level` | `integer` | yes | Minimum house level to purchase. |
| `effects` | `map` | yes | Effects applied when upgrade is active. Open map. |
| `prerequisites` | `list` | — | List of upgrade IDs that must be completed first. |
| `completion_time` | `integer` | yes | Time in seconds to complete. |
| `icon` | `string` | — | Icon filename. |
| `tags` | `list` | — | Open string list. |


---

## 4. Location Schema

Locations are the navigable spaces of the game world. A location definition covers its identity, Discord channel binding, links to other locations, contained objects, enemy encounters, resource nodes, and triggered events.

locationInstance and its child tables are runtime state — they are not authored in YAML.

### 4.1 Superimposition Model

One Discord channel represents one location to the player. Behind it, up to three location records can exist — one per time slot (morning, afternoon, night). The system activates whichever record matches the current time of day.

Flag overrides take absolute precedence over time. A flag-bound record is the active reality for that channel regardless of time, and persists until the flag is cleared. Only one flag override should be active per channel at a time — conflicts are a data integrity problem resolved by admin intervention.

Resolution order: (1) check for active flag override, use it if found. (2) Otherwise match current time of day.

```yaml
# Normal operation — three time versions of the same channel
locations:
  - id: peninsula-forest-morning
    channel: "1234567890"
    time: morning
    name: "The Forest"

  - id: peninsula-forest-afternoon
    channel: "1234567890"
    time: afternoon
    name: "The Forest"

  - id: peninsula-forest-night
    channel: "1234567890"
    time: night
    name: "The Forest — After Dark"

# Flag override — extraordinary circumstance
  - id: peninsula-forest-burning
    channel: "1234567890"
    time: null                           # not time-bound
    flag_override: global.forest_burning # active while this flag is set
    name: "The Forest — On Fire"
```

### 4.2 Top-Level Structure

```yaml
locations:
  - id: peninsula-forest-morning
    name: "The Forest"
    description: "The canopy closes fast. Light reaches the floor in columns."
    type: wilderness         # wilderness | settlement | camp | dungeon | transit
    channel: "1234567890"    # Discord channel ID this location is bound to
    role: "9876543210"       # optional: Discord role ID required to access
    time: morning            # morning | afternoon | night | null
    flag_override: null      # scope.flag_name — makes this version active regardless of time
    tags: [attrition, depth-enabled]
    cluster: peninsula
    links:
      - peninsula-plain-morning
      - peninsula-camp
    contains:
      - object_id: ruined-well
        type: structure
        time: null
    enemy_spawns:
      - enemy: grey-wolf
        spawn_chance: 80
        min_count: 1
        max_count: 3
        rarity: 1
        is_guaranteed: false
        spawn_conditions: null
    enemies:
      - enemy: grey-wolf
        min_level: 1
        max_level: 10
        encounter_weight: 100
        enemy_category: common
        threat_level: 2
        spawn_conditions: null
        time_restrictions: null
        group_encounter: false
        level_scaling: true
        stat_modifiers: null
        loot_table_modifiers: null
        experience_modifier: 1.0
        description: "Territorial wolves that patrol the treeline."
        is_active: true
    resource_nodes:
      - node: ironwood-tree
        spawn_chance: 60
        min_count: 1
        max_count: 2
        rarity: 1
        is_guaranteed: false
        spawn_conditions: null
    events:
      - event: ruined-village-discovery
        event_type: exploration
        event_weight: 50
        event_config: null
        level_requirement: 1
        skill_requirements: null
        item_requirements: null
        flag_requirements: null
        time_restrictions: null
        is_repeatable: false
        cooldown_time: 0
        max_occurrences: 1
        seasonal_availability: null
        is_active: true
```

### 4.3 Field Reference — Location Base

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | yes | Kebab-case. Permanent. Include time slot in id (e.g. forest-morning). |
| `name` | `string` | yes | Display name shown to players. |
| `description` | `string` | — | Flavour text shown on arrival. |
| `type` | `string` | yes | wilderness | settlement | camp | dungeon | transit |
| `channel` | `string` | yes | Discord channel ID this record is bound to. Multiple records share the same channel. |
| `role` | `string` | — | Discord role ID required to access this location. |
| `time` | `string` | — | morning | afternoon | night | null. Null only for flag-override versions. |
| `flag_override` | `string` | — | scope.flag_name. When this flag is set, this record is the active reality for its channel, overriding time. Only one flag override should be active per channel at a time. |
| `tags` | `list` | — | Open string list. |
| `cluster` | `string` | — | Cluster ID this location belongs to. |
| `links` | `list` | — | List of location IDs this location connects to. |
| `contains` | `list` | — | Objects present at this location. See 4.4. |
| `enemy_spawns` | `list` | — | Spawn pool for enemies. See 4.5. |
| `enemies` | `list` | — | Encounter table with full config. See 4.6. |
| `resource_nodes` | `list` | — | Resource node spawn pool. See 4.7. |
| `events` | `list` | — | Events that can trigger here. See 4.8. |


### 4.4 Field Reference — contains entry

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `object_id` | `string` | yes | ID of the contained object. |
| `type` | `string` | yes | Object category. Open vocabulary (e.g. structure, npc, item). |
| `time` | `string` | — | If set, object only present at this time of day. |


### 4.5 Field Reference — enemy_spawns entry

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enemy` | `string` | yes | Enemy ID from enemy schema. |
| `spawn_chance` | `integer` | yes | 0–100. Probability this enemy spawns. |
| `min_count` | `integer` | yes | Minimum number spawned. |
| `max_count` | `integer` | yes | Maximum number spawned. |
| `rarity` | `integer` | yes | 1=Common 2=Uncommon 3=Rare 4=Epic 5=Legendary |
| `is_guaranteed` | `boolean` | yes | If true, always spawns regardless of chance. |
| `spawn_conditions` | `map` | — | Conditions that must be met for spawn. Open map. |


### 4.6 Field Reference — enemies entry

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enemy` | `string` | yes | Enemy ID from enemy schema. |
| `min_level` | `integer` | — | Minimum player level for this enemy to appear. Default 1. |
| `max_level` | `integer` | — | Maximum player level. Default 99. |
| `encounter_weight` | `integer` | yes | Relative weight in encounter table. Default 100. |
| `enemy_category` | `string` | — | common | elite | boss | rare |
| `threat_level` | `integer` | — | 1–10 threat rating. Default 1. |
| `spawn_conditions` | `map` | — | Environmental or quest conditions. Open map. |
| `time_restrictions` | `map` | — | Day/night or seasonal restrictions. Open map. |
| `group_encounter` | `boolean` | — | If true, enemy can appear in groups. Default false. |
| `level_scaling` | `boolean` | — | If true, scales with player level. Default true. |
| `stat_modifiers` | `map` | — | Location-specific stat changes. Open map. |
| `loot_table_modifiers` | `map` | — | Location-specific loot changes. Open map. |
| `experience_modifier` | `float` | — | XP multiplier for this location. Default 1.0. |
| `description` | `string` | — | Author note explaining why this enemy is here. |
| `is_active` | `boolean` | — | If false, excluded from encounter table. Default true. |


### 4.7 Field Reference — resource_nodes entry

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `node` | `string` | yes | Resource node library ID. |
| `spawn_chance` | `integer` | yes | 0–100. Probability this node spawns. |
| `min_count` | `integer` | yes | Minimum nodes spawned. |
| `max_count` | `integer` | yes | Maximum nodes spawned. |
| `rarity` | `integer` | yes | 1=Common 2=Uncommon 3=Rare 4=Epic 5=Legendary |
| `is_guaranteed` | `boolean` | yes | If true, always spawns. |
| `spawn_conditions` | `map` | — | Conditions that must be met for spawn. Open map. |


### 4.8 Field Reference — events entry

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `event` | `string` | yes | Event ID from event schema. |
| `event_type` | `string` | yes | combat | resource | special | exploration |
| `event_weight` | `integer` | yes | Relative probability weight. Default 100. |
| `event_config` | `map` | — | Flexible per-location event configuration. Open map. |
| `level_requirement` | `integer` | — | Minimum player level. Default 1. |
| `skill_requirements` | `map` | — | Required skills and levels. Open map. |
| `item_requirements` | `map` | — | Required items in inventory. Open map. |
| `flag_requirements` | `map` | — | Required character or global flags. Open map. |
| `time_restrictions` | `map` | — | Time-based availability. Open map. |
| `is_repeatable` | `boolean` | — | If false, fires once per character. Default true. |
| `cooldown_time` | `integer` | — | Seconds before event can fire again. Default 0. |
| `max_occurrences` | `integer` | — | Maximum total fires. Null = unlimited. |
| `seasonal_availability` | `map` | — | Season or calendar restrictions. Open map. |
| `is_active` | `boolean` | — | If false, excluded from location pool. Default true. |


---

## 5. Cross-Reference Summary

The table below shows how content types reference each other. All references use IDs. The loader validates that referenced IDs exist at startup.

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `enemy.start_event` | `→ event.id` | — | Event fired at combat start. |
| `enemy.reward.items[].id` | `→ item.id` | — | Drop table references. |
| `event.combat.enemy` | `→ enemy.id` | — | Combat encounter target. |
| `event.enemies[].enemy` | `→ enemy.id` | — | Enemy preview reference. |
| `event.actions[shop].npc` | `→ npc id` | — | Shop owner. |
| `event.actions[event].next` | `→ event.id` | — | Event chain target. |
| `event.options[].next` | `→ event.id` | — | Option branch target. |
| `event.checks[].on_success` | `→ event.id` | — | Check success branch. |
| `event.checks[].on_failure` | `→ event.id` | — | Check failure branch. |
| `event.next` | `→ event.id` | — | Default next event. |
| `event.actions[move].location` | `→ location.id` | — | Move action destination. |
| `event.actions[item].item` | `→ item.id` | — | Item action reference. |
| `item.weapon / item.armor` | `→ weaponLib / armorLib` | — | Embedded weapon or armor stats. |
| `item.special keys` | `→ specialLib.name` | — | Special keyword must exist in specialLib. |
| `perk.skill` | `→ skill.id` | — | Skill required to unlock perk. |
| `perk.special keys` | `→ specialLib.name` | — | Special keyword must exist in specialLib. |
| `skill.parent` | `→ skill.id` | — | Parent skill in tree. |
| `quest.reward.items[].item` | `→ item.id` | — | Item reward reference. |
| `quest.reward.quests[]` | `→ quest.id` | — | Quest unlocked on completion. |
| `resource_node.resource_item` | `→ item.id` | — | Item yielded by node. |
| `project.prerequisites[]` | `→ project.id` | — | Required prior projects. |
| `house_upgrade.prerequisites[]` | `→ house_upgrade.id` | — | Required prior upgrades. |
| `location.links[]` | `→ location.id` | — | Connected location IDs. |
| `location.cluster` | `→ cluster id` | — | Cluster this location belongs to. |
| `location.contains[].object_id` | `→ object id` | — | Contained object reference. |
| `location.enemy_spawns[].enemy` | `→ enemy.id` | — | Spawn pool enemy reference. |
| `location.enemies[].enemy` | `→ enemy.id` | — | Encounter table enemy reference. |
| `location.resource_nodes[].node` | `→ resource_node.id` | — | Resource node reference. |
| `location.events[].event` | `→ event.id` | — | Event pool reference. |

End of schema specification.

> Questions about this document should result in updating this document — not working around it.

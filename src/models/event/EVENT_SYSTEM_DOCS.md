# New Event System Documentation

## Overview

The new event system is a modular, flexible architecture that separates concerns and allows for complex event scenarios. Instead of events being limited to just Discord messages, events can now be composed of multiple components that work together.

## Core Components

### 1. Event Base (`eventBase`)
The foundation of every event. Contains basic metadata and acts as a container for other components.

**Key Fields:**
- `id`: Unique identifier
- `name`: Human-readable name
- `event_type`: Category (story, combat, choice, automatic, etc.)
- `tags`: Array for categorization and filtering
- `metadata`: Flexible JSON storage for custom data

### 2. Event Message (`eventMessage`)
Optional component for Discord display. Not every event needs a message.

**Key Fields:**
- `event_id`: Links to eventBase
- `title`, `text`: Message content
- `avatar`, `illustration`: Visual elements
- `npc_speaker`: Who is speaking
- `message_type`: How to display (normal, embed, whisper)
- `display_conditions`: When to show this message

### 3. Event Check (`eventCheck`)
Validation system that can check multiple conditions before proceeding.

**Check Types:**
- **Flag checks**: Global or character flags
- **Stat checks**: Player stats with comparisons or dice rolls
- **Item checks**: Inventory requirements (with optional consumption)
- **Custom checks**: Extensible for future needs

**Key Fields:**
- `check_name`: Identifier for referencing in actions/options
- `check_type`: What kind of check to perform
- `is_required`: Whether failure blocks progression
- `execution_order`: Order to run multiple checks

### 4. Event Combat (`eventCombat`)
Combat resolution component.

**Features:**
- Multiple monster/NPC opponents
- Difficulty scaling
- Environmental effects
- Custom victory/defeat messages
- Auto-resolve option for narrative combat

### 5. Event Enemy (`eventEnemy`)
Enemy preview system that displays enemy information to players before they make decisions.

**Features:**
- **Enemy references**: Link to monsters or NPCs
- **Selective information**: Choose what stats/abilities to reveal
- **Display overrides**: Custom names, descriptions, and images
- **Threat assessment**: Warning messages and threat levels
- **Conditional reveals**: Show different info based on player knowledge
- **Multiple enemies**: Support for displaying multiple opponents

**Key Fields:**
- `enemy_type`/`enemy_id`: Reference to the actual enemy
- `show_health`/`show_level`: Control stat visibility
- `show_stats`/`show_abilities`: Arrays of specific attributes to reveal
- `threat_level`: Difficulty indicator ("Easy", "Moderate", "Deadly", etc.)
- `reveal_conditions`: JSON conditions for progressive information reveal

### 6. Event Action (`eventAction`)
The workhorse of the system. Can modify database, change player state, and chain events.

**Action Types:**
- **Flag actions**: Set, add, subtract, toggle flags
- **Item actions**: Give, take, or set item quantities
- **Stat actions**: Modify player stats
- **Status effects**: Apply buffs/debuffs
- **Movement**: Teleport or move players
- **Event chaining**: Trigger subsequent events
- **Experience**: Award XP or skill experience

**Trigger Conditions:**
- `immediate`: Execute right away
- `check_success`/`check_failure`: Based on check results
- `combat_victory`/`combat_defeat`: Based on combat outcome
- `option_selected`: When player chooses an option

### 7. Event Option (`eventOption`)
Player choice system with advanced visibility controls.

**Features:**
- Conditional visibility based on checks
- Discord button styling
- Cooldown prevention
- Destructive action warnings

## Event Flow Example

Here's how a complex event might work:

```javascript
// 1. Event Base
{
  id: "mysterious_cave_entrance",
  name: "Mysterious Cave",
  event_type: "choice",
  tags: ["exploration", "mystery"],
  metadata: { difficulty: "medium" }
}

// 2. Event Message
{
  event_id: "mysterious_cave_entrance",
  title: "A Dark Cave",
  text: "You discover a cave entrance covered in strange runes...",
  illustration: "cave_entrance.jpg"
}

// 3. Event Checks
[
  {
    event_id: "mysterious_cave_entrance",
    check_name: "has_torch",
    check_type: "item",
    item_id: 15, // torch item
    required_quantity: 1
  },
  {
    event_id: "mysterious_cave_entrance",
    check_name: "archaeology_skill",
    check_type: "stat",
    stat_name: "archaeology",
    stat_comparison: "greater",
    stat_value: 50
  }
]

// 4. Event Enemy (Optional - for preview)
[
  {
    event_id: "mysterious_cave_entrance",
    enemy_type: "monster",
    enemy_id: 23, // Cave Troll
    display_name: "Ancient Cave Guardian",
    threat_level: "Dangerous",
    show_health: true,
    show_level: true,
    show_stats: ["strength", "defense"],
    show_abilities: ["cave_slam", "rock_throw"],
    warning_message: "This creature looks formidable...",
    reveal_conditions: { required_checks: ["archaeology_skill"] }
  }
]

// 5. Event Options
[
  {
    event_id: "mysterious_cave_entrance",
    option_id: "enter_cave",
    text: "Enter the cave",
    required_checks: ["has_torch"]
  },
  {
    event_id: "mysterious_cave_entrance", 
    option_id: "study_runes",
    text: "Study the ancient runes",
    required_checks: ["archaeology_skill"]
  },
  {
    event_id: "mysterious_cave_entrance",
    option_id: "leave",
    text: "Leave this place",
    is_default: true
  }
]

// 6. Event Actions
[
  {
    event_id: "mysterious_cave_entrance",
    action_name: "consume_torch",
    action_type: "item",
    trigger_condition: "option_selected",
    required_option_id: "enter_cave",
    item_id: 15,
    item_quantity: 1,
    item_operation: "take"
  },
  {
    event_id: "mysterious_cave_entrance", 
    action_name: "archaeology_exp",
    action_type: "exp",
    trigger_condition: "option_selected",
    required_option_id: "study_runes",
    skill_exp: { "archaeology": 25 }
  },
  {
    event_id: "mysterious_cave_entrance",
    action_name: "enter_dungeon",
    action_type: "event",
    trigger_condition: "option_selected", 
    required_option_id: "enter_cave",
    next_event_id: "cave_interior_entrance"
  }
]
```

## Action Trigger Conditions

Actions can execute at different points in event processing based on their `trigger_condition`:

### **Available Trigger Conditions:**

1. **`immediate`** - Execute as soon as the event loads
2. **`check_success`** - Execute when a specific check succeeds
3. **`check_failure`** - Execute when a specific check fails  
4. **`combat_victory`** - Execute after winning combat
5. **`combat_defeat`** - Execute after losing combat
6. **`option_selected`** - Execute when player selects a specific option

### **Conditional Action Examples:**

```javascript
// Give experience only if skill check succeeds
{
  action_name: "archaeology_reward",
  action_type: "exp", 
  trigger_condition: "check_success",
  required_check_name: "archaeology_skill",
  skill_exp: { "archaeology": 50 }
},

// Take item only if check fails (consumed attempting)
{
  action_name: "consume_material",
  action_type: "item",
  trigger_condition: "check_failure", 
  required_check_name: "archaeology_skill",
  item_id: 123,
  item_quantity: -1
},

// Different rewards based on combat outcome
{
  action_name: "victory_treasure",
  action_type: "item",
  trigger_condition: "combat_victory",
  item_id: 456, 
  item_quantity: 1
},
{
  action_name: "defeat_injury", 
  action_type: "status",
  trigger_condition: "combat_defeat",
  status_effect: "wounded",
  status_duration: 300
},

// Option-specific outcomes
{
  action_name: "sneak_bonus",
  action_type: "exp", 
  trigger_condition: "option_selected",
  required_option_id: "sneak_past_guards",
  skill_exp: { "stealth": 25 }
}
```

### **Action Processing Order:**

1. **Immediate actions** - Execute first 
2. **Check result actions** - Based on success/failure of each check
3. **Combat result actions** - Based on victory/defeat  
4. **Option actions** - When player makes choices
5. **Message display** - Show results to player

This allows complex event flows like: "Check archaeology skill → If success, give XP and reveal secret option → If player chooses secret option, trigger hidden event → If combat in hidden event succeeds, give rare treasure"

## Event Chaining

Event chaining is handled through **Event Actions** with `action_type: "event"`. This provides maximum flexibility:

1. **Conditional chaining**: Different events based on success/failure
2. **Delayed chaining**: Events can trigger after a delay
3. **Multiple outcomes**: One event can trigger different follow-ups
4. **Complex branching**: Based on player choices, checks, or combat results

## Migration from Old System

The old system had these limitations:
- Events were always Discord messages
- Limited check system
- Rigid option structure
- Event chaining was hardcoded

The new system addresses all these issues while maintaining backward compatibility through the legacy `specialEventBase` for location-based events.

## Usage Patterns

### Simple Message Event
- Only `eventBase` + `eventMessage`
- No checks, options, or actions needed

### Choice Event  
- `eventBase` + `eventMessage` + `eventOption` + `eventAction`
- Actions trigger based on player choices

### Skill Check Event
- `eventBase` + `eventCheck` + `eventAction`
- Actions trigger based on check success/failure
- Optional message component

### Combat Event
- `eventBase` + `eventCombat` + `eventAction`
- Actions trigger based on combat outcome
- Optional message for narrative setup

### Enemy Preview Event
- `eventBase` + `eventMessage` + `eventEnemy` + `eventOption`
- Show enemy information before player makes decisions
- Conditional information reveal based on player knowledge
- Allows strategic decision-making

### Complex Multi-Stage Event
- All components working together
- Multiple checks with different requirements
- Various actions for different outcomes
- Rich player choice system

## Benefits

1. **Modularity**: Only include components you need
2. **Flexibility**: Complex scenarios are easily handled
3. **Reusability**: Components can be shared between events
4. **Extensibility**: Easy to add new check types or action types
5. **Performance**: Only load and execute what's needed
6. **Maintainability**: Clear separation of concerns
7. **Strategic Gameplay**: Enemy previews enable informed decision-making

## Enemy Preview Use Cases

### 1. **Encounter Assessment**
Players can evaluate threats before committing to combat, making choices based on enemy strength, abilities, and their own preparedness.

### 2. **Progressive Knowledge**
Use `reveal_conditions` to show more enemy information as players gain knowledge through skills, items, or previous encounters.

### 3. **Multiple Enemy Display**
Show all enemies in a group encounter, helping players plan tactics and resource allocation.

### 4. **Threat Level Communication**
Use `threat_level` and `warning_message` to communicate danger without revealing exact stats, maintaining mystery while enabling informed choices.
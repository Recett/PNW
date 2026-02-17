# Finish Register Tag - Implementation Guide

## Overview

The `finish_register` tag is a special event tag that automatically handles the final steps of character registration. When an event has this tag, it will:

1. **Apply Virtue Stats** - Read virtue flags and calculate bonus stats
2. **Give Starter Weapon** - Find and grant starter weapon based on character flags
3. **Equip Weapon** - Automatically equip the starter weapon
4. **Clean Up** - Remove temporary registration flags

## How It Works

### 1. Virtue Stat Calculation

The system reads the following **local session flags**:
- `fortitude` (default: 8)
- `justice` (default: 8)
- `prudence` (default: 8)
- `temperance` (default: 8)

These values are used to calculate bonus stats using the formulas:
```
CON = (3F - 24) / 8
STR = (2J + 2P - T) / 8
DEX = (2P + 2T - J) / 8
AGI = (2J + 2T - P) / 8
```

The total bonus is always adjusted to equal 12 points.

### 2. Starter Weapon Assignment

The system looks for any **local flag** that starts with `starter_` (e.g., `starter_sword`, `starter_bow`, `starter_staff`).

It then searches the item library for an item with a matching tag and:
- Adds the item to the character's inventory
- Equips the item automatically
- Removes the starter flag from the session

### 3. Flag Cleanup

After processing, the system:
- Removes the `unregistered` **character flag** to unlock full game access
- Removes the `starter_*` **local flag** from the session to prevent duplicate weapons

## Usage

### Creating a Finish Registration Event

1. Create an event in the `event_base` table with the `finish_register` tag:

```javascript
{
  id: 'registration_complete',
  name: 'Registration Complete',
  tags: ['finish_register'],
  is_active: true,
  // ... other event properties
}
```

2. Set up virtue flags during the interview process (via event actions or other mechanisms):

```javascript
// Example: Set virtue flags based on player choices
eventActionFlag: {
  event_id: 'interview_question_1',
  flag_name: 'fortitude',
  flag_value: '10',
  flag_type: 'local',  // LOCAL FLAG - stored in event session
  // ...
}
```

3. Set a starter weapon flag based on player choice:

```javascript
// Example: Player chooses sword as starting weapon
eventActionFlag: {
  event_id: 'weapon_choice_event',
  flag_name: 'starter_sword',
  flag_value: '1',
  flag_type: 'local',  // LOCAL FLAG - stored in event session
  // ...
}
```

### Item Tag Setup

Ensure your starter weapons have matching tags in the `item_lib` table:

```javascript
{
  id: 101,
  name: 'Training Sword',
  item_type: 'weapon',
  tag: ['starter', 'starter_sword'],
  // ... other item properties
}
```

### Example Flow

```
1. Player starts /register command
2. Interview event starts (sets unregistered character flag)
3. Interview asks virtue questions (sets virtue LOCAL flags)
4. Interview asks weapon preference (sets starter_sword LOCAL flag)
5. Final event has "finish_register" tag
6. System automatically:
   - Reads virtue values from session.flags.local
   - Calculates and applies virtue bonuses
   - Finds starter_sword in session.flags.local
   - Gives Training Sword (matches starter_sword tag)
   - Equips Training Sword
   - Removes starter_sword from local flags
   - Removes unregistered character flag
   - Shows completion message
```

## Messages Displayed

The system automatically adds these messages to the event:

- **Virtue Stats**: "📊 Your virtues have shaped your abilities: **CON** +X | **STR** +X | **DEX** +X | **AGI** +X"
- **Starter Weapon**: "⚔️ You have been given **WEAPON_NAME** as your starter weapon!"
- **Completion**: "✅ Registration complete! You are now ready to begin your adventure."

## Error Handling

If any step fails, an error message is displayed:
- "⚠️ There was an issue completing your registration. Please contact an administrator."

The error is also logged to the console for debugging.

## Flag Requirements

### Local Flags (Session Variables)
These flags are set during the event session and are NOT persisted to the database:
- `fortitude` (integer, 1-16) - Set during interview questions
- `justice` (integer, 1-16) - Set during interview questions
- `prudence` (integer, 1-16) - Set during interview questions
- `temperance` (integer, 1-16) - Set during interview questions
- `starter_*` (any flag matching this pattern, e.g., `starter_sword`) - Set during weapon selection

### Character Flags (Persistent)
- `unregistered` (removed after completion to unlock full game access)

### Item Tags
- Items must have tags that match the starter flag names
- Example: Flag `starter_sword` → Item tag includes `'starter_sword'`

## Important Notes

- **Local flags are session-based** - They exist only during the event chain and are NOT saved to the database
- The virtue flags and starter weapon flags should be set as `flag_type: 'local'` in event actions
- Local flags are passed between events in the same session via the session object
- The virtue flag defaults are set to 8 if not found in the session
- Only one starter weapon can be given (first match found)
- Combat stats are automatically recalculated after applying bonuses
- The `unregistered` **character flag** removal unlocks all gameplay commands

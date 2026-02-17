# Event System Constants Usage

This document shows how to use the event system constants in your code.

## Importing Constants

You can import constants from either location:

```javascript
// From the constants file directly
const { FLAG_TYPE, ACTION_TYPE } = require('./models/event/eventConstants');

// From the event model (includes both models and constants)
const { FLAG_TYPE, ACTION_TYPE, EventBase } = require('./models/event/eventModel');
```

## Usage Examples

### Flag Types
```javascript
const { FLAG_TYPE } = require('./models/event/eventConstants');

// Instead of magic strings:
flag_type: 'character'

// Use the enum:
flag_type: FLAG_TYPE.CHARACTER
```

### Action Types
```javascript
const { ACTION_TYPE } = require('./models/event/eventConstants');

// Instead of magic strings:
action_type: 'flag'

// Use the enum:
action_type: ACTION_TYPE.FLAG
```

### Creating Event Actions
```javascript
const { ACTION_TYPE, FLAG_TYPE, FLAG_OPERATION, TRIGGER_CONDITION } = require('./models/event/eventConstants');

// Example: Create a flag action that sets a character flag when a check succeeds
const flagAction = {
    event_id: 'event_001',
    action_name: 'mark_quest_started',
    action_type: ACTION_TYPE.FLAG,
    trigger_condition: TRIGGER_CONDITION.CHECK_SUCCESS,
    required_check_name: 'skill_check',
    flag_name: 'quest_started',
    flag_operation: FLAG_OPERATION.SET,
    flag_type: FLAG_TYPE.CHARACTER,
    flag_value: '1'
};
```

### Creating Event Checks
```javascript
const { CHECK_TYPE, STAT_COMPARISON } = require('./models/event/eventConstants');

// Example: Create a stat check
const statCheck = {
    event_id: 'event_001',
    check_name: 'strength_check',
    check_type: CHECK_TYPE.STAT,
    stat_name: 'strength',
    stat_comparison: STAT_COMPARISON.GREATER,
    stat_value: 15,
    use_dice_roll: true
};
```

### Switch Statements
```javascript
const { ACTION_TYPE } = require('./models/event/eventConstants');

switch (action.action_type) {
    case ACTION_TYPE.FLAG:
        await this.executeFlagAction(action, session);
        break;
    case ACTION_TYPE.ITEM:
        await this.executeItemAction(action, session);
        break;
    case ACTION_TYPE.STAT:
        await this.executeStatAction(action, session);
        break;
    // ... etc
}
```

## Available Constants

### FLAG_TYPE
- `LOCAL: 'local'` - Temporary flags (session only)
- `CHARACTER: 'character'` - Character-specific flags
- `GLOBAL: 'global'` - World-wide flags

### ACTION_TYPE
- `FLAG: 'flag'` - Modify flags
- `ITEM: 'item'` - Give/take items
- `STAT: 'stat'` - Modify character stats
- `STATUS: 'status'` - Add/remove status effects
- `MOVE: 'move'` - Move character to location
- `EVENT: 'event'` - Chain to another event
- `EXP: 'exp'` - Give experience
- `CUSTOM: 'custom'` - Custom action with custom_data

### TRIGGER_CONDITION
- `IMMEDIATE: 'immediate'` - Execute right away
- `CHECK_SUCCESS: 'check_success'` - Execute when a check succeeds
- `CHECK_FAILURE: 'check_failure'` - Execute when a check fails
- `COMBAT_VICTORY: 'combat_victory'` - Execute after winning combat
- `COMBAT_DEFEAT: 'combat_defeat'` - Execute after losing combat
- `OPTION_SELECTED: 'option_selected'` - Execute when specific option chosen

### FLAG_OPERATION
- `SET: 'set'` - Set to specific value
- `ADD: 'add'` - Add to current value
- `SUBTRACT: 'subtract'` - Subtract from current value
- `TOGGLE: 'toggle'` - Toggle between 0 and 1

And many more! See `eventConstants.js` for the complete list.

## Benefits

1. **Type Safety**: Catch typos at development time
2. **IntelliSense**: Better autocomplete in editors
3. **Consistency**: No more wondering if it's 'flag' or 'Flag' or 'FLAG'
4. **Refactoring**: Easy to change values across the entire codebase
5. **Documentation**: Self-documenting code with meaningful names
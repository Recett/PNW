# LocationEvent Table Implementation

## Overview
Successfully added a new `locationEvent` table to replace the `locationInstance` system for the adventuring command. This provides a more flexible, event-based approach to location interactions.

## Database Schema

### LocationEvent Table Structure
```sql
CREATE TABLE location_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id STRING NOT NULL,
    event_name STRING NOT NULL,
    event_type STRING NOT NULL,
    event_weight INTEGER DEFAULT 100,
    
    -- Event configuration (JSON)
    event_config JSON,
    
    -- Requirements
    level_requirement INTEGER DEFAULT 1,
    skill_requirements JSON,
    item_requirements JSON,
    flag_requirements JSON,
    time_restrictions JSON,
    
    -- Rewards and outcomes
    base_rewards JSON,
    bonus_rewards JSON,
    failure_consequences JSON,
    
    -- Event metadata
    description TEXT,
    flavor_text TEXT,
    success_message TEXT,
    failure_message TEXT,
    
    -- Availability
    is_repeatable BOOLEAN DEFAULT true,
    cooldown_time INTEGER DEFAULT 0,
    max_occurrences INTEGER,
    seasonal_availability JSON,
    
    -- Administrative
    is_active BOOLEAN DEFAULT true,
    created_by STRING,
    created_at DATE DEFAULT NOW,
    updated_at DATE DEFAULT NOW
);
```

## Implementation Details

### Files Modified:
1. **`f:\Personal3\src\models\location\locationModel.js`**
   - Added `locationEvent` model definition
   - Added proper indexes for performance
   - Exported the new model

2. **`f:\Personal3\src\dbObject.js`**
   - Added `LocationEvent` import and initialization
   - Set up relationships: `LocationBase.hasMany(LocationEvent)`
   - Added to module exports

3. **`f:\Personal3\src\utility\locationEventUtility.js`** (Created)
   - Complete utility class for managing location events
   - Methods for event selection, requirement checking, and execution
   - Sample event creation functionality

### Database Relationships:
```javascript
// One location can have many events
LocationBase.hasMany(LocationEvent, { foreignKey: 'location_id', as: 'events' });
LocationEvent.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
```

## Event Types Supported

### 1. Combat Events
- Enemy encounters
- Boss fights
- Group combat scenarios
- Integration with existing combat system

### 2. Resource Events
- Gathering materials
- Mining operations
- Harvesting activities
- Skill-based resource acquisition

### 3. Special Events
- Story-driven encounters
- Quest-related interactions
- Unique one-time events
- Integration with existing event system

### 4. Exploration Events
- Discovery of hidden areas
- Treasure finding
- Environmental interactions
- Skill-based exploration

## Usage Examples

### Basic Event Selection:
```javascript
const LocationEventUtility = require('@root/utility/locationEventUtility.js');

// Get available events for a character at a location
const availableEvents = await LocationEventUtility.getAvailableEvents(
    'forest_entrance', 
    character,
    { currentTime: new Date() }
);

// Select random event based on weights
const selectedEvent = LocationEventUtility.selectRandomEvent(availableEvents);

// Execute the selected event
const result = await LocationEventUtility.executeEvent(selectedEvent, character, interaction);
```

### Event Configuration Examples:

#### Combat Event:
```json
{
    "event_name": "Goblin Patrol",
    "event_type": "combat",
    "event_config": {
        "enemy_ids": [1, 2],
        "combat_type": "enemy",
        "difficulty": "normal"
    },
    "level_requirement": 1,
    "base_rewards": {
        "experience": 50,
        "gold": 25
    }
}
```

#### Resource Event:
```json
{
    "event_name": "Herb Gathering",
    "event_type": "resource",
    "event_config": {
        "resource_type": "herbs",
        "skill_required": "herbalism",
        "base_yield": 3
    },
    "skill_requirements": {
        "herbalism": 2
    },
    "base_rewards": {
        "items": [{"name": "healing_herb", "quantity": 3}]
    }
}
```

## Advantages Over LocationInstance System

### 1. **Flexibility**
- Events can be easily added/modified without code changes
- Complex requirements and rewards system
- Support for multiple event types

### 2. **Performance**
- No need for instance generation
- Efficient database queries with proper indexing
- Weight-based random selection

### 3. **Maintainability**
- Centralized event configuration
- Clear separation of concerns
- Easy to extend with new event types

### 4. **Features**
- Cooldown system for repeatable events
- Skill/item/flag requirements
- Time-based availability
- Detailed reward system

## Integration with Existing Systems

### Adventuring Command Integration:
The new `LocationEvent` system can be integrated into the existing adventuring command by:

1. **Replacing instance-based logic** with event-based selection
2. **Using LocationEventUtility** for event management
3. **Maintaining compatibility** with existing combat/event systems
4. **Providing migration path** from current implementation

### Database Migration:
- The new table coexists with existing location tables
- Current functionality remains unchanged
- Gradual migration possible by updating commands individually

## Next Steps

1. **Update adventuring command** to use LocationEvent system
2. **Create event data** for existing locations
3. **Test integration** with combat and event systems
4. **Migrate existing location interactions** to event-based approach
5. **Add administrative commands** for event management

## Configuration Management

The system supports dynamic event configuration through the database, allowing:
- Real-time event modifications
- A/B testing of different event configurations
- Seasonal or time-based event activation
- Player progression-based event unlocking

This implementation provides a solid foundation for replacing the locationInstance system with a more flexible and maintainable event-based approach.
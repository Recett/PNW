# YAML Schema Documentation Improvement

## Overview
Enhanced all YAML file headers with comprehensive field examples showing ALL possible fields for each content type, including previously undocumented features like NPC shops and perks.

## Changes Made

### 1. Comprehensive Field Coverage
Updated `_generateFileHeader` method in `yamlEditor.js` to include complete examples showing:

**NPCs (Previously Missing Fields):**
- Shop system: `stocks` array with `item`, `price`, `amount`, `required_building_id`, `required_building_level`
- Perk teaching: `perks` array with `perk`, `stamina_cost`, building requirements
- Character details: `fullname`, `unknown_name`, `avatar`, `npc_type`, `start_event`, `age`, `gender`, `status`

**Items (Enhanced Documentation):**
- All item types: `value`, `weight`, `tags`, `special` field (JSON objects)
- Weapon-specific: Complete `weapon` object with all stats
- Armor-specific: Complete `armor` object with defense properties
- Other items: `stack_size`, `tradeable`, `quest_item` flags

**Events (Complete Schema):**
- Event flow: `event_type`, `is_active`, `tags`, `metadata`, `next_event_id`
- Advanced features: `silent`, `custom_message`, location/character requirements

**Enemies (Full Combat System):**
- Identity: `fullname`, `unknown_name`, `avatar`
- Combat: Complete `stats` and `attacks` arrays
- Rewards: `reward` object with gold, exp, and item drops

**Skills & Perks (Added New Types):**
- Skills: `category`, `base_stat`, `max_level`, `effects`, `prerequisites`, `parent_skill_id`
- Perks: `category`, `skill_id`, `skill_level_required`, `max_level`, `power`, `cost`, `stamina_cost`

### 2. Schema Format Improvements
- **Inline Comments**: Detailed explanations for every field
- **Required vs Optional**: Clear marking of mandatory fields
- **Data Types**: Specific value types and constraints
- **Examples**: Real-world usage patterns
- **Relationships**: Cross-references between content types

### 3. Files Updated
Applied to all YAML files in the content system:
- ✅ `weapons.yaml` - Complete weapon schema
- ✅ `armor.yaml` - Complete armor schema  
- ✅ `other_items.yaml` - Consumables, materials, quest items
- ✅ `all_npcs.yaml` - NPCs with shop/perk systems
- ✅ `all_events.yaml` - Complete event system
- ✅ `all_enemies.yaml` - Combat system
- ✅ `all_skills.yaml` - Skill definitions
- ✅ `all_perks.yaml` - Perk system
- ✅ Additional content files: objects, quests, resource_nodes, projects, house_upgrades

## Technical Implementation

### Database Schema Integration
The field documentation now reflects:
- **Database Models**: Based on Sequelize model definitions in `src/models/`
- **Event System**: Integration with `eventUtility.js` action types
- **Shop System**: `npc_stocks` table structure for merchant functionality
- **Perk System**: `npc_perks` and character progression integration
- **Building Requirements**: Town development system integration

### Usage Examples
Each content type now includes realistic examples showing:
- **Minimum viable entries** (required fields only)
- **Feature-complete entries** (all optional fields demonstrated)
- **Cross-system integration** (items ↔ shops, skills ↔ perks, events ↔ requirements)

## Benefits

### For Content Creators
- **Complete visibility** into all available fields
- **No more guesswork** about optional features
- **Copy-paste examples** for complex configurations
- **Understanding of field relationships** and dependencies

### For System Integration
- **Shop system** now fully documented with building requirements
- **Perk teaching system** with stamina costs and prerequisites
- **Event system** with advanced features like silent events and custom messages
- **Combat system** with complete stat definitions and attack arrays

## Future Maintenance

### Schema Synchronization
- Headers automatically update with current date
- New fields from database models should be added to `_generateFileHeader`
- Validation schemas in `yamlEditor.js` should match documented fields

### Documentation Updates
- When adding new database models, update corresponding header template
- Test header accuracy with `format-all` command
- Use semantic search to identify new system features for documentation

## Command Reference

```bash
# Apply updated headers to all files
node yaml-editor.js format-all

# Validate updated schema coverage
node yaml-editor.js stats

# Test specific content type
node yaml-editor.js format npcs
```

## Schema Completeness Summary

| Content Type | Fields Documented | Advanced Features |
|-------------|------------------|------------------|
| NPCs | 11 core + shop/perk systems | Building requirements, stamina costs |
| Weapons | 10 core + weapon stats | Special abilities, scaling mechanics |
| Armor | 10 core + defense stats | Percentage defense, crit resistance |
| Items | 8 core + item properties | Stack limits, tradeable flags |
| Events | 12 core + advanced flow | Silent events, requirements |
| Enemies | 15 core + combat system | Attack arrays, reward drops |
| Skills | 9 core + progression | Prerequisites, effects |
| Perks | 11 core + requirements | Multi-level, costs |

**Result**: Users now have complete visibility into all system capabilities through comprehensive, accurate schema documentation in every YAML file header.
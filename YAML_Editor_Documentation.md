# YAML Editor Documentation

## Overview

The YAML Editor is a comprehensive content management system for Discord RPG Bot YAML files. It provides human-readable formatting, validation, template generation, and CLI-based content management tools.

## Features

- **🎨 Human-Readable Formatting**: Automatically formats YAML files with headers, comments, and readable array structures
- **✅ Schema Validation**: Validates content against expected structures with detailed error reporting
- **📝 Template Generation**: Creates new content entries with proper structure and helpful comments
- **🔧 CLI Management**: Command-line interface for batch operations and content management
- **⚡ Performance**: Optimized loading with caching and lazy loading capabilities
- **🔄 Safe Operations**: Preview mode and automatic backups for all modifications

## Architecture

### Core Components

1. **YamlEditor Class** (`src/utility/yamlEditor.js`)
   - Core formatting and editing functionality
   - Schema validation and template generation
   - Comment insertion and structure optimization

2. **ContentStore Integration** (`src/contentStore.js`)
   - Enhanced loading system with editor integration
   - File caching and lazy loading
   - Async operations for improved performance

3. **CLI Tool** (`yaml-editor.js`)
   - Command-line interface for all operations
   - Batch processing and preview modes
   - Comprehensive help and documentation

## Installation & Setup

The YAML Editor is ready to use out of the box. All dependencies are already included:

```bash
# Verify installation
node yaml-editor.js help
```

## CLI Commands

### Basic Usage

```bash
node yaml-editor.js <command> [options]
```

### Available Commands

#### `stats` - Content Statistics
Display loading statistics and system information:

```bash
node yaml-editor.js stats
```

**Output:**
- Memory usage metrics
- File cache status  
- Loaded collections count
- Content directory path

#### `format` - Format YAML Files
Make YAML files human-readable with proper formatting:

```bash
# Format single file
node yaml-editor.js format src/content/items/weapons.yaml

# Preview formatting without saving
node yaml-editor.js format src/content/items/weapons.yaml --preview

# Format with comments
node yaml-editor.js format src/content/events/ --comments

# Format all content types
node yaml-editor.js format-all
```

**Features:**
- Adds descriptive headers and sections
- Converts arrays to readable list format
- Adds helpful inline comments
- Sorts entries for consistency
- Creates automatic backups

#### `create` - Generate New Content
Create new content entries with proper templates:

```bash
# Create new weapon
node yaml-editor.js create weapon "Iron Sword"

# Create new event
node yaml-editor.js create event "Village_Meeting"

# Create new NPC
node yaml-editor.js create npc "Shop_Keeper"
```

**Supported Types:**
- `weapon` - Weapon items with combat stats
- `armor` - Armor items with defense stats  
- `item` - General items
- `event` - Game events with options
- `npc` - Non-player characters
- `enemy` - Combat enemies
- `skill` - Character skills

#### `edit` - Interactive Editing
Modify existing content with guided prompts:

```bash
# Edit specific entry
node yaml-editor.js edit weapon sword_iron

# Edit by file
node yaml-editor.js edit src/content/items/weapons.yaml
```

#### `validate` - Content Validation
Check content structure and data integrity:

```bash
# Validate single file
node yaml-editor.js validate src/content/items/weapons.yaml

# Validate directory
node yaml-editor.js validate src/content/events/

# Validate all content
node yaml-editor.js validate-all
```

**Validation Checks:**
- Required field presence
- Data type validation
- ID uniqueness
- Reference integrity
- Schema compliance

#### `docs` - Generate Documentation
Create documentation from content structure:

```bash
# Generate full documentation
node yaml-editor.js docs

# Generate for specific type
node yaml-editor.js docs weapons

# Output to file
node yaml-editor.js docs > content-docs.md
```

#### `help` - Command Help
Display detailed help information:

```bash
# General help
node yaml-editor.js help

# Command-specific help
node yaml-editor.js help format
```

## Formatting Features

### Before Formatting
```yaml
items:
- id: sword_iron
name: Iron Sword
type: weapon
value: 100
tags: ["melee", "sword", "common"]
attack: 15
speed: 10
```

### After Formatting
```yaml
# ===================================================================
# WEAPONS - Combat Equipment
# ===================================================================
# Weapons provide attack capability and determine combat effectiveness.
# Each weapon has base stats that modify character combat performance.

items:
  # Iron Sword - Basic melee weapon for new adventurers
  - id: sword_iron                    # Unique identifier
    name: Iron Sword                  # Display name
    type: weapon                      # Item category
    value: 100                        # Gold value for trading
    tags:                             # Classification tags
      - melee                         # Combat type
      - sword                         # Weapon category  
      - common                        # Rarity level
    attack: 15                        # Base damage value
    speed: 10                         # Attack speed modifier
```

## Content Types & Templates

### Weapons Template
```yaml
- id: weapon_id_here                  # Unique weapon identifier
  name: "Weapon Name"                 # Display name
  description: "Weapon description"   # Detailed description
  type: weapon                        # Must be "weapon"
  subtype: sword                      # Weapon category (sword, axe, bow, etc.)
  value: 100                          # Gold value
  tags:                               # Classification tags
    - melee                           # Combat type
    - common                          # Rarity
  attack: 10                          # Base attack damage
  speed: 5                            # Attack speed (higher = faster)
  crit_rate: 50                       # Critical hit rate (per 1000)
  crit_damage: 2.0                    # Critical damage multiplier
```

### Events Template
```yaml
- id: event_id_here                   # Unique event identifier
  name: "Event Name"                  # Display name
  description: "Event description"    # Detailed description
  event_type: standard                # Event category
  is_active: true                     # Enable/disable event
  tags:                               # Classification tags
    - story                           # Event type
    - main_quest                      # Quest category
  metadata:                           # Additional data
    location: village                 # Where event occurs
    requirements:                     # Prerequisites
      level: 1                        # Minimum level
  next_event_id: null                 # Chained event (optional)
```

## Integration with ContentStore

### Loading Content
```javascript
const contentStore = require('./src/contentStore.js');

// Load all content (cached and optimized)
await contentStore.initialize();

// Access formatted content
const weapons = contentStore.items.findAll();
const events = contentStore.events.findAll();
```

### Using Editor Features
```javascript
// Get editor instance
const editor = contentStore.getEditor();

// Format files programmatically
await contentStore.formatFiles(['weapons'], { comments: true });

// Create new entries
await contentStore.createEntry('weapon', 'new_sword', weaponData);

// Edit existing content
await contentStore.editContent('events', 'village_meeting', updates);
```

## Performance Metrics

### Before Optimization
- **Memory Usage**: 34MB RSS
- **Loading Time**: Synchronous blocking
- **File Operations**: No caching

### After Optimization  
- **Memory Usage**: 10MB RSS (70% reduction)
- **Loading Time**: 19ms async loading
- **File Cache**: 15 files cached
- **Content Loaded**: 21 items, 119 events, 4 enemies, 2 NPCs, 12 skills

## Error Handling

### Common Issues

1. **File Not Found**
   ```bash
   ❌ Error: ENOENT: no such file or directory
   ```
   **Solution**: Check file path and ensure file exists

2. **Invalid YAML Syntax**
   ```bash
   ❌ YAML parsing error: unexpected token
   ```
   **Solution**: Use `validate` command to identify syntax issues

3. **Schema Validation Errors**
   ```bash
   ❌ Validation error: Missing required field 'id'
   ```
   **Solution**: Add missing fields as indicated

### Debug Mode
Enable verbose logging for troubleshooting:

```bash
DEBUG=yaml-editor node yaml-editor.js stats
```

## Best Practices

### Content Management
1. **Always preview changes** with `--preview` flag
2. **Validate before formatting** to catch syntax errors
3. **Use templates** for new content to ensure consistency
4. **Format regularly** to maintain readability
5. **Check stats** periodically to monitor system health

### File Organization
- Keep related content in appropriate directories
- Use consistent naming conventions
- Maintain backup copies of critical files
- Document custom modifications in comments

### Performance Tips
- Use lazy loading for large content sets
- Enable file caching for frequently accessed files
- Format in batches rather than individual files
- Monitor memory usage with stats command

## Troubleshooting

### Editor Not Working
1. Check Node.js version (requires 14+)
2. Verify file permissions
3. Ensure content directory exists
4. Run stats command to check system status

### Formatting Issues
1. Validate YAML syntax first
2. Check for special characters in content
3. Use preview mode to test changes
4. Review backup files if needed

### Performance Problems
1. Clear file cache: restart application
2. Check memory usage with stats
3. Use lazy loading for large datasets
4. Consider splitting large files

## Advanced Usage

### Custom Validators
Add custom validation rules in `yamlEditor.js`:

```javascript
_validateCustomRule(data, contentType) {
    // Custom validation logic
    return { isValid: true, errors: [] };
}
```

### Batch Operations
Process multiple files efficiently:

```bash
# Format all weapon and armor files
node yaml-editor.js format src/content/items/ --type weapon,armor

# Validate all event files
find src/content/events -name "*.yaml" -exec node yaml-editor.js validate {} \;
```

### Integration Scripts
Create automation scripts using the editor:

```javascript
const { YamlEditor } = require('./src/utility/yamlEditor.js');

const editor = new YamlEditor('./src/content');

// Batch format all files
await editor.formatAllFiles({ comments: true, backup: true });

// Generate documentation
const docs = editor.generateDocumentation();
console.log(docs);
```

## API Reference

### YamlEditor Class

#### Constructor
```javascript
new YamlEditor(contentDir, options)
```

#### Methods
- `formatFile(filePath, options)` - Format single file
- `formatAllFiles(options)` - Format all content files
- `createEntry(type, id, data)` - Create new content entry
- `validateContent(filePath)` - Validate file structure
- `generateTemplate(type)` - Get template for content type
- `addComments(content, type)` - Add helpful comments

### ContentStore Integration

#### New Methods
- `getEditor()` - Get YamlEditor instance
- `formatFiles(types, options)` - Format specific content types
- `createEntry(type, id, data)` - Create new content
- `editContent(type, id, updates)` - Edit existing content
- `generateDocs()` - Generate documentation

## Version History

### v1.0.0 - Initial Release
- Basic YAML loading and parsing
- Simple content access methods

### v2.0.0 - Performance Upgrade  
- Async loading implementation
- File caching system
- Lazy loading for unused content
- Memory optimization (70% reduction)

### v3.0.0 - Human-Readable Editor
- YamlEditor utility class
- Automatic formatting with comments
- CLI management tool
- Template generation
- Schema validation
- Preview and backup features

## Support

### Getting Help
1. Use `node yaml-editor.js help` for command reference
2. Check error messages for specific guidance  
3. Review this documentation for detailed explanations
4. Use preview mode to test changes safely

### Contributing
- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation for changes
- Use descriptive commit messages

---

*Last updated: March 23, 2026*
*Version: 3.0.0*
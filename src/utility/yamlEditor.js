const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Enhanced YAML formatter for human-readable content files
 * Provides formatting, validation, and editing utilities for Discord RPG Bot content
 */
class YamlEditor {
	constructor(contentDir = path.join(__dirname, '..', 'content')) {
		this.contentDir = contentDir;
		this.schemas = this._initializeSchemas();
	}

	/**
	 * Format YAML content with human-readable structure and helpful comments
	 * @param {string} filePath - Path to YAML file
	 * @param {Object} options - Formatting options
	 */
	formatFile(filePath, options = {}) {
		const {
			addComments = true,
			sortByProperty = null,
			validateSchema = true,
			backup = true,
			indent = 2,
			lineWidth = 120
		} = options;

		try {
			// Create backup if requested
			if (backup) {
				this._createBackup(filePath);
			}

			// Read and parse existing content
			const rawContent = fs.readFileSync(filePath, 'utf8');
			const data = yaml.load(rawContent);
			
			if (!data) {
				console.log(`⚠️  File ${filePath} is empty or invalid`);
				return;
			}

			// Determine content type from file path
			const contentType = this._getContentType(filePath);
			
			// Sort content if requested
			if (sortByProperty && data[contentType]) {
				data[contentType] = this._sortContent(data[contentType], sortByProperty);
			}

			// Validate schema
			if (validateSchema) {
				const errors = this._validateContent(data, contentType);
				if (errors.length > 0) {
					console.warn(`⚠️  Schema validation warnings for ${filePath}:`);
					errors.forEach(err => console.warn(`   - ${err}`));
				}
			}

			// Generate formatted YAML with comments
			const formattedYaml = this._generateFormattedYaml(data, contentType, {
				addComments,
				indent,
				lineWidth
			});

			// Write formatted content back to file
			fs.writeFileSync(filePath, formattedYaml, 'utf8');
			console.log(`✅ Formatted ${filePath}`);

		} catch (error) {
			console.error(`❌ Error formatting ${filePath}:`, error.message);
		}
	}

	/**
	 * Format all YAML files in the content directory
	 */
	formatAll(options = {}) {
		console.log('🎨 Formatting all YAML files...');
		
		const contentDirs = [
			'enemies', 'events', 'items', 'npcs', 'objects', 
			'perks', 'quests', 'skills', 'specials', 
			'resource_nodes', 'projects', 'house_upgrades'
		];

		let totalFiles = 0;
		let formattedFiles = 0;

		for (const dir of contentDirs) {
			const dirPath = path.join(this.contentDir, dir);
			if (!fs.existsSync(dirPath)) continue;

			const files = fs.readdirSync(dirPath)
				.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
			
			for (const file of files) {
				totalFiles++;
				const filePath = path.join(dirPath, file);
				try {
					this.formatFile(filePath, options);
					formattedFiles++;
				} catch (error) {
					console.error(`❌ Failed to format ${filePath}:`, error.message);
				}
			}
		}

		console.log(`\\n🎉 Formatting complete: ${formattedFiles}/${totalFiles} files processed`);
	}

	/**
	 * Create a new content entry with proper formatting and comments
	 */
	createEntry(contentType, data, filePath = null) {
		if (!filePath) {
			filePath = this._getDefaultFilePath(contentType);
		}

		try {
			// Load existing file or create new structure
			let existingData = {};
			if (fs.existsSync(filePath)) {
				const rawContent = fs.readFileSync(filePath, 'utf8');
				existingData = yaml.load(rawContent) || {};
			}

			// Initialize array if it doesn't exist
			if (!existingData[contentType]) {
				existingData[contentType] = [];
			}

			// Add new entry
			existingData[contentType].push(data);

			// Format and save
			this.formatFile(filePath, { backup: true });
			console.log(`✅ Added new ${contentType} entry to ${filePath}`);

		} catch (error) {
			console.error(`❌ Error creating ${contentType} entry:`, error.message);
		}
	}

	/**
	 * Generate human-readable YAML with helpful comments and structure
	 */
	_generateFormattedYaml(data, contentType, options = {}) {
		const { addComments = true, indent = 2, lineWidth = 120 } = options;
		
		let output = '';
		
		// Add file header comment
		if (addComments) {
			output += this._generateFileHeader(contentType);
		}

		// Configure YAML dump options for readability
		const dumpOptions = {
			indent: indent,
			lineWidth: lineWidth,
			noRefs: true,
			sortKeys: false,
			quotingType: '"',
			forceQuotes: false,
			condenseFlow: false,
			noCompatMode: true,
			skipInvalid: false
		};

		// Generate formatted YAML
		const yamlContent = yaml.dump(data, dumpOptions);
		
		// Post-process for better readability
		const processedYaml = this._postProcessYaml(yamlContent, contentType, addComments);
		
		output += processedYaml;
		
		return output;
	}

	/**
	 * Post-process YAML for enhanced readability
	 */
	_postProcessYaml(yamlContent, contentType, addComments) {
		let processed = yamlContent;

		// Add spacing between top-level entries
		processed = processed.replace(/^  - id:/gm, '\n  - id:');
		
		// Add inline comments for important fields
		if (addComments) {
			processed = this._addInlineComments(processed, contentType);
		}

		// Fix array formatting to be more readable
		processed = processed.replace(/^(    tag:)\s*\[([^\]]+)\]/gm, (match, prefix, items) => {
			const tagItems = items.split(', ').map(item => item.trim().replace(/['"]/g, ''));
			return prefix + '\n' + tagItems.map(tag => `      - ${tag}`).join('\n');
		});

		return processed;
	}

	/**
	 * Add helpful inline comments based on content type
	 */
	_addInlineComments(content, contentType) {
		const commentRules = {
			weapons: {
				'base_damage:': '# Base damage before scaling',
				'scaling:': '# Damage scaling with stats (0.0-1.0)',
				'hit_mod:': '# Hit chance modifier (0.0-1.0)',
				'cooldown:': '# Attack speed (lower = faster)'
			},
			armor: {
				'defense:': '# Physical damage reduction',
				'defense_percent:': '# Percentage damage reduction',
				'crit_resistance:': '# Critical hit resistance'
			},
			events: {
				'event_type:': '# story, dialogue, combat',
				'silent:': '# Skip user interaction if true'
			},
			enemies: {
				'level:': '# Enemy difficulty level',
				'enemy_type:': '# minion, soldier, elite, boss'
			}
		};

		const rules = commentRules[contentType];
		if (!rules) return content;

		let processed = content;
		const commentedFields = new Set(); // Track which fields have been commented

		for (const [field, comment] of Object.entries(rules)) {
			const fieldName = field.replace(':', '');
			const regex = new RegExp(`^(\\s*${fieldName}:.*?)$`, 'gm');
			
			// Only add comment to the first occurrence
			processed = processed.replace(regex, (match, group1) => {
				if (!commentedFields.has(fieldName)) {
					commentedFields.add(fieldName);
					return `${group1} ${comment}`;
				}
				return match; // Return unchanged for subsequent occurrences
			});
		}

		return processed;
	}

	/**
	 * Generate helpful file header with schema information
	 */
	_generateFileHeader(contentType) {
		const headers = {
			weapons: `# ===============================================
# WEAPONS DEFINITION FILE
# ===============================================
# This file defines all weapons in the game including melee weapons, ranged weapons, and shields.
#
# Complete Example (all possible fields):
#   - id: "1"                            # Required: Unique identifier (string)
#     name: "Iron Sword"                 # Required: Display name
#     description: "A sturdy iron blade" # Optional: Flavor text
#     item_type: weapon                  # Required: Must be "weapon"
#     value: 100                         # Optional: Gold value for trading
#     weight: 5                          # Optional: Inventory weight
#     tag:                               # Optional: Classification array
#       - melee
#       - sword
#     weapon:                            # Required: Combat properties
#       slot: mainhand                   # Required: "mainhand"|"offhand"|"twohand"
#       subtype: sword                   # Optional: dagger|sword|rapier|spear|axe|mace|shortbow|longbow|shield
#       base_damage: 15                  # Required: Base damage before scaling
#       scaling: 0.5                     # Required: Stat scaling (0.0-1.0)
#       hit_mod: 0.75                    # Required: Hit chance modifier (0.0-1.0)
#       cooldown: 100                    # Required: Attack speed (lower = faster)
#
# Last modified: ${new Date().toISOString().split('T')[0]}
# ===============================================

`,
			armor: `# ===============================================
# ARMOR DEFINITION FILE
# ===============================================
# This file defines all armor pieces including head, body, and leg protection.
#
# Complete Example (all possible fields):
#   - id: "11"                           # Required: Unique identifier (string)
#     name: "Iron Helmet"                # Required: Display name
#     description: "Protects the head"   # Optional: Flavor text
#     item_type: armor                   # Required: Must be "armor"
#     value: 75                          # Optional: Gold value for trading
#     weight: 3                          # Optional: Inventory weight
#     tag:                               # Optional: Classification array
#       - heavy
#     armor:                             # Required: Defense properties
#       slot: head                       # Required: "head"|"body"|"leg"
#       subtype: medium                  # Optional: "light"|"medium"|"heavy"
#       defense: 10                      # Required: Physical damage reduction
#       defense_percent: 5               # Optional: Percentage damage reduction
#       crit_resistance: 15              # Optional: Critical hit resistance
#
# Last modified: ${new Date().toISOString().split('T')[0]}
# ===============================================

`,
			npcs: `# ===============================================
# NPCS DEFINITION FILE
# ===============================================
# This file defines all non-player characters.
# This file is the source of truth for NPC data. Shop stock (stocks) and
# teachable perks (perks) are defined here as nested arrays and loaded into
# the database at runtime via contentStore.
#
# Complete Example (all possible fields):
#   - id: npc_1234567890                 # Required: Unique identifier
#     name: "Marcus"                     # Required: Short/display name
#     fullname: "Marcus the Merchant"    # Optional: Full display name
#     unknown_name: "Hooded Figure"      # Optional: Name shown before player meets NPC
#     avatar: "https://..."              # Optional: Character portrait URL
#     description: "A grizzled merchant" # Optional: Appearance/flavour text
#     npc_type: merchant                 # Optional: NPC role category
#     start_event: event_meet_marcus     # Optional: Event triggered on first interaction
#     age: 45                            # Optional: Age (used for Vietnamese pronoun system)
#     gender: male                       # Optional: "male"|"female" (default: male)
#     status: active                     # Optional: "active"|"inactive"
#     stocks:                            # Optional: Shop inventory (loaded into npc_stocks table)
#       - item: "1"                      # Item ID
#         purchased: 0                   # Purchase counter
#     perks:                             # Optional: Teachable perks (loaded into npc_perks table)
#       - perk: "101"                    # Perk ID
#         stamina_cost: 5                # Stamina cost for the player to learn
#         required_building_id: 1        # Optional: Required building ID
#         required_building_level: 1     # Optional: Minimum building level
#
# Last modified: ${new Date().toISOString().split('T')[0]}
# ===============================================

`,
			events: `# ===============================================
# EVENTS DEFINITION FILE
# ===============================================
# This file defines all game events including story, dialogue, and action sequences.
#
# Pronoun placeholders: \${1p} \${2p} \${npc_1p} \${npc_2p} \${player_name} \${player_fullname} \${npc_name}
# Variable placeholders: \${variable_name} (set via "variable" action)
#
# Complete Example (all possible fields):
#   - id: event_example                  # Required: Unique identifier (underscores OK)
#     name: "Example Event"              # Required: Display name
#     description: "Event description"   # Optional: Internal notes
#     event_type: story                  # Required: "story"|"dialogue"
#     next: event_next_id                # Optional: Auto-advance to this event after displaying
#     silent: true                       # Optional: Skip display, run actions only (default: false)
#     tag:                               # Optional: Classification array
#       - quest_tag
#     message:                           # Optional: Display a message to the player
#       text: "Hello \${2p}!"            # Required if message present: Supports pronoun placeholders
#       npc_speaker: npc_1234567890      # Optional: NPC portrait/name shown
#       message_type: normal             # Optional: "normal" (default)
#     option:                            # Optional: Player choices (omit for auto-advance)
#       - id: event_example-option-1     # Required: Unique option ID
#         text: "Choice text"            # Required: Full option text shown in embed (keep under 95 chars)
#         button_label: "Short label"    # Optional: Short button label (max ~40 chars). Overrides truncated text on button.
#         next: event_result_a           # Optional: Event to go to when chosen
#         display_order: 1               # Required: Sort order for display
#     combat:                            # Optional: Trigger a combat encounter
#       combat_type: a                   # Required: Combat mode identifier
#       enemy: "1001"                    # Required: Enemy ID
#       on_victory: event_win            # Optional: Event after winning
#       on_defeat: event_lose            # Optional: Event after losing
#     action:                            # Optional: Side effects to apply
#       - type: flag                     # Set a character or global flag
#         flag_name: FlagName            # Required: Flag identifier
#         flag_value: "1"                # Required: Value to set/add
#         flag_operation: add            # Required: "set"|"add"|"remove"
#         flag_type: Local               # Required: "Local" (character) | "Global"
#       - type: stat                     # Modify a character stat
#         stat_name: gold                # Required: Stat field name
#         value: 100                     # Required: Value (supports \${variable_name})
#         operation: add                 # Required: "set"|"add"|"remove"
#         silent: false                  # Optional: Suppress confirmation message
#         custom_message: "You earned gold!" # Optional: Override confirmation message
#       - type: variable                 # Prompt player for input, store as session variable
#         variable_name: my_var          # Required: Variable name for use in later actions
#         source_type: input             # Required: "input" (text prompt)
#         silent: false                  # Optional: Suppress confirmation
#         input_label: "Enter value:"    # Optional: Prompt text shown to player
#
# Last modified: ${new Date().toISOString().split('T')[0]}
# ===============================================

`,
			enemies: `# ===============================================
# ENEMIES DEFINITION FILE
# ===============================================
# This file defines all enemy creatures including their combat stats.
#
# Complete Example (all possible fields):
#   - id: "1001"                         # Required: Unique identifier (string)
#     name: "Goblin Scout"               # Required: Display name
#     unknown_name: Small Creature       # Optional: Name shown before identification
#     level: 1                           # Required: Enemy difficulty level
#     enemy_type: minion                 # Optional: "minion"|"soldier"|"elite"|"boss"
#     tag:                               # Optional: Classification array
#       - goblin
#       - easy
#     reward:                            # Optional: Victory rewards
#       gold: 10                         # Optional: Gold amount
#       exp: 5                           # Optional: Experience points
#     stats:                             # Required: Combat statistics
#       health: 30                       # Required: Max HP
#       defense: 2                       # Required: Physical damage reduction (flat)
#       defense_percent: 0               # Optional: Percentage damage reduction
#       crit_resistance: 0               # Optional: Critical hit resistance
#       evade: 10                        # Required: Dodge chance
#       speed: 15                        # Required: Combat speed/initiative
#
# Last modified: ${new Date().toISOString().split('T')[0]}
# ===============================================

`,
			other_items: `# ===============================================
# OTHER ITEMS DEFINITION FILE
# ===============================================
# This file defines consumables, materials, quest items, and miscellaneous items.
#
# Complete Example (all possible fields):
#   - id: "101"                          # Required: Unique identifier (string)
#     name: "Health Potion"              # Required: Display name
#     description: "Restores 50 HP"     # Optional: Item description
#     item_type: consumable              # Required: "consumable"|"material"|"quest_item"|"misc"
#     value: 25                          # Optional: Gold value for trading
#     weight: 1                          # Optional: Inventory weight
#     tag:                               # Optional: Classification array
#       - healing
#
# Last modified: ${new Date().toISOString().split('T')[0]}
# ===============================================

`,
			skills: `# ===============================================
# SKILLS DEFINITION FILE
# ===============================================
# This file defines all learnable skills (mostly weapon/armor mastery types).
# Skills are tied to equipment subtypes and grant bonus_value at each level.
#
# Complete Example (all possible fields):
#   - id: "1"                            # Required: Unique identifier (string)
#     name: "Sword Mastery"              # Required: Display name
#     description: "Mastery of sword combat" # Optional: Description
#     bonus_value: 0                     # Required: Bonus value granted per level
#
# Last modified: ${new Date().toISOString().split('T')[0]}
# ===============================================

`,
			perks: `# ===============================================
# PERKS DEFINITION FILE
# ===============================================
# This file defines all character perks unlocked through skill progression.
#
# Complete Example (all possible fields):
#   - id: "1"                            # Required: Unique identifier (string)
#     name: "Power Strike"               # Required: Display name
#     description: "Deal increased damage" # Optional: Perk description
#     skill_id: "9"                      # Required: Associated skill ID (from skills file)
#     skill_level_required: 3            # Required: Minimum skill level to unlock
#     max_level: 5                       # Optional: Maximum perk level (default: 1)
#     power: 3                           # Optional: Perk strength/tier rating
#     cost: 2                            # Optional: Perk point cost to acquire
#     stamina_cost: 5                    # Optional: Stamina cost per activation
#     effects:                           # Optional: Effect definitions (JSON)
#       damage_multiplier: 1.5
#
# Last modified: ${new Date().toISOString().split('T')[0]}
# ===============================================

`
		};

		return headers[contentType] || `# ${contentType.toUpperCase()} DEFINITION FILE\n# Last modified: ${new Date().toISOString().split('T')[0]}\n\n`;
	}
	/**
	 * Sort content by specified property
	 */
	_sortContent(content, property) {
		if (!Array.isArray(content)) return content;
		
		return content.sort((a, b) => {
			const aVal = this._getNestedValue(a, property);
			const bVal = this._getNestedValue(b, property);
			
			// Handle numeric IDs
			if (typeof aVal === 'string' && typeof bVal === 'string' && 
				!isNaN(aVal) && !isNaN(bVal)) {
				return parseInt(aVal) - parseInt(bVal);
			}
			
			// String comparison
			return String(aVal).localeCompare(String(bVal));
		});
	}

	/**
	 * Get nested property value
	 */
	_getNestedValue(obj, path) {
		const parts = path.split('.');
		let current = obj;
		for (const part of parts) {
			if (current == null) return undefined;
			current = current[part];
		}
		return current;
	}

	/**
	 * Basic schema validation
	 */
	_validateContent(data, contentType) {
		const errors = [];
		const schema = this.schemas[contentType];
		
		if (!schema) return errors;
		
		const items = data[contentType];
		if (!Array.isArray(items)) {
			errors.push(`${contentType} should be an array`);
			return errors;
		}

		items.forEach((item, index) => {
			// Check required fields
			schema.required?.forEach(field => {
				if (!this._hasValue(item, field)) {
					errors.push(`Item ${index + 1}: Missing required field '${field}'`);
				}
			});

			// Check ID uniqueness
			if (item.id) {
				const duplicates = items.filter(other => other.id === item.id);
				if (duplicates.length > 1) {
					errors.push(`Duplicate ID '${item.id}' found`);
				}
			}
		});

		return errors;
	}

	/**
	 * Check if object has a value at the given path
	 */
	_hasValue(obj, path) {
		const value = this._getNestedValue(obj, path);
		return value !== undefined && value !== null && value !== '';
	}

	/**
	 * Get content type from file path
	 */
	_getContentType(filePath) {
		const fileName = path.basename(filePath, path.extname(filePath));
		
		// Handle split item files
		if (fileName === 'weapons') return 'weapons';
		if (fileName === 'armor') return 'armor';
		if (fileName === 'other_items') return 'other_items';
		
		// Handle standard files (remove 'all_' prefix)
		return fileName.replace('all_', '');
	}

	/**
	 * Get default file path for content type
	 */
	_getDefaultFilePath(contentType) {
		const fileMap = {
			weapons: 'items/weapons.yaml',
			armor: 'items/armor.yaml',
			other_items: 'items/other_items.yaml',
			enemies: 'enemies/all_enemies.yaml',
			events: 'events/all_events.yaml',
			npcs: 'npcs/all_npcs.yaml',
			objects: 'objects/all_objects.yaml',
			specials: 'specials/all_specials.yaml',
			skills: 'skills/all_skills.yaml',
			perks: 'perks/all_perks.yaml',
			quests: 'quests/all_quests.yaml',
			resource_nodes: 'resource_nodes/all_resource_nodes.yaml',
			projects: 'projects/all_projects.yaml',
			house_upgrades: 'house_upgrades/all_house_upgrades.yaml'
		};

		const relativePath = fileMap[contentType];
		return relativePath ? path.join(this.contentDir, relativePath) : null;
	}

	/**
	 * Create backup of file before modification
	 */
	_createBackup(filePath) {
		try {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupPath = filePath.replace(/\\.(yaml|yml)$/, `_backup_${timestamp}.$1`);
			fs.copyFileSync(filePath, backupPath);
		} catch (error) {
			console.warn(`⚠️  Could not create backup for ${filePath}`);
		}
	}

	/**
	 * Initialize basic schemas for validation
	 */
	_initializeSchemas() {
		return {
			weapons: {
				required: ['id', 'name', 'item_type', 'weapon']
			},
			armor: {
				required: ['id', 'name', 'item_type', 'armor']
			},
			events: {
				required: ['id', 'name', 'event_type']
			},
			enemies: {
				required: ['id', 'name', 'level', 'stats']
			},
			npcs: {
				required: ['id', 'name', 'npc_type', 'status']
			},
			skills: {
				required: ['id', 'name', 'description']
			}
		};
	}

	/**
	 * Interactive editor for content entries
	 */
	editContent(contentType, id) {
		const filePath = this._getDefaultFilePath(contentType);
		if (!filePath || !fs.existsSync(filePath)) {
			console.error(`❌ File not found for ${contentType}`);
			return;
		}

		try {
			const rawContent = fs.readFileSync(filePath, 'utf8');
			const data = yaml.load(rawContent);
			const items = data[contentType] || [];
			const item = items.find(i => i.id === id);

			if (!item) {
				console.error(`❌ Item with ID '${id}' not found in ${contentType}`);
				return;
			}

			console.log(`\\n📝 Editing ${contentType} item: ${item.name || id}`);
			console.log('Current data:');
			console.log(yaml.dump(item, { indent: 2, quotingType: '"' }));
			console.log('\\n💡 To edit this item:');
			console.log(`   1. Open: ${filePath}`);
			console.log(`   2. Find ID: ${id}`);
			console.log(`   3. Use formatFile() after editing to ensure proper formatting`);

		} catch (error) {
			console.error(`❌ Error loading ${contentType}:`, error.message);
		}
	}
}

module.exports = YamlEditor;
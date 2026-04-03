#!/usr/bin/env node

/**
 * YAML Content Editor CLI Tool
 * Discord RPG Bot - Human-Readable YAML Management
 */

const path = require('path');
const contentStore = require('./contentStore');

// CLI argument parsing
const args = process.argv.slice(2);
const command = args[0];

/**
 * Display help information
 */
function showHelp() {
	console.log(`
🎨 Discord RPG Bot - YAML Content Editor

📝 USAGE:
   node yaml-editor.js <command> [options]

🔧 COMMANDS:
   format [file]              - Format YAML file(s) for human readability
   format-all                 - Format all YAML files in content directory
   edit <type> <id>          - Get editing help for specific content entry
   create <type>             - Show template for creating new content
   validate                  - Validate all content cross-references
   docs                      - Show content structure documentation
   stats                     - Show content loading statistics

🏷️  FORMATTING OPTIONS:
   --no-quotes               - Disable automatic quoting enforcement

📋 QUOTING CONVENTIONS:
   By default, the formatter enforces these quoting rules:
   • Numeric IDs: Always quoted (id: "123")
   • Flag values: Always quoted (flag_value: "true") 
   • Simple text: Never quoted (name: Simple Text)
   • Special chars: Auto-quoted as needed

📁 CONTENT TYPES:
   weapons, armor, other_items, enemies, events, npcs, skills, perks, 
   quests, objects, specials, resource_nodes, projects, house_upgrades

💡 EXAMPLES:
   node yaml-editor.js format-all
   node yaml-editor.js format-all --no-quotes
   node yaml-editor.js format src/content/items/weapons.yaml
   node yaml-editor.js edit weapons 1
   node yaml-editor.js create enemies
   node yaml-editor.js validate
   node yaml-editor.js stats

📖 For complete schema documentation, see YAML_Schema_Reference.md
`);
}

/**
 * Format specific file or all files
 */
function formatFiles(targetFile = 'all') {
	try {
		// Check for --no-quotes flag
		const noQuotes = args.includes('--no-quotes');
		const options = noQuotes ? { enforceQuoting: false } : {};
		
		if (targetFile === 'all') {
			console.log('🎨 Formatting all YAML files...');
			if (noQuotes) console.log('   ⚠️  Quoting enforcement disabled');
			contentStore.formatFiles('all', options);
		} else {
			console.log(`🎨 Formatting ${targetFile}...`);
			if (noQuotes) console.log('   ⚠️  Quoting enforcement disabled');
			contentStore.formatFiles(targetFile, options);
		}
	} catch (error) {
		console.error('❌ Formatting failed:', error.message);
		process.exit(1);
	}
}

/**
 * Show editing help for specific content
 */
function editContent(contentType, id) {
	if (!contentType || !id) {
		console.error('❌ Usage: edit <type> <id>');
		console.log('   Example: edit weapons 1');
		process.exit(1);
	}

	try {
		contentStore.editContent(contentType, id);
	} catch (error) {
		console.error('❌ Edit failed:', error.message);
		process.exit(1);
	}
}

/**
 * Show template for creating new content
 */
function showCreateTemplate(contentType) {
	if (!contentType) {
		console.error('❌ Usage: create <type>');
		console.log('   Example: create weapons');
		process.exit(1);
	}

	const templates = {
		weapons: {
			id: "new_id",
			name: "New Weapon",
			description: "Weapon description here",
			item_type: "weapon",
			value: 100,
			weight: 5,
			tags: ["custom_weapon"],
			weapon: {
				slot: "mainhand", // mainhand, offhand, twohand
				subtype: "sword", // sword, bow, dagger, etc.
				base_damage: 10,
				scaling: 0.3,
				hit_mod: 0.75,
				cooldown: 100
			}
		},
		armor: {
			id: "new_id",
			name: "New Armor",
			description: "Armor description here",
			item_type: "armor",
			value: 100,
			weight: 5,
			tags: ["custom_armor"],
			armor: {
				slot: "body", // head, body, leg
				subtype: "medium", // light, medium, heavy
				defense: 5,
				defense_percent: 0,
				crit_resistance: 0
			}
		},
		enemies: {
			id: "new_id",
			name: "New Enemy",
			unknown_name: "???",
			level: 1,
			enemy_type: "minion", // minion, soldier, elite, boss
			tags: ["custom"],
			reward: {
				gold: 50,
				exp: 25
			},
			stats: {
				health: 100,
				defense: 5,
				defense_percent: 0,
				crit_resistance: 0,
				evade: 10,
				speed: 20
			}
		},
		events: {
			id: "new_event_id",
			name: "New Event",
			description: "Event description",
			event_type: "story", // story, dialogue, combat
			tags: ["custom"],
			message: {
				text: "Event message text here. Use ${player_name} for variables.",
				npc_speaker: "npc_id", // optional
				message_type: "normal" // normal, whisper, shout
			},
			options: [
				{
					id: "new_event_id-option-1",
					text: "Option 1 text",
					next: "next_event_id", // optional
					display_order: 1
				}
			]
		},
		npcs: {
			id: "npc_new_id",
			name: "New NPC",
			fullname: "Full NPC Name",
			npc_type: "villager", // villager, merchant, guard
			status: "active", // active, inactive, dead
			start_event: "event_id" // optional
		}
	};

	const template = templates[contentType];
	if (!template) {
		console.error(`❌ No template available for content type: ${contentType}`);
		console.log('Available types:', Object.keys(templates).join(', '));
		process.exit(1);
	}

	console.log(`\\n📝 Template for ${contentType}:`);
	console.log('Copy this structure to your YAML file:\\n');
	
	const yaml = require('js-yaml');
	console.log(yaml.dump(template, { indent: 2, quotingType: '"', lineWidth: 100 }));
	
	console.log(`💡 After creating your entry:`);
	console.log(`   1. Add it to the appropriate .yaml file`);
	console.log(`   2. Run: node yaml-editor.js format-all`);
	console.log(`   3. Validate: node yaml-editor.js validate`);
}

/**
 * Validate content and show cross-reference errors
 */
function validateContent() {
	console.log('🔍 Validating content cross-references...');
	
	try {
		const errors = contentStore.validate();
		
		if (errors.length === 0) {
			console.log('✅ All content validation passed!');
		} else {
			console.warn(`⚠️  Found ${errors.length} validation warning(s):`);
			errors.forEach(err => console.warn(`   - ${err}`));
		}
		
		console.log(`\\n📊 Content Summary:`);
		const stats = contentStore.getCacheStats();
		Object.entries(stats.loadedCollections).forEach(([name, size]) => {
			const status = typeof size === 'number' ? '✅' : '💤';
			console.log(`   ${status} ${name}: ${size}`);
		});
		
	} catch (error) {
		console.error('❌ Validation failed:', error.message);
		process.exit(1);
	}
}

/**
 * Show content statistics
 */
function showStats() {
	console.log('📊 Content Loading Statistics\\n');
	
	try {
		const stats = contentStore.getCacheStats();
		
		console.log('💾 Memory Usage:');
		const mem = stats.memoryUsage;
		console.log(`   Heap Used: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
		console.log(`   Heap Total: ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
		console.log(`   RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`);
		
		console.log(`\\n📁 File Cache:`);
		console.log(`   Cached Files: ${stats.cachedFiles}`);
		
		console.log(`\\n📚 Loaded Collections:`);
		Object.entries(stats.loadedCollections).forEach(([name, size]) => {
			const status = typeof size === 'number' ? '✅ loaded' : '💤 lazy';
			const count = typeof size === 'number' ? `${size} entries` : size;
			console.log(`   ${name.padEnd(15)} - ${status.padEnd(10)} - ${count}`);
		});
		
		// Show file locations
		console.log(`\\n📂 Content Directory: ${path.join(__dirname, 'src', 'content')}`);
		console.log(`\\n💡 Use 'format-all' to make files human-readable`);
		console.log(`💡 Use 'docs' to see content structure overview`);
		
	} catch (error) {
		console.error('❌ Stats failed:', error.message);
		process.exit(1);
	}
}

// Main CLI logic
switch (command) {
	case 'format':
		formatFiles(args[1]);
		break;
	
	case 'format-all':
		formatFiles('all');
		break;
	
	case 'edit':
		editContent(args[1], args[2]);
		break;
	
	case 'create':
		showCreateTemplate(args[1]);
		break;
	
	case 'validate':
		validateContent();
		break;
	
	case 'docs':
		contentStore.generateDocs();
		break;
	
	case 'stats':
		showStats();
		break;
	
	case 'help':
	case '--help':
	case '-h':
		showHelp();
		break;
	
	default:
		if (!command) {
			showHelp();
		} else {
			console.error(`❌ Unknown command: ${command}`);
			console.log('Run "node yaml-editor.js help" for usage information');
			process.exit(1);
		}
}
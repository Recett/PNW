const { Sequelize } = require('sequelize');

// Create database connection
const databasePath = process.env.DATABASE_PATH || 'database.sqlite';
const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: databasePath,
});

/**
 * Migration Script: Convert Old Placeholder Format to New Format
 * 
 * Old Format -> New Format:
 * {2sp} -> ${2p}  (second person pronoun)
 * {1sp} -> ${1p}  (first person pronoun)
 * 
 * This script updates all text fields in the database that might contain placeholders.
 */

async function migrateOldPlaceholders() {
	try {
		console.log('\n=== MIGRATING OLD PLACEHOLDER FORMAT TO NEW FORMAT ===\n');
		let totalUpdates = 0;

		// Helper function to convert old format to new format
		function convertPlaceholders(text) {
			if (!text) return text;
			
			let updated = text;
			
			// Convert {2sp} to ${2p}
			updated = updated.replace(/\{2sp\}/g, '${2p}');
			
			// Convert {1sp} to ${1p} (if it exists)
			updated = updated.replace(/\{1sp\}/g, '${1p}');
			
			// You can add more conversions here if needed
			
			return updated;
		}

		// 1. Update event_bases table (description and name fields only)
		console.log('Checking event_bases...');
		const [eventBases] = await sequelize.query(`
			SELECT id, name, description 
			FROM event_bases 
			WHERE name LIKE '%{%sp}%' OR description LIKE '%{%sp}%'
		`);
		
		for (const event of eventBases) {
			const newName = convertPlaceholders(event.name);
			const newDesc = convertPlaceholders(event.description);
			if (newName !== event.name || newDesc !== event.description) {
				await sequelize.query(`
					UPDATE event_bases 
					SET name = ?, description = ?
					WHERE id = ?
				`, { replacements: [newName, newDesc, event.id] });
				console.log(`  ✓ Updated event_base: ${event.id}`);
				totalUpdates++;
			}
		}
		console.log(`  Found ${eventBases.length} events with old format, updated ${eventBases.length}\n`);

		// 2. Update event_messages table
		console.log('Checking event_messages...');
		const [eventMessages] = await sequelize.query(`
			SELECT id, event_id, text 
			FROM event_messages 
			WHERE text LIKE '%{%sp}%'
		`);
		
		for (const msg of eventMessages) {
			const newText = convertPlaceholders(msg.text);
			if (newText !== msg.text) {
				await sequelize.query(`
					UPDATE event_messages 
					SET text = ? 
					WHERE id = ?
				`, { replacements: [newText, msg.id] });
				console.log(`  ✓ Updated event_message: ${msg.id} (event: ${msg.event_id})`);
				totalUpdates++;
			}
		}
		console.log(`  Found ${eventMessages.length} messages with old format, updated ${eventMessages.length}\n`);

		// 3. Update event_options table
		console.log('Checking event_options...');
		const [eventOptions] = await sequelize.query(`
			SELECT id, event_id, text, description
			FROM event_options 
			WHERE text LIKE '%{%sp}%' OR description LIKE '%{%sp}%'
		`);
		
		for (const opt of eventOptions) {
			const newText = convertPlaceholders(opt.text);
			const newDesc = convertPlaceholders(opt.description);
			if (newText !== opt.text || newDesc !== opt.description) {
				await sequelize.query(`
					UPDATE event_options 
					SET text = ?, description = ?
					WHERE id = ?
				`, { replacements: [newText, newDesc, opt.id] });
				console.log(`  ✓ Updated event_option: ${opt.id} (event: ${opt.event_id})`);
				totalUpdates++;
			}
		}
		console.log(`  Found ${eventOptions.length} options with old format, updated ${eventOptions.length}\n`);

		// Summary
		console.log('='.repeat(60));
		console.log(`MIGRATION COMPLETE: ${totalUpdates} total updates`);
		console.log('='.repeat(60));

		await sequelize.close();
	}
	catch (error) {
		console.error('Error during migration:', error);
		await sequelize.close();
		process.exit(1);
	}
}

migrateOldPlaceholders();

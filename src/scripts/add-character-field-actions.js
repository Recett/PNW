/**
 * Script to add stat actions to the input events to set character fields
 * These events have variable actions that collect input, and we need to save those inputs to character fields
 */

const db = require('../dbObject.js');

async function addCharacterFieldActions() {
	try {
		console.log('Adding stat actions to set character fields...');

		// Event mappings: event_id -> { field: character field name, variable: session variable name }
		const eventMappings = [
			{
				eventId: 'event_1771347398385',
				field: 'fullname',
				variable: 'fullname',
				label: 'full name',
			},
			{
				eventId: 'event_1771347398385_copy_1771355805218',
				field: 'name',
				variable: 'name',
				label: 'name',
			},
			{
				eventId: 'event_1771347398385_copy_1771355936234',
				field: 'age',
				variable: 'age',
				label: 'age',
			},
			{
				eventId: 'event_1771347398385_copy_1771355936234_copy_1771355969474',
				field: 'avatar',
				variable: 'image',
				label: 'avatar',
			},
		];

		for (const mapping of eventMappings) {
			const actionId = `${mapping.eventId}-action-stat-set-${mapping.field}`;
			
			// Check if action already exists
			const existing = await db.EventActionStat.findOne({ where: { id: actionId } });
			if (existing) {
				console.log(`✓ Action ${actionId} already exists, skipping...`);
				continue;
			}

			// Create stat action to set the character field
			await db.EventActionStat.create({
				id: actionId,
				event_id: mapping.eventId,
				stat_name: mapping.field,
				value: `\${${mapping.variable}}`, // Use the session variable
				operation: 'set', // SET operation to replace the value
				silent: false,
				custom_message: `Your ${mapping.label} has been recorded.`,
				execution_order: 10, // Execute after variable action (which has order 1)
			});

			console.log(`✓ Created stat action for ${mapping.eventId} to set ${mapping.field} field`);
		}

		console.log('\nDone! All stat actions have been created.');
		process.exit(0);
	}
	catch (error) {
		console.error('Error adding stat actions:', error);
		process.exit(1);
	}
}

addCharacterFieldActions();

/**
 * Fix character input events configuration
 * - Make events non-silent so they can show modals
 * - Add options so events can continue after input collection
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function fixCharacterInputEvents() {
	return new Promise((resolve, reject) => {
		const dbPath = path.join(__dirname, 'src', 'database.sqlite');
		const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
		
		const eventIds = [
			'event_1771347398385',                                      // fullname
			'event_1771347398385_copy_1771355805218',                  // name 
			'event_1771347398385_copy_1771355936234',                  // age
			'event_1771347398385_copy_1771355936234_copy_1771355969474' // image
		];
		
		console.log('=== FIXING CHARACTER INPUT EVENTS ===\n');
		
		db.serialize(() => {
			let completed = 0;
			
			eventIds.forEach((eventId, index) => {
				console.log(`Fixing event: ${eventId}`);
				
				// Step 1: Make event non-silent so it can display modal
				db.run("UPDATE event_bases SET silent = 0 WHERE id = ?", [eventId], function(err) {
					if (err) {
						console.error(`❌ Failed to update ${eventId}:`, err);
						completed++;
						if (completed === eventIds.length) { db.close(); resolve(); }
						return;
					}
					
					console.log(`✓ Set silent = 0 for ${eventId}`);
					
					// Step 2: Check if event has options, if not add one
					db.get("SELECT COUNT(*) as count FROM event_options WHERE event_id = ?", [eventId], (err, result) => {
						if (err) {
							console.error(`❌ Failed to check options for ${eventId}:`, err);
							completed++;
							if (completed === eventIds.length) { db.close(); resolve(); }
							return;
						}
						
						if (result.count === 0) {
							// Add a "Continue" option
							db.run(`INSERT INTO event_options (event_id, option_id, text, next_event_id, display_order) 
									VALUES (?, '1', 'Tiếp tục', NULL, 1)`, 
								[eventId], function(err) {
									if (err) {
										console.error(`❌ Failed to add option to ${eventId}:`, err);
									} else {
										console.log(`✓ Added 'Continue' option to ${eventId}`);
									}
									
									completed++;
									if (completed === eventIds.length) {
										console.log('\n✅ All character input events fixed!');
										console.log('Changes made:');
										console.log('- Set silent = 0 (events can now show modals)');
										console.log('- Added Continue options (events can proceed after input)');
										db.close();
										resolve();
									}
								});
						} else {
							console.log(`✓ ${eventId} already has options`);
							completed++;
							if (completed === eventIds.length) {
								console.log('\n✅ All character input events fixed!');
								db.close();
								resolve();
							}
						}
					});
				});
			});
		});
	});
}

fixCharacterInputEvents().catch(console.error);
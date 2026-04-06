const {
	CharacterBase,
	CharacterFlag,
	CharacterItem,
	GlobalFlag
} = require('@root/dbObject.js');
const contentStore = require('@root/contentStore.js');

const characterUtil = require('@utility/characterUtility.js');
const itemUtility = require('@utility/itemUtility.js');
const locationUtility = require('@utility/locationUtility.js');
const eventUtility = require('@utility/eventUtility.js');
const { Op } = require('sequelize');

/**
 * Special Event Utility Module
 * Handles special event types and unique event mechanics beyond standard event processing
 */

/**
 * Cooking Mini-Game Data
 * Additive definitions with their primary traits and transformation rules
 */
const COOKING_ADDITIVES = {
	'vinegar': {
		name: 'Vinegar',
		primaryTrait: 'Sour',
		transformations: {
			'Gristly': 'Tender',
			'Crust': 'Soggy', 
			'Heavy': 'Fermenting',
			'Grainy': 'Smooth',
			'Elastic': 'Stringy',
			'Pungent': 'Sharp'
		}
	},
	'lard': {
		name: 'Lard',
		primaryTrait: 'Fat',
		transformations: {
			'Dry': 'Crispy',
			'Vapor': 'Rich Sauce',
			'Soggy': 'Glazed',
			'Stringy': 'Velvet',
			'Tender': 'Mellow',
			'Sharp': 'Savory'
		}
	},
	'hardtack': {
		name: 'Hardtack',
		primaryTrait: 'Dry',
		transformations: {
			'Liquid': 'Starch',
			'Sour': 'Grainy',
			'Syrup': 'Paste',
			'Gelatinous': 'Chewy',
			'Ropy': 'Thick',
			'Pungent': 'Bready'
		}
	},
	'old_ale': {
		name: 'Old Ale',
		primaryTrait: 'Liquid',
		transformations: {
			'Sour': 'Vapor',
			'Salty': 'Fizzy',
			'Brittle': 'Malty',
			'Paste': 'Dough',
			'Gristly': 'Elastic',
			'Thick': 'Broth'
		}
	},
	'sea_salt': {
		name: 'Sea-Salt',
		primaryTrait: 'Salty',
		transformations: {
			'Starch': 'Crust',
			'Savory': 'Cured',
			'Dough': 'Hardened',
			'Fermenting': 'Acrid',
			'Mellow': 'Complex',
			'Liquid': 'Brine'
		}
	}
};

/**
 * Apply a spice to a dish in the cooking mini-game
 * @param {string} characterId - The character performing the cooking
 * @param {string} spiceId - The spice being added (vinegar, lard, hardtack, old_ale, sea_salt)
 * @param {Array} currentTraits - Array of current food traits
 * @param {Object} options - Additional cooking options
 * @returns {Promise<Object>} Cooking result with updated traits and effects
 */
async function applyCookingAdditive(characterId, spiceId, currentTraits = [], options = {}) {
	try {
		const spice = COOKING_ADDITIVES[spiceId.toLowerCase()];
		if (!spice) {
			return {
				success: false,
				message: `Unknown spice: ${spiceId}`,
				traits: currentTraits
			};
		}

		const result = {
			success: true,
			message: `Added ${spice.name} to the dish.`,
			spiceUsed: spice.name,
			traits: [...currentTraits],
			transformations: [],
			newTraits: [],
			maxTraitsReached: currentTraits.length >= 6
		};

		// Add the primary trait from the spice (if not already present and under trait limit)
		if (!result.traits.includes(spice.primaryTrait) && result.traits.length < 6) {
			result.traits.push(spice.primaryTrait);
			result.newTraits.push(spice.primaryTrait);
		}

		// Apply transformation rules
		const transformations = spice.transformations;
		for (let i = 0; i < result.traits.length; i++) {
			const currentTrait = result.traits[i];
			if (transformations[currentTrait]) {
				const newTrait = transformations[currentTrait];
				result.traits[i] = newTrait;
				result.transformations.push({
					from: currentTrait,
					to: newTrait
				});
			}
		}

		// Simple result message - don't explain transformations
		result.message = `Added ${spice.name}. The dish is now: ${result.traits.map(t => `[${t}]`).join(' ')}`;

		// Log the cooking action to character flags for tracking
		await logCookingAction(characterId, spiceId, result);

		return result;
	}
	catch (error) {
		console.error(`Error applying cooking spice ${spiceId}:`, error);
		return {
			success: false,
			message: 'An error occurred while cooking.',
			traits: currentTraits
		};
	}
}

/**
 * Start a new cooking session for a character
 * @param {string} characterId - The character starting to cook
 * @param {string} baseIngredientId - The base ingredient/food item ID
 * @param {Object} options - Cooking session options
 * @returns {Promise<Object>} New cooking session data
 */
async function startCookingSession(characterId, baseIngredientId, options = {}) {
	try {
		// Get the base ingredient details
		const baseItem = await itemUtility.getItemWithDetails(baseIngredientId);
		if (!baseItem) {
			return {
				success: false,
				message: 'Base ingredient not found.'
			};
		}

		// Initialize cooking session data
		const cookingSession = {
			sessionId: `cooking_${characterId}_${Date.now()}`,
			characterId: characterId,
			baseIngredient: {
				id: baseIngredientId,
				name: baseItem.name,
				description: baseItem.description
			},
			traits: options.initialTrait || [],
			additivesUsed: [],
			startTime: Date.now(),
			status: 'active'
		};

		// Store session in character flags
		await characterUtil.updateCharacterFlag(
			characterId,
			'active_cooking_session',
			JSON.stringify(cookingSession)
		);

		return {
			success: true,
			message: `Started cooking with ${baseItem.name}.`,
			session: cookingSession
		};
	}
	catch (error) {
		console.error(`Error starting cooking session:`, error);
		return {
			success: false,
			message: 'Failed to start cooking session.'
		};
	}
}

/**
 * Get the current cooking session for a character
 * @param {string} characterId - The character ID
 * @returns {Promise<Object|null>} Current cooking session or null
 */
async function getCurrentCookingSession(characterId) {
	try {
		const sessionFlag = await CharacterFlag.findOne({
			where: {
				character_id: characterId,
				flag: 'active_cooking_session'
			}
		});

		if (!sessionFlag) {
			return null;
		}

		return JSON.parse(sessionFlag.value);
	}
	catch (error) {
		console.error(`Error getting cooking session for ${characterId}:`, error);
		return null;
	}
}

/**
 * Add an additive to the current cooking session
 * @param {string} characterId - The character ID
 * @param {string} additiveId - The additive to add
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Updated cooking result
 */
async function addAdditiveToSession(characterId, additiveId, options = {}) {
	try {
		const session = await getCurrentCookingSession(characterId);
		if (!session) {
			return {
				success: false,
				message: 'No active cooking session found. Start cooking first!'
			};
		}

		// Apply the additive to the current dish
		const cookingResult = await applyCookingAdditive(characterId, additiveId, session.traits, options);
		
		if (cookingResult.success) {
			// Update session data
			session.traits = cookingResult.traits;
			session.additivesUsed.push({
				additiveId: additiveId,
				additiveName: COOKING_ADDITIVES[additiveId]?.name || additiveId,
				timestamp: Date.now(),
				transformations: cookingResult.transformations
			});

			// Save updated session
			await characterUtil.updateCharacterFlag(
				characterId,
				'active_cooking_session',
				JSON.stringify(session)
			);

			cookingResult.session = session;
		}

		return cookingResult;
	}
	catch (error) {
		console.error(`Error adding additive to cooking session:`, error);
		return {
			success: false,
			message: 'An error occurred while adding the additive.',
		};
	}
}

/**
 * Finish the cooking session and create the final dish
 * @param {string} characterId - The character ID
 * @param {Object} options - Finishing options
 * @returns {Promise<Object>} Final cooking result
 */
async function finishCookingSession(characterId, options = {}) {
	try {
		const session = await getCurrentCookingSession(characterId);
		if (!session) {
			return {
				success: false,
				message: 'No active cooking session found.'
			};
		}

		// Calculate final dish quality/value based on score derived from traits
		const dishScore = calculateDishScore(session.traits);
		const dishQuality = calculateDishQuality(session.traits);
		
		// Create the finished dish item (this would need item creation logic)
		const finishedDish = {
			name: `Cooked ${session.baseIngredient.name}`,
			description: `A dish made from ${session.baseIngredient.name} with ${session.additivesUsed.length} additives.`,
			traits: session.traits,
			quality: dishQuality,
			score: dishScore,
			additivesUsed: session.additivesUsed.map(a => a.additiveName),
			cookingTime: Date.now() - session.startTime
		};

		// Store the finished dish data (could be converted to actual item later)
		await characterUtil.updateCharacterFlag(
			characterId,
			`finished_dish_${session.sessionId}`,
			JSON.stringify(finishedDish)
		);

		// Store as latest cooked dish so the player can choose to eat it immediately
		await characterUtil.updateCharacterFlag(
			characterId,
			'latest_cooked_dish',
			JSON.stringify(finishedDish)
		);

		// Clear active cooking session
		await CharacterFlag.destroy({
			where: {
				character_id: characterId,
				flag: 'active_cooking_session'
			}
		});

		return {
			success: true,
			message: `Cooking completed! You've created: ${finishedDish.name}`,
			dish: finishedDish,
			session: session
		};
	}
	catch (error) {
		console.error(`Error finishing cooking session:`, error);
		return {
			success: false,
			message: 'Failed to finish cooking.'
		};
	}
}

/**
 * Get list of available additives for cooking
 * @returns {Array} Array of additive information
 */
function getAvailableAdditives() {
	return Object.entries(COOKING_ADDITIVES).map(([id, additive]) => ({
		id: id,
		name: additive.name,
		primaryTrait: additive.primaryTrait,
		transformationCount: Object.keys(additive.transformations).length
	}));
}

/**
 * Get detailed additive information
 * @param {string} additiveId - The additive ID
 * @returns {Object|null} Additive data or null
 */
function getAdditiveInfo(additiveId) {
	return COOKING_ADDITIVES[additiveId.toLowerCase()] || null;
}

// Helper functions
async function logCookingAction(characterId, additiveId, result) {
	const logData = {
		action: 'additive_applied',
		additiveId: additiveId,
		additiveName: COOKING_ADDITIVES[additiveId]?.name,
		transformations: result.transformations,
		timestamp: Date.now()
	};

	await characterUtil.updateCharacterFlag(
		characterId,
		`cooking_log_${Date.now()}`,
		JSON.stringify(logData)
	);
}

async function checkCharacterHasSpice(characterId, spiceId) {
	// This would check character inventory for the spice item
	// Implementation depends on your item system
	const spiceItemId = getSpiceItemId(spiceId);
	if (!spiceItemId) return false;

	const item = await CharacterItem.findOne({
		where: {
			character_id: characterId,
			item_id: spiceItemId,
			amount: { [Op.gt]: 0 }
		}
	});

	return !!item;
}

async function consumeSpiceItem(characterId, spiceId) {
	// This would consume 1 of the spice item from inventory
	const spiceItemId = getSpiceItemId(spiceId);
	if (spiceItemId) {
		const character = await CharacterBase.findOne({ where: { id: characterId } });
		await characterUtil.removeCharacterItem(character.id, spiceItemId, 1);
	}
}

function getSpiceItemId(spiceId) {
	// Map spice IDs to actual item IDs in your item system
	const spiceItemMapping = {
		'vinegar': 'item_vinegar',
		'lard': 'item_lard', 
		'hardtack': 'item_hardtack',
		'old_ale': 'item_old_ale',
		'sea_salt': 'item_sea_salt'
	};
	
	return spiceItemMapping[spiceId.toLowerCase()] || null;
}

function calculateDishQuality(traits) {
	const score = calculateDishScore(traits);
	if (score > 200) return 'Legendary';
	if (score > 100) return 'Epic';
	if (score > 50)  return 'Rare';
	if (score > 20)  return 'Uncommon';
	return 'Common';
}

/**
 * Calculate the numerical score of a dish based on its traits
 * @param {Array} traits - Array of trait strings
 * @param {number} baseScore - Base score to start calculation (default 10)
 * @returns {number} Final dish score
 */
function calculateDishScore(traits, baseScore = 10) {
	// Trait scoring system
	const TRAIT_BONUSES = {
		// High-value transformed traits
		'Velvet': 25,
		'Rich Sauce': 14,
		'Glazed': 20,
		'Crust': 18,
		'Hardened': 10,
		'Crispy': 15,
		'Chewy': 15,
		'Thick': 9,
		'Smooth': 12,
		'Vapor': 7,
		'Fizzy': 6,
		'Paste': 5,
		'Tender': 10,
		'Starch': 5,
		'Grainy': 5,
		'Elastic': 5,
		'Liquid': 4,
		'Bready': 4,
		'Dough': 4,
		'Stringy': 4,
		'Ropy': 4,
		'Salty': 4,
		'Dry': 4,
		'Fermenting': 3,
		'Sour': 3,
		'Fat': 3,
		'Oily': 3,
		'Broth': 8,
		'Gristly': 2,
		'Soggy': -20
	};

	const TRAIT_MULTIPLIERS = {
		'Complex': 3.0,
		'Cured': 2.5,
		'Savory': 1.5,
		'Brine': 1.4,
		'Sharp': 1.3,
		'Mellow': 1.2,
		'Malty': 1.1,
		'Acrid': 0.5
	};

	const ZERO_TRAITS = ['Sludge', 'Putrid', 'Caustic', 'Charred'];

	// Check for auto-zero traits first
	if (traits.some(trait => ZERO_TRAITS.includes(trait))) {
		return 0;
	}

	let score = baseScore;

	// Apply additive bonuses/penalties
	for (const trait of traits) {
		if (TRAIT_BONUSES[trait] !== undefined) {
			score += TRAIT_BONUSES[trait];
		}
	}

	// Apply multipliers
	for (const trait of traits) {
		if (TRAIT_MULTIPLIERS[trait] !== undefined) {
			score *= TRAIT_MULTIPLIERS[trait];
		}
	}

	// Round to nearest integer and ensure minimum of 0
	return Math.max(0, Math.round(score));
}

/**
 * Get all special events from the event system
 * @param {Array} specialTags - Array of tags that identify special events (e.g., ['special', 'unique', 'custom'])
 * @returns {Promise<Array>} Array of special event entries
 */
async function getSpecialEvents(specialTags = ['special', 'unique', 'custom']) {
	try {
		const allEvents = contentStore.events.findAll();

		const specialEvents = allEvents.filter(event =>
			event.is_active !== false &&
			event.tag && Array.isArray(event.tag) &&
			specialTags.some(tag => event.tag.includes(tag))
		);
		
		return specialEvents;
	}
	catch (error) {
		console.error('Error getting special events:', error);
		return [];
	}
}

/**
 * Get special event by ID
 * @param {string} eventId - The event ID to find
 * @returns {Promise<Object|null>} Special event or null
 */
async function getSpecialEventById(eventId) {
	try {
		const event = contentStore.events.findByPk(String(eventId));

		if (!event || event.is_active === false || !event.tag || !Array.isArray(event.tag)) {
			return null;
		}
		
		// Check if it's tagged as special
		const isSpecial = ['special', 'unique', 'custom'].some(tag => event.tag.includes(tag));
		return isSpecial ? event : null;
	}
	catch (error) {
		console.error(`Error getting special event ${eventId}:`, error);
		return null;
	}
}

/**
 * Get special events by specific tag
 * @param {string} tag - The tag to filter by
 * @returns {Promise<Array>} Array of matching special events
 */
async function getSpecialEventsByTag(tag) {
	try {
		const allEvents = contentStore.events.findAll();

		const taggedEvents = allEvents.filter(event =>
			event.is_active !== false &&
			event.tag && Array.isArray(event.tag) && event.tag.includes(tag)
		);
		
		return taggedEvents;
	}
	catch (error) {
		console.error(`Error getting special events by tag ${tag}:`, error);
		return [];
	}
}

/**
 * Check if an event requires special handling
 * @param {string} eventId - The event ID to check
 * @returns {Promise<boolean>} True if event needs special processing
 */
async function requiresSpecialHandling(eventId) {
	try {
		const event = await getSpecialEventById(eventId);
		return event !== null;
	}
	catch (error) {
		console.error(`Error checking special handling for ${eventId}:`, error);
		return false;
	}
}

/**
 * Process special event with custom logic
 * @param {string} characterId - The character ID
 * @param {string} eventId - The special event ID
 * @param {Object} sessionData - Current event session data
 * @param {Object} options - Additional processing options
 * @returns {Promise<Object>} Processing result
 */
async function processSpecialEvent(characterId, eventId, sessionData = {}, options = {}) {
	try {
		const event = await getSpecialEventById(eventId);
		if (!event) {
			return { success: false, message: 'Special event not found.' };
		}

		const results = {
			success: true,
			message: '',
			actions: [],
			nextEvent: null,
			specialEffects: []
		};

		// Check for specific special event types by tag
		if (event.tag.includes('ritual')) {
			await processRitualEvent(characterId, event, sessionData, results);
		}
		else if (event.tag.includes('puzzle')) {
			await processPuzzleEvent(characterId, event, sessionData, results);
		}
		else if (event.tag.includes('transformation')) {
			await processTransformationEvent(characterId, event, sessionData, results);
		}
		else if (event.tag.includes('temporal')) {
			await processTemporalEvent(characterId, event, sessionData, results);
		}
		else if (event.tag.includes('dimensional')) {
			await processDimensionalEvent(characterId, event, sessionData, results);
		}
		else {
			// Generic special event processing
			await processGenericSpecialEvent(characterId, event, sessionData, results);
		}

		return results;
	}
	catch (error) {
		console.error(`Error processing special event ${eventId}:`, error);
		return { success: false, message: 'An error occurred while processing the special event.' };
	}
}

/**
 * Process ritual-type special events
 * @param {string} characterId - Character ID
 * @param {Object} event - Event data
 * @param {Object} sessionData - Session data
 * @param {Object} results - Results object to modify
 */
async function processRitualEvent(characterId, event, sessionData, results) {
	// Ritual events typically involve:
	// - Multiple stages/phases
	// - Resource consumption
	// - Time-based mechanics
	// - Potential failure consequences
	
	const ritualPhase = sessionData.ritualPhase || 1;
	const maxPhases = event.metadata?.phases || 3;
	
	if (ritualPhase <= maxPhases) {
		// Process current ritual phase
		const phaseResult = await processRitualPhase(characterId, event, ritualPhase);
		results.specialEffects.push(`Ritual phase ${ritualPhase} completed`);
		
		// Advance to next phase or complete ritual
		if (ritualPhase < maxPhases) {
			sessionData.ritualPhase = ritualPhase + 1;
			results.message = `Ritual phase ${ritualPhase} complete. Prepare for phase ${ritualPhase + 1}.`;
		}
		else {
			results.message = 'Ritual completed successfully!';
			await applyRitualRewards(characterId, event);
			results.specialEffects.push('Ritual completed - rewards granted');
		}
	}
}

/**
 * Process puzzle-type special events
 * @param {string} characterId - Character ID
 * @param {Object} event - Event data
 * @param {Object} sessionData - Session data
 * @param {Object} results - Results object to modify
 */
async function processPuzzleEvent(characterId, event, sessionData, results) {
	// Puzzle events involve:
	// - Logic challenges
	// - Pattern recognition
	// - Multiple attempts with consequences
	// - Hint systems
	
	const attempts = sessionData.puzzleAttempts || 0;
	const maxAttempts = event.metadata?.maxAttempts || 3;
	const solution = event.metadata?.solution;
	const currentAnswer = sessionData.currentAnswer;
	
	if (attempts < maxAttempts) {
		if (currentAnswer === solution) {
			results.message = 'Puzzle solved correctly!';
			await applyPuzzleRewards(characterId, event);
			results.specialEffects.push('Puzzle solved - rewards granted');
		}
		else {
			sessionData.puzzleAttempts = attempts + 1;
			const remainingAttempts = maxAttempts - (attempts + 1);
			results.message = `Incorrect answer. ${remainingAttempts} attempts remaining.`;
			
			if (remainingAttempts === 0) {
				results.message += ' Puzzle failed!';
				await applyPuzzleFailure(characterId, event);
				results.specialEffects.push('Puzzle failed - consequences applied');
			}
		}
	}
}

/**
 * Process transformation-type special events
 * @param {string} characterId - Character ID
 * @param {Object} event - Event data
 * @param {Object} sessionData - Session data
 * @param {Object} results - Results object to modify
 */
async function processTransformationEvent(characterId, event, sessionData, results) {
	// Transformation events change character state/appearance
	const transformationType = event.metadata?.transformationType || 'temporary';
	const duration = event.metadata?.duration || 3600; // 1 hour default
	
	const transformationData = {
		type: 'special_transformation',
		eventSource: event.id,
		transformationType: transformationType,
		originalForm: sessionData.originalForm || 'human',
		duration: duration,
		timestamp: Date.now()
	};
	
	await characterUtil.updateCharacterFlag(
		characterId,
		'special_transformation',
		JSON.stringify(transformationData)
	);
	
	results.message = `You have been transformed! (Duration: ${duration}s)`;
	results.specialEffects.push('Transformation applied');
}

/**
 * Process temporal-type special events
 * @param {string} characterId - Character ID
 * @param {Object} event - Event data
 * @param {Object} sessionData - Session data
 * @param {Object} results - Results object to modify
 */
async function processTemporalEvent(characterId, event, sessionData, results) {
	// Temporal events affect time flow or access past/future states
	const timeEffect = event.metadata?.timeEffect || 'pause';
	
	switch (timeEffect) {
		case 'pause':
			// Pause time-based mechanics
			await characterUtil.updateCharacterFlag(characterId, 'time_paused', Date.now());
			results.message = 'Time has been paused around you...';
			break;
		case 'accelerate':
			// Speed up regeneration, cooldowns, etc.
			await characterUtil.updateCharacterFlag(characterId, 'time_accelerated', Date.now());
			results.message = 'Time flows faster around you...';
			break;
		case 'rewind':
			// Restore previous state
			await restoreCharacterSnapshot(characterId);
			results.message = 'Time rewinds, restoring your previous state...';
			break;
	}
	
	results.specialEffects.push(`Temporal effect: ${timeEffect}`);
}

/**
 * Process dimensional-type special events
 * @param {string} characterId - Character ID
 * @param {Object} event - Event data
 * @param {Object} sessionData - Session data
 * @param {Object} results - Results object to modify
 */
async function processDimensionalEvent(characterId, event, sessionData, results) {
	// Dimensional events involve plane shifting, pocket dimensions, etc.
	const dimensionType = event.metadata?.dimensionType || 'pocket';
	
	const character = await CharacterBase.findOne({ where: { id: characterId } });
	if (!character) {
		return;
	}
	
	// Store original location for return
	await characterUtil.updateCharacterFlag(
		characterId,
		'original_dimension_location',
		character.location_id.toString()
	);
	
	// Move to dimensional location
	const dimensionLocationId = event.metadata?.dimensionLocation;
	if (dimensionLocationId) {
		await characterUtil.updateCharacterStat(characterId, 'location_id', dimensionLocationId, 'set');
	}
	
	results.message = `You have entered a ${dimensionType} dimension...`;
	results.specialEffects.push('Dimensional travel');
}

/**
 * Process generic special events
 * @param {string} characterId - Character ID
 * @param {Object} event - Event data
 * @param {Object} sessionData - Session data
 * @param {Object} results - Results object to modify
 */
async function processGenericSpecialEvent(characterId, event, sessionData, results) {
	// Default processing for special events without specific type
	results.message = event.description || 'A special event occurs...';
	
	// Apply any metadata effects
	if (event.metadata?.effects) {
		for (const effect of event.metadata.effects) {
			await applySpecialEffect(characterId, effect);
			results.specialEffects.push(effect.description || 'Special effect applied');
		}
	}
}

/**
 * Get special event requirements based on tags and metadata
 * @param {string} eventId - Event ID to check
 * @returns {Promise<Object>} Requirements object
 */
async function getSpecialEventRequirements(eventId) {
	try {
		const event = await getSpecialEventById(eventId);
		if (!event) {
			return {};
		}
		
		const requirements = {
			level: event.metadata?.requiredLevel || 1,
			items: event.metadata?.requiredItems || {},
			flags: event.metadata?.requiredFlags || {},
			stats: event.metadata?.requiredStats || {},
			location: event.metadata?.requiredLocation || null,
			special: event.metadata?.specialRequirements || {}
		};
		
		return requirements;
	}
	catch (error) {
		console.error(`Error getting special event requirements for ${eventId}:`, error);
		return {};
	}
}

/**
 * Check if character meets special event requirements
 * @param {string} characterId - Character ID
 * @param {string} eventId - Special event ID
 * @returns {Promise<Object>} Check result with details
 */
async function validateSpecialEventRequirements(characterId, eventId) {
	try {
		const requirements = await getSpecialEventRequirements(eventId);
		const character = await CharacterBase.findOne({ where: { id: characterId } });
		
		if (!character) {
			return { valid: false, reason: 'Character not found' };
		}
		
		// Check level requirement
		if (requirements.level && character.level < requirements.level) {
			return { valid: false, reason: `Level ${requirements.level} required` };
		}
		
		// Check item requirements
		for (const [itemId, quantity] of Object.entries(requirements.items)) {
			const item = await CharacterItem.findOne({
				where: { character_id: characterId, item_id: itemId }
			});
			if (!item || item.amount < quantity) {
				return { valid: false, reason: `Requires ${quantity} of item ${itemId}` };
			}
		}
		
		// Check flag requirements
		for (const [flagName, flagValue] of Object.entries(requirements.flags)) {
			const flag = await CharacterFlag.findOne({
				where: { character_id: characterId, flag_name: flagName }
			});
			if (!flag || flag.flag_value !== flagValue) {
				return { valid: false, reason: `Requires flag ${flagName}=${flagValue}` };
			}
		}
		
		return { valid: true };
	}
	catch (error) {
		console.error(`Error validating special event requirements:`, error);
		return { valid: false, reason: 'Validation error' };
	}
}

// Helper functions for special event processing
async function processRitualPhase(characterId, event, phase) {
	// Implementation for ritual phase processing
	return { success: true, phase: phase };
}

async function applyRitualRewards(characterId, event) {
	// Apply rewards for completing ritual
	const rewards = event.metadata?.ritualRewards || {};
	for (const [stat, value] of Object.entries(rewards)) {
		await characterUtil.modifyCharacterStat(characterId, stat, value, 'add');
	}
}

async function applyPuzzleRewards(characterId, event) {
	// Apply rewards for solving puzzle
	const rewards = event.metadata?.puzzleRewards || {};
	for (const [stat, value] of Object.entries(rewards)) {
		await characterUtil.modifyCharacterStat(characterId, stat, value, 'add');
	}
}

async function applyPuzzleFailure(characterId, event) {
	// Apply consequences for puzzle failure
	const penalties = event.metadata?.puzzlePenalties || {};
	for (const [stat, value] of Object.entries(penalties)) {
		await characterUtil.modifyCharacterStat(characterId, stat, -value, 'add');
	}
}

async function restoreCharacterSnapshot(characterId) {
	// Restore character to previous state (placeholder implementation)
	// This would need to be implemented based on your snapshot system
	console.log(`Restoring snapshot for character ${characterId}`);
}

async function applySpecialEffect(characterId, effect) {
	// Apply generic special effect
	if (effect.type === 'stat') {
		await characterUtil.modifyCharacterStat(characterId, effect.stat, effect.value, effect.operation || 'add');
	}
	else if (effect.type === 'flag') {
		await characterUtil.updateCharacterFlag(characterId, effect.flagName, effect.flagValue);
	}
}

module.exports = {
	getSpecialEvents,
	getSpecialEventById,
	getSpecialEventsByTag,
	requiresSpecialHandling,
	processSpecialEvent,
	getSpecialEventRequirements,
	validateSpecialEventRequirements,
	processRitualEvent,
	processPuzzleEvent,
	processTransformationEvent,
	processTemporalEvent,
	processDimensionalEvent,
	processGenericSpecialEvent,
	// Cooking mini-game functions
	applyCookingAdditive,
	startCookingSession,
	getCurrentCookingSession,
	addAdditiveToSession,
	finishCookingSession,
	getAvailableAdditives,
	getAdditiveInfo,
	calculateDishScore,
	COOKING_ADDITIVES
};
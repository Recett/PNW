const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const {
	CharacterBase,
	CharacterFlag,
	CharacterItem,
	CharacterStatus,
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
			'Heavy': 'Fermenting',
			'Pungent': 'Sharp',
			'Gelatinous': 'Soggy',
			'Brittle': 'Grainy',
			'Thick': 'Ropy',
			'Glazed': 'Smooth',
			'Dough': 'Vapor',
			'Hardened': 'Crust',
			'Velvet': 'Complex',
			'Acrid': 'Caustic',
			'Putrid': 'Sour',
			'Broth': 'Sharp',
			'Elastic': 'Grainy'
		}
	},
	'lard': {
		name: 'Lard',
		primaryTrait: 'Fat',
		transformations: {
			'Dry': 'Crispy',
			'Sour': 'Syrup',
			'Grainy': 'Velvet',
			'Tender': 'Broth',
			'Sharp': 'Savory',
			'Starch': 'Glazed',
			'Ropy': 'Elastic',
			'Vapor': 'Chewy',
			'Fermenting': 'Brittle',
			'Liquid': 'Broth',
			'Soggy': 'Sludge',
			'Cured': 'Savory',
			'Malty': 'Crispy',
			'Bready': 'Paste'
		}
	},
	'hardtack': {
		name: 'Hardtack',
		primaryTrait: 'Dry',
		transformations: {
			'Liquid': 'Starch',
			'Syrup': 'Paste',
			'Crispy': 'Bready',
			'Chewy': 'Gristly',
			'Smooth': 'Grainy',
			'Mellow': 'Gelatinous',
			'Velvet': 'Dough',
			'Savory': 'Heavy',
			'Malty': 'Hardened',
			'Sour': 'Acrid',
			'Broth': 'Charred',
			'Fermenting': 'Putrid',
			'Crust': 'Thick',
			'Ropy': 'Dough'
		}
	},
	'old_ale': {
		name: 'Old Ale',
		primaryTrait: 'Liquid',
		transformations: {
			'Salty': 'Pungent',
			'Soggy': 'Malty',
			'Paste': 'Dough',
			'Fat': 'Vapor',
			'Crust': 'Grainy',
			'Acrid': 'Sour',
			'Gristly': 'Elastic',
			'Thick': 'Gelatinous',
			'Hardened': 'Crispy',
			'Dry': 'Mellow',
			'Fermenting': 'Syrup',
			'Charred': 'Malty',
			'Brine': 'Pungent',
			'Caustic': 'Brittle'
		}
	},
	'sea_salt': {
		name: 'Sea-Salt',
		primaryTrait: 'Salty',
		transformations: {
			'Tender': 'Glazed',
			'Mellow': 'Savory',
			'Thick': 'Heavy',
			'Crispy': 'Crust',
			'Grainy': 'Starch',
			'Smooth': 'Ropy',
			'Gelatinous': 'Elastic',
			'Dough': 'Hardened',
			'Chewy': 'Gristly',
			'Vapor': 'Fermenting',
			'Broth': 'Cured',
			'Liquid': 'Brine',
			'Complex': 'Heavy',
			'Sludge': 'Paste'
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
				result.transformations.push({
					from: currentTrait,
					to: newTrait
				});
				if (result.traits.includes(newTrait)) {
					// Target already exists — remove the source to avoid duplicates
					result.traits.splice(i, 1);
					i--;
				}
				else {
					result.traits[i] = newTrait;
				}
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
			traits: options.initialTraits || options.initialTrait || [],
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
	if (score > 150) return 'Legendary';
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
		'Glazed': 20,
		'Crust': 18,
		'Crispy': 15,
		'Chewy': 15,
		'Smooth': 12,
		'Tender': 10,
		'Hardened': 10,
		'Thick': 9,
		'Broth': 8,
		'Vapor': 7,
		'Gelatinous': 5,
		'Paste': 5,
		'Starch': 5,
		'Grainy': 5,
		'Elastic': 5,
		'Liquid': 4,
		'Bready': 4,
		'Dough': 4,
		'Ropy': 4,
		'Salty': 4,
		'Dry': 4,
		'Fermenting': 3,
		'Sour': 3,
		'Fat': 3,
		'Brittle': 3,
		'Gristly': 2,
		'Soggy': -20,
		'Heavy': -10
	};

	const TRAIT_MULTIPLIERS = {
		'Complex': 3.0,
		'Cured': 2.5,
		'Savory': 1.5,
		'Syrup': 1.3,
		'Brine': 1.4,
		'Sharp': 1.3,
		'Mellow': 1.2,
		'Malty': 1.1,
		'Acrid': 0.5,
		'Pungent': 0.8
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

// ─── Cooking UI Handlers ────────────────────────────────────────────────────

async function showIngredientSelection(interaction, ingredients) {
	const embed = new EmbedBuilder()
		.setTitle('\uD83C\uDF73 Choose Base Ingredient')
		.setDescription('Select which ingredient you want to cook with. **This ingredient will be consumed immediately.**')
		.setColor(0xFFD700);

	const options = ingredients.slice(0, 25).map(ingredient => ({
		label: `${ingredient.name} (${ingredient.amount})`,
		description: ingredient.description?.substring(0, 100) || 'No description',
		value: ingredient.id
	}));

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId('cook_select_ingredient')
		.setPlaceholder('Choose your base ingredient...')
		.addOptions(options);

	const cancelButton = new ButtonBuilder()
		.setCustomId('cook_cancel_selection')
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary)
		.setEmoji('\u274C');

	const selectRow = new ActionRowBuilder().addComponents(selectMenu);
	const buttonRow = new ActionRowBuilder().addComponents(cancelButton);

	const method = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
	await interaction[method]({
		embeds: [embed],
		components: [selectRow, buttonRow],
		flags: MessageFlags.Ephemeral
	});
}

async function showCookingInterface(interaction, userId, session) {
	const embed = new EmbedBuilder()
		.setTitle('\uD83C\uDF73 Cooking in Progress')
		.setDescription(`**Base:** ${session.baseIngredient.name}\n**The dish is:** ${session.traits.length > 0 ? session.traits.map(t => `[${t}]`).join(' ') : 'Plain'}\n**Additives Used:** ${session.additivesUsed.length}`)
		.setColor(0xFF6B35);

	const additiveOptions = getAvailableAdditives().map(additive => ({
		label: `${additive.name} [${additive.primaryTrait}]`,
		description: `Adds [${additive.primaryTrait}] + transforms existing`,
		value: additive.id
	}));

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId('cook_add_additive')
		.setPlaceholder('Add an additive...')
		.addOptions(additiveOptions);

	const finishButton = new ButtonBuilder()
		.setCustomId('cook_finish')
		.setLabel('Finish Cooking')
		.setStyle(ButtonStyle.Success)
		.setEmoji('\u2705');

	const cancelButton = new ButtonBuilder()
		.setCustomId('cook_cancel')
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger)
		.setEmoji('\u274C');

	const additiveRow = new ActionRowBuilder().addComponents(selectMenu);
	const buttonRow = new ActionRowBuilder().addComponents(finishButton, cancelButton);

	const method = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
	await interaction[method]({
		embeds: [embed],
		components: [additiveRow, buttonRow],
		flags: MessageFlags.Ephemeral
	});
}

async function handleIngredientSelection(interaction) {
	const userId = interaction.user.id;
	const ingredientId = interaction.values[0];
	try {
		const ingredient = await itemUtility.getItemWithDetails(ingredientId);
		if (!ingredient) {
			return interaction.reply({ content: 'Selected ingredient not found.', flags: MessageFlags.Ephemeral });
		}

		const characterItem = await CharacterItem.findOne({
			where: { character_id: userId, item_id: ingredientId, amount: { [Op.gt]: 0 } }
		});
		if (!characterItem) {
			return interaction.reply({ content: 'You no longer have this ingredient.', flags: MessageFlags.Ephemeral });
		}

		const STAMINA_COST = 5;
		const character = await CharacterBase.findOne({ where: { id: userId } });
		if ((character?.currentStamina ?? 0) < STAMINA_COST) {
			return interaction.reply({
				content: `B\u1ea1n qu\u00e1 m\u1ec7t \u0111\u1ec3 n\u1ea5u \u0103n. (C\u1ea7n ${STAMINA_COST} stamina, hi\u1ec7n c\u00f3 ${character?.currentStamina ?? 0})`,
				flags: MessageFlags.Ephemeral,
			});
		}

		await characterUtil.removeCharacterItem(character.id, ingredientId, 1);
		await characterUtil.modifyCharacterStat(userId, 'currentStamina', -STAMINA_COST, 'add');

		const initialTraits = ingredient.metadata?.initialTrait || [];
		const result = await startCookingSession(userId, ingredientId, { initialTraits });
		if (!result.success) {
			return interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
		}

		await showCookingInterface(interaction, userId, result.session);
	}
	catch (error) {
		console.error('Error handling ingredient selection:', error);
		await interaction.reply({ content: 'An error occurred while starting to cook.', flags: MessageFlags.Ephemeral });
	}
}

async function handleAdditiveAddition(interaction) {
	const userId = interaction.user.id;
	const additiveId = interaction.values[0];
	try {
		const ADDITIVE_STAMINA_COST = 1;
		const character = await CharacterBase.findOne({ where: { id: userId } });
		if ((character?.currentStamina ?? 0) < ADDITIVE_STAMINA_COST) {
			return interaction.reply({
				content: `B\u1ea1n qu\u00e1 m\u1ec7t \u0111\u1ec3 th\u00eam gia v\u1ecb. (C\u1ea7n ${ADDITIVE_STAMINA_COST} stamina, hi\u1ec7n c\u00f3 ${character?.currentStamina ?? 0})`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const result = await addAdditiveToSession(userId, additiveId, { requireAdditiveItem: false });
		if (!result.success) {
			return interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
		}

		await characterUtil.modifyCharacterStat(userId, 'currentStamina', -ADDITIVE_STAMINA_COST, 'add');
		await showCookingInterface(interaction, userId, result.session);
	}
	catch (error) {
		console.error('Error adding additive:', error);
		await interaction.reply({ content: 'An error occurred while adding the additive.', flags: MessageFlags.Ephemeral });
	}
}

// Trait → derived combat stat mapping
const FOOD_TRAIT_STATS = {
	'Crispy': 'attack', 'Crust': 'attack', 'Chewy': 'attack', 'Gristly': 'attack',
	'Hardened': 'defense',
	'Cured': 'defense_percent', 'Glazed': 'defense_percent',
	'Smooth': 'evade', 'Liquid': 'evade', 'Vapor': 'evade', 'Fizzy': 'evade',
	'Sharp': 'speed', 'Elastic': 'speed', 'Ropy': 'speed', 'Stringy': 'speed',
	'Grainy': 'accuracy', 'Dry': 'accuracy', 'Malty': 'accuracy',
	'Complex': 'critical', 'Velvet': 'critical',
	'Rich Sauce': 'critical_damage', 'Thick': 'critical_damage', 'Paste': 'critical_damage',
	'Brine': 'crit_resistance', 'Salty': 'crit_resistance', 'Mellow': 'crit_resistance',
};
const FOOD_NEGATIVE_TRAITS = ['Soggy', 'Acrid', 'Sludge', 'Putrid', 'Caustic', 'Charred'];
const FOOD_QUALITY_MULT = { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5 };
const FOOD_STAT_MULT = {
	attack: 1 / 3, defense: 1 / 5, defense_percent: 1 / 3,
	evade: 1 / 3, speed: 1 / 3, accuracy: 1 / 3,
	critical: 2, critical_damage: 2, crit_resistance: 2,
};
const FOOD_STAT_LABEL = {
	attack: 'Attack', defense: 'Defense', defense_percent: 'Defense%',
	evade: 'Evade', speed: 'Speed', accuracy: 'Accuracy',
	critical: 'Critical', critical_damage: 'Crit Damage', crit_resistance: 'Crit Resist',
};

function getDishBuff(traits, quality) {
	if (!traits || traits.length === 0) return [];
	if (traits.some(t => FOOD_NEGATIVE_TRAITS.includes(t))) return null;
	const qualityMult = FOOD_QUALITY_MULT[quality] || 1;
	const votes = {};
	for (const trait of traits) {
		const stat = FOOD_TRAIT_STATS[trait];
		if (stat) votes[stat] = (votes[stat] || 0) + 1;
	}
	return Object.entries(votes).map(([stat_target, count]) => ({ stat_target, potency: count * qualityMult }));
}

function scoreToQualityMult(score) {
	if (score > 200) return FOOD_QUALITY_MULT.Legendary;
	if (score > 100) return FOOD_QUALITY_MULT.Epic;
	if (score > 50)  return FOOD_QUALITY_MULT.Rare;
	if (score > 20)  return FOOD_QUALITY_MULT.Uncommon;
	return FOOD_QUALITY_MULT.Common;
}

function getDishDebuff(traits, score) {
	if (!traits || traits.length === 0) return [];
	const negativeCount = traits.filter(t => FOOD_NEGATIVE_TRAITS.includes(t)).length;
	const negativeMult = Math.max(1, negativeCount);
	const qualityMult = scoreToQualityMult((score ?? 0) * negativeMult);
	const votes = {};
	for (const trait of traits.filter(t => !FOOD_NEGATIVE_TRAITS.includes(t))) {
		const stat = FOOD_TRAIT_STATS[trait];
		if (stat) votes[stat] = (votes[stat] || 0) + 1;
	}
	return Object.entries(votes).map(([stat_target, count]) => ({ stat_target, potency: -(count * qualityMult) }));
}

const EAT_FLAVOR = {
	spoiled:   'V\u1ecb kh\u00f4ng \u1ed5n ngay t\u1eeb mi\u1ebfng \u0111\u1ea7u. B\u1ea1n c\u1ed1 nu\u1ed1t h\u1ebft v\u00ec kh\u00f4ng c\u00f3 l\u1ef1a ch\u1ecdn n\u00e0o kh\u00e1c, nh\u01b0ng d\u1ea1 d\u00e0y b\u1eaft \u0111\u1ea7u ph\u1ea3n \u0111\u1ed1i.',
	plain:     '\u0102n \u0111\u01b0\u1ee3c. Nh\u1ea1t v\u00e0 kh\u00f4ng \u0111\u1ec3 l\u1ea1i \u1ea5n t\u01b0\u1ee3ng g\u00ec \u2014 nh\u01b0ng c\u0169ng \u0111\u00e3 t\u1eebng t\u1ec7 h\u01a1n.',
	Common:    'B\u00ecnh th\u01b0\u1eddng. \u0110\u1ee7 no, kh\u00f4ng th\u00eam g\u00ec h\u01a1n.',
	Uncommon:  'Kh\u00e1 \u1ed5n. B\u1ea1n nh\u1eadn ra m\u00ecnh \u0103n nhanh h\u01a1n d\u1ef1 t\u00ednh.',
	Rare:      'Th\u1ef1c s\u1ef1 ngon. V\u1ecb c\u00e2n b\u1eb1ng, no b\u1ee5ng v\u00e0 c\u01a1 th\u1ec3 \u0111\u00e1p l\u1ea1i t\u00edch c\u1ef1c.',
	Epic:      'Xu\u1ea5t s\u1eafc. V\u1ecb ngon tr\u00ean t\u1eebng ng\u00f3n tay.',
	Legendary: 'Ngon v\u00e3i n\u1ed3i. B\u1ea1n c\u1ea3m gi\u00e1c m\u00ecnh tho\u00e1t ra kh\u1ecfi qu\u1ea7n \u00e1o \u0111\u1ec3 m\u00e0 th\u0103ng hoa.',
};

async function handleCookingFinish(interaction) {
	const userId = interaction.user.id;
	try {
		const result = await finishCookingSession(userId);
		if (!result.success) {
			return interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
		}

		const dish = result.dish;
		const previewBuffs = getDishBuff(dish.traits, dish.quality);
		let buffPreviewText;
		if (previewBuffs === null) {
			buffPreviewText = 'This dish has spoiled. Eating it will provide no benefit.';
		}
		else if (!previewBuffs || previewBuffs.length === 0) {
			buffPreviewText = 'This dish is too plain to provide a buff.';
		}
		else {
			const buffList = previewBuffs
				.map(b => `+${Math.floor(b.potency * FOOD_STAT_MULT[b.stat_target])} ${FOOD_STAT_LABEL[b.stat_target]}`)
				.join(', ');
			buffPreviewText = `Eating this will grant: **${buffList}**`;
		}

		const embed = new EmbedBuilder()
			.setTitle('\uD83C\uDF7D\uFE0F Cooking Complete!')
			.setDescription(`**${dish.name}**\n${dish.description}\n\n${buffPreviewText}`)
			.addFields([
				{ name: 'The dish is', value: dish.traits.length > 0 ? dish.traits.map(t => `[${t}]`).join(' ') : 'Plain', inline: false },
				{ name: 'Quality', value: dish.quality, inline: true },
				{ name: 'Score', value: dish.score.toString(), inline: true },
				{ name: 'Additives Used', value: dish.additivesUsed.length > 0 ? dish.additivesUsed.join(', ') : 'None', inline: true }
			])
			.setColor(dish.score > 50 ? 0x00FF00 : dish.score > 25 ? 0xFFD700 : 0xFF6B35);

		const eatButton = new ButtonBuilder().setCustomId('cook_eat').setLabel('Eat').setStyle(ButtonStyle.Success);
		const feedMoraleButton = new ButtonBuilder().setCustomId('cook_feed_morale').setLabel('Feed to Lt. Morale').setStyle(ButtonStyle.Primary);
		const cookingUnlocked = await GlobalFlag.findOne({ where: { flag: 'global.cooking_unlocked' } });
		const resultComponents = cookingUnlocked && Number(cookingUnlocked.value) === 1
			? [eatButton, feedMoraleButton]
			: [eatButton];
		const resultRow = new ActionRowBuilder().addComponents(resultComponents);

		await interaction.update({ embeds: [embed], components: [resultRow] });
	}
	catch (error) {
		console.error('Error finishing cooking:', error);
		await interaction.reply({ content: 'An error occurred while finishing cooking.', flags: MessageFlags.Ephemeral });
	}
}

async function handleCookingCancel(interaction) {
	try {
		await CharacterFlag.destroy({
			where: { character_id: interaction.user.id, flag: 'active_cooking_session' }
		});
		await interaction.update({ content: '\u274C Cooking cancelled.', embeds: [], components: [] });
	}
	catch (error) {
		console.error('Error cancelling cooking:', error);
		await interaction.reply({ content: 'An error occurred while cancelling.', flags: MessageFlags.Ephemeral });
	}
}

async function handleCookingCancelSelection(interaction) {
	try {
		await interaction.update({ content: '\u274C Cooking cancelled.', embeds: [], components: [] });
	}
	catch (error) {
		console.error('Error cancelling ingredient selection:', error);
		await interaction.reply({ content: 'An error occurred while cancelling.', flags: MessageFlags.Ephemeral });
	}
}

async function handleEatDish(interaction) {
	const userId = interaction.user.id;
	try {
		const dishFlag = await CharacterFlag.findOne({ where: { character_id: userId, flag: 'latest_cooked_dish' } });
		if (!dishFlag) {
			return interaction.reply({ content: 'There is no dish available to eat.', flags: MessageFlags.Ephemeral });
		}

		const dish = JSON.parse(dishFlag.value);
		await CharacterStatus.destroy({ where: { character_id: userId, source: 'food' } });
		await CharacterFlag.destroy({ where: { character_id: userId, flag: 'latest_cooked_dish' } });

		const buffs = getDishBuff(dish.traits, dish.quality);
		let buffDescription;
		let embedColor;

		if (buffs === null) {
			const debuffs = getDishDebuff(dish.traits, dish.score);
			for (const debuff of debuffs) {
				await CharacterStatus.create({
					character_id: userId, status_id: 'food_debuff', category: 'debuff', scope: 'persistent',
					stat_target: debuff.stat_target, value_type: 'flat', potency: debuff.potency,
					duration: 3600, duration_unit: 'seconds', expires_at: new Date(Date.now() + 3600 * 1000), source: 'food',
				});
			}
			await characterUtil.recalculateCharacterStats({ id: userId });
			const debuffList = debuffs
				.map(b => `${Math.ceil(b.potency * FOOD_STAT_MULT[b.stat_target])} ${FOOD_STAT_LABEL[b.stat_target]}`)
				.join(', ');
			buffDescription = debuffs.length > 0 ? `${EAT_FLAVOR.spoiled}\n\n**${debuffList}**` : EAT_FLAVOR.spoiled;
			embedColor = 0x8B0000;
		}
		else if (buffs.length === 0) {
			buffDescription = EAT_FLAVOR.plain;
			embedColor = 0x888888;
		}
		else {
			for (const buff of buffs) {
				await CharacterStatus.create({
					character_id: userId, status_id: 'food_buff', category: 'buff', scope: 'persistent',
					stat_target: buff.stat_target, value_type: 'flat', potency: buff.potency,
					duration: 3600, duration_unit: 'seconds', expires_at: new Date(Date.now() + 3600 * 1000), source: 'food',
				});
			}
			await characterUtil.recalculateCharacterStats({ id: userId });
			const buffList = buffs
				.map(b => `+${Math.floor(b.potency * FOOD_STAT_MULT[b.stat_target])} ${FOOD_STAT_LABEL[b.stat_target]}`)
				.join(', ');
			const flavorMsg = EAT_FLAVOR[dish.quality] || EAT_FLAVOR.Common;
			buffDescription = `${flavorMsg}\n\n**${buffList}**`;
			embedColor = dish.quality === 'Legendary' ? 0xFFD700
				: dish.quality === 'Epic' ? 0x9B59B6
				: dish.quality === 'Rare' ? 0x3498DB
				: dish.quality === 'Uncommon' ? 0x2ECC71
				: 0x00FF00;
		}

		const embed = new EmbedBuilder()
			.setTitle('You ate the dish!')
			.setDescription(`**${dish.name}**\n\n${buffDescription}`)
			.setColor(embedColor);
		await interaction.update({ embeds: [embed], components: [] });
	}
	catch (error) {
		console.error('Error eating dish:', error);
		await interaction.reply({ content: 'An error occurred while eating.', flags: MessageFlags.Ephemeral });
	}
}

function getMoraleReactionTier(score) {
	if (score === 0) return 1;
	if (score <= 20) return 2;
	if (score <= 50) return 3;
	if (score <= 100) return 4;
	if (score <= 200) return 5;
	return 6;
}

async function handleFeedMorale(interaction) {
	const userId = interaction.user.id;
	try {
		const dishJson = await characterUtil.getCharacterFlag(userId, 'latest_cooked_dish');
		if (!dishJson) {
			return interaction.reply({ content: 'There is no dish available to feed.', flags: MessageFlags.Ephemeral });
		}

		const dish = JSON.parse(dishJson);
		const score = dish.score ?? 0;
		const tier = getMoraleReactionTier(score);

		const currentHigh = await characterUtil.getCharacterFlag(userId, 'lt_morale_cook_high_score');
		const newHigh = Math.max(currentHigh ?? 0, score);
		if (newHigh > 0) await characterUtil.updateCharacterFlag(userId, 'lt_morale_cook_high_score', newHigh);

		const currentAccum = await characterUtil.getCharacterFlag(userId, 'lt_morale_cook_accumulated');
		const newAccum = (currentAccum ?? 0) + score;
		if (newAccum > 0) await characterUtil.updateCharacterFlag(userId, 'lt_morale_cook_accumulated', newAccum);

		await characterUtil.updateCharacterFlag(userId, 'latest_cooked_dish', null);
		await eventUtility.processEvent(`lt-morale-reaction-${tier}`, interaction, userId, {});
	}
	catch (error) {
		console.error('Error feeding dish to Lt. Morale:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: 'An error occurred while feeding the dish.', flags: MessageFlags.Ephemeral });
		}
	}
}

async function startCooking(interaction, userId) {
	try {
		const existingSession = await getCurrentCookingSession(userId);
		if (existingSession) {
			await showCookingInterface(interaction, userId, existingSession);
			return true;
		}

		const inventory = await CharacterItem.findAll({
			where: { character_id: userId, amount: { [Op.gt]: 0 } },
		});

		const baseIngredients = [];
		for (const item of inventory) {
			const itemDetails = await itemUtility.getItemWithDetails(item.item_id);
			if (itemDetails?.tag && Array.isArray(itemDetails.tag) && itemDetails.tag.includes('base_ingredient')) {
				baseIngredients.push({
					id: item.item_id,
					name: itemDetails.name,
					description: itemDetails.description,
					amount: item.amount,
				});
			}
		}

		if (baseIngredients.length === 0) return false;
		await showIngredientSelection(interaction, baseIngredients);
		return true;
	}
	catch (error) {
		console.error('Error starting cooking:', error);
		return false;
	}
}

// ─────────────────────────────────────────────────────────────────────────────

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
	COOKING_ADDITIVES,
	// Cooking UI handlers
	startCooking,
	handleIngredientSelection,
	handleAdditiveAddition,
	handleCookingFinish,
	handleCookingCancel,
	handleCookingCancelSelection,
	handleEatDish,
	handleFeedMorale,
};
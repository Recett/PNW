const { LocationEvent, CharacterFlag, GlobalFlag } = require('@root/dbObject.js');
const { Op } = require('sequelize');

/**
 * LocationEvent Utility - Main source for adventuring command
 * Replaces the locationInstance system with a more flexible event-based approach
 */
class LocationEventUtility {
	// =========================================================================
	// FLAG NAMING CONVENTION HELPERS
	// =========================================================================

	/**
	 * Get the flag name for tracking location event occurrences
	 * Convention: loc_event_{location_event_id}
	 * @param {number} locationEventId - LocationEvent ID
	 * @returns {string} Flag name
	 */
	static getEventFlagName(locationEventId) {
		return `loc_event_${locationEventId}`;
	}

	/**
	 * Get character's occurrence count for an event
	 * @param {string} characterId - Character ID
	 * @param {number} locationEventId - LocationEvent ID
	 * @returns {number} Occurrence count (0 if not found)
	 */
	static async getCharacterOccurrenceCount(characterId, locationEventId) {
		const flagName = this.getEventFlagName(locationEventId);
		const flag = await CharacterFlag.findOne({
			where: { character_id: characterId, flag: flagName },
		});
		return flag ? flag.value : 0;
	}

	/**
	 * Get server-wide occurrence count for an event
	 * @param {number} locationEventId - LocationEvent ID
	 * @returns {number} Occurrence count (0 if not found)
	 */
	static async getGlobalOccurrenceCount(locationEventId) {
		const flagName = this.getEventFlagName(locationEventId);
		const flag = await GlobalFlag.findOne({
			where: { flag: flagName },
		});
		return flag ? flag.value : 0;
	}

	/**
	 * Increment character's occurrence count for an event
	 * @param {string} characterId - Character ID
	 * @param {number} locationEventId - LocationEvent ID
	 * @returns {number} New occurrence count
	 */
	static async incrementCharacterOccurrence(characterId, locationEventId) {
		const flagName = this.getEventFlagName(locationEventId);
		const [flag, created] = await CharacterFlag.findOrCreate({
			where: { character_id: characterId, flag: flagName },
			defaults: { value: 0 },
		});
		const newValue = (flag.value || 0) + 1;
		await flag.update({ value: newValue });
		return newValue;
	}

	/**
	 * Increment server-wide occurrence count for an event
	 * @param {number} locationEventId - LocationEvent ID
	 * @returns {number} New occurrence count
	 */
	static async incrementGlobalOccurrence(locationEventId) {
		const flagName = this.getEventFlagName(locationEventId);
		const [flag, created] = await GlobalFlag.findOrCreate({
			where: { flag: flagName },
			defaults: { value: 0 },
		});
		const newValue = (flag.value || 0) + 1;
		await flag.update({ value: newValue });
		return newValue;
	}

	/**
	 * Check if event is available based on occurrence limits
	 * @param {Object} event - LocationEvent instance
	 * @param {string} characterId - Character ID
	 * @returns {Object} { available: boolean, reason: string|null }
	 */
	static async checkOccurrenceLimits(event, characterId) {
		// Check server-wide max_occurrences limit
		if (event.max_occurrences !== null && event.max_occurrences > 0) {
			const globalCount = await this.getGlobalOccurrenceCount(event.id);
			if (globalCount >= event.max_occurrences) {
				return {
					available: false,
					reason: 'server_limit_reached',
				};
			}
		}

		// Check per-player is_repeatable limit
		if (!event.is_repeatable) {
			const characterCount = await this.getCharacterOccurrenceCount(characterId, event.id);
			if (characterCount > 0) {
				return {
					available: false,
					reason: 'not_repeatable',
				};
			}
		}

		return { available: true, reason: null };
	}

	/**
	 * Track event occurrence after successful execution
	 * Increments both character and global occurrence counts
	 * @param {Object} event - LocationEvent instance
	 * @param {string} characterId - Character ID
	 * @returns {Object} { characterCount, globalCount }
	 */
	static async trackEventOccurrence(event, characterId) {
		const characterCount = await this.incrementCharacterOccurrence(characterId, event.id);
		const globalCount = await this.incrementGlobalOccurrence(event.id);
		return { characterCount, globalCount };
	}

	// =========================================================================
	// EVENT RETRIEVAL AND SELECTION
	// =========================================================================

	/**
	 * Get available events for a location based on character requirements
	 * @param {string} locationId - Location identifier
	 * @param {Object} character - Character object with level, skills, items, flags
	 * @param {Object} options - Additional filtering options
	 * @returns {Array} Array of available events
	 */
	static async getAvailableEvents(locationId, character, options = {}) {
		const whereConditions = {
			location_id: locationId,
			is_active: true,
			level_requirement: { [Op.lte]: character.level || 1 },
		};

		// Add time restrictions if needed
		if (options.currentTime) {
			// Add time-based filtering logic here
		}

		const events = await LocationEvent.findAll({
			where: whereConditions,
			order: [['event_weight', 'DESC']],
		});

		// Filter events based on requirements and occurrence limits
		const availableEvents = [];
		for (const event of events) {
			// Check basic requirements (skills, items, flags)
			if (!await this.checkEventRequirements(event, character)) {
				continue;
			}

			// Check occurrence limits (is_repeatable, max_occurrences)
			const occurrenceCheck = await this.checkOccurrenceLimits(event, character.id);
			if (!occurrenceCheck.available) {
				continue;
			}

			availableEvents.push(event);
		}

		return availableEvents;
	}

	/**
	 * Select a random event based on weights
	 * @param {Array} events - Array of available events
	 * @returns {Object|null} Selected event or null if none available
	 */
	static selectRandomEvent(events) {
		if (!events || events.length === 0) return null;

		const totalWeight = events.reduce((sum, event) => sum + (event.event_weight || 100), 0);
		let random = Math.random() * totalWeight;

		for (const event of events) {
			random -= (event.event_weight || 100);
			if (random <= 0) {
				return event;
			}
		}

		// Fallback to first event
		return events[0];
	}

	/**
	 * Check if character meets event requirements
	 * @param {Object} event - LocationEvent instance
	 * @param {Object} character - Character object
	 * @returns {boolean} Whether requirements are met
	 */
	static async checkEventRequirements(event, character) {
		// Check skill requirements
		if (event.skill_requirements) {
			const skillReqs = JSON.parse(event.skill_requirements);
			for (const [skillName, requiredLevel] of Object.entries(skillReqs)) {
				const characterSkill = character.skills?.find(s => s.skill_name === skillName);
				if (!characterSkill || characterSkill.level < requiredLevel) {
					return false;
				}
			}
		}

		// Check item requirements
		if (event.item_requirements) {
			const itemReqs = JSON.parse(event.item_requirements);
			for (const [itemName, requiredQuantity] of Object.entries(itemReqs)) {
				const characterItem = character.items?.find(i => i.item_name === itemName);
				if (!characterItem || characterItem.quantity < requiredQuantity) {
					return false;
				}
			}
		}

		// Check flag requirements
		if (event.flag_requirements) {
			const flagReqs = JSON.parse(event.flag_requirements);
			for (const [flagName, requiredValue] of Object.entries(flagReqs)) {
				const characterFlag = character.flags?.find(f => f.flag_name === flagName);
				if (!characterFlag || characterFlag.value !== requiredValue) {
					return false;
				}
			}
		}

		return true;
	}

	// =========================================================================
	// EVENT EXECUTION
	// =========================================================================

	/**
	 * Process event execution
	 * @param {Object} event - LocationEvent instance
	 * @param {Object} character - Character object
	 * @param {Object} interaction - Discord interaction
	 * @returns {Object} Event result
	 */
	static async executeEvent(event, character, interaction) {
		let result = {
			success: false,
			message: '',
			rewards: [],
			consequences: [],
			occurrenceTracking: null,
		};

		try {
			switch (event.event_type) {
			case 'combat':
				result = await this.executeCombatEvent(event, character, interaction);
				break;
			case 'resource':
				result = await this.executeResourceEvent(event, character, interaction);
				break;
			case 'special':
				result = await this.executeSpecialEvent(event, character, interaction);
				break;
			case 'exploration':
				result = await this.executeExplorationEvent(event, character, interaction);
				break;
			default:
				result.message = 'Unknown event type';
			}

			// Apply rewards or consequences
			if (result.success && event.base_rewards) {
				result.rewards = JSON.parse(event.base_rewards);
			}
			else if (!result.success && event.failure_consequences) {
				result.consequences = JSON.parse(event.failure_consequences);
			}

			// Track event occurrence (both character and global)
			result.occurrenceTracking = await this.trackEventOccurrence(event, character.id);

		}
		catch (error) {
			console.error('Error executing event:', error);
			result.message = 'An error occurred while processing the event';
		}

		return result;
	}

	/**
	 * Execute combat event
	 * @param {Object} event - LocationEvent instance
	 * @param {Object} character - Character object
	 * @param {Object} interaction - Discord interaction
	 * @returns {Object} Combat result
	 */
	static async executeCombatEvent(event, character, interaction) {
		const config = JSON.parse(event.event_config || '{}');
		
		// This would integrate with your existing combat system
		// For now, return a placeholder result
		return {
			success: Math.random() > 0.3, // 70% success rate
			message: event.success_message || 'Combat completed!',
			rewards: [],
			consequences: [],
		};
	}

	/**
	 * Execute resource gathering event
	 * @param {Object} event - LocationEvent instance
	 * @param {Object} character - Character object
	 * @param {Object} interaction - Discord interaction
	 * @returns {Object} Resource gathering result
	 */
	static async executeResourceEvent(event, character, interaction) {
		const config = JSON.parse(event.event_config || '{}');
		
		// Implement resource gathering logic
		return {
			success: Math.random() > 0.1, // 90% success rate
			message: event.success_message || 'Resources gathered!',
			rewards: [],
			consequences: [],
		};
	}

	/**
	 * Execute special event
	 * @param {Object} event - LocationEvent instance
	 * @param {Object} character - Character object
	 * @param {Object} interaction - Discord interaction
	 * @returns {Object} Special event result
	 */
	static async executeSpecialEvent(event, character, interaction) {
		// This could integrate with your existing event system
		return {
			success: true,
			message: event.success_message || 'Special event completed!',
			rewards: [],
			consequences: [],
		};
	}

	/**
	 * Execute exploration event
	 * @param {Object} event - LocationEvent instance
	 * @param {Object} character - Character object
	 * @param {Object} interaction - Discord interaction
	 * @returns {Object} Exploration result
	 */
	static async executeExplorationEvent(event, character, interaction) {
		return {
			success: Math.random() > 0.2, // 80% success rate
			message: event.success_message || 'Exploration completed!',
			rewards: [],
			consequences: [],
		};
	}

	/**
	 * Create sample events for a location (for testing/setup)
	 * @param {string} locationId - Location identifier
	 * @returns {Array} Created events
	 */
	static async createSampleEvents(locationId) {
		const sampleEvents = [
			{
				location_id: locationId,
				event_name: 'Goblin Patrol',
				event_type: 'combat',
				event_weight: 150,
				level_requirement: 1,
				event_config: JSON.stringify({
					enemy_ids: [1, 2], // Enemy IDs to fight
					combat_type: 'enemy',
				}),
				description: 'A small patrol of goblins blocks your path.',
				success_message: 'You defeated the goblin patrol!',
				failure_message: 'The goblins overwhelmed you!',
				base_rewards: JSON.stringify({
					experience: 50,
					gold: 25,
				}),
				is_repeatable: true,
				cooldown_time: 300, // 5 minutes
			},
			{
				location_id: locationId,
				event_name: 'Herb Gathering',
				event_type: 'resource',
				event_weight: 200,
				level_requirement: 1,
				event_config: JSON.stringify({
					resource_type: 'herbs',
					skill_required: 'herbalism',
					base_yield: 3,
				}),
				description: 'You spot some valuable herbs growing nearby.',
				success_message: 'You successfully gathered some herbs!',
				failure_message: 'The herbs withered as you tried to pick them.',
				base_rewards: JSON.stringify({
					items: [{ name: 'healing_herb', quantity: 3 }],
				}),
				is_repeatable: true,
				cooldown_time: 600, // 10 minutes
			},
			{
				location_id: locationId,
				event_name: 'Hidden Treasure',
				event_type: 'exploration',
				event_weight: 50,
				level_requirement: 3,
				skill_requirements: JSON.stringify({
					perception: 5,
				}),
				event_config: JSON.stringify({
					discovery_type: 'treasure',
					rarity: 'uncommon',
				}),
				description: 'You notice something glinting in the shadows...',
				success_message: 'You discovered a hidden treasure!',
				failure_message: 'It was just a trick of the light.',
				base_rewards: JSON.stringify({
					gold: 100,
					items: [{ name: 'silver_coin', quantity: 5 }],
				}),
				is_repeatable: false,
				max_occurrences: 1,
			},
		];

		const createdEvents = [];
		for (const eventData of sampleEvents) {
			const event = await LocationEvent.create(eventData);
			createdEvents.push(event);
		}

		return createdEvents;
	}
}

module.exports = LocationEventUtility;
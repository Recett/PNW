const { CharacterQuest, QuestLib } = require('@root/dbObject.js');

/**
 * Character Quest Management Utility
 * Provides functions to track and manage character quest progress
 */
class CharacterQuestManager {
	/**
	 * Start a new quest for a character
	 * @param {string} characterId - Character identifier
	 * @param {number} questId - Quest library ID
	 * @param {Object} initialData - Initial quest data (optional)
	 * @returns {Object} Created quest record
	 */
	static async startQuest(characterId, questId, initialData = {}) {
		// Check if quest already exists for this character
		const existingQuest = await CharacterQuest.findOne({
			where: {
				character_id: characterId,
				quest_id: questId,
			},
		});

		if (existingQuest) {
			throw new Error('Quest already started for this character');
		}

		// Get quest information from library
		const questLib = await QuestLib.findByPk(questId);
		if (!questLib) {
			throw new Error('Quest not found in library');
		}

		const questData = {
			character_id: characterId,
			quest_id: questId,
			status: 'in_progress',
			progress: initialData.progress || {},
			max_progress: questLib.max_progress || {},
			quest_data: initialData,
			objectives: questLib.objectives || [],
			current_stage: 0,
			started_at: new Date(),
			updated_at: new Date(),
		};

		return await CharacterQuest.create(questData);
	}

	/**
	 * Update quest progress
	 * @param {string} characterId - Character identifier
	 * @param {number} questId - Quest library ID
	 * @param {Object|number} progressUpdate - Progress update (object for complex, number for simple)
	 * @param {Object} updateData - Additional data to update
	 * @returns {Object} Updated quest record
	 */
	static async updateProgress(characterId, questId, progressUpdate = {}, updateData = {}) {
		const quest = await CharacterQuest.findOne({
			where: {
				character_id: characterId,
				quest_id: questId,
			},
		});

		if (!quest) {
			throw new Error('Quest not found for this character');
		}

		if (quest.status !== 'in_progress') {
			throw new Error('Cannot update progress on non-active quest');
		}

		// Handle both simple numeric and complex JSON progress
		let newProgress;
		if (typeof progressUpdate === 'number') {
			// Simple numeric progress
			const currentProgress = quest.progress.value || 0;
			newProgress = { ...quest.progress, value: currentProgress + progressUpdate };
		}
		else {
			// Complex JSON progress
			newProgress = { ...quest.progress, ...progressUpdate };
		}

		const updatePayload = {
			progress: newProgress,
			updated_at: new Date(),
			...updateData,
		};

		// Check if quest should be completed based on max_progress criteria
		const isCompleted = this.checkQuestCompletion(newProgress, quest.max_progress);
		if (isCompleted) {
			updatePayload.status = 'completed';
			updatePayload.completed_at = new Date();
		}

		await quest.update(updatePayload);
		return quest.reload();
	}

	/**
	 * Check if quest progress meets completion criteria
	 * @param {Object} progress - Current progress JSON
	 * @param {Object} maxProgress - Maximum progress criteria JSON
	 * @returns {boolean} Whether quest should be completed
	 */
	static checkQuestCompletion(progress, maxProgress) {
		// Handle simple numeric progress
		if (typeof progress.value === 'number' && typeof maxProgress.value === 'number') {
			return progress.value >= maxProgress.value;
		}

		// Handle complex progress with multiple criteria
		for (const [key, maxValue] of Object.entries(maxProgress)) {
			if (progress[key] === undefined || progress[key] < maxValue) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Complete a quest
	 * @param {string} characterId - Character identifier
	 * @param {number} questId - Quest library ID
	 * @param {Object} completionData - Additional completion data
	 * @returns {Object} Updated quest record
	 */
	static async completeQuest(characterId, questId, completionData = {}) {
		const quest = await CharacterQuest.findOne({
			where: {
				character_id: characterId,
				quest_id: questId,
			},
		});

		if (!quest) {
			throw new Error('Quest not found for this character');
		}

		const updatePayload = {
			status: 'completed',
			progress: quest.max_progress,
			completed_at: new Date(),
			updated_at: new Date(),
			...completionData,
		};

		await quest.update(updatePayload);
		return quest.reload();
	}

	/**
	 * Fail a quest
	 * @param {string} characterId - Character identifier
	 * @param {number} questId - Quest library ID
	 * @param {string} reason - Reason for failure
	 * @returns {Object} Updated quest record
	 */
	static async failQuest(characterId, questId, reason = null) {
		const quest = await CharacterQuest.findOne({
			where: {
				character_id: characterId,
				quest_id: questId,
			},
		});

		if (!quest) {
			throw new Error('Quest not found for this character');
		}

		const updatePayload = {
			status: 'failed',
			completed_at: new Date(),
			updated_at: new Date(),
		};

		if (reason) {
			updatePayload.notes = reason;
		}

		await quest.update(updatePayload);
		return quest.reload();
	}

	/**
	 * Abandon a quest
	 * @param {string} characterId - Character identifier
	 * @param {number} questId - Quest library ID
	 * @returns {Object} Updated quest record
	 */
	static async abandonQuest(characterId, questId) {
		const quest = await CharacterQuest.findOne({
			where: {
				character_id: characterId,
				quest_id: questId,
			},
		});

		if (!quest) {
			throw new Error('Quest not found for this character');
		}

		const updatePayload = {
			status: 'abandoned',
			completed_at: new Date(),
			updated_at: new Date(),
		};

		await quest.update(updatePayload);
		return quest.reload();
	}

	/**
	 * Get all quests for a character
	 * @param {string} characterId - Character identifier
	 * @param {string} status - Filter by status (optional)
	 * @returns {Array} Array of character quests
	 */
	static async getCharacterQuests(characterId, status = null) {
		const whereConditions = { character_id: characterId };
		
		if (status) {
			whereConditions.status = status;
		}

		return await CharacterQuest.findAll({
			where: whereConditions,
			include: [{
				model: QuestLib,
				as: 'quest',
				required: false,
			}],
			order: [['started_at', 'DESC']],
		});
	}

	/**
	 * Get active quests for a character
	 * @param {string} characterId - Character identifier
	 * @returns {Array} Array of in-progress quests
	 */
	static async getActiveQuests(characterId) {
		return await this.getCharacterQuests(characterId, 'in_progress');
	}

	/**
	 * Get completed quests for a character
	 * @param {string} characterId - Character identifier
	 * @returns {Array} Array of completed quests
	 */
	static async getCompletedQuests(characterId) {
		return await this.getCharacterQuests(characterId, 'completed');
	}

	/**
	 * Update quest stage/phase
	 * @param {string} characterId - Character identifier
	 * @param {number} questId - Quest library ID
	 * @param {number} newStage - New stage number
	 * @param {Object} stageData - Stage-specific data
	 * @returns {Object} Updated quest record
	 */
	static async updateStage(characterId, questId, newStage, stageData = {}) {
		const quest = await CharacterQuest.findOne({
			where: {
				character_id: characterId,
				quest_id: questId,
			},
		});

		if (!quest) {
			throw new Error('Quest not found for this character');
		}

		const updatePayload = {
			current_stage: newStage,
			updated_at: new Date(),
			quest_data: { ...quest.quest_data, ...stageData },
		};

		await quest.update(updatePayload);
		return quest.reload();
	}

	/**
	 * Update quest objectives
	 * @param {string} characterId - Character identifier
	 * @param {number} questId - Quest library ID
	 * @param {Array} objectives - Updated objectives array
	 * @returns {Object} Updated quest record
	 */
	static async updateObjectives(characterId, questId, objectives) {
		const quest = await CharacterQuest.findOne({
			where: {
				character_id: characterId,
				quest_id: questId,
			},
		});

		if (!quest) {
			throw new Error('Quest not found for this character');
		}

		const updatePayload = {
			objectives,
			updated_at: new Date(),
		};

		await quest.update(updatePayload);
		return quest.reload();
	}

	/**
	 * Check if character has completed a specific quest
	 * @param {string} characterId - Character identifier
	 * @param {number} questId - Quest library ID
	 * @returns {boolean} True if quest is completed
	 */
	static async hasCompletedQuest(characterId, questId) {
		const quest = await CharacterQuest.findOne({
			where: {
				character_id: characterId,
				quest_id: questId,
				status: 'completed',
			},
		});

		return !!quest;
	}

	/**
	 * Get quest statistics for a character
	 * @param {string} characterId - Character identifier
	 * @returns {Object} Quest statistics
	 */
	static async getQuestStats(characterId) {
		const quests = await CharacterQuest.findAll({
			where: { character_id: characterId },
			attributes: ['status'],
		});

		const stats = {
			total: quests.length,
			in_progress: 0,
			completed: 0,
			failed: 0,
			abandoned: 0,
		};

		quests.forEach(quest => {
			if (Object.prototype.hasOwnProperty.call(stats, quest.status)) {
				stats[quest.status]++;
			}
		});

		return stats;
	}
}

module.exports = CharacterQuestManager;
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase, CharacterItem, LocationBase, GlobalFlag } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const itemUtility = require('@utility/itemUtility.js');
const locationUtility = require('@utility/locationUtility.js');
const specialEventUtil = require('@utility/specialEventUtility.js');
const eventUtility = require('@utility/eventUtility.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('cook')
		.setDescription('Start cooking with ingredients and spices')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			const userId = interaction.user.id;

			// Check if character exists
			const character = await CharacterBase.findOne({
				where: { id: userId }
			});

			if (!character) {
				return interaction.reply({
					content: 'You need to register a character first! Use `/register` to get started.',
					flags: MessageFlags.Ephemeral
				});
			}

			// Check unregistered flag
			const unregisteredFlag = await characterUtil.getCharacterFlag(userId, 'unregistered');
			if (unregisteredFlag) {
				return interaction.reply({
					content: 'Complete your character registration first!',
					flags: MessageFlags.Ephemeral
				});
			}

			// Check if location has kitchen tag
			const location = await LocationBase.findByPk(character.location_id);

			if (!location || !location.tag || !Array.isArray(location.tag) || !location.tag.includes('kitchen')) {
				return interaction.reply({
					content: 'You need to be in a kitchen to cook! Find a location with cooking facilities.',
					flags: MessageFlags.Ephemeral
				});
			}

			// Check if already has active cooking session
			const existingSession = await specialEventUtil.getCurrentCookingSession(userId);
			if (existingSession) {
				return await showCookingInterface(interaction, userId, existingSession);
			}

			// Get base ingredients from inventory
			const inventory = await CharacterItem.findAll({
				where: { character_id: userId, amount: { [require('sequelize').Op.gt]: 0 } }
			});

			const baseIngredients = [];
			for (const item of inventory) {
				const itemDetails = await itemUtility.getItemWithDetails(item.item_id);
				if (itemDetails && itemDetails.tag && Array.isArray(itemDetails.tag) && itemDetails.tag.includes('base_ingredient')) {
					baseIngredients.push({
						id: item.item_id,
						name: itemDetails.name,
						description: itemDetails.description,
						amount: item.amount
					});
				}
			}

			if (baseIngredients.length === 0) {
				return interaction.reply({
					content: 'You don\'t have any base ingredients to cook with! Look for items that can be used as cooking bases.',
					flags: MessageFlags.Ephemeral
				});
			}

			// Show base ingredient selection
			await showIngredientSelection(interaction, baseIngredients);

		}
		catch (error) {
			console.error('Error in cook command:', error);
			return interaction.reply({
				content: 'An error occurred while trying to cook.',
				flags: MessageFlags.Ephemeral
			});
		}
	}
};

async function showIngredientSelection(interaction, ingredients) {
	const embed = new EmbedBuilder()
		.setTitle('🍳 Choose Base Ingredient')
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
		.setEmoji('❌');

	const selectRow = new ActionRowBuilder().addComponents(selectMenu);
	const buttonRow = new ActionRowBuilder().addComponents(cancelButton);

	await interaction.reply({
		embeds: [embed],
		components: [selectRow, buttonRow],
		flags: MessageFlags.Ephemeral
	});
}

async function showCookingInterface(interaction, userId, session) {
	const embed = new EmbedBuilder()
		.setTitle('🍳 Cooking in Progress')
		.setDescription(`**Base:** ${session.baseIngredient.name}\n**The dish is:** ${session.traits.length > 0 ? session.traits.map(t => `[${t}]`).join(' ') : 'Plain'}\n**Additives Used:** ${session.additivesUsed.length}`)
		.setColor(0xFF6B35);

	const availableAdditives = specialEventUtil.getAvailableAdditives();
	const additiveOptions = availableAdditives.map(additive => ({
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
		.setEmoji('✅');

	const cancelButton = new ButtonBuilder()
		.setCustomId('cook_cancel')
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger)
		.setEmoji('❌');

	const additiveRow = new ActionRowBuilder().addComponents(selectMenu);
	const buttonRow = new ActionRowBuilder().addComponents(finishButton, cancelButton);

	const method = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
	await interaction[method]({
		embeds: [embed],
		components: [additiveRow, buttonRow],
		flags: MessageFlags.Ephemeral
	});
}

// Handle ingredient selection
async function handleIngredientSelection(interaction) {
	const userId = interaction.user.id;
	const ingredientId = interaction.values[0];

	try {
		// Get ingredient details
		const ingredient = await itemUtility.getItemWithDetails(ingredientId);
		if (!ingredient) {
			return interaction.reply({
				content: 'Selected ingredient not found.',
				flags: MessageFlags.Ephemeral
			});
		}

		// Check if player still has the ingredient
		const characterItem = await CharacterItem.findOne({
			where: { character_id: userId, item_id: ingredientId, amount: { [require('sequelize').Op.gt]: 0 } }
		});

		if (!characterItem) {
			return interaction.reply({
				content: 'You no longer have this ingredient.',
				flags: MessageFlags.Ephemeral
			});
		}

		// Consume the ingredient immediately
		const character = await CharacterBase.findOne({ where: { id: userId } });
		await characterUtil.removeCharacterItem(character.id, ingredientId, 1);

		// Consume 5 stamina for starting to cook
		await characterUtil.modifyCharacterStat(userId, 'stamina', -5, 'add');

		// Start cooking session with any initial traits from the ingredient
		const initialTraits = ingredient.metadata?.initialTraits || [];
		const result = await specialEventUtil.startCookingSession(userId, ingredientId, { initialTraits });

		if (!result.success) {
			return interaction.reply({
				content: result.message,
				flags: MessageFlags.Ephemeral
			});
		}

		await showCookingInterface(interaction, userId, result.session);

	}
	catch (error) {
		console.error('Error handling ingredient selection:', error);
		await interaction.reply({
			content: 'An error occurred while starting to cook.',
			flags: MessageFlags.Ephemeral
		});
	}
}

// Handle additive addition
async function handleAdditiveAddition(interaction) {
	const userId = interaction.user.id;
	const additiveId = interaction.values[0];

	try {
		const result = await specialEventUtil.addAdditiveToSession(userId, additiveId, { requireAdditiveItem: false });
		
		if (!result.success) {
			return interaction.reply({
				content: result.message,
				flags: MessageFlags.Ephemeral
			});
		}

		// Consume 2 stamina for adding additive
		await characterUtil.modifyCharacterStat(userId, 'stamina', -2, 'add');

		await showCookingInterface(interaction, userId, result.session);

	}
	catch (error) {
		console.error('Error adding additive:', error);
		await interaction.reply({
			content: 'An error occurred while adding the additive.',
			flags: MessageFlags.Ephemeral
		});
	}
}

// Handle cooking completion
async function handleCookingFinish(interaction) {
	const userId = interaction.user.id;

	try {
		const result = await specialEventUtil.finishCookingSession(userId);
		
		if (!result.success) {
			return interaction.reply({
				content: result.message,
				flags: MessageFlags.Ephemeral
			});
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
				{
					name: 'The dish is',
					value: dish.traits.length > 0 ? dish.traits.map(t => `[${t}]`).join(' ') : 'Plain',
					inline: false
				},
				{
					name: 'Quality',
					value: dish.quality,
					inline: true
				},
				{
					name: 'Score',
					value: dish.score.toString(),
					inline: true
				},
				{
					name: 'Additives Used',
					value: dish.additivesUsed.length > 0 ? dish.additivesUsed.join(', ') : 'None',
					inline: true
				}
			])
			.setColor(dish.score > 50 ? 0x00FF00 : dish.score > 25 ? 0xFFD700 : 0xFF6B35);

		const eatButton = new ButtonBuilder()
			.setCustomId('cook_eat')
			.setLabel('Eat')
			.setStyle(ButtonStyle.Success);

		const feedMoraleButton = new ButtonBuilder()
			.setCustomId('cook_feed_morale')
			.setLabel('Feed to Lt. Morale')
			.setStyle(ButtonStyle.Primary);

		const cookingUnlocked = await GlobalFlag.findOne({ where: { flag: 'global.cooking_unlocked' } });
		const resultComponents = cookingUnlocked && Number(cookingUnlocked.value) === 1
			? [eatButton, feedMoraleButton]
			: [eatButton];
		const resultRow = new ActionRowBuilder().addComponents(resultComponents);

		await interaction.update({
			embeds: [embed],
			components: [resultRow]
		});

	}
	catch (error) {
		console.error('Error finishing cooking:', error);
		await interaction.reply({
			content: 'An error occurred while finishing cooking.',
			flags: MessageFlags.Ephemeral
		});
	}
}

// Handle cooking cancellation
async function handleCookingCancel(interaction) {
	const userId = interaction.user.id;

	try {
		// Clear the cooking session
		await require('@root/dbObject.js').CharacterFlag.destroy({
			where: {
				character_id: userId,
				flag_name: 'active_cooking_session'
			}
		});

		await interaction.update({
			content: '❌ Cooking cancelled. The session has been cleared.',
			embeds: [],
			components: []
		});

	}
	catch (error) {
		console.error('Error cancelling cooking:', error);
		await interaction.reply({
			content: 'An error occurred while cancelling.',
			flags: MessageFlags.Ephemeral
		});
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

/**
 * Returns null if any negative trait is present (all buffs blocked).
 * Returns array of { stat_target, potency } for each stat that received >= 1 vote.
 * potency = votes * quality_multiplier (before per-stat multiplier).
 */
function getDishBuff(traits, quality) {
	if (!traits || traits.length === 0) return [];
	if (traits.some(t => FOOD_NEGATIVE_TRAITS.includes(t))) return null;

	const qualityMult = FOOD_QUALITY_MULT[quality] || 1;
	const votes = {};
	for (const trait of traits) {
		const stat = FOOD_TRAIT_STATS[trait];
		if (stat) votes[stat] = (votes[stat] || 0) + 1;
	}

	return Object.entries(votes).map(([stat_target, count]) => ({
		stat_target,
		potency: count * qualityMult,
	}));
}

// Handle the player eating the finished dish
async function handleEatDish(interaction) {
	const userId = interaction.user.id;
	try {
		const { CharacterFlag, CharacterStatus } = require('@root/dbObject.js');

		const dishFlag = await CharacterFlag.findOne({
			where: { character_id: userId, flag: 'latest_cooked_dish' },
		});

		if (!dishFlag) {
			return interaction.reply({
				content: 'There is no dish available to eat.',
				flags: MessageFlags.Ephemeral,
			});
		}

		const dish = JSON.parse(dishFlag.value);

		// Clear existing food buff and the dish flag
		await CharacterStatus.destroy({ where: { character_id: userId, source: 'food' } });
		await CharacterFlag.destroy({ where: { character_id: userId, flag: 'latest_cooked_dish' } });

		const buffs = getDishBuff(dish.traits, dish.quality);
		let buffDescription;

		if (buffs === null) {
			buffDescription = 'This dish had spoiled traits. No buff was granted.';
		}
		else if (buffs.length === 0) {
			buffDescription = 'The dish was too plain to provide any benefit.';
		}
		else {
			for (const buff of buffs) {
				await CharacterStatus.create({
					character_id: userId,
					status_id: 'food_buff',
					category: 'buff',
					scope: 'persistent',
					stat_target: buff.stat_target,
					value_type: 'flat',
					potency: buff.potency,
					duration: 3600,
					duration_unit: 'seconds',
					expires_at: new Date(Date.now() + 3600 * 1000),
					source: 'food',
				});
			}
			await characterUtil.recalculateCharacterStats({ id: userId });
			const buffList = buffs
				.map(b => `+${Math.floor(b.potency * FOOD_STAT_MULT[b.stat_target])} ${FOOD_STAT_LABEL[b.stat_target]}`)
				.join(', ');
			buffDescription = `You feel invigorated! **${buffList}** applied.`;
		}

		const embed = new EmbedBuilder()
			.setTitle('You ate the dish!')
			.setDescription(`**${dish.name}**\n\n${buffDescription}`)
			.setColor(buffs && buffs.length > 0 ? 0x00FF00 : 0x888888);

		await interaction.update({
			embeds: [embed],
			components: [],
		});
	}
	catch (error) {
		console.error('Error eating dish:', error);
		await interaction.reply({
			content: 'An error occurred while eating.',
			flags: MessageFlags.Ephemeral,
		});
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

// Handle feeding a finished dish to Lt. Morale
async function handleFeedMorale(interaction) {
	const userId = interaction.user.id;
	try {
		const dishJson = await characterUtil.getCharacterFlag(userId, 'latest_cooked_dish');
		if (!dishJson) {
			return interaction.reply({
				content: 'There is no dish available to feed.',
				flags: MessageFlags.Ephemeral,
			});
		}

		const dish = JSON.parse(dishJson);
		const score = dish.score ?? 0;
		const tier = getMoraleReactionTier(score);

		// Update high score (only stored if > 0)
		const currentHigh = await characterUtil.getCharacterFlag(userId, 'lt_morale_cook_high_score');
		const newHigh = Math.max(currentHigh ?? 0, score);
		if (newHigh > 0) {
			await characterUtil.updateCharacterFlag(userId, 'lt_morale_cook_high_score', newHigh);
		}

		// Update accumulated score
		const currentAccum = await characterUtil.getCharacterFlag(userId, 'lt_morale_cook_accumulated');
		const newAccum = (currentAccum ?? 0) + score;
		if (newAccum > 0) {
			await characterUtil.updateCharacterFlag(userId, 'lt_morale_cook_accumulated', newAccum);
		}

		// Clear the dish flag (consumed by feeding)
		await characterUtil.updateCharacterFlag(userId, 'latest_cooked_dish', null);

		// Fire the appropriate Morale reaction event
		await eventUtility.processEvent(`lt-morale-reaction-${tier}`, interaction, userId, {});
	}
	catch (error) {
		console.error('Error feeding dish to Lt. Morale:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({
				content: 'An error occurred while feeding the dish.',
				flags: MessageFlags.Ephemeral,
			});
		}
	}
}

// Handle cooking cancellation during ingredient selection
async function handleCookingCancelSelection(interaction) {
	try {
		await interaction.update({
			content: '❌ Cooking cancelled.',
			embeds: [],
			components: []
		});
	}
	catch (error) {
		console.error('Error cancelling ingredient selection:', error);
		await interaction.reply({
			content: 'An error occurred while cancelling.',
			flags: MessageFlags.Ephemeral
		});
	}
}

// Export handlers for use in interactionCreate event
module.exports.handleIngredientSelection = handleIngredientSelection;
module.exports.handleAdditiveAddition = handleAdditiveAddition;
module.exports.handleCookingFinish = handleCookingFinish;
module.exports.handleCookingCancel = handleCookingCancel;
module.exports.handleCookingCancelSelection = handleCookingCancelSelection;
module.exports.handleEatDish = handleEatDish;
module.exports.handleFeedMorale = handleFeedMorale;
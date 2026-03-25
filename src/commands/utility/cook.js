const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase, CharacterItem, LocationBase } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const itemUtility = require('@utility/itemUtility.js');
const locationUtility = require('@utility/locationUtility.js');
const specialEventUtil = require('@utility/specialEventUtility.js');

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
		const embed = new EmbedBuilder()
			.setTitle('🍽️ Cooking Complete!')
			.setDescription(`**${dish.name}**\n${dish.description}`)
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

		await interaction.update({
			embeds: [embed],
			components: []
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
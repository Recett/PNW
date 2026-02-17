const { Collection, Events, MessageFlags } = require('discord.js');
const Discord = require('discord.js');
const PFB = Discord.PermissionFlagsBits;

function checkUserPermission(ia, command) {
	switch (command.authority) {
	case 'developer':
		return ia.user.id == '275992469764833280';
	case 'owner':
		return ia.member == ia.guild.owner;
	case 'administrators':
		return ia.member.permissions.has(PFB.Administrator);
	case 'moderators':
		return ia.member.permissions.has(PFB.Administrator);
	case 'dungeonmasters':
		return ia.guild.id == ia.client.data.tlg.id
			? ia.member.roles.cache.find((r) => r.id == ia.client.data.tlg.dmRoleID) ||
					ia.member.roles.cache.find((r) => r.id == ia.client.data.tlg.modRoleID) ||
					ia.member.permissions.has(PFB.Administrator)
			: ia.member.permissions.has(PFB.Administrator);
	default:
		return true;
	}
}

function checkBotPermission(ia) {
	if (ia.channel.type == 'dm') return true;
	/*	if (!ia.guild.members.me.permissions.has([...command.botPermissions, PFB.SendMessages])) {
		ia.reply({
			content:
				'Cannot execute the command because the bot lacks the following permissions:\n' +
				`\`${ia.guild.members.me.permissions.missing(Discord.PermissionsBitField.resolve(command.botPermissions))}\``,
			flags: MessageFlags.Ephemeral,
		});
		return false;
	}*/
	return true;
}

// Handle interview-related button interactions
async function handleInterviewInteraction(interaction) {
	const customId = interaction.customId;
	if (!customId.startsWith('start_interview|')) return false;

	const parts = customId.split('|');
	// Format: start_interview|{userId}|{eventId}
	const targetUserId = parts[1];
	const eventId = parts[2];

	// Verify the button was clicked by the correct user
	if (interaction.user.id !== targetUserId) {
		await interaction.reply({
			content: 'This interview is not for you.',
			ephemeral: true,
		});
		return true;
	}

	try {
		// Check if user has a character
		const { getCharacterBase } = require('../utility/characterUtility');
		const character = await getCharacterBase(interaction.user.id);
		if (!character) {
			await interaction.reply({
				content: 'You need a character to proceed with the interview.',
				ephemeral: true,
			});
			return true;
		}

		// Disable the button
		await interaction.update({
			components: [],
		});

		// Process the interview event if it exists
		if (eventId && eventId !== 'default') {
			const eventUtil = interaction.client.eventUtil;
			if (eventUtil) {
				try {
					await eventUtil.processEvent(eventId, interaction, interaction.user.id, {
						ephemeral: false,
					});
				}
				catch (eventError) {
					console.error('Error processing interview event:', eventError);
					await interaction.followUp({
						content: 'The interview event could not be started. The event may not exist or is inactive. Please contact an administrator.',
						ephemeral: true,
					});
				}
			}
			else {
				await interaction.followUp({
					content: 'The interview event could not be started. Please contact an administrator.',
					ephemeral: true,
				});
			}
		}
		else {
			// No interview event configured - just acknowledge
			await interaction.followUp({
				content: 'Welcome! Your registration is complete. An administrator will be with you shortly.',
				ephemeral: false,
			});
		}
	}
	catch (error) {
		console.error('Interview interaction error:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({
				content: 'An error occurred while starting the interview.',
				ephemeral: true,
			});
		}
	}

	return true;
}

// Handle trade-related button and select menu interactions
async function handleTradeInteraction(interaction) {
	const customId = interaction.customId;
	if (!customId.startsWith('trade_')) return false;

	const { getCharacterBase } = require('../utility/characterUtility');
	const tradeUtility = require('../utility/tradeUtility');
	const { Trade, TradeItem, CharacterItem, ItemLib, CharacterBase } = require('../dbObject');

	// Initialize trade utility models if not already done
	tradeUtility.initModels({ Trade, TradeItem, CharacterItem, ItemLib, CharacterBase });

	const character = await getCharacterBase(interaction.user.id);
	if (!character) {
		await interaction.reply({ content: 'You need a character to trade.', ephemeral: true });
		return true;
	}

	const parts = customId.split('_');
	const action = parts[1];
	const tradeId = parseInt(parts[2]);

	try {
		if (action === 'accept') {
			const result = await tradeUtility.acceptTrade(tradeId, character.id);
			if (!result.success) {
				return interaction.reply({ content: result.error, ephemeral: true });
			}
			const embed = await tradeUtility.buildTradeEmbed(result.trade);
			await interaction.update({ embeds: [embed], components: [] });
			await interaction.followUp({ content: 'Trade accepted! Use `/trade add` to add items, then `/trade confirm` when ready.', ephemeral: true });
		}
		else if (action === 'decline') {
			const result = await tradeUtility.cancelTrade(tradeId, character.id);
			if (!result.success) {
				return interaction.reply({ content: result.error, ephemeral: true });
			}
			const trade = await Trade.findByPk(tradeId);
			const embed = await tradeUtility.buildTradeEmbed(trade);
			embed.setColor(0xFF0000);
			embed.setDescription('❌ Trade was declined.');
			await interaction.update({ embeds: [embed], components: [] });
		}
		else if (action === 'confirm') {
			const result = await tradeUtility.confirmTrade(tradeId, character.id);
			if (!result.success) {
				return interaction.reply({ content: result.error, ephemeral: true });
			}
			if (result.bothConfirmed) {
				const trade = await Trade.findByPk(tradeId);
				const embed = await tradeUtility.buildTradeEmbed(trade);
				embed.setColor(0x00FF00);
				embed.setDescription('✅ Trade completed successfully!');
				await interaction.update({ embeds: [embed], components: [] });
			}
			else {
				const trade = await Trade.findByPk(tradeId);
				const embed = await tradeUtility.buildTradeEmbed(trade);
				const isInitiator = trade.initiator_id === character.id;
				const buttons = tradeUtility.buildTradeButtons(trade, isInitiator);
				await interaction.update({ embeds: [embed], components: buttons });
			}
		}
		else if (action === 'cancel') {
			const result = await tradeUtility.cancelTrade(tradeId, character.id);
			if (!result.success) {
				return interaction.reply({ content: result.error, ephemeral: true });
			}
			const trade = await Trade.findByPk(tradeId);
			const embed = await tradeUtility.buildTradeEmbed(trade);
			embed.setColor(0xFF0000);
			embed.setDescription('❌ Trade was cancelled.');
			await interaction.update({ embeds: [embed], components: [] });
		}
		else if (action === 'add' && parts[2] === 'item') {
			// Handle select menu for adding items
			const actualTradeId = parseInt(parts[3]);
			const [charItemId, quantity] = interaction.values[0].split('_').map(v => parseInt(v));
			const result = await tradeUtility.addItemToTrade(actualTradeId, character.id, charItemId, quantity);
			if (!result.success) {
				return interaction.reply({ content: result.error, ephemeral: true });
			}
			await interaction.reply({ content: '✅ Item added to trade. Use `/trade view` to see the current trade.', ephemeral: true });
		}
		else if (action === 'remove' && parts[2] === 'item') {
			// Handle select menu for removing items
			const actualTradeId = parseInt(parts[3]);
			const charItemId = parseInt(interaction.values[0]);
			const result = await tradeUtility.removeItemFromTrade(actualTradeId, character.id, charItemId);
			if (!result.success) {
				return interaction.reply({ content: result.error, ephemeral: true });
			}
			await interaction.reply({ content: '✅ Item removed from trade. Use `/trade view` to see the current trade.', ephemeral: true });
		}
	}
	catch (error) {
		console.error('Trade interaction error:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: 'An error occurred while processing the trade.', ephemeral: true });
		}
	}

	return true;
}

// Handle location exit button interactions
async function handleLocationExitButton(interaction) {
	if (!interaction.isButton()) return false;
	if (!interaction.customId.startsWith('location_exit_')) return false;

	const { CharacterBase, LocationBase } = require('../dbObject.js');
	const locationUtil = require('../utility/locationUtility.js');

	try {
		const locationId = parseInt(interaction.customId.split('_')[2]);
		const userId = interaction.user.id;

		// Get character
		const character = await CharacterBase.findOne({
			where: { id: userId },
		});

		if (!character) {
			await interaction.reply({ content: 'You do not have a registered character.', flags: MessageFlags.Ephemeral });
			return true;
		}

		// Get linked locations
		const linkedLocations = await locationUtil.getLinkedLocations(locationId);
		
		// Get cluster locations
		const clusterLocations = await locationUtil.getLocationinCluster(locationId);
		
		// Combine linked and cluster locations (avoid duplicates)
		const allPossibleLocations = new Set();
		
		// Add linked location IDs
		for (const link of linkedLocations) {
			allPossibleLocations.add(link.link_id);
		}
		
		// Add cluster location IDs (excluding current location)
		for (const clusterLoc of clusterLocations) {
			if (clusterLoc.location_id !== locationId) {
				allPossibleLocations.add(clusterLoc.location_id);
			}
		}
		
		// Filter out locked locations
		const unlockedLocationIds = [];
		for (const locId of allPossibleLocations) {
			const loc = await LocationBase.findByPk(locId);
			if (loc && !loc.lock) {
				unlockedLocationIds.push(locId);
			}
		}
		
		let targetLocationId;
		if (unlockedLocationIds.length > 0) {
			// Move to a random unlocked location
			targetLocationId = unlockedLocationIds[Math.floor(Math.random() * unlockedLocationIds.length)];
		}
		else {
			// No unlocked locations found
			await interaction.reply({ content: 'Cannot leave this location - no unlocked exit found.', flags: MessageFlags.Ephemeral });
			return true;
		}

		// Get target location info
		const targetLocation = await LocationBase.findByPk(targetLocationId);
		if (!targetLocation) {
			await interaction.reply({ content: 'Error: Destination location not found.', flags: MessageFlags.Ephemeral });
			return true;
		}

		// Move character
		await locationUtil.moveCharacterToLocation(character.id, targetLocationId, interaction.guild);

		await interaction.reply({
			content: `🚪 You have left the locked location and moved to **${targetLocation.name}**.`,
			flags: MessageFlags.Ephemeral,
		});
	}
	catch (error) {
		console.error('Location exit button error:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({ content: 'An error occurred while leaving the location.', flags: MessageFlags.Ephemeral });
		}
	}

	return true;
}

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		// Handle button interactions
		if (interaction.isButton() || interaction.isStringSelectMenu()) {
			// Check for interview interactions
			if (await handleInterviewInteraction(interaction)) return;
			// Check for trade interactions
			if (await handleTradeInteraction(interaction)) return;
			// Check for location exit button
			if (await handleLocationExitButton(interaction)) return;
			// Add other button/select handlers here as needed
			return;
		}

		// Handle modal submissions
		if (interaction.isModalSubmit()) {
			try {
				if (interaction.customId === 'register_character_modal') {
					const registerCommand = require('../commands/utility/register.js');
					await registerCommand.handleModal(interaction);
					return;
				}
				if (interaction.customId === 'narrate_modal') {
					const narrateCommand = require('../commands/admin/narrate.js');
					await narrateCommand.handleModal(interaction);
					return;
				}
				if (interaction.customId.startsWith('location_lock_modal_')) {
					const locationCommand = require('../commands/admin/location.js');
					await locationCommand.handleLockModal(interaction);
					return;
				}
				// Add other modal handlers here
			}
			catch (error) {
				console.error('Error handling modal submission:', error);
				if (!interaction.replied && !interaction.deferred) {
					await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
				}
			}
			return;
		}

		if (!interaction.isChatInputCommand()) return;

		// Check developer mode
		/*	if ((ia.client.developerMode && ia.user.id != process.env.OWNER_ID)
			return interaction.reply({ content: pickRandom(ia.client.data.replies.developerMode) });*/
		// let [subcommand, subgroup] = [ia.options.getSubcommand(false), ia.options.getSubcommandGroup(false)];
		const command = interaction.client.commands.get(interaction.commandName);

		// Check permissions
		if (!checkUserPermission(interaction, command)) return interaction.reply({ content: 'Permission denied.' });
		if (!checkBotPermission(interaction)) return;
		// interaction.client.log("COMMAND", commandLog(interaction, subcommand, subgroup), 2, 0);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}


		const { cooldowns } = interaction.client;

		if (!cooldowns.has(command.data.name)) {
			cooldowns.set(command.data.name, new Collection());
		}

		const now = Date.now();
		const timestamps = cooldowns.get(command.data.name);
		const defaultCooldownDuration = 3;
		const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

		if (timestamps.has(interaction.user.id)) {
			const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

			if (now < expirationTime) {
				const expiredTimestamp = Math.round(expirationTime / 1_000);
				return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, flags: MessageFlags.Ephemeral });
			}
		}

		timestamps.set(interaction.user.id, now);
		setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

		try {
			await command.execute(interaction);
		}
		catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
			}
		}
	},
};

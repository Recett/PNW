const { Collection, Events, MessageFlags } = require('discord.js');
const Discord = require('discord.js');
const PFB = Discord.PermissionFlagsBits;
const { ADMIN_IDS } = require('../config/admins');

function checkUserPermission(ia, command) {
	switch (command.authority) {
	case 'developer':
		return ADMIN_IDS.has(ia.user.id);
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
	const { Trade } = require('../dbObject.js');

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
			allPossibleLocations.add(link.linked_location_id);
		}
		
		// Add cluster location IDs (excluding current location)
		for (const clusterLoc of clusterLocations) {
			if (clusterLoc.location_id !== locationId) {
				allPossibleLocations.add(clusterLoc.location_id);
			}
		}
		
		// Filter out locked locations (lock is runtime DB state, not YAML)
		// If character is at 0 HP, also filter out non-town locations
		const isWounded = (character.currentHp ?? 0) <= 0;
		const unlockedLocationIds = [];
		for (const locId of allPossibleLocations) {
			const loc = await LocationBase.findByPk(locId);
			if (loc && !loc.lock && (!isWounded || (loc.type && loc.type.toLowerCase() === 'town'))) {
				unlockedLocationIds.push(locId);
			}
		}
		
		let targetLocationId;
		if (unlockedLocationIds.length > 0) {
			// Move to a random unlocked location
			targetLocationId = unlockedLocationIds[Math.floor(Math.random() * unlockedLocationIds.length)];
		}
		else {
			// No unlocked locations found (or all filtered out due to low HP)
			const msg = isWounded
				? 'You are too wounded to leave — no town-type exit is available from here. Rest here and recover.'
				: 'Cannot leave this location - no unlocked exit found.';
			await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
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

		// Post move activity messages
		const characterName = character.name || `<@${character.id}>`;
		const characterGender = character?.gender;
		await locationUtil.postLocationActivity(interaction.client, locationId, characterName, 'depart', characterGender).catch(() => null);
		await locationUtil.postLocationActivity(interaction.client, targetLocationId, characterName, 'arrive', characterGender).catch(() => null);

		let exitReplyContent = `\uD83D\uDEAA You have left the locked location and moved to **${targetLocation.name}**.`;
		await interaction.reply({
			content: exitReplyContent,
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

// Handle cooking-related button and select menu interactions  
async function handleCookingInteraction(interaction) {
	const customId = interaction.customId;
	if (!customId.startsWith('cook_')) return false;

	try {
		const cookCommand = require('@utility/specialEventUtility.js');
		
		if (customId === 'cook_select_ingredient') {
			await cookCommand.handleIngredientSelection(interaction);
		}
		else if (customId === 'cook_add_spice' || customId === 'cook_add_additive') {
			await cookCommand.handleAdditiveAddition(interaction);
		}
		else if (customId === 'cook_finish') {
			await cookCommand.handleCookingFinish(interaction);
		}
		else if (customId === 'cook_cancel') {
			await cookCommand.handleCookingCancel(interaction);
		}
		else if (customId === 'cook_cancel_selection') {
			await cookCommand.handleCookingCancelSelection(interaction);
		}
		else if (customId === 'cook_eat') {
			await cookCommand.handleEatDish(interaction);
		}
		else if (customId === 'cook_feed_morale') {
			await cookCommand.handleFeedMorale(interaction);
		}
		else {
			return false; // Not a cooking interaction
		}
		
		return true;
	}
	catch (error) {
		console.error('Cooking interaction error:', error);
		if (!interaction.replied && !interaction.deferred) {
			await interaction.reply({
				content: 'An error occurred while processing the cooking interaction.',
				ephemeral: true,
			});
		}
		return true;
	}
}

// Handle character delete button/modal interactions
async function handleCharDeleteInteraction(interaction) {
	if (!interaction.isButton()) return false;
	const customId = interaction.customId;

	if (customId === 'char_delete_cancel') {
		await interaction.update({ content: 'Character deletion cancelled.', embeds: [], components: [] });
		return true;
	}

	if (!customId.startsWith('char_delete_confirm|')) return false;

	const parts = customId.split('|');
	const targetId = parts[1];
	const actingUserId = parts[2];

	// Only the person who initiated the command can confirm
	if (interaction.user.id !== actingUserId) {
		await interaction.reply({ content: 'This confirmation is not for you.', ephemeral: true });
		return true;
	}

	const { CharacterBase } = require('../dbObject.js');
	const character = await CharacterBase.findOne({ where: { id: targetId } });
	if (!character) {
		await interaction.update({ content: 'Character not found.', embeds: [], components: [] });
		return true;
	}

	const charName = character.name || 'Unknown';
	const labelBase = `Type "${charName}" to confirm`;
	const label = labelBase.length > 45 ? 'Type the character name to confirm' : labelBase;

	const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

	const modal = new ModalBuilder()
		.setCustomId(`char_delete_modal|${targetId}|${actingUserId}`)
		.setTitle('Confirm Character Deletion');

	const nameInput = new TextInputBuilder()
		.setCustomId('char_delete_name_input')
		.setLabel(label)
		.setStyle(TextInputStyle.Short)
		.setPlaceholder(charName.substring(0, 100))
		.setRequired(true);

	modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
	await interaction.showModal(modal);
	return true;
}

/**
 * Handle a player pressing the "Fight" button on a pending encounter embed.
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<boolean>} true if this interaction was handled
 */
async function handleEncounterFightInteraction(interaction) {
	if (!interaction.isButton()) return false;
	if (!interaction.customId.startsWith('encounter_fight|')) return false;

	const parts = interaction.customId.split('|');
	const encounterId = parseInt(parts[1], 10);
	if (isNaN(encounterId)) return false;

	const { PendingEncounter } = require('@root/dbObject.js');
	const characterUtil = require('@utility/characterUtility.js');
	const combatUtil = require('@utility/combatUtility.js');
	const contentStore = require('@root/contentStore.js');
	const { EMOJI } = require('../enums');
	const { MessageFlags, EmbedBuilder } = require('discord.js');

	const record = await PendingEncounter.findByPk(encounterId);
	if (!record) {
		await interaction.reply({ content: 'Encounter not found.', flags: MessageFlags.Ephemeral });
		return true;
	}

	if (record.status !== 'pending') {
		await interaction.reply({ content: 'This encounter has already been resolved.', flags: MessageFlags.Ephemeral });
		return true;
	}

	if (record.expires_at < new Date()) {
		await record.update({ status: 'expired' });
		try { await interaction.message.delete(); } catch (_) { /* ignore */ }
		await interaction.reply({ content: 'This encounter has expired.', flags: MessageFlags.Ephemeral });
		return true;
	}

	const fighterId = interaction.user.id;
	const isTarget = fighterId === record.target_player_id;

	// All fighters pay 5 stamina. If they can't afford it they still fight but at half speed.
	const STAMINA_COST = 5;
	const fighter = await characterUtil.getCharacterBase(fighterId);
	if (!fighter) {
		await interaction.reply({ content: 'You need a character to fight.', flags: MessageFlags.Ephemeral });
		return true;
	}
	const canPayStamina = (fighter.currentStamina ?? 0) >= STAMINA_COST;
	if (canPayStamina) {
		await characterUtil.modifyCharacterStat(fighterId, 'currentStamina', -STAMINA_COST, 'add');
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	// Pre-mark as resolved to prevent concurrent fight triggers; reverted below on player loss
	await record.update({ status: 'resolved', fighter_id: fighterId });

	// Compute armory damage multiplier (20% debuff if players in armory or armory secured)
	const battleUtil = require('@utility/battleUtility.js');
	const enemyDamageMultiplier = await battleUtil.getArmoryDamageMultiplier(record.location_id);

	// Compute morale-based speed multipliers for this location
	const moraleMultipliers = await battleUtil.getMoraleSpeedMultipliers(record.location_id);

	// Run combat, passing any retained enemy HP from a prior lost round
	// If fighter couldn't pay stamina, their speed is halved
	let result;
	try {
		result = await combatUtil.mainCombat(fighterId, record.enemy_id, {
			enemyStartHp: record.enemy_current_hp ?? undefined,
			enemyDamageMultiplier,
			playerSpeedMultiplier: (canPayStamina ? 1 : 0.7) * moraleMultipliers.playerSpeedMultiplier,
			enemySpeedMultiplier: moraleMultipliers.enemySpeedMultiplier,
		});
	}
	catch (combatErr) {
		console.error('[Encounter] mainCombat threw:', combatErr);
		await interaction.editReply({ content: `${EMOJI.FAILURE} Combat error: ${combatErr.message}` });
		return true;
	}
	const won = (result?.finalState?.player?.hp ?? 0) > 0 && (result?.finalState?.enemy?.hp ?? 1) <= 0;
	const enemyData = contentStore.enemies.findByPk(String(record.enemy_id));
	const enemyLabel = enemyData?.name || record.enemy_id.replace(/-/g, ' ');

	// Post result to zone channel
	try {
		const channel = interaction.guild?.channels.cache.get(record.channel_id);
		if (channel) {
			const embed = new EmbedBuilder()
				.setDescription(`<@${fighterId}> ${won ? 'defeated' : 'was defeated by'} **${enemyLabel}**!`);
			await channel.send({ embeds: [embed] });
		}
	}
	catch (e) {
		console.error('[Encounter] Failed to post combat result:', e);
	}

	// Delete the original encounter message
	try { await interaction.message.delete(); } catch (_) { /* ignore */ }

	// Update battle morale based on encounter result
	try {
		const battleUtil = require('@utility/battleUtility.js');
		const baseGain = battleUtil.ENEMY_MORALE_VALUES[record.enemy_id] ?? 1;
		const onHmsZone = battleUtil.HMS_ZONE_IDS.includes(record.location_id);
		const moraleDelta = won
			? (onHmsZone ? baseGain * 2 : baseGain)
			: -3;
		await battleUtil.updateMorale(moraleDelta, won ? `encounter win: ${record.enemy_id}` : `encounter loss: ${record.enemy_id}`);
		// Boss kill: permanently reduce drain baseline by 2
		if (won && battleUtil.BOSS_ENEMIES.has(record.enemy_id)) {
			const currentReduction = await battleUtil.getFlag('hms_divine_drain_reduction');
			await battleUtil.setFlag('hms_divine_drain_reduction', currentReduction + 2);
		}
		// Armory wave: mark outcome and check completion
		if (won && record.wave_id != null) {
			await record.update({ outcome: 'win' });
			await battleUtil.checkArmoryWaveCompletion(interaction.client, record.wave_id);
		}
	}
	catch (moraleErr) {
		console.error('[Encounter] Failed to update morale:', moraleErr);
	}

	// Build battle report embeds
	const reportColor = won ? 0x27ae60 : 0xe74c3c;
	const pages = result?.battleReportPages || [result?.battleReport || 'No combat details available.'];
	const firstPageContent = result?.narrativeText ? `*${result.narrativeText}*\n\n${pages[0]}` : pages[0];
	const reportEmbed = new EmbedBuilder()
		.setTitle(`${EMOJI.SWORD} Combat`)
		.setColor(reportColor)
		.setDescription(firstPageContent);

	if (won) {
		await interaction.editReply({ content: `${EMOJI.SUCCESS} You defeated the **${enemyLabel}**!`, embeds: [reportEmbed] });
		for (let i = 1; i < pages.length; i++) {
			await interaction.followUp({ embeds: [new EmbedBuilder().setColor(reportColor).setDescription(pages[i])], flags: MessageFlags.Ephemeral });
		}
	}
	else {
		// Player lost — retain enemy HP
		const enemyHpLeft = result?.finalState?.enemy?.hp ?? 0;
		const playerHp = result?.finalState?.player?.hp ?? 1;
		await record.update({ status: 'pending', fighter_id: null, enemy_current_hp: enemyHpLeft });

		if (playerHp > 0) {
			// Not knocked out — repost weakened encounter targeting same player
			try {
				const channel = interaction.guild?.channels.cache.get(record.channel_id);
				if (channel) {
					const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
					const enemyMaxHp = enemyData?.stat?.health || 100;

					const weakenedEmbed = new EmbedBuilder()
						.setTitle(`${EMOJI.SWORD} Under Attack!`)
						.setDescription(`A **${enemyLabel}** (weakened) has engaged <@${record.target_player_id}>.`)
						.setFooter({ text: `HP: ${enemyHpLeft}/${enemyMaxHp} \u2022 Encounter #${record.id}` });

					const row = new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId(`encounter_fight|${record.id}`)
							.setLabel('Fight')
							.setStyle(ButtonStyle.Danger),
					);

					const msg = await channel.send({ embeds: [weakenedEmbed], components: [row] });
					await record.update({ message_id: msg.id });
				}
			}
			catch (e) {
				console.error('[Encounter] Failed to repost weakened encounter message:', e);
			}
		}

		const lossMessage = playerHp > 0
			? `${EMOJI.FAILURE} You were defeated by the **${enemyLabel}**. It lingers, weakened.`
			: `${EMOJI.FAILURE} You were knocked out by the **${enemyLabel}**.`;
		await interaction.editReply({ content: lossMessage, embeds: [reportEmbed] });
		for (let i = 1; i < pages.length; i++) {
			await interaction.followUp({ embeds: [new EmbedBuilder().setColor(reportColor).setDescription(pages[i])], flags: MessageFlags.Ephemeral });
		}

		// Knocked out — move to living quarters
		if (playerHp <= 0) {
			try {
				const battleActive = await battleUtil.getFlag('global.hms_divine_battle_active');
				if (battleActive) {
					const locationUtil = require('@utility/locationUtility.js');
					await locationUtil.moveCharacterToLocation(fighterId, battleUtil.BOONG_SINH_HOAT_ID, interaction.guild);
					console.log(`[Battle] Player ${fighterId} knocked out — moved to living quarters.`);
				}
			}
			catch (e) {
				console.error('[Battle] Failed to move KO\'d player to living quarters:', e);
			}
		}
	}
	return true;
}

/**
 * Handle officer cabin assault confirm/cancel buttons.
 * CustomId formats: ocabin_confirm|<sessionId>  |  ocabin_cancel|<sessionId>
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<boolean>}
 */
async function handleOfficerCabinInteraction(interaction) {
	if (!interaction.isButton()) return false;
	const { customId } = interaction;
	if (!customId.startsWith('ocabin_confirm|') && !customId.startsWith('ocabin_cancel|')) return false;

	const { EmbedBuilder } = require('discord.js');
	const battleUtil = require('@utility/battleUtility.js');
	const combatUtil = require('@utility/combatUtility.js');
	const characterUtil = require('@utility/characterUtility.js');
	const locationUtil = require('@utility/locationUtility.js');
	const { EMOJI } = require('../enums');

	const parts = customId.split('|');
	const action = parts[0]; // 'ocabin_confirm' or 'ocabin_cancel'
	const sessionId = parts[1];

	// Find session by sessionId
	let sessionKey = null;
	let session = null;
	for (const [key, s] of battleUtil.officerCabinSessions.entries()) {
		if (s.sessionId === sessionId) {
			sessionKey = key;
			session = s;
			break;
		}
	}

	if (!session) {
		try { await interaction.update({ components: [] }); } catch (_) { /* already updated */ }
		await interaction.followUp({ content: 'This assault has already been resolved or expired.', flags: MessageFlags.Ephemeral });
		return true;
	}

	const userId = interaction.user.id;

	if (action === 'ocabin_cancel') {
		clearTimeout(session.timeout);
		battleUtil.officerCabinSessions.delete(sessionKey);
		await interaction.update({ content: 'The assault on the officer quarters has been called off.', embeds: [], components: [] });
		return true;
	}

	// ocabin_confirm — check user has an assigned role
	const userRole = Object.entries(session.assignments).find(([, uid]) => uid === userId)?.[0];
	if (!userRole) {
		await interaction.reply({
			content: 'You must be assigned a role before you can confirm the assault.',
			flags: MessageFlags.Ephemeral,
		});
		return true;
	}

	// Remove buttons from the board and open a deferred reply for the follow-up summary.
	// Use deferUpdate so we can later call followUp; also delete the board message so
	// stale copies (from previous role updates) don't leave orphaned buttons.
	try {
		await interaction.deferUpdate();
		await interaction.message.delete();
	}
	catch {
		// Board already gone or interaction stale — safe to continue
	}

	// Clear session — prevent re-entry
	clearTimeout(session.timeout);
	battleUtil.officerCabinSessions.delete(sessionKey);

	// Check current defeated state to skip already-dead officers
	const [captainDefeated, firstMateDefeated, headGuardDefeated] = await Promise.all([
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.captain.defeatFlag),
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.first_mate.defeatFlag),
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.head_guard.defeatFlag),
	]);
	const defeatedBefore = {
		captain: captainDefeated === 1,
		first_mate: firstMateDefeated === 1,
		head_guard: headGuardDefeated === 1,
	};

	// Collect all active fights
	const fights = [];
	for (const [role, def] of Object.entries(battleUtil.OFFICER_ROLES)) {
		const fighterId = session.assignments[role];
		if (!fighterId || defeatedBefore[role]) continue;
		fights.push({ role, def, fighterId, name: session.names[role] });
	}

	if (fights.length === 0) {
		await interaction.followUp({
			content: 'No fights are ready to begin — all assigned officers are already defeated.',
			flags: MessageFlags.Ephemeral,
		});
		return true;
	}

	const STAMINA_COST = 5;
	const channel = interaction.channel;

	// Announce the assault
	const startLines = fights.map(f => `${EMOJI.SWORD} **${f.name}** vs **${f.def.label.replace('Fight ', '')}**`);
	const startEmbed = new EmbedBuilder()
		.setTitle('\u2694\uFE0F The Assault Begins!')
		.setDescription(startLines.join('\n'))
		.setColor(0x8B0000);
	await channel.send({ embeds: [startEmbed] });

	// Deduct stamina for each fighter and build team pairs
	const teamPairs = await Promise.all(fights.map(async ({ fighterId, def }) => {
		const fighter = await characterUtil.getCharacterBase(fighterId);
		let speedMultiplier = 1;
		if (fighter && (fighter.currentStamina ?? 0) >= STAMINA_COST) {
			await characterUtil.modifyCharacterStat(fighterId, 'currentStamina', -STAMINA_COST, 'add');
		}
		else {
			speedMultiplier = 0.7;
		}
		return { playerId: fighterId, enemyId: def.enemyId, speedMultiplier };
	}));

	// Run all three fights on a single shared initiative tracker
	const teamResult = await combatUtil.teamCombat(teamPairs);

	// Map outcomes back to fight metadata for downstream logic
	const fightResults = fights.map((f, i) => {
		const outcome = teamResult.pairOutcomes[i];
		return { role: f.role, def: f.def, fighterId: f.fighterId, name: f.name, won: outcome.playerWon, finalPlayer: outcome.finalPlayer };
	});

	// Post one combined battle report
	const pages = teamResult.battleReportPages;
	const allWon = fightResults.every(f => f.won);
	const anyWon = fightResults.some(f => f.won);
	const reportColor = allWon ? 0x27ae60 : anyWon ? 0xF39C12 : 0xe74c3c;
	const firstEmbed = new EmbedBuilder()
		.setTitle(`${EMOJI.SWORD} Officer Quarters \u2014 The Assault`)
		.setDescription(pages[0])
		.setColor(reportColor);
	await channel.send({ embeds: [firstEmbed] });
	for (let i = 1; i < pages.length; i++) {
		const pageEmbed = new EmbedBuilder()
			.setTitle(`${EMOJI.SWORD} Officer Quarters (${i + 1}/${pages.length})`)
			.setDescription(pages[i])
			.setColor(reportColor);
		await channel.send({ embeds: [pageEmbed] });
	}

	// Apply morale updates — individual per fight
	let moraleDelta = 0;
	for (const { def, won } of fightResults) {
		if (won) {
			moraleDelta += battleUtil.ENEMY_MORALE_VALUES[def.enemyId] ?? 1;
		}
		else {
			moraleDelta -= 3;
		}
	}
	if (moraleDelta !== 0) {
		await battleUtil.updateMorale(moraleDelta, 'multi-fight result');
	}

	// Boss defeat flags and drain reduction only count if every boss was killed
	if (allWon) {
		for (const { def } of fightResults) {
			await battleUtil.setFlag(def.defeatFlag, 1);
		}
		const currentReduction = await battleUtil.getFlag('hms_divine_drain_reduction');
		await battleUtil.setFlag('hms_divine_drain_reduction', currentReduction + (2 * fightResults.length));
	}

	// If all 3 officers are now dead, mark the commander quarters as secured
	const [c, fm, hg] = await Promise.all([
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.captain.defeatFlag),
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.first_mate.defeatFlag),
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.head_guard.defeatFlag),
	]);
	if (c === 1 && fm === 1 && hg === 1) {
		const victoryEmbed = new EmbedBuilder()
			.setTitle('\u2694\uFE0F Officer Quarters Secured!')
			.setDescription('All officers of *La Dauphine* have been defeated. The officer quarters are under your control.')
			.setColor(0xFFD700);
		await channel.send({ embeds: [victoryEmbed] });
	}

	// Move knocked-out players to living quarters
	for (const { fighterId, won, finalPlayer } of fightResults) {
		if (!won) {
			const playerHp = finalPlayer?.hp ?? 1;
			if (playerHp <= 0) {
				try {
					const battleActive = await battleUtil.getFlag('global.hms_divine_battle_active');
					if (battleActive) {
						await locationUtil.moveCharacterToLocation(fighterId, battleUtil.BOONG_SINH_HOAT_ID, interaction.guild);
						console.log(`[OfficerCabin] Player ${fighterId} KO'd \u2014 moved to living quarters.`);
					}
				}
				catch (e) {
					console.error('[OfficerCabin] Failed to move KO\'d player:', e);
				}
			}
		}
	}

	return true;
}

/**
 * Handle "Vote to Resume" / "Withdraw Vote" buttons for cron-pause vote.
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<boolean>}
 */
async function handleCronVoteInteraction(interaction) {
	if (!interaction.isButton()) return false;
	if (interaction.customId !== 'cronvote_cast' && interaction.customId !== 'cronvote_withdraw') return false;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const cronVoteUtil = require('@utility/cronVoteUtil.js');
	const msgId = interaction.message.id;
	const userId = interaction.user.id;

	// Vote message not tracked (e.g. bot restarted) — ignore silently
	if (!cronVoteUtil.getVoters(msgId)) {
		await interaction.editReply({ content: 'This vote is no longer active.' });
		return true;
	}

	let newCount;
	if (interaction.customId === 'cronvote_cast') {
		newCount = cronVoteUtil.addVote(msgId, userId);
		await interaction.editReply({ content: `Your vote has been cast. (${newCount} / ${cronVoteUtil.CRON_VOTE_THRESHOLD})` });
	}
	else {
		newCount = cronVoteUtil.removeVote(msgId, userId);
		await interaction.editReply({ content: `Your vote has been withdrawn. (${newCount} / ${cronVoteUtil.CRON_VOTE_THRESHOLD})` });
	}

	// Threshold reached — resume and close vote
	if (newCount >= cronVoteUtil.CRON_VOTE_THRESHOLD) {
		const { resumeAllCronJobs } = require('@utility/cronUtility.js');
		const resumed = await resumeAllCronJobs();
		cronVoteUtil.closeVote(msgId);
		await interaction.message.edit({
			embeds: [cronVoteUtil.buildCronVoteEmbed(newCount, true)],
			components: [cronVoteUtil.buildCronVoteRow(true)],
		});
		console.log(`[CronVote] ${newCount} votes reached — resumed ${resumed} job(s).`);
	}
	else {
		// Update vote count on embed
		await interaction.message.edit({
			embeds: [cronVoteUtil.buildCronVoteEmbed(newCount, false)],
		});
	}

	return true;
}

/**
 * Handle a player clicking the "Ready" muster button before battle spawns begin.
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<boolean>}
 */
async function handleBattleMusterInteraction(interaction) {
	if (!interaction.isButton()) return false;
	if (interaction.customId !== 'battle_muster_ready') return false;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const userId = interaction.user.id;
	const battleUtil = require('@utility/battleUtility.js');
	const { CharacterBase, CharacterFlag } = require('../dbObject.js');

	// Must be a registered character
	const character = await CharacterBase.findOne({ where: { id: userId } });
	if (!character) {
		await interaction.editReply({ content: 'You do not have a character.' });
		return true;
	}
	const unregistered = await CharacterFlag.findOne({ where: { character_id: userId, flag: 'unregistered' } });
	if (unregistered && parseInt(unregistered.value) !== 0) {
		await interaction.editReply({ content: 'You must complete registration first.' });
		return true;
	}

	// Check battle is still mustering
	const mustering = await battleUtil.getFlag('global.hms_divine_mustering');
	if (!mustering) {
		await interaction.editReply({ content: 'The battle has already begun!' });
		return true;
	}

	// Check if already mustered
	const alreadyMustered = await CharacterFlag.findOne({ where: { character_id: userId, flag: 'hms_divine_mustered' } });
	if (alreadyMustered && parseInt(alreadyMustered.value) !== 0) {
		const count = await battleUtil.getFlag('global.hms_divine_ready_count');
		await interaction.editReply({ content: `You are already marked as ready. (${count}/${battleUtil.MUSTER_REQUIRED})` });
		return true;
	}

	// Mark this player as mustered (destroy+create to avoid composite primary key upsert issue)
	await CharacterFlag.destroy({ where: { character_id: userId, flag: 'hms_divine_mustered' } });
	await CharacterFlag.create({ character_id: userId, flag: 'hms_divine_mustered', value: 1 });

	// Increment counter
	const prevCount = await battleUtil.getFlag('global.hms_divine_ready_count');
	const newCount = prevCount + 1;
	await battleUtil.setFlag('global.hms_divine_ready_count', newCount);

	// Update the muster message footer with current count
	const { EmbedBuilder } = require('discord.js');
	const SystemSettingUtil = require('@utility/systemSetting.js');
	try {
		const ref = await SystemSettingUtil.get('message.battle_muster');
		if (ref) {
			const [channelId, messageId] = ref.split(':');
			const channel = interaction.guild?.channels.cache.get(channelId);
			if (channel) {
				const msg = await channel.messages.fetch(messageId);
				const updated = EmbedBuilder.from(msg.embeds[0]).setFooter({ text: `${newCount} / ${battleUtil.MUSTER_REQUIRED} ready` });
				await msg.edit({ embeds: [updated], components: msg.components });
			}
		}
	}
	catch (e) {
		console.error('[Muster] Failed to update muster message count:', e);
	}

	await interaction.editReply({ content: `You are ready! (${newCount}/${battleUtil.MUSTER_REQUIRED})` });

	// Activate spawns if threshold reached
	if (newCount >= battleUtil.MUSTER_REQUIRED) {
		await battleUtil.activateBattleSpawns(interaction.guild, interaction.client);
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
			// Check for cooking interactions
			if (await handleCookingInteraction(interaction)) return;
			// Check for location exit button
			if (await handleLocationExitButton(interaction)) return;
			// Check for character delete confirmation
			if (await handleCharDeleteInteraction(interaction)) return;
			// Check for officer cabin assault buttons
			if (await handleOfficerCabinInteraction(interaction)) return;
			// Check for encounter fight button
			if (await handleEncounterFightInteraction(interaction)) return;
			// Check for battle muster button
			if (await handleBattleMusterInteraction(interaction)) return;
			// Check for cron-pause vote buttons
			if (await handleCronVoteInteraction(interaction)) return;
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
				if (interaction.customId === 'character_edit_modal') {
					const characterCommand = require('../commands/utility/character.js');
					await characterCommand.handleModal(interaction);
					return;
				}
				if (interaction.customId.startsWith('char_delete_modal|')) {
					const parts = interaction.customId.split('|');
					const targetId = parts[1];
					const actingUserId = parts[2];

					if (interaction.user.id !== actingUserId) {
						await interaction.reply({ content: 'This confirmation is not for you.', flags: MessageFlags.Ephemeral });
						return;
					}

					const { CharacterBase } = require('../dbObject.js');
					const character = await CharacterBase.findOne({ where: { id: targetId } });
					if (!character) {
						await interaction.reply({ content: 'Character not found (may have already been deleted).', flags: MessageFlags.Ephemeral });
						return;
					}

					const typedName = interaction.fields.getTextInputValue('char_delete_name_input').trim();
					if (typedName !== character.name) {
						await interaction.reply({
							content: `Name did not match — expected **${character.name}**. Deletion cancelled.`,
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					await interaction.deferReply({ flags: MessageFlags.Ephemeral });

					const charName = character.name;
					const isAdminAction = actingUserId !== targetId;
					const characterCommand = require('../commands/utility/character.js');
					await characterCommand.performDelete(interaction.guild, targetId);

					const message = isAdminAction
						? `Character **${charName}** has been deleted.`
						: `Your character **${charName}** and all associated data have been deleted.`;
					await interaction.editReply({ content: message });
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

		if (interaction.isAutocomplete()) {
			const command = interaction.client.commands.get(interaction.commandName);
			if (command?.autocomplete) {
				try { await command.autocomplete(interaction); }
				catch (err) { console.error(err); }
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

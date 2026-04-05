const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase, GlobalFlag } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');

// Bilge encounter raffle:
//   ratTickets   = current global.undead_rat_count (50 max)
//   kingTickets  = floor(depth / 2), 0 if king is already slain
//   miasmaTickets = 3 — constant low-chance environmental hazard
//   ghoulTickets = floor(depth / 3) — rare, grows with depth
function pickEncounterEvent(ratCount, depth, ratKingSlain) {
	const ratTickets = ratCount;
	const kingTickets = ratKingSlain ? 0 : Math.floor(depth / 2);
	const miasmaTickets = 3;
	const ghoulTickets = Math.floor(depth / 3);
	const total = ratTickets + kingTickets + miasmaTickets + ghoulTickets;
	if (total <= 0) return null;
	const roll = Math.random() * total;
	let cursor = 0;
	cursor += kingTickets;
	if (kingTickets > 0 && roll < cursor) return ratCount > 0 ? 'bilge-encounter-rat-king-undead' : 'bilge-encounter-rat-king-undead-enraged';
	cursor += miasmaTickets;
	if (roll < cursor) return 'bilge-encounter-miasma';
	cursor += ghoulTickets;
	if (ghoulTickets > 0 && roll < cursor) return 'bilge-encounter-rat-ghoul';
	return Math.random() < 0.5 ? 'bilge-encounter-rat' : 'bilge-encounter-rat-adult-undead';
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('hunt')
		.setDescription('Hunt in the bilge for rats.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			const userId = interaction.user.id;

			const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.reply({
					content: 'You must complete registration before hunting.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const locationUtil = interaction.client.locationUtil;
			const channel = interaction.channel;
			const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
			const currentLocation = await locationUtil.getLocationByChannel(channelId);

			if (!currentLocation || !Array.isArray(currentLocation.tag) || !currentLocation.tag.includes('bilge')) {
				return await interaction.reply({
					content: 'You can only hunt in the bilge.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				return await interaction.reply({
					content: 'Character not found.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const [bilgeFlag] = await GlobalFlag.findOrCreate({ where: { flag: 'global.bilge_unlocked' }, defaults: { value: 0 } });
			if (!bilgeFlag.value) {
				const hasKey = await characterUtil.checkCharacterInventory(userId, 'bilge-key');
				if (!hasKey) {
					const eventUtil = interaction.client.eventUtil;
					return await eventUtil.processEvent('bilge-door-locked', interaction, userId, { ephemeral: false });
				}
				await bilgeFlag.update({ value: 1 });
				await characterUtil.removeCharacterItem(userId, 'bilge-key');
			}

			const STAMINA_COST = 3;
			if ((character.currentStamina || 0) < STAMINA_COST) {
				return await interaction.reply({
					content: `Not enough stamina. You need ${STAMINA_COST} stamina to hunt (you have ${character.currentStamina || 0}).`,
					flags: MessageFlags.Ephemeral,
				});
			}
			await character.update({ currentStamina: character.currentStamina - STAMINA_COST });

			const ratCountRecord = await GlobalFlag.findOne({ where: { flag: 'global.undead_rat_count' } });
			if (!ratCountRecord) {
				return await interaction.reply({
					content: 'The bilge has not been initialized yet. Return after midnight.',
					flags: MessageFlags.Ephemeral,
				});
			}
			const ratCount = parseInt(ratCountRecord.value) || 0;
			const ratKingSlainRecord = await GlobalFlag.findOne({ where: { flag: 'global.undead_rat_king_slain' } });
			const ratKingSlain = ratKingSlainRecord ? parseInt(ratKingSlainRecord.value) || 0 : 0;

			const depth = character.depth || 0;
			const eventUtil = interaction.client.eventUtil;
			const eventId = pickEncounterEvent(ratCount, depth, ratKingSlain);

			if (!eventId) {
				if (ratKingSlain) {
					return await interaction.reply({
						content: 'The bilge has been cleared. There is nothing left to hunt.',
						flags: MessageFlags.Ephemeral,
					});
				}
				return await interaction.reply({
					content: 'There are no rats left in the bilge. Return at midnight when they respawn.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const newDepth = depth + 1;
			await CharacterBase.update({ depth: newDepth }, { where: { id: userId } });

			await eventUtil.processEvent(eventId, interaction, userId, { ephemeral: false });
		}
		catch (error) {
			console.error('Error in hunt command:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.editReply({ content: 'An error occurred.' }).catch(() => {});
			}
		}
	},
};

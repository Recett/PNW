const { SlashCommandBuilder, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { Op } = require('sequelize');
const { CharacterFlag } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lookaround')
		.setDescription('Look around your current location!')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			// Get location by channelId (use parent channel if in thread)
			const channel = interaction.channel;
			const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
			const currentLocation = await interaction.client.locationUtil.getLocationByChannel(channelId);
			if (!currentLocation) {
				return interaction.reply({ content: 'This channel is not mapped to any location.', flags: MessageFlags.Ephemeral });
			}


			const title = `${currentLocation.name}`;
			let description = `${currentLocation.description}`;

			const locationUtil = interaction.client.locationUtil;
			const { objects, pcs, npcs, enemies } = await locationUtil.getLocationContents(currentLocation.id);

			if (objects.length > 0) {
				description += `\n\n**Objects:** ${objects.map(obj => obj.name).join(', ')}`;
			}
			if (pcs.length > 0) {
				description += `\n\n**Characters:** ${pcs.map(pc => pc.id ? `<@${pc.id}>` : pc.name).join(', ')}`;
			}
			if (npcs.length > 0) {
				// Get NPC-specific known flags for this character
				const userId = interaction.user.id;
				const npcKnownFlags = npcs.map(npc => `${npc.id}_known`);
				const flags = await CharacterFlag.findAll({
					where: {
						character_id: userId,
						flag: { [Op.in]: npcKnownFlags },
					},
				});
				const flagMap = {};
				flags.forEach(f => { flagMap[f.flag] = f.value; });
				description += `\n\n**NPCs:** ${npcs.map(npc => {
					const knownFlag = flagMap[`${npc.id}_known`];
					console.log(`NPC ${npc.id} known flag: ${knownFlag}`);
					return (!knownFlag || knownFlag === false || knownFlag === 0) && npc.unknown_name ? npc.unknown_name : npc.name;
				}).join(', ')}`;
			}
			if (enemies.length > 0) {
				description += `\n\n**Enemies:** ${enemies.map(enemy => enemy.name).join(', ')}`;
			}

			const embed = new EmbedBuilder()
				.setTitle(title)
				.setDescription(description);
			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
		}
		catch (error) {
			console.error('Error in lookaround command:', error);
			if (!interaction.replied) {
				await interaction.reply({ content: 'An error occurred while looking around.', flags: MessageFlags.Ephemeral });
			}
		}
	},
};

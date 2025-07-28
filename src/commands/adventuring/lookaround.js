const { SlashCommandBuilder, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { Op } = require('sequelize');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lookaround')
		.setDescription('Look around your current location!')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		// Get location by channelId
		const channelId = interaction.channelId;
		let currentLocation = await interaction.client.locationUtil.getLocationByChannel(channelId);
		if (!currentLocation) {
			return interaction.reply({ content: 'This channel is not mapped to any location.', flags: MessageFlags.Ephemeral });
		}


		let title = `${currentLocation.name}`;
		let description = `${currentLocation.description}`;

		const locationUtil = interaction.client.locationUtil;
		const { objects, pcs, npcs, enemies } = await locationUtil.getLocationContents(currentLocation.id);

		if (objects.length > 0) {
			description += `\n\n**Objects:** ${objects.map(obj => obj.name).join(', ')}`;
		}
		if (pcs.length > 0) {
			description += `\n\n**Characters:** ${pcs.map(pc => pc.user_id ? `<@${pc.user_id}>` : pc.name).join(', ')}`;
		}
		if (npcs.length > 0) {
			// Get all known flags for this character
			const { CharacterFlag } = require('@root/dbObject.js');
			const userId = interaction.user.id;
			const flags = await CharacterFlag.findAll({ where: { character_id: userId } });
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
	},
};

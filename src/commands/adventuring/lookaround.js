const { SlashCommandBuilder, InteractionContextType, EmbedBuilder } = require('discord.js');
const { LocationBase } = require('@root/dbObject.js');
const gamecon = require('@root/Data/gamecon.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lookaround')
		.setDescription('Look around your current location!')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		// Get current location
		let currentLocationId = await interaction.client.characterUtil.getCharacterCurrentLocationId(interaction.user.id);
		let currentLocation = await interaction.client.locationUtil.getLocationBase(currentLocationId);
		if (!currentLocation) {
			return interaction.reply({ content: 'You are not in any location.', ephemeral: true });
		}

		let title = `${currentLocation.name}`;
		let description = `${currentLocation.description}`;
		let objects = (await currentLocation.getObjects()) || [];
		let pcs = (await currentLocation.getPCs()) || [];
		let npcs = (await currentLocation.getNPCs()) || [];
		let enemies = (await currentLocation.getEnemies()) || [];

		if (objects.length > 0) {
			description += `\n\n**Objects:** ${objects.map(obj => obj.name).join(', ')}`;
		}
		if (pcs.length > 0) {
			description += `\n\n**Characters:** ${pcs.map(pc => pc.user_id ? `<@${pc.user_id}>` : pc.name).join(', ')}`;
		}
		if (npcs.length > 0) {
			description += `\n\n**NPCs:** ${npcs.map(npc => npc.name).join(', ')}`;
		}
		if (enemies.length > 0) {
			description += `\n\n**Enemies:** ${enemies.map(enemy => enemy.name).join(', ')}`;
		}

		const embed = new EmbedBuilder()
			.setTitle(title)
			.setDescription(description);
		await interaction.reply({ embeds: [embed] });
	},
};

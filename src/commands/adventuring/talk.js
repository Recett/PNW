const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { NpcBase } = require('@root/dbObject.js');
const eventUtil = require('@utility/eventUtility.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('talk')
		.setDescription('Talk with an NPC!')
		.setContexts(InteractionContextType.Guild)
		.addStringOption(option =>
			option
				.setName('npc_id')
				.setDescription('NPC ID to talk to')
				.setRequired(true)),

	async execute(interaction) {
		const npcId = interaction.options.getString('npc_id');
		if (!npcId) {
			return interaction.reply({ content: 'Please provide a valid NPC ID.', ephemeral: true });
		}
		let npc = await NpcBase.findOne({ where: { npc_id: npcId } });
		if (!npc) {
			return interaction.reply({ content: 'NPC not found.', ephemeral: true });
		}

		let embed;
		if (npc.default_event) {
			const eventBase = await eventUtil.getEventBase(npc.default_event);
			if (eventBase) {
				embed = {
					title: eventBase.title,
					description: eventBase.text,
				};
			}
			else {
				embed = {
					title: `You talk to ${npc.name}`,
					description: npc.dialogue || 'The NPC has nothing to say right now.',
				};
			}
		}
		else {
			embed = {
				title: `You talk to ${npc.name}`,
				description: npc.dialogue || 'The NPC has nothing to say right now.',
			};
		}

		// Use the embed for the initial reply
		await interaction.reply({ embeds: [embed], ephemeral: true });

		await eventUtil.handleEvent(npc.default_event, interaction, interaction);
	},
};

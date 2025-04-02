const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('newchar')
		.setDescription('Your journey begin'),
	async execute(interaction) {
		eventId = 'character_creation_begin';

		let first = true;
		let flags = [];

		eventHandler(eventId, interaction, first, flags);
	},
};

async function eventHandler(eventId, interaction, first, flags) {
	const collectorFilter = i => i.user.id === interaction.user.id;
	const eventBase = await ia.client.eventUtil.getEventBase(eventId);
	const eventResolutions = await ia.client.eventUtil.getEventResolution(eventId);
	const eventFlag = await ia.client.eventUtil.getEventFlag(eventId);

	// Display event text
	const embed = { description: eventBase.event_text };
	let child_eventId;

	// Action Row
	const select = new StringSelectMenuBuilder()
		.setCustomId('starter')
		.setPlaceholder('Choose carefully');
	let count = 0;

	eventResolutions.forEach(function(resolution) {
	   count += 1;
	   select.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel(count)
				.setDescription('. ' + resolution.resolution_text)
				.setValue(resolution.child_event_id != null ? resolution.child_event_id : eventBase.default_child_event_id),
		);
	});

	const choose = new ButtonBuilder()
		.setCustomId('choose')
		.setLabel('Choose')
		.setStyle(ButtonStyle.Success);

	const row = new ActionRowBuilder()
		.addComponents(select, choose);

	if (first) {
		let response = await interaction.reply({ embeds: [embed], components: [row], withResponse: true });
		first = false;
	}

	try {
		const choice = await response.resource.message.awaitMessageComponent({ filter: collectorFilter });
		child_eventId = interaction.values[0];
		// Update Flag
		eventFlag.forEach(function(flag) {
		   if (flag.resolution_id == 0 || flag.resolution_id == child_eventId) {
		   		if (flag.set != null) {
		   			flags[flag.flag_id] = flag.set;
		   		}
				else {
		   			flags[flag.flag_id] += flag.add;
		   		}
		   }
		});

		if (!first) {
			await choice.update({ embeds: [embed], components: [row], withResponse: true });
		}

		// Update Flag
		eventFlag.forEach(function(flag) {
		   if (flag.resolution_id == 0 || flag.resolution_id == child_eventId) {
		   		if (flag.set != null) {
		   			flags[flag.flag_id] = flag.set;
		   		}
		   		else {
		   			flags[flag.flag_id] += flag.add;
		   		}
		   }
		});

		// Get ChildEvent
		if (child_eventId != 'end') {
			eventHandler(childEventId, interaction, first);
		}
	}
	catch {
		// TODO
	}

}
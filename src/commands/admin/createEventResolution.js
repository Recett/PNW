const Discord = require('discord.js');
const name = 'createEventResolution';
const EventResolution = require('@/models/character/eventResolution.js');

module.exports = {
	authority: 'moderators',
	data: new Discord.SlashCommandSubcommandBuilder()
		.setName(name)
		.setDescription('Create a event'),
	async execute(interaction) {
		const modal = new Discord.ModalBuilder()
			.setTitle(ia.options.getString('name', true))
			.addComponents(
				new Discord.ActionRowBuilder().addComponents(
					new Discord.TextInputBuilder()
						.setCustomId('eventId')
						.setLabel('Event Id')
						.setStyle(Discord.TextInputStyle.Paragraph)
						.setMaxLength(512)
						.setPlaceholder('Give some background or lore of the camp here.'),
				),
				new Discord.ActionRowBuilder().addComponents(
					new Discord.TextInputBuilder()
						.setCustomId('resolutionId')
						.setLabel('Resolution Id')
						.setStyle(Discord.TextInputStyle.Paragraph)
						.setMaxLength(512)
						.setPlaceholder('Give some background or lore of the camp here.'),
				),
				new Discord.ActionRowBuilder().addComponents(
					new Discord.TextInputBuilder()
						.setCustomId('resolutionText')
						.setLabel('Resolution Text')
						.setStyle(Discord.TextInputStyle.Paragraph)
						.setMaxLength(512)
						.setPlaceholder('DM note and rules of the camp.'),
				),
				new Discord.ActionRowBuilder().addComponents(
					new Discord.TextInputBuilder()
						.setCustomId('ChildId')
						.setLabel('Child Event ID')
						.setStyle(Discord.TextInputStyle.Paragraph)
						.setMaxLength(512)
						.setPlaceholder('DM note and rules of the camp.'),
				),
			);

		await interaction.showModal(modal);

		const msia = await interaction.awaitModalSubmit({ time: 300000, filter: (i) => i.customId == `${ia.cid}=moreInfo` }).catch(() => {
			interaction.reply('Timeout. Creation failed.');
			throw new Error('Timeout');
		});

		msia.deferReply();

		const eventId = msia.fields.getTextInputValue('eventId') ?? '';
		const resolutionId = msia.fields.getTextInputValue('resolutionId') ?? '';
		const resolutionText = msia.fields.getTextInputValue('resolutionText') ?? '';
		const childId = msia.fields.getTextInputValue('childId') ?? '';
		const eventResolution = await ia.client.eventUtil.getEventResolutionOne(eventId, resolutionId);

		try {
			if (eventResolution != null) {
				// equivalent to: INSERT INTO tags (name, description, username) values (?, ?, ?);
				const newEventResolutions = await EventResolution.create({
					eventId: eventId,
					resolutionText: resolutionText,
					resolutionId: resolutionId,
					childId: childId,
				});
				return interaction.reply(`Event ${newEventResolutions.eventId} added.`);
			}
			else {
				const affectedRows = await EventResolution.update(
					{ childId: childId, resolutionText: resolutionText },
					{ where: { eventId: eventId, resolutionId: resolutionId } });

				if (affectedRows > 0) {
					return interaction.reply(`Tag ${tagName} was edited.`);
				}
			}
		}
		catch (error) {
			if (error.name === 'SequelizeUniqueConstraintError') {
				return interaction.reply('That tag already exists.');
			}

			return interaction.reply('Something went wrong with adding a tag.');
		}
	},
};

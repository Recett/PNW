const Discord = require('discord.js');
const name = 'createEvent';
const EventBase = require('@/models/character/eventResolution.js');

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
						.setCustomId('eventText')
						.setLabel('Event Text')
						.setStyle(Discord.TextInputStyle.Paragraph)
						.setMaxLength(512)
						.setPlaceholder('DM note and rules of the camp.'),
				),
				new Discord.ActionRowBuilder().addComponents(
					new Discord.TextInputBuilder()
						.setCustomId('defaultChildId')
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
		const eventText = msia.fields.getTextInputValue('eventText') ?? '';
		const defaultChildId = msia.fields.getTextInputValue('defaultChildId') ?? '';
		const eventBase = await ia.client.eventUtil.getEventBase(eventId);

		try {
			if (eventBase != null) {
				// equivalent to: INSERT INTO tags (name, description, username) values (?, ?, ?);
				const newEvent = await EventBase.create({
					eventId: eventId,
					eventText: eventText,
					defaultChildId: defaultChildId,
				});
				return interaction.reply(`Event ${newEvent.eventId} added.`);
			}
			else {
				// equivalent to: INSERT INTO tags (name, description, username) values (?, ?, ?);
				const affectedRows = await EventBase.update({ defaultChildId: defaultChildId, eventText: eventText }, { where: { eventId: eventId } });

				if (affectedRows > 0) {
					return interaction.reply(`Event ${newEvent.eventId} was edited.`);
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

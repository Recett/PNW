const Discord = require('discord.js');
const EventBase = require('@models/event/eventBase.js');

module.exports = {
	authority: 'moderators',
	data: new Discord.SlashCommandSubcommandBuilder()
		.setName('create-event')
		.setDescription('Create a event'),
	async execute(interaction) {
		const modal = new Discord.ModalBuilder()
			.setCustomId('create-event')
			.setTitle('Create Event')
			.addComponents(
				new Discord.ActionRowBuilder().addComponents(
					new Discord.TextInputBuilder()
						.setCustomId('eventId')
						.setLabel('Event Id')
						.setStyle(Discord.TextInputStyle.Paragraph)
						.setMaxLength(512)
						.setPlaceholder('Event Id'),
				),
				new Discord.ActionRowBuilder().addComponents(
					new Discord.TextInputBuilder()
						.setCustomId('eventText')
						.setLabel('Event Text')
						.setStyle(Discord.TextInputStyle.Paragraph)
						.setMaxLength(512)
						.setPlaceholder('Event Text'),
				),
				new Discord.ActionRowBuilder().addComponents(
					new Discord.TextInputBuilder()
						.setCustomId('defaultChildId')
						.setLabel('Child Event ID')
						.setStyle(Discord.TextInputStyle.Paragraph)
						.setMaxLength(512)
						.setPlaceholder('Child Event ID in case there is no resolution'),
				),
			);

		await interaction.showModal(modal);

		client.on(Events.InteractionCreate, interaction => {
			if (!interaction.isModalSubmit()) return;

			// Get the data entered by the user
			const favoriteColor = interaction.fields.getTextInputValue('favoriteColorInput');
			const hobbies = interaction.fields.getTextInputValue('hobbiesInput');
			console.log({ favoriteColor, hobbies });
		});

/*		msia.deferReply();

		const eventId = msia.fields.getTextInputValue('eventId') ?? '';
		const eventText = msia.fields.getTextInputValue('eventText') ?? '';
		const defaultChildId = msia.fields.getTextInputValue('defaultChildId') ?? '';
		const eventBase = await interaction.client.eventUtil.getEventBase(eventId);
		console.log('1');

		try {
			if (eventBase != null) {
				console.log('2');
				// equivalent to: INSERT INTO tags (name, description, username) values (?, ?, ?);
				const newEvent = await EventBase.create({
					eventId: eventId,
					eventText: eventText,
					defaultChildId: defaultChildId,
				});
				return interaction.reply(`Event ${newEvent.eventId} added.`);
				console.log('3');
			}
			else {
				// equivalent to: INSERT INTO tags (name, description, username) values (?, ?, ?);
				const affectedRows = await EventBase.update({ defaultChildId: defaultChildId, eventText: eventText }, { where: { eventId: eventId } });

				if (affectedRows > 0) {
					return interaction.reply(`Event ${newEvent.eventId} was edited.`);
				}
				console.log('4');
			}
		}
		catch (error) {
			if (error.name === 'SequelizeUniqueConstraintError') {
				return interaction.reply('That tag already exists.');
			}

			return interaction.reply('Something went wrong with adding a tag.');
		}*/
	},
};

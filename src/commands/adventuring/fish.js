const { SlashCommandBuilder, InteractionContextType, MessageFlags, EmbedBuilder } = require('discord.js');
const { GlobalFlag } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const { EMOJI } = require('@root/enums.js');

// Catch table matching design doc section 4.4
// 50% fail, 22% herring, 15% mackerel, 9% giant crab (combat), 4% shark (combat)
const CATCH_TABLE = [
	{ id: null, name: null, weight: 60 },
	{ id: 'herring', name: 'Herring', weight: 18 },
	{ id: 'mackerel', name: 'Mackerel', weight: 12 },
	{ id: 'crab', name: 'Giant Crab', type: 'combat', event: 'fish-encounter-crab', weight: 7 },
	{ id: 'shark', name: 'Shark', type: 'combat', event: 'fish-encounter-shark', weight: 3 },
];

const TOTAL_WEIGHT = CATCH_TABLE.reduce((sum, e) => sum + e.weight, 0);

function rollCatch() {
	let roll = Math.random() * TOTAL_WEIGHT;
	for (const entry of CATCH_TABLE) {
		roll -= entry.weight;
		if (roll < 0) return entry;
	}
	return CATCH_TABLE[CATCH_TABLE.length - 1];
}

// Flavour text for non-combat catches only (herring, mackerel)
const CATCH_FLAVOUR = {
	herring: [
		'You pull up a small herring. Common, but honest work.',
		'A herring flaps at the end of your line. You\'ve seen worse.',
		'The herring practically jumped onto the hook.',
	],
	mackerel: [
		'A mackerel. Firm, decent weight. Not bad.',
		'You haul in a mackerel. The cook will be pleased.',
		'A fine mackerel breaks the surface. A good catch.',
	],
};

const FAIL_FLAVOUR = [
	'Nothing. The sea keeps its counsel today.',
	'A bite — then gone. The line comes up empty.',
	'You wait. The water gives nothing back.',
	'Something tugs and vanishes. Not your day.',
	'The hook returns bare. Perhaps tomorrow.',
];

function pickFlavour(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('fish')
		.setDescription('Cast a line from the deck.')
		.setContexts(InteractionContextType.Guild)
		.addBooleanOption(opt =>
			opt.setName('donate')
				.setDescription('Donate the catch to the ship\'s food stock (+6 units) instead of keeping it.')
				.setRequired(false),
		),

	async execute(interaction) {
		try {
			const userId = interaction.user.id;
			const donateToStock = interaction.options.getBoolean('donate') ?? false;

			// Registration check
			const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.reply({
					content: 'You must complete registration before fishing.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Location check — must be on a deck
			const locationUtil = interaction.client.locationUtil;
			const channel = interaction.channel;
			const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
			const currentLocation = await locationUtil.getLocationByChannel(channelId);

			if (!currentLocation || !Array.isArray(currentLocation.tag) || !currentLocation.tag.includes('deck')) {
				return await interaction.reply({
					content: 'You need to be on the deck to fish.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Stamina check — fishing costs 3 stamina
			const STAMINA_COST = 5;
			const character = await characterUtil.getCharacterBase(userId);
			if ((character?.currentStamina ?? 0) < STAMINA_COST) {
				return await interaction.reply({
					content: `You are too tired to fish. (Requires ${STAMINA_COST} stamina)`,
					flags: MessageFlags.Ephemeral,
				});
			}
			await characterUtil.modifyCharacterStat(userId, 'currentStamina', -STAMINA_COST);

			// Roll the catch
			const result = rollCatch();

			// Combat encounters — hand off to event system entirely
			if (result.type === 'combat') {
				const eventUtil = interaction.client.eventUtil;
				await eventUtil.processEvent(result.event, interaction, userId, { ephemeral: false });
				return;
			}

			const embed = new EmbedBuilder();

			if (!result.id) {
				// Failed catch
				embed
					.setDescription(`${EMOJI.INFO} *${pickFlavour(FAIL_FLAVOUR)}*`)
					.setColor(0x7a7a7a);

				return await interaction.reply({ embeds: [embed] });
			}

			// Successful catch
			if (donateToStock) {
				// Add +6 to global food stock
				const stockRecord = await GlobalFlag.findOne({ where: { flag: 'global.food_stock' } });
				const current = stockRecord ? parseInt(stockRecord.value) || 0 : 300;
				await GlobalFlag.upsert({ flag: 'global.food_stock', value: String(current + 6) });

				embed
					.setDescription(`${EMOJI.SUCCESS} You pull up a **${result.name}** and hand it to the cook. The food stock increases by 6 units.`)
					.setFooter({ text: `Food stock: ${current + 6}` })
					.setColor(0x5ba85b);
			}
			else {
				// Add to inventory
				await characterUtil.addCharacterItem(userId, result.id, 1);

				const flavour = CATCH_FLAVOUR[result.id];
				embed
					.setDescription(`${EMOJI.SUCCESS} *${pickFlavour(flavour)}*\n\nYou receive: **${result.name}**`)
					.setColor(0x4a90d9);
			}

			await interaction.reply({ embeds: [embed] });
		}
		catch (error) {
			console.error('Error in fish command:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.editReply({ content: 'An error occurred.' }).catch(console.error);
			}
		}
	},
};

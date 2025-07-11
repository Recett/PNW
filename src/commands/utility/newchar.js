const { SlashCommandBuilder } = require('discord.js');
const gamecon = require('../../Data/gamecon.json');
const eventUtil = require('../../utility/eventUtility');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('newchar')
		.setDescription('Begin your adventure with a guided prologue event.'),
	async execute(interaction) {
		const userId = interaction.user.id;
		// Start the prologue event chain
		let currentEventId = gamecon.newchar;
		let continueChain = true;
		let flags = {};
		while (continueChain && currentEventId) {
			// Run the event and get the result (embed and next event id)
			const result = await eventUtil.handleEvent(currentEventId, interaction, flags, userId, true);
			if (result && result.embed) {
				await interaction.reply({ embeds: [result.embed], ephemeral: true });
			}
			// Decide next event: if handleEvent returns nextEventId, continue; else, break
			if (result && result.nextEventId) {
				currentEventId = result.nextEventId;
				// Optionally, update flags if result.flags is returned
				if (result.flags) flags = { ...flags, ...result.flags };
			} else {
				continueChain = false;
			}
		}
		// After the event chain ends, set player base stats
		const { CharacterBase } = require('@root/dbObject.js');
		const character = await CharacterBase.findOne({ where: { id: userId } });
		if (character) {
			await CharacterBase.update({
				maxHp: 100,
				currentHp: 100,
				str: 5,
				dex: 5,
				agi: 5,
				con: 5,
			}, { where: { id: userId } });
		}

		// After the event chain ends, give the player their starter items
		const { ItemLib, CharacterItem } = require('@root/dbObject.js');
		const starterItems = [
			'Sword',
			'Travelling Clothes',
			'Leather Shoe'
		];
		for (const itemName of starterItems) {
			const item = await ItemLib.findOne({ where: { name: itemName } });
			if (item) {
				await CharacterItem.create({
					character_id: userId,
					item_id: item.id || item.item_id,
					amount: 1,
					equipped: true,
				});
			}
		}

		// Calculate and update player's Combat and Attack stats
		const characterUtil = require('../../utility/characterUtility');
		await characterUtil.calculateCombatStat(userId);
		await characterUtil.calculateAttackStat(userId);

		// Display character stats to the player
		const { CharacterAttackStat, CharacterCombatStat } = require('@root/dbObject.js');
		const Discord = require('discord.js');
		const updatedCharacter = await CharacterBase.findOne({ where: { id: userId } });
		const combatStat = await CharacterCombatStat.findOne({ where: { character_id: userId } });
		const attackStat = await CharacterAttackStat.findOne({ where: { character_id: userId } });
		const statEmbed = new Discord.EmbedBuilder()
			.setTitle('Your Character Stats')
			.addFields(
				{ name: 'Name', value: updatedCharacter.fullname || updatedCharacter.name || 'Unknown', inline: true },
				{ name: 'HP', value: `${updatedCharacter.currentHp}/${updatedCharacter.maxHp}`, inline: true },
				{ name: 'STR', value: `${updatedCharacter.str}`, inline: true },
				{ name: 'DEX', value: `${updatedCharacter.dex}`, inline: true },
				{ name: 'AGI', value: `${updatedCharacter.agi}`, inline: true },
				{ name: 'CON', value: `${updatedCharacter.con}`, inline: true },
				{ name: 'Combat', value: combatStat ? `DEF: ${combatStat.defense}, SPD: ${combatStat.speed}, EVA: ${combatStat.evade}` : 'N/A', inline: false },
				{ name: 'Attack', value: attackStat ? `ATK: ${attackStat.attack}, ACC: ${attackStat.accuracy}, CRIT: ${attackStat.critical}` : 'N/A', inline: false }
			)
			.setColor(0x00AE86);
		await interaction.followUp({ embeds: [statEmbed], ephemeral: true });
	},
};

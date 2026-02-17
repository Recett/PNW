const { Events } = require('discord.js');

// Raid reaction emojis
const RAID_FIGHT_EMOJI = '⚔️';
const RAID_PASS_EMOJI = '🏃';

module.exports = {
	name: Events.MessageReactionAdd,
	async execute(reaction, user) {
		// Ignore bot reactions
		if (user.bot) return;

		// Handle partial reactions (for uncached messages)
		if (reaction.partial) {
			try {
				await reaction.fetch();
			}
			catch (error) {
				console.error('Error fetching reaction:', error);
				return;
			}
		}

		// Handle partial messages
		if (reaction.message.partial) {
			try {
				await reaction.message.fetch();
			}
			catch (error) {
				console.error('Error fetching message:', error);
				return;
			}
		}

		const emoji = reaction.emoji.name;

		// Check if this is a raid monster message
		if (emoji === RAID_FIGHT_EMOJI || emoji === RAID_PASS_EMOJI) {
			await handleRaidReaction(reaction, user, emoji);
		}
	},
};

async function handleRaidReaction(reaction, user, emoji) {
	const { getCharacterBase } = require('../utility/characterUtility');
	const RaidManager = require('../utility/raidManager');
	const { RaidMonster } = require('../dbObject');

	const message = reaction.message;

	// Find the raid monster by message ID
	const raidMonster = await RaidMonster.findOne({
		where: { message_id: message.id },
	});

	if (!raidMonster) {
		// Not a raid monster message
		return;
	}

	// Check if monster is still active
	if (raidMonster.status !== 'active') {
		// Remove the reaction silently - monster already dealt with
		try {
			await reaction.users.remove(user.id);
		}
		catch (e) {
			// Ignore permission errors
		}
		return;
	}

	// Get character
	const character = await getCharacterBase(user.id);
	if (!character) {
		// User doesn't have a character - remove reaction
		try {
			await reaction.users.remove(user.id);
			const dm = await user.createDM();
			await dm.send('You need a character to participate in raids. Use `/newchar` to create one.');
		}
		catch (e) {
			// Ignore DM errors
		}
		return;
	}

	try {
		if (emoji === '⚔️') {
			// Remove the reaction so user can react again later
			try {
				await reaction.users.remove(user.id);
			}
			catch (e) {
				// Ignore
			}

			// Execute combat
			const result = await RaidManager.executeRaidCombat(raidMonster.id, user.id, message.client);

			if (!result.success) {
				await message.channel.send({
					content: `❌ ${result.error}`,
				});
				return;
			}

			// Build combat result message
			const charName = character.name || 'Adventurer';

			if (result.defeated) {
				// Monster was defeated
				await message.channel.send({
					content: `⚔️ **${charName}** dealt **${result.damageDealt}** damage and defeated the monster!\n${result.lootResults?.goldGained ? `💰 Earned ${result.lootResults.goldGained} gold` : ''}\n${result.lootResults?.expGained ? `✨ Gained ${result.lootResults.expGained} EXP` : ''}`,
				});

				// Send battle report if available
				if (result.battleReport) {
					const reportChunks = splitMessage(result.battleReport, 1900);
					for (const chunk of reportChunks) {
						await message.channel.send({ content: `\`\`\`\n${chunk}\n\`\`\`` });
					}
				}
			}
			else {
				// Monster still alive
				await message.channel.send({
					content: `⚔️ **${charName}** dealt **${result.damageDealt}** damage! Monster HP: ${result.monsterHpRemaining}`,
				});
			}
		}
		else if (emoji === '🏃') {
			// Pass - just acknowledge silently
			// Remove reaction so they can pass again later if needed
			try {
				await reaction.users.remove(user.id);
			}
			catch (e) {
				// Ignore
			}
		}
	}
	catch (error) {
		console.error('Raid combat error:', error);
		await message.channel.send({
			content: `❌ Combat error: ${error.message}`,
		});
	}
}

/**
 * Split a message into chunks that fit Discord's character limit
 */
function splitMessage(text, maxLength = 1900) {
	if (text.length <= maxLength) return [text];
	
	const chunks = [];
	let remaining = text;
	
	while (remaining.length > 0) {
		if (remaining.length <= maxLength) {
			chunks.push(remaining);
			break;
		}
		
		// Find a good break point
		let breakPoint = remaining.lastIndexOf('\n', maxLength);
		if (breakPoint === -1 || breakPoint < maxLength / 2) {
			breakPoint = maxLength;
		}
		
		chunks.push(remaining.substring(0, breakPoint));
		remaining = remaining.substring(breakPoint);
	}
	
	return chunks;
}

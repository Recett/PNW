const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { CharacterBase, CharacterItem, GlobalFlag } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const contentStore = require('../../contentStore.js');
const { EMOJI } = require('../../enums');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('debug')
		.setDescription('[GM] Debug tools for managing players and world state.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(sub =>
			sub.setName('grant')
				.setDescription('Grant or deduct HP, stamina, gold, XP, and/or free stat points from a player.')
				.addUserOption(opt =>
					opt.setName('user')
						.setDescription('Target player.')
						.setRequired(true))
				.addIntegerOption(opt =>
					opt.setName('hp')
						.setDescription('HP amount (negative to deduct). Capped at max HP.')
						.setMinValue(-99999)
						.setMaxValue(99999))
				.addIntegerOption(opt =>
					opt.setName('stamina')
						.setDescription('Stamina amount (negative to deduct). Capped at max stamina.')
						.setMinValue(-99999)
						.setMaxValue(99999))
				.addIntegerOption(opt =>
					opt.setName('gold')
						.setDescription('Gold amount (negative to deduct). Minimum result is 0.')
						.setMinValue(-9999999)
						.setMaxValue(9999999))
				.addIntegerOption(opt =>
					opt.setName('xp')
						.setDescription('XP amount (negative to deduct). Triggers level-up if threshold met.')
						.setMinValue(-9999999)
						.setMaxValue(9999999))
				.addIntegerOption(opt =>
					opt.setName('free_point')
						.setDescription('Free stat points to grant (negative to deduct). Minimum result is 0.')
						.setMinValue(-999)
						.setMaxValue(999)),
		)
		.addSubcommand(sub =>
			sub.setName('item')
				.setDescription('Give or take an item from a player.')
				.addUserOption(opt =>
					opt.setName('user')
						.setDescription('Target player.')
						.setRequired(true))
				.addStringOption(opt =>
					opt.setName('item_id')
						.setDescription('The item ID (e.g. iron_sword).')
						.setRequired(true))
				.addIntegerOption(opt =>
					opt.setName('quantity')
						.setDescription('Quantity to give (negative to remove). Default: 1.')
						.setMinValue(-9999)
						.setMaxValue(9999)),
		)
		.addSubcommand(sub =>
			sub.setName('finditem')
				.setDescription('Find all players who hold a given item.')
				.addStringOption(opt =>
					opt.setName('item_id')
						.setDescription('The item ID to search for (e.g. bilge-key).')
						.setRequired(true)),
		)
		.addSubcommand(sub =>
			sub.setName('orphancheck')
				.setDescription('Scan all character inventories for item IDs that no longer exist in the content store.'),
		)
		.addSubcommand(sub =>
			sub.setName('remapitem')
				.setDescription('Replace one item ID with another across ALL character inventories.')
				.addStringOption(opt =>
					opt.setName('from_id')
						.setDescription('The broken/old item ID to replace.')
						.setRequired(true))
				.addStringOption(opt =>
					opt.setName('to_id')
						.setDescription('The valid item ID to remap to.')
						.setRequired(true)),
		)
		.addSubcommandGroup(group =>
			group.setName('flag')
				.setDescription('Read or modify flags.')
				.addSubcommand(sub =>
					sub.setName('get')
						.setDescription('Read a flag. Omit user for global flag.')
						.addStringOption(opt =>
							opt.setName('name')
								.setDescription('Flag name.')
								.setRequired(true))
						.addUserOption(opt =>
							opt.setName('user')
								.setDescription('Player (character flag). Omit for global flag.')),
				)
				.addSubcommand(sub =>
					sub.setName('set')
						.setDescription('Set a flag. Omit user for global flag. Value 0 deletes the flag.')
						.addStringOption(opt =>
							opt.setName('name')
								.setDescription('Flag name.')
								.setRequired(true))
						.addIntegerOption(opt =>
							opt.setName('value')
								.setDescription('New integer value. Set to 0 to delete the flag.')
								.setRequired(true))
						.addUserOption(opt =>
							opt.setName('user')
								.setDescription('Player (character flag). Omit for global flag.')),
				),
		),

	async execute(interaction) {
		const sub = interaction.options.getSubcommand();
		const group = interaction.options.getSubcommandGroup(false);

		if (group === 'flag') {
			if (sub === 'get') return handleFlagGet(interaction);
			if (sub === 'set') return handleFlagSet(interaction);
		}

		if (sub === 'grant') return handleGrant(interaction);
		if (sub === 'item') return handleItem(interaction);
		if (sub === 'finditem') return handleFindItem(interaction);
		if (sub === 'orphancheck') return handleOrphanCheck(interaction);
		if (sub === 'remapitem') return handleRemapItem(interaction);
	},
};

// ─── Orphan Check ────────────────────────────────────────────────────────────

async function handleOrphanCheck(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const allRows = await CharacterItem.findAll();
	const orphans = allRows.filter(row => contentStore.items.findByPk(row.item_id) == null);

	if (orphans.length === 0) {
		return interaction.editReply({ content: `${EMOJI.SUCCESS} No orphaned item entries found. All inventories are clean.` });
	}

	const grouped = {};
	for (const row of orphans) {
		if (!grouped[row.item_id]) grouped[row.item_id] = [];
		grouped[row.item_id].push(row.character_id);
	}

	const lines = Object.entries(grouped).map(([itemId, charIds]) =>
		`\`${itemId}\` — ${charIds.length} player(s) affected`,
	);

	return interaction.editReply({
		content: `${EMOJI.WARNING} **Orphaned item entries found** (${orphans.length} total rows):\n${lines.join('\n')}\n\nUse \`/debug remapitem\` to fix.`,
	});
}

// ─── Remap Item ───────────────────────────────────────────────────────────────

async function handleRemapItem(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const fromId = interaction.options.getString('from_id');
	const toId = interaction.options.getString('to_id');

	if (!contentStore.items.findByPk(toId)) {
		return interaction.editReply({
			content: `${EMOJI.FAILURE} Target item \`${toId}\` does not exist in the content store. Aborting.`,
		});
	}

	const rows = await CharacterItem.findAll({ where: { item_id: fromId } });
	if (rows.length === 0) {
		return interaction.editReply({
			content: `${EMOJI.WARNING} No character has item \`${fromId}\`. Nothing to remap.`,
		});
	}

	let replaced = 0;
	let merged = 0;

	for (const row of rows) {
		const existing = await CharacterItem.findOne({ where: { character_id: row.character_id, item_id: toId } });
		if (existing) {
			// Merge stacks, preserve the higher equipped state
			await existing.update({
				amount: existing.amount + row.amount,
				equipped: existing.equipped || row.equipped,
			});
			await row.destroy();
			merged++;
		}
		else {
			await row.update({ item_id: toId });
			replaced++;
		}
	}

	const toItem = contentStore.items.findByPk(toId);
	return interaction.editReply({
		content: `${EMOJI.SUCCESS} Remapped \`${fromId}\` → \`${toId}\` (${toItem?.name ?? toId}) across ${rows.length} player(s).\n` +
			`Replaced: ${replaced} | Merged into existing stack: ${merged}`,
	});
}

// ─── Grant ────────────────────────────────────────────────────────────────────

async function handleGrant(interaction) {
	const targetUser = interaction.options.getUser('user');
	const hpAmount = interaction.options.getInteger('hp');
	const staminaAmount = interaction.options.getInteger('stamina');
	const goldAmount = interaction.options.getInteger('gold');
	const xpAmount = interaction.options.getInteger('xp');
	const freePointAmount = interaction.options.getInteger('free_point');

	if (hpAmount === null && staminaAmount === null && goldAmount === null && xpAmount === null && freePointAmount === null) {
		return interaction.reply({
			content: `${EMOJI.WARNING} Provide at least one of \`hp\`, \`stamina\`, \`gold\`, \`xp\`, or \`free_point\`.`,
			flags: MessageFlags.Ephemeral,
		});
	}

	const character = await CharacterBase.findOne({ where: { id: targetUser.id } });
	if (!character) {
		return interaction.reply({
			content: `${EMOJI.FAILURE} No character found for ${targetUser}.`,
			flags: MessageFlags.Ephemeral,
		});
	}

	const updates = {};
	const lines = [];

	if (hpAmount !== null) {
		const before = character.currentHp ?? 0;
		const maxHp = character.maxHp ?? 0;
		const after = Math.max(0, Math.min(maxHp, before + hpAmount));
		updates.currentHp = after;
		lines.push(`HP: ${before} \u2192 ${after} / ${maxHp} (${hpAmount >= 0 ? '+' : ''}${hpAmount})`);
	}

	if (staminaAmount !== null) {
		const before = character.currentStamina ?? 0;
		const maxStamina = character.maxStamina ?? 0;
		const after = Math.max(0, Math.min(maxStamina, before + staminaAmount));
		updates.currentStamina = after;
		lines.push(`Stamina: ${before} \u2192 ${after} / ${maxStamina} (${staminaAmount >= 0 ? '+' : ''}${staminaAmount})`);
	}

	if (goldAmount !== null) {
		const before = character.gold ?? 0;
		const after = Math.max(0, before + goldAmount);
		updates.gold = after;
		lines.push(`Gold: ${before} \u2192 ${after} (${goldAmount >= 0 ? '+' : ''}${goldAmount})`);
	}

	if (freePointAmount !== null) {
		const before = character.free_point ?? 0;
		const after = Math.max(0, before + freePointAmount);
		updates.free_point = after;
		lines.push(`Free Points: ${before} \u2192 ${after} (${freePointAmount >= 0 ? '+' : ''}${freePointAmount})`);
	}

	await CharacterBase.update(updates, { where: { id: targetUser.id } });

	if (xpAmount !== null) {
		const xpResult = await characterUtil.addCharacterExperience(targetUser.id, xpAmount);
		const freshChar = await CharacterBase.findOne({ where: { id: targetUser.id } });
		const beforeXp = (character.xp ?? 0);
		const afterXp = freshChar.xp ?? 0;
		lines.push(`XP: ${beforeXp} \u2192 ${afterXp} (${xpAmount >= 0 ? '+' : ''}${xpAmount})`);
		if (xpResult.leveledUp) {
			lines.push(`Level: ${xpResult.oldLevel} \u2192 ${xpResult.newLevel} (+${xpResult.freeStatPointsGained} free points)`);
		}
	}

	return interaction.reply({
		content: `${EMOJI.SUCCESS} Updated **${character.name}** (${targetUser}):\n${lines.join('\n')}`,
		flags: MessageFlags.Ephemeral,
	});
}

// ─── Item ─────────────────────────────────────────────────────────────────────

async function handleItem(interaction) {
	const targetUser = interaction.options.getUser('user');
	const itemId = interaction.options.getString('item_id');
	const quantity = interaction.options.getInteger('quantity') ?? 1;

	if (quantity === 0) {
		return interaction.reply({
			content: `${EMOJI.WARNING} Quantity cannot be 0. Use a positive number to give, negative to take.`,
			flags: MessageFlags.Ephemeral,
		});
	}

	const character = await CharacterBase.findOne({ where: { id: targetUser.id } });
	if (!character) {
		return interaction.reply({
			content: `${EMOJI.FAILURE} No character found for ${targetUser}.`,
			flags: MessageFlags.Ephemeral,
		});
	}

	if (quantity > 0) {
		const result = await characterUtil.addCharacterItem(targetUser.id, itemId, quantity);
		if (!result.success) {
			return interaction.reply({
				content: `${EMOJI.FAILURE} Failed to add item \`${itemId}\`.`,
				flags: MessageFlags.Ephemeral,
			});
		}
		return interaction.reply({
			content: `${EMOJI.SUCCESS} Gave **${quantity}x \`${itemId}\`** to **${character.name}** (total: ${result.newTotal}).`,
			flags: MessageFlags.Ephemeral,
		});
	}
	else {
		const result = await characterUtil.removeCharacterItem(targetUser.id, itemId, Math.abs(quantity));
		if (!result.success) {
			return interaction.reply({
				content: `${EMOJI.FAILURE} **${character.name}** does not have item \`${itemId}\`.`,
				flags: MessageFlags.Ephemeral,
			});
		}
		return interaction.reply({
			content: `${EMOJI.SUCCESS} Removed **${result.quantityRemoved}x \`${itemId}\`** from **${character.name}**.`,
			flags: MessageFlags.Ephemeral,
		});
	}
}

// ─── Find Item ───────────────────────────────────────────────────────────────

async function handleFindItem(interaction) {
	const itemId = interaction.options.getString('item_id');

	const rows = await CharacterItem.findAll({ where: { item_id: itemId } });

	if (rows.length === 0) {
		return interaction.reply({
			content: `No players are holding item \`${itemId}\`.`,
			flags: MessageFlags.Ephemeral,
		});
	}

	const characterIds = rows.map(r => r.character_id);
	const characters = await CharacterBase.findAll({ where: { id: characterIds } });
	const nameMap = Object.fromEntries(characters.map(c => [c.id, c.name]));

	const lines = rows.map(r => {
		const name = nameMap[r.character_id] ?? `(unknown: ${r.character_id})`;
		const equippedTag = r.equipped ? ' [equipped]' : '';
		return `**${name}** — ${r.amount}x${equippedTag}`;
	});

	return interaction.reply({
		content: `Players holding \`${itemId}\` (${rows.length}):\n${lines.join('\n')}`,
		flags: MessageFlags.Ephemeral,
	});
}

// ─── Flag Get ─────────────────────────────────────────────────────────────────

async function handleFlagGet(interaction) {
	const rawName = interaction.options.getString('name');
	const targetUser = interaction.options.getUser('user');

	if (targetUser) {
		const flagName = rawName.startsWith('char.') ? rawName : `char.${rawName}`;
		const character = await CharacterBase.findOne({ where: { id: targetUser.id } });
		if (!character) {
			return interaction.reply({
				content: `${EMOJI.FAILURE} No character found for ${targetUser}.`,
				flags: MessageFlags.Ephemeral,
			});
		}
		const value = await characterUtil.getCharacterFlag(targetUser.id, flagName);
		return interaction.reply({
			content: `Character flag \`${flagName}\` for **${character.name}**: \`${value ?? '(not set)'}\``,
			flags: MessageFlags.Ephemeral,
		});
	}
	else {
		const flagName = rawName.startsWith('global.') ? rawName : `global.${rawName}`;
		const flag = await GlobalFlag.findOne({ where: { flag: flagName } });
		const value = flag ? flag.value : null;
		return interaction.reply({
			content: `Global flag \`${flagName}\`: \`${value ?? '(not set)'}\``,
			flags: MessageFlags.Ephemeral,
		});
	}
}

// ─── Flag Set ─────────────────────────────────────────────────────────────────

async function handleFlagSet(interaction) {
	const rawName = interaction.options.getString('name');
	const value = interaction.options.getInteger('value');
	const targetUser = interaction.options.getUser('user');

	if (targetUser) {
		const flagName = rawName.startsWith('char.') ? rawName : `char.${rawName}`;
		const character = await CharacterBase.findOne({ where: { id: targetUser.id } });
		if (!character) {
			return interaction.reply({
				content: `${EMOJI.FAILURE} No character found for ${targetUser}.`,
				flags: MessageFlags.Ephemeral,
			});
		}
		await characterUtil.updateCharacterFlag(targetUser.id, flagName, value);
		const action = value === 0 ? 'Deleted' : 'Set';
		return interaction.reply({
			content: `${EMOJI.SUCCESS} ${action} character flag \`${flagName}\` for **${character.name}** to \`${value}\`.`,
			flags: MessageFlags.Ephemeral,
		});
	}
	else {
		const flagName = rawName.startsWith('global.') ? rawName : `global.${rawName}`;
		if (value === 0) {
			await GlobalFlag.destroy({ where: { flag: flagName } });
			return interaction.reply({
				content: `${EMOJI.SUCCESS} Deleted global flag \`${flagName}\`.`,
				flags: MessageFlags.Ephemeral,
			});
		}
		await GlobalFlag.upsert({ flag: flagName, value: value });
		return interaction.reply({
			content: `${EMOJI.SUCCESS} Set global flag \`${flagName}\` to \`${value}\`.`,
			flags: MessageFlags.Ephemeral,
		});
	}
}

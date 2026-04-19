const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { CharacterBase, CharacterItem, CharacterFlag, GlobalFlag, LocationBase, CharacterCombatStat, CharacterAttackStat, CharacterStatus } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const itemUtility = require('@utility/itemUtility.js');
const { resetNpcStockPurchases } = require('@utility/cronUtility.js');
const contentStore = require('../../contentStore.js');
const eventUtil = require('@utility/eventUtility.js');
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
		.addSubcommand(sub =>
			sub.setName('charinfo')
				.setDescription('Show raw HP, location, and regen eligibility info for a player.')
				.addUserOption(opt =>
					opt.setName('user')
						.setDescription('Target player.')
						.setRequired(true)),
		)
		.addSubcommand(sub =>
			sub.setName('unstick')
				.setDescription('Release a player stuck in a frozen event interaction.')
				.addUserOption(opt =>
					opt.setName('user')
						.setDescription('The player to unstick.')
						.setRequired(true)),
		)
		.addSubcommand(sub =>
			sub.setName('statcheck')
				.setDescription('Recalculate and display the full stat breakdown for a player.')
				.addUserOption(opt =>
					opt.setName('user')
						.setDescription('Target player.')
						.setRequired(true)),
		)
		.addSubcommand(sub =>
			sub.setName('restocknpc')
				.setDescription('Force-restock a single NPC shop by clearing its purchase records.')
				.addStringOption(opt =>
					opt.setName('npc_id')
						.setDescription('NPC YAML ID to restock.')
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
		)
		.addSubcommand(sub =>
			sub.setName('catscores')
				.setDescription('Show Lt. Morale cook high score and total score for all players.'),
		)
		.addSubcommandGroup(group =>
			group.setName('status')
				.setDescription('View or remove character status effects.')
				.addSubcommand(sub =>
					sub.setName('list')
						.setDescription('List all active status effects for a player.')
						.addUserOption(opt =>
							opt.setName('user')
								.setDescription('Target player.')
								.setRequired(true)),
				)
				.addSubcommand(sub =>
					sub.setName('clear')
						.setDescription('Remove a specific status effect from a player.')
						.addUserOption(opt =>
							opt.setName('user')
								.setDescription('Target player.')
								.setRequired(true))
						.addStringOption(opt =>
							opt.setName('status_id')
								.setDescription('Status ID to remove (e.g. knocked_out).')
								.setRequired(true)),
				),
		),

	async execute(interaction) {
		const sub = interaction.options.getSubcommand();
		const group = interaction.options.getSubcommandGroup(false);

		if (group === 'flag') {
			if (sub === 'get') return handleFlagGet(interaction);
			if (sub === 'set') return handleFlagSet(interaction);
		}

		if (group === 'status') {
			if (sub === 'list') return handleStatusList(interaction);
			if (sub === 'clear') return handleStatusClear(interaction);
		}

		if (sub === 'grant') return handleGrant(interaction);
		if (sub === 'item') return handleItem(interaction);
		if (sub === 'finditem') return handleFindItem(interaction);
		if (sub === 'orphancheck') return handleOrphanCheck(interaction);
		if (sub === 'remapitem') return handleRemapItem(interaction);
		if (sub === 'charinfo') return handleCharInfo(interaction);
		if (sub === 'unstick') return handleUnstick(interaction);
		if (sub === 'statcheck') return handleStatCheck(interaction);
		if (sub === 'restocknpc') return handleRestockNpc(interaction);
		if (sub === 'catscores') return handleCatScores(interaction);
	},
};

async function handleRestockNpc(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const npcId = interaction.options.getString('npc_id');
	const npc = contentStore.npcs.findByPk(npcId);

	if (!npc) {
		return interaction.editReply({
			content: `${EMOJI.FAILURE} NPC \`${npcId}\` was not found in the content store.`,
		});
	}

	if (!Array.isArray(npc.stock) || npc.stock.length === 0) {
		return interaction.editReply({
			content: `${EMOJI.WARNING} **${npc.name}** (\`${npc.id}\`) has no item shop stock configured. Nothing to restock.`,
		});
	}

	const deleted = await resetNpcStockPurchases(npc.id);
	return interaction.editReply({
		content: `${EMOJI.SUCCESS} Restocked **${npc.name}** (\`${npc.id}\`). Cleared ${deleted} purchase record(s); item stock is back to YAML max values.`,
	});
}

// ─── Stat Check ──────────────────────────────────────────────────────────────

async function handleStatCheck(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const targetUser = interaction.options.getUser('user');
	const character = await CharacterBase.findOne({ where: { id: targetUser.id } });
	if (!character) {
		return interaction.editReply({ content: `${EMOJI.FAILURE} No character found for ${targetUser}.` });
	}

	// Recalculate fresh (defense before attack so maxWeight is current in DB)
	await characterUtil.calculateCombatStat(character.id);
	await characterUtil.calculateAttackStat(character.id);

	const combatStat = await CharacterCombatStat.findOne({ where: { character_id: character.id } });
	const attackStats = await CharacterAttackStat.findAll({ where: { character_id: character.id } });

	// Gather equipped items with weights for the breakdown
	const equippedRows = await CharacterItem.findAll({ where: { character_id: character.id, equipped: true } });
	const gearLines = [];
	for (const row of equippedRows) {
		const details = await itemUtility.getItemWithDetails(row.item_id);
		let weight = details?.weight || details?.weapon?.weight || details?.armor?.weight || 0;
		const slot = details?.weapon?.slot ?? details?.armor?.slot ?? '?';
		gearLines.push(`  \`${row.item_id}\` [${slot}] — weight \`${weight}\``);
	}

	// Weight penalty display
	const curW = combatStat?.currentWeight ?? 0;
	const maxW = combatStat?.maxWeight ?? 0;
	let penaltyLine;
	if (curW > maxW && maxW > 0) {
		const penalty = Math.pow(curW - maxW, 2) * 1.5 / curW;
		penaltyLine = `${EMOJI.FAILURE} OVERWEIGHT — penalty \`${penalty.toFixed(2)}\` (agi reduced by \`${Math.floor(penalty)}\`, accuracy reduced by \`${Math.floor(penalty)}\`)`;
	}
	else {
		penaltyLine = `${EMOJI.SUCCESS} Not overweight`;
	}

	// Food buffs
	const now = Date.now();
	const foodRows = await CharacterStatus.findAll({ where: { character_id: character.id, source: 'food' } });
	const activeFoodRows = foodRows.filter(b => b.expires_at == null || new Date(b.expires_at).getTime() >= now);
	const foodLines = activeFoodRows.length > 0
		? activeFoodRows.map(b => `  \`${b.stat_target}\` +${b.potency}`)
		: ['  (none)'];

	// Per-weapon attack stat lines
	const weaponLines = attackStats.length > 0
		? attackStats.map(a => {
			const item = contentStore.items.findByPk(a.item_id);
			const name = item?.name ?? a.item_id;
			return `  **${name}** — atk \`${a.attack}\` | acc \`${a.accuracy}\` | crit \`${a.critical}\` | cd \`${a.cooldown}\``;
		})
		: ['  (no weapons)'];

	const lines = [
		`**Stat Check — ${character.name}** (${targetUser})`,
		'',
		`**Base stats:** STR \`${character.str}\` | DEX \`${character.dex}\` | AGI \`${character.agi}\` | CON \`${character.con}\``,
		'',
		`**Equipped gear:**`,
		...(gearLines.length > 0 ? gearLines : ['  (none)']),
		`**Weight:** \`${curW}\` / \`${maxW}\` (maxWeight = STR)`,
		penaltyLine,
		'',
		`**Combat stats (DB after recalc):**`,
		`  defense \`${combatStat?.defense ?? 'N/A'}\` | speed \`${combatStat?.speed ?? 'N/A'}\` | evade \`${combatStat?.evade ?? 'N/A'}\``,
		`  crit_resistance \`${combatStat?.crit_resistance ?? 'N/A'}\` | defense_percent \`${combatStat?.defense_percent ?? 'N/A'}\``,
		'',
		`**Attack stats per weapon:**`,
		...weaponLines,
		'',
		`**Active food buffs:**`,
		...foodLines,
	];

	return interaction.editReply({ content: lines.join('\n') });
}

// ─── Unstick ─────────────────────────────────────────────────────────────────

async function handleUnstick(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const target = interaction.options.getUser('user');

	const { wasLocked } = eventUtil.unlockCharacter(target.id);

	if (wasLocked) {
		return interaction.editReply({ content: `${EMOJI.SUCCESS} <@${target.id}> has been unstuck. Their active event session has been cleared.` });
	}
	else {
		return interaction.editReply({ content: `${EMOJI.WARNING} <@${target.id}> was not locked in any active event.` });
	}
}

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
			lines.push(`Level: ${xpResult.oldLevel} \u2192 ${xpResult.newLevel} (+${xpResult.freeStatPointsGained} free points, +${xpResult.perkPointsGained || 0} perk point${(xpResult.perkPointsGained || 0) === 1 ? '' : 's'})`);
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

// ─── Char Info ───────────────────────────────────────────────────────────────

async function handleCharInfo(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const targetUser = interaction.options.getUser('user');

	const character = await CharacterBase.findOne({ where: { id: targetUser.id } });
	if (!character) {
		return interaction.editReply({ content: `${EMOJI.FAILURE} No character found for ${targetUser}.` });
	}

	const location = character.location_id
		? await LocationBase.findOne({ where: { id: character.location_id } })
		: null;

	// Use the same table the cron SQL checks
	const koStatus = await CharacterStatus.findOne({ where: { character_id: targetUser.id, status_id: 'knocked_out' } });

	const hasMaxHp = character.maxHp !== null && character.maxHp !== undefined;
	const hasCurrentHp = character.currentHp !== null && character.currentHp !== undefined;
	const locationType = location?.type ?? null;
	const isInTown = locationType !== null && locationType.toLowerCase() === 'town';
	const isKnockedOut = koStatus !== null && koStatus.expires_at !== null && new Date(koStatus.expires_at) > new Date();
	const wouldRegen = hasMaxHp && hasCurrentHp && isInTown && !isKnockedOut;

	let regenNote = '';
	if (hasMaxHp && hasCurrentHp) {
		const gain = Math.floor(character.maxHp * 0.20 + 0.999);
		const after = Math.min(character.maxHp, character.currentHp + gain);
		regenNote = ` (next tick: +${gain} \u2192 ${after})`;
	}

	const koExpiresTs = koStatus?.expires_at ? Math.floor(new Date(koStatus.expires_at).getTime() / 1000) : null;
	const lines = [
		`**Character:** ${character.name} (${targetUser})`,
		`**HP:** \`${character.currentHp ?? 'NULL'}\` / \`${character.maxHp ?? 'NULL'}\`${regenNote}`,
		`**Location:** ${location?.name ?? '(unknown)'} \`[${character.location_id ?? 'NULL'}]\``,
		`**Location type:** \`${locationType ?? 'NULL'}\``,
		`**knocked_out** (character_statuses): ${isKnockedOut ? `active, expires <t:${koExpiresTs}:R>` : koStatus ? `(expired — stale record in DB${koExpiresTs ? `, was <t:${koExpiresTs}:R>` : ', no expires_at'})` : '(none)'}`,
		'',
		'**Regen filter check:**',
		`${hasMaxHp ? EMOJI.SUCCESS : EMOJI.FAILURE} maxHp IS NOT NULL`,
		`${hasCurrentHp ? EMOJI.SUCCESS : EMOJI.FAILURE} currentHp IS NOT NULL`,
		`${isInTown ? EMOJI.SUCCESS : EMOJI.FAILURE} location type = 'town' (actual: \`${locationType ?? 'NULL'}\`)`,
		`${!isKnockedOut ? EMOJI.SUCCESS : EMOJI.FAILURE} not knocked out`,
		'',
		wouldRegen
			? `${EMOJI.SUCCESS} **Player WOULD receive HP regen.**`
			: `${EMOJI.FAILURE} **Player is EXCLUDED from HP regen.**`,
	];

	return interaction.editReply({ content: lines.join('\n') });
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
// ─── Cat Scores ──────────────────────────────────────────────────────────────

async function handleCatScores(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const highScoreRows = await CharacterFlag.findAll({ where: { flag: 'lt_morale_cook_high_score' } });
	const accumRows = await CharacterFlag.findAll({ where: { flag: 'lt_morale_cook_accumulated' } });

	const highMap = Object.fromEntries(highScoreRows.map(r => [r.character_id, parseInt(r.value) || 0]));
	const accumMap = Object.fromEntries(accumRows.map(r => [r.character_id, parseInt(r.value) || 0]));

	const allIds = [...new Set([...Object.keys(highMap), ...Object.keys(accumMap)])];

	if (allIds.length === 0) {
		return interaction.editReply({ content: `${EMOJI.WARNING} No cat event scores found yet.` });
	}

	const characters = await CharacterBase.findAll({ where: { id: allIds } });
	const nameMap = Object.fromEntries(characters.map(c => [c.id, c.name]));

	const rows = allIds.map(id => ({
		name: nameMap[id] ?? `(unknown: ${id})`,
		high: highMap[id] ?? 0,
		total: accumMap[id] ?? 0,
	}));

	rows.sort((a, b) => b.high - a.high || b.total - a.total);

	const lines = rows.map((r, i) =>
		`**${i + 1}.** ${r.name} — High: \`${r.high}\` | Total: \`${r.total}\``,
	);

	const header = `**Lt. Morale Cook Scores** (${rows.length} player(s)) — sorted by high score\n`;
	const body = lines.join('\n');
	const full = header + body;

	if (full.length > 1900) {
		const truncated = full.slice(0, 1900) + '\n*(truncated)*';
		return interaction.editReply({ content: truncated });
	}

	return interaction.editReply({ content: full });
}
// ─── Status List ───────────────────────────────────────────────────────────────

async function handleStatusList(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const targetUser = interaction.options.getUser('user');

	const character = await CharacterBase.findOne({ where: { id: targetUser.id } });
	if (!character) {
		return interaction.editReply({ content: `${EMOJI.FAILURE} No character found for ${targetUser}.` });
	}

	const statuses = await CharacterStatus.findAll({ where: { character_id: targetUser.id } });
	if (statuses.length === 0) {
		return interaction.editReply({ content: `${EMOJI.SUCCESS} **${character.name}** has no active status effects.` });
	}

	const now = new Date();
	const lines = statuses.map(s => {
		const id = s.status_id || s.status || '(unknown)';
		let expiry = '';
		if (s.expires_at) {
			const ts = Math.floor(new Date(s.expires_at).getTime() / 1000);
			expiry = new Date(s.expires_at) > now ? ` — expires <t:${ts}:R>` : ' — **expired (stale)**';
		}
		const extra = s.potency != null ? ` potency: ${s.potency}` : '';
		return `\`${id}\`${extra}${expiry}`;
	});

	return interaction.editReply({
		content: `**${character.name}** statuses (${statuses.length}):\n${lines.join('\n')}`,
	});
}

// ─── Status Clear ──────────────────────────────────────────────────────────────

async function handleStatusClear(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const targetUser = interaction.options.getUser('user');
	const statusId = interaction.options.getString('status_id');

	const character = await CharacterBase.findOne({ where: { id: targetUser.id } });
	if (!character) {
		return interaction.editReply({ content: `${EMOJI.FAILURE} No character found for ${targetUser}.` });
	}

	// Match against both status_id and status columns
	const existing = await CharacterStatus.findOne({
		where: { character_id: targetUser.id, status_id: statusId },
	});

	if (!existing) {
		return interaction.editReply({
			content: `${EMOJI.WARNING} **${character.name}** does not have status \`${statusId}\`.`,
		});
	}

	await existing.destroy();

	// If it was knocked_out, also restore HP to 1 if still at 0
	if (statusId === 'knocked_out' && (character.currentHp ?? 0) <= 0) {
		await CharacterBase.update({ currentHp: 1 }, { where: { id: targetUser.id } });
		return interaction.editReply({
			content: `${EMOJI.SUCCESS} Removed \`${statusId}\` from **${character.name}** and restored HP to 1.`,
		});
	}

	return interaction.editReply({
		content: `${EMOJI.SUCCESS} Removed \`${statusId}\` from **${character.name}**.`,
	});
}

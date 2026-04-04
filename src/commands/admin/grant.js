const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');
const { EMOJI } = require('../../enums');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('grant')
		.setDescription('[Admin] Grant HP and/or stamina to a player.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The player to grant resources to.')
				.setRequired(true))
		.addIntegerOption(option =>
			option.setName('hp')
				.setDescription('Amount of HP to grant (can be negative to deduct).')
				.setRequired(false)
				.setMinValue(-9999)
				.setMaxValue(9999))
		.addIntegerOption(option =>
			option.setName('stamina')
				.setDescription('Amount of stamina to grant (can be negative to deduct).')
				.setRequired(false)
				.setMinValue(-9999)
				.setMaxValue(9999)),

	async execute(interaction) {
		const targetUser = interaction.options.getUser('user');
		const hpAmount = interaction.options.getInteger('hp');
		const staminaAmount = interaction.options.getInteger('stamina');

		if (hpAmount === null && staminaAmount === null) {
			return interaction.reply({
				content: `${EMOJI.WARNING} Please provide at least one of \`hp\` or \`stamina\`.`,
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

		await CharacterBase.update(updates, { where: { id: targetUser.id } });

		return interaction.reply({
			content: `${EMOJI.SUCCESS} Granted resources to **${character.name}** (${targetUser}):\n${lines.join('\n')}`,
			flags: MessageFlags.Ephemeral,
		});
	},
};

const { SlashCommandBuilder, InteractionContextType, MessageFlags, AttachmentBuilder } = require('discord.js');
const { EMOJI } = require('@/enums.js');
const path = require('path');
const fs = require('fs');
const https = require('https');

const DB_PATH = path.join(__dirname, '../../database.sqlite');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dbfile')
		.setDescription('Download or upload the database file (Admin only)')
		.setContexts([InteractionContextType.Guild])
		.addSubcommand(sub =>
			sub.setName('download')
				.setDescription('Send the current database.sqlite as a file attachment'),
		)
		.addSubcommand(sub =>
			sub.setName('upload')
				.setDescription('Replace the database with an uploaded .sqlite file (DANGEROUS — bot will restart)')
				.addAttachmentOption(opt =>
					opt.setName('file')
						.setDescription('The .sqlite file to restore')
						.setRequired(true),
				),
		),

	async execute(interaction) {
		if (!interaction.member.permissions.has('Administrator')) {
			return interaction.reply({
				content: `${EMOJI.FAILURE} Administrator permission required.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const sub = interaction.options.getSubcommand();

		// ── DOWNLOAD ────────────────────────────────────────────────────────────
		if (sub === 'download') {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			if (!fs.existsSync(DB_PATH)) {
				return interaction.editReply(`${EMOJI.FAILURE} Database file not found at expected path.`);
			}

			const stat = fs.statSync(DB_PATH);
			const sizeMB = (stat.size / 1024 / 1024).toFixed(2);

			if (stat.size > 25 * 1024 * 1024) {
				return interaction.editReply(
					`${EMOJI.FAILURE} Database is **${sizeMB} MB** — exceeds Discord's 25 MB limit.`,
				);
			}

			const attachment = new AttachmentBuilder(DB_PATH, { name: 'database.sqlite' });
			return interaction.editReply({
				content: `${EMOJI.SUCCESS} Current database (**${sizeMB} MB**). Keep this safe.`,
				files: [attachment],
			});
		}

		// ── UPLOAD ──────────────────────────────────────────────────────────────
		if (sub === 'upload') {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const attachment = interaction.options.getAttachment('file');

			if (!attachment.name.endsWith('.sqlite')) {
				return interaction.editReply(`${EMOJI.FAILURE} File must be a \`.sqlite\` file.`);
			}

			// Back up the current DB before overwriting
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupPath = `${DB_PATH}.backup-${timestamp}`;

			try {
				if (fs.existsSync(DB_PATH)) {
					fs.copyFileSync(DB_PATH, backupPath);
				}
			}
			catch (err) {
				return interaction.editReply(`${EMOJI.FAILURE} Failed to back up current database: ${err.message}`);
			}

			// Download the attachment to a temp file first, then atomically replace
			const tempPath = `${DB_PATH}.incoming`;

			try {
				await downloadFile(attachment.url, tempPath);
			}
			catch (err) {
				return interaction.editReply(`${EMOJI.FAILURE} Failed to download attachment: ${err.message}`);
			}

			try {
				fs.renameSync(tempPath, DB_PATH);
			}
			catch (err) {
				// Clean up temp file if rename fails
				if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
				return interaction.editReply(`${EMOJI.FAILURE} Failed to replace database: ${err.message}`);
			}

			await interaction.editReply(
				`${EMOJI.SUCCESS} Database replaced successfully.\n` +
				`Backup saved as \`${path.basename(backupPath)}\`.\n` +
				'**The bot process will now exit** — your host should restart it automatically.',
			);

			// Give Discord time to send the reply before exiting
			setTimeout(() => process.exit(0), 2000);
		}
	},
};

/**
 * Downloads a URL to a local file path.
 * @param {string} url
 * @param {string} destPath
 * @returns {Promise<void>}
 */
function downloadFile(url, destPath) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(destPath);

		https.get(url, response => {
			if (response.statusCode !== 200) {
				file.destroy();
				fs.unlink(destPath, () => {});
				return reject(new Error(`HTTP ${response.statusCode}`));
			}

			response.pipe(file);

			file.on('finish', () => file.close(resolve));
			file.on('error', err => {
				fs.unlink(destPath, () => {});
				reject(err);
			});
		}).on('error', err => {
			fs.unlink(destPath, () => {});
			reject(err);
		});
	});
}

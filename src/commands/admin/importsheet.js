const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { EventBase } = require('@root/dbObject.js');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
	try {
		const content = await fs.readFile(TOKEN_PATH);
		const credentials = JSON.parse(content);
		return google.auth.fromJSON(credentials);
	} catch (err) {
		return null;
	}
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
	const content = await fs.readFile(CREDENTIALS_PATH);
	const keys = JSON.parse(content);
	const key = keys.installed || keys.web;
	const payload = JSON.stringify({
		type: 'authorized_user',
		client_id: key.client_id,
		client_secret: key.client_secret,
		refresh_token: client.credentials.refresh_token,
	});
	await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
	let client = await loadSavedCredentialsIfExist();
	if (client) {
		return client;
	}
	client = await authenticate({
		scopes: SCOPES,
		keyfilePath: CREDENTIALS_PATH,
	});
	if (client.credentials) {
		await saveCredentials(client);
	}
	return client;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('importsheet')
		.setDescription('Import data from a Google Sheet')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addStringOption(option =>
			option.setName('url').setDescription('Google Sheet URL').setRequired(true)),

	async execute(interaction) {
		// Extract sheet ID from URL
		const url = interaction.options.getString('url');
		const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
		if (!match) {
			return interaction.reply({ content: 'Invalid Google Sheet URL.', ephemeral: true });
		}
		const sheetId = match[1];

		await interaction.reply({ content: 'Importing data from Google Sheet...', ephemeral: true });

		async function doImport(auth) {
			const sheets = google.sheets({ version: 'v4', auth });
			try {
				const res = await sheets.spreadsheets.values.get({
					spreadsheetId: sheetId,
					range: 'Sheet1!A2:J',
				});
				const rows = res.data.values;
				if (!rows || rows.length === 0) {
					return interaction.editReply('No data found in the specified range.');
				}

				// Import each row to EventBase
				let imported = 0;
				for (const row of rows) {
					// Adjust the mapping as needed for your EventBase schema
					const [id, title, text, avatar, illustration, default_child_event_id, choose_placeholder, hidden, npc, check] = row;
					try {
						await EventBase.create({
							id,
							title,
							avatar,
							illustration,
							text,
							default_child_event_id,
							choose_placeholder,
							hidden: hidden === 'true' || hidden === true ? true : false,
							npc,
							check: check === 'true' || check === true ? true : false,
						});
						imported++;
					}
					catch {
						// Optionally log or handle duplicate/invalid rows
					}
				}
				await interaction.editReply(`Imported ${imported} events from Google Sheet.`);
			}
			catch (error) {
				await interaction.editReply(`Error importing from Google Sheet: ${error}`);
			}
		}
		authorize().then(doImport).catch(console.error);
	},
};

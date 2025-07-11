// importGoogleSheet.js
// Usage: node importGoogleSheet.js <googleSheetUrl> [range]
// Imports data from a Google Sheet directly into the EventBase table (no Discord required)

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const Sequelize = require('sequelize');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

async function loadSavedCredentialsIfExist() {
	try {
		const content = await fs.readFile(TOKEN_PATH);
		const credentials = JSON.parse(content);
		return google.auth.fromJSON(credentials);
	} catch (err) {
		return null;
	}
}

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

async function importSheet(sheetId, range) {
	const auth = await authorize();
	const sheets = google.sheets({ version: 'v4', auth });
	// Get all sheet metadata
	const metaRes = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
	const sheetInfos = metaRes.data.sheets.map(s => s.properties.title);
	for (const sheetName of sheetInfos) {
		// If no range is provided, get the header row to determine the range
		let actualRange = range;
		let header;
		if (!range) {
			const meta = await sheets.spreadsheets.values.get({
				spreadsheetId: sheetId,
				range: `${sheetName}!1:1`,
			});
			header = meta.data.values && meta.data.values[0];
			if (header && header.length > 0) {
				const lastCol = String.fromCharCode('A'.charCodeAt(0) + header.length - 1);
				actualRange = `${sheetName}!A2:${lastCol}`;
			} else {
				actualRange = `${sheetName}!A2:J`; // fallback
			}
		} else {
			actualRange = range;
		}
		const res = await sheets.spreadsheets.values.get({
			spreadsheetId: sheetId,
			range: actualRange,
		});
		const rows = res.data.values;
		if (!rows || rows.length === 0) {
			console.log(`No data found in sheet ${sheetName}.`);
			continue;
		}
		await sequelize.sync();
		// Dynamically require the model based on sheet name
		let Model;
		try {
			Model = require(`./models/event/${sheetName}.js`)(sequelize);
		} catch (e) {
			console.error(`Model for sheet '${sheetName}' not found.`);
			continue;
		}
		let imported = 0;
		for (const row of rows) {
			const record = {};
			for (let i = 0; i < header.length; i++) {
				record[header[i]] = row[i];
			}
			try {
				await Model.create(record);
				imported++;
			} catch (e) {
				// Optionally log or handle duplicate/invalid rows
			}
		}
		console.log(`Imported ${imported} records into ${sheetName}.`);
	}
	await sequelize.close();
}

if (require.main === module) {
	const [,, url, range] = process.argv;
	if (!url) {
		console.error('Usage: node importGoogleSheet.js <googleSheetUrl> [range]');
		process.exit(1);
	}
	const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
	if (!match) {
		console.error('Invalid Google Sheet URL.');
		process.exit(1);
	}
	const sheetId = match[1];
	importSheet(sheetId, range).catch(err => {
		console.error('Error importing from Google Sheet:', err);
		process.exit(1);
	});
}

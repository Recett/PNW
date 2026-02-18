const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { EQUIPMENT_SLOT_CONFIG, WEAPON_SLOTS } = require('@root/enums.js');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Find a font file using fc-list (fontconfig) on Linux
 * @param {string} fontFamily - Font family name (e.g., "Liberation Sans")
 * @returns {string|null} - Path to font file or null
 */
function findFontWithFc(fontFamily) {
	try {
		// Use fc-list to find font file path
		const output = execSync(`fc-list "${fontFamily}" file`, { encoding: 'utf8', timeout: 2000 });
		const lines = output.trim().split('\n');
		for (const line of lines) {
			// fc-list returns lines like: /path/to/font.ttf: Font Family Name:style
			const match = line.match(/^([^:]+\.ttf)/i);
			if (match) {
				return match[1].trim();
			}
		}
	}
	catch {
		// fc-list not available or failed
		return null;
	}
	return null;
}

// Register fonts (platform-specific)
try {
	// Windows
	if (process.platform === 'win32') {
		const windowsFontPath = 'C:\\Windows\\Fonts\\seguiemj.ttf';
		if (fs.existsSync(windowsFontPath)) {
			GlobalFonts.registerFromPath(windowsFontPath, 'Segoe UI Emoji');
			console.log('[Canvas] Registered Segoe UI Emoji font');
		}
		// Windows already has Arial/system fonts available
	}
	// Linux (Railway/production)
	else if (process.platform === 'linux') {
		let fontsRegistered = 0;
		
		// Register Liberation Sans family (all weights) - CRITICAL for rendering
		const liberationFonts = [
			{ file: 'LiberationSans-Regular.ttf', family: 'Liberation Sans' },
			{ file: 'LiberationSans-Bold.ttf', family: 'Liberation Sans' },
		];
		
		// Standard Linux paths
		const basePaths = [
			'/usr/share/fonts/truetype/liberation',
			'/usr/share/fonts/truetype/liberation2',
			'/usr/share/fonts/liberation-sans',
			'/run/current-system/sw/share/fonts/truetype',
		];
		
		// Search Nix store for liberation fonts (Railway uses Nix)
		try {
			const findCmd = 'find /nix/store -name "LiberationSans-*.ttf" 2>/dev/null | head -5';
			const nixFonts = execSync(findCmd, { encoding: 'utf8', timeout: 5000 }).trim().split('\n').filter(Boolean);
			
			if (nixFonts.length > 0) {
				console.log('[Canvas] Found Liberation fonts in Nix store:', nixFonts.length);
				for (const fontPath of nixFonts) {
					if (fontPath.includes('Regular')) {
						GlobalFonts.registerFromPath(fontPath, 'Liberation Sans');
						console.log('[Canvas] Registered Regular from Nix:', fontPath);
						fontsRegistered++;
					}
					else if (fontPath.includes('Bold') && !fontPath.includes('Italic')) {
						GlobalFonts.registerFromPath(fontPath, 'Liberation Sans');
						console.log('[Canvas] Registered Bold from Nix:', fontPath);
						fontsRegistered++;
					}
				}
			}
		}
		catch (nixError) {
			console.log('[Canvas] Nix store search failed:', nixError.message);
		}
		
		// Fallback to standard paths if Nix search didn't work
		if (fontsRegistered === 0) {
			for (const fontDef of liberationFonts) {
				for (const basePath of basePaths) {
					const fontPath = `${basePath}/${fontDef.file}`;
					if (fs.existsSync(fontPath)) {
						GlobalFonts.registerFromPath(fontPath, fontDef.family);
						console.log(`[Canvas] Registered ${fontDef.file} from ${basePath}`);
						fontsRegistered++;
						break;
					}
				}
			}
		}
		
		// Try fc-list if available
		if (fontsRegistered === 0) {
			const fcPath = findFontWithFc('Liberation Sans');
			if (fcPath && fs.existsSync(fcPath)) {
				GlobalFonts.registerFromPath(fcPath, 'Liberation Sans');
				console.log('[Canvas] Registered via fc-list:', fcPath);
				fontsRegistered++;
			}
		}
		
		if (fontsRegistered === 0) {
			console.error('[Canvas] CRITICAL: No Liberation Sans fonts found!');
			console.error('[Canvas] Searched: Nix store, standard paths, fc-list');
			console.error('[Canvas] Make sure liberation_ttf is in nixpacks.toml nixPkgs array');
		}
		else {
			console.log(`[Canvas] Successfully registered ${fontsRegistered} Liberation Sans variants`);
		}

		// Register emoji font
		const emojiPaths = [
			'/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
			'/usr/share/fonts/google-noto-emoji/NotoColorEmoji.ttf',
			'/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf',
		];
		
		// Also search Nix store for emoji fonts
		try {
			const nixEmoji = execSync('find /nix/store -name "NotoColorEmoji.ttf" 2>/dev/null | head -1', { encoding: 'utf8', timeout: 3000 }).trim();
			if (nixEmoji) {
				GlobalFonts.registerFromPath(nixEmoji, 'Noto Color Emoji');
				console.log('[Canvas] Registered emoji from Nix:', nixEmoji);
			}
		}
		catch {
			// Try standard paths
			for (const fontPath of emojiPaths) {
				if (fs.existsSync(fontPath)) {
					GlobalFonts.registerFromPath(fontPath, 'Noto Color Emoji');
					console.log('[Canvas] Registered emoji from:', fontPath);
					break;
				}
			}
		}
	}
}
catch (e) {
	console.error('[Canvas] Font registration error:', e.message);
}

// Log available fonts for debugging
try {
	const registeredFonts = GlobalFonts.families;
	console.log('[Canvas] Available font families:', registeredFonts.length > 0 ? registeredFonts : 'NONE - This will cause rendering to fail!');
	
	// Test canvas rendering on Linux
	if (process.platform === 'linux') {
		try {
			const testCanvas = createCanvas(100, 100);
			const testCtx = testCanvas.getContext('2d');
			testCtx.fillStyle = '#ff0000';
			testCtx.fillRect(0, 0, 100, 100);
			testCtx.fillStyle = '#ffffff';
			testCtx.font = '14px "Liberation Sans", Arial, sans-serif';
			testCtx.fillText('TEST', 10, 50);
			const testBuffer = testCanvas.toBuffer('image/png');
			console.log('[Canvas] Test render successful, buffer size:', testBuffer.length, 'bytes');
		}
		catch (testError) {
			console.error('[Canvas] Test render FAILED:', testError.message);
			console.error('[Canvas] Stack:', testError.stack);
		}
	}
}
catch (e) {
	console.log('[Canvas] Could not list fonts:', e.message);
}

/**
 * Creates a colored progress bar on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Bar width
 * @param {number} height - Bar height
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @param {string} type - 'hp' for gradient colors, 'stamina' for blue
 */
function drawProgressBar(ctx, x, y, width, height, current, max, type = 'hp') {
	const percent = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
	const filledWidth = width * percent;

	// Background (dark)
	ctx.fillStyle = '#1a1a2e';
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, 4);
	ctx.fill();

	// Border
	ctx.strokeStyle = '#3a3a5e';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, 4);
	ctx.stroke();

	// Filled portion
	if (filledWidth > 0) {
		let fillColor;
		if (type === 'stamina') {
			// Blue
			fillColor = '#3498db';
		}
		else if (percent > 0.5) {
			// Green
			fillColor = '#2ecc71';
		}
		else if (percent > 0.25) {
			// Yellow/Orange
			fillColor = '#f39c12';
		}
		else {
			// Red
			fillColor = '#e74c3c';
		}

		ctx.fillStyle = fillColor;
		ctx.beginPath();
		ctx.roundRect(x + 2, y + 2, filledWidth - 4, height - 4, 2);
		ctx.fill();

		// Add shine effect
		const gradient = ctx.createLinearGradient(x, y, x, y + height);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
		gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.roundRect(x + 2, y + 2, filledWidth - 4, height / 2 - 2, 2);
		ctx.fill();
	}

	// Text value
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 14px "Liberation Sans", Arial, sans-serif';
	ctx.textAlign = 'right';
	ctx.fillText(`${current ?? 0}/${max ?? 0}`, x + width - 8, y + height - 6);
}

/**
 * Gets the rank color based on character level
 * Bronze (1-20), Silver (21-40), Gold (41+)
 * @param {number} level - Character level
 * @returns {string} Hex color code
 */
function getRankColor(level) {
	if (level >= 41) return '#FFD700';
	if (level >= 21) return '#C0C0C0';
	return '#CD7F32';
}

/**
 * Draws a circular avatar with border
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Image} image - Avatar image
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {number} radius - Circle radius
 * @param {string} borderColor - Border color (default: blurple)
 */
function drawCircularAvatar(ctx, image, x, y, radius, borderColor = '#5865F2') {
	ctx.save();

	// Draw border
	ctx.beginPath();
	ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
	ctx.fillStyle = borderColor;
	ctx.fill();

	// Clip to circle
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.clip();

	// Draw image
	ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
	ctx.restore();
}

/**
 * Draws section header with line
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Header text
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Line width
 */
function drawSectionHeader(ctx, text, x, y, width) {
	ctx.fillStyle = '#7289da';
	ctx.font = 'bold 14px "Liberation Sans", Arial, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText(text, x, y);

	// Draw line
	const textWidth = ctx.measureText(text).width;
	ctx.strokeStyle = '#4a4a6e';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x + textWidth + 10, y - 5);
	ctx.lineTo(x + width, y - 5);
	ctx.stroke();
}

/**
 * Generates a stat card image for a character
 * @param {Object} character - Character base data
 * @param {Object} combatStats - Combat stats (defense, speed, evade, etc.)
 * @param {Object} attackStats - Attack stats (attack, accuracy, critical, etc.)
 * @param {Array} equipment - Array of {slot, itemName} objects
 * @param {string} avatarUrl - URL to character avatar
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateStatCard(character, combatStats, attackStats, equipment, avatarUrl) {
	console.log('[Canvas] generateStatCard called for character:', character.id);
	
	// CRITICAL: Register fonts for @napi-rs/canvas before any rendering
	// This library requires explicit font registration on Linux
	if (process.platform === 'linux') {
		try {
			// Try to find and register Liberation Sans
			const fontPaths = [
				'/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
				'/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
			];
			
			let registered = false;
			for (const fontPath of fontPaths) {
				if (fs.existsSync(fontPath)) {
					GlobalFonts.registerFromPath(fontPath, 'Liberation Sans');
					console.log('[Canvas] Registered font:', fontPath);
					registered = true;
				}
			}
			
			if (!registered) {
				console.error('[Canvas] WARNING: Could not register Liberation Sans font');
			}
			
			console.log('[Canvas] Available fonts:', GlobalFonts.families);
		}
		catch (fontError) {
			console.error('[Canvas] Font registration error:', fontError.message);
		}
	}
	
	const width = 650;
	const height = 430;
	const canvas = createCanvas(width, height);
	console.log('[Canvas] Canvas created successfully, size:', width, 'x', height);
	const ctx = canvas.getContext('2d');

	// Determine rank color based on level
	const rankColor = getRankColor(character.level ?? 1);

	// Get rank-tinted background colors
	let bgTop, bgBottom;
	if ((character.level ?? 1) >= 41) {
		// Gold - warm golden tint
		bgTop = '#2a2510';
		bgBottom = '#1a1808';
	}
	else if ((character.level ?? 1) >= 21) {
		// Silver - cool gray tint
		bgTop = '#252530';
		bgBottom = '#18181e';
	}
	else {
		// Bronze - warm brown tint
		bgTop = '#2a1f1a';
		bgBottom = '#1a1410';
	}

	// Background gradient with rank tint
	const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
	bgGradient.addColorStop(0, bgTop);
	bgGradient.addColorStop(1, bgBottom);
	ctx.fillStyle = bgGradient;
	ctx.beginPath();
	ctx.roundRect(0, 0, width, height, 16);
	ctx.fill();

	// Decorative border (rank colored)
	ctx.strokeStyle = rankColor;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.roundRect(4, 4, width - 8, height - 8, 14);
	ctx.stroke();

	// Load and draw avatar
	const avatarRadius = 55;
	const avatarX = 80;
	const avatarY = 85;
	try {
		if (avatarUrl) {
			const avatar = await loadImage(avatarUrl);
			drawCircularAvatar(ctx, avatar, avatarX, avatarY, avatarRadius, rankColor);
		}
	}
	catch {
		// Draw placeholder circle if avatar fails to load (with rank color ring)
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
		ctx.fillStyle = rankColor;
		ctx.fill();
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
		ctx.fillStyle = '#3a3a5e';
		ctx.fill();
		ctx.fillStyle = '#7289da';
		ctx.font = 'bold 40px "Liberation Sans", Arial, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('?', avatarX, avatarY);
	}

	// Character name
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 28px "Liberation Sans", Arial, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText(character.name ?? 'Unknown', 160, 50);

	// Level badge (rank colored)
	ctx.fillStyle = rankColor;
	ctx.beginPath();
	ctx.roundRect(160, 60, 70, 26, 6);
	ctx.fill();
	// Use dark text for gold/silver for better contrast
	ctx.fillStyle = (character.level ?? 1) >= 21 ? '#1a1a2e' : '#ffffff';
	ctx.font = 'bold 14px "Liberation Sans", Arial, sans-serif';
	ctx.fillText(`Lv. ${character.level ?? 1}`, 170, 78);

	// Gold display (using emoji font)
	ctx.fillStyle = '#f1c40f';
	ctx.font = '14px "Noto Color Emoji", "Segoe UI Emoji", "Liberation Sans", Arial, sans-serif';
	ctx.fillText(`💰 ${character.gold ?? 0}`, 240, 78);

	// HP Bar (below level/gold row)
	ctx.textAlign = 'left';
	ctx.fillStyle = '#e74c3c';
	ctx.font = 'bold 14px "Noto Color Emoji", "Segoe UI Emoji", "Liberation Sans", Arial, sans-serif';
	ctx.fillText('❤️ HP', 160, 110);
	drawProgressBar(ctx, 230, 95, 255, 20, character.currentHp ?? 0, character.maxHp ?? 100, 'hp');

	// Stamina Bar
	ctx.textAlign = 'left';
	ctx.fillStyle = '#3498db';
	ctx.font = 'bold 14px "Noto Color Emoji", "Segoe UI Emoji", "Liberation Sans", Arial, sans-serif';
	ctx.fillText('⚡ STA', 160, 135);
	drawProgressBar(ctx, 230, 120, 255, 20, character.currentStamina ?? 0, character.maxStamina ?? 100, 'stamina');

	// XP Bar
	ctx.textAlign = 'left';
	ctx.fillStyle = '#9b59b6';
	ctx.font = 'bold 14px "Noto Color Emoji", "Segoe UI Emoji", "Liberation Sans", Arial, sans-serif';
	ctx.fillText('✨ XP', 160, 160);
	const xpForLevel = 1000;
	drawProgressBar(ctx, 230, 145, 255, 20, character.xp ?? 0, xpForLevel, 'xp');

	// === BASE STATS SECTION ===
	drawSectionHeader(ctx, 'BASE STATS', 25, 185, 600);

	const stats = [
		{ label: 'STR', value: character.str ?? 0, icon: '💪' },
		{ label: 'DEX', value: character.dex ?? 0, icon: '🎯' },
		{ label: 'AGI', value: character.agi ?? 0, icon: '🦶' },
		{ label: 'CON', value: character.con ?? 0, icon: '🛡️' },
	];

	stats.forEach((stat, index) => {
		const statX = 40 + index * 150;
		const statY = 210;

		// Stat box
		ctx.fillStyle = '#2a2a4e';
		ctx.beginPath();
		ctx.roundRect(statX, statY - 18, 120, 40, 6);
		ctx.fill();

		// Icon and Label (using emoji font)
		ctx.fillStyle = '#7289da';
		ctx.textAlign = 'left';
		ctx.font = 'bold 16px "Noto Color Emoji", "Segoe UI Emoji", "Liberation Sans", Arial, sans-serif';
		ctx.fillText(`${stat.icon} ${stat.label}`, statX + 5, statY + 5);

		// Value
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'right';
		ctx.font = 'bold 16px "Liberation Sans", Arial, sans-serif';
		ctx.fillText(stat.value.toString(), statX + 110, statY + 5);
	});

	// === COMBAT STATS SECTION ===
	drawSectionHeader(ctx, 'COMBAT', 25, 270, 290);

	const combatData = [
		{ label: 'Attack', value: attackStats?.attack ?? 0 },
		{ label: 'Defense', value: combatStats?.defense ?? 0 },
		{ label: 'Accuracy', value: attackStats?.accuracy ?? 0 },
		{ label: 'Evade', value: combatStats?.evade ?? 0 },
		{ label: 'Speed', value: combatStats?.speed ?? 0 },
		{ label: 'Critical', value: attackStats?.critical ?? 0 },
	];

	ctx.font = '13px "Liberation Sans", Arial, sans-serif';
	combatData.forEach((stat, index) => {
		const col = index % 2;
		const row = Math.floor(index / 2);
		const statX = 30 + col * 145;
		const statY = 290 + row * 24;

		ctx.fillStyle = '#aaaaaa';
		ctx.textAlign = 'left';
		ctx.fillText(`${stat.label}:`, statX, statY);

		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'right';
		ctx.fillText(stat.value.toString(), statX + 130, statY);
	});

	// === EQUIPMENT SECTION ===
	drawSectionHeader(ctx, 'EQUIPMENT', 340, 270, 280);

	const equipmentMap = {};
	// Slots occupied by two-handed weapon (not actually equipped)
	const occupiedSlots = new Set();
	
	if (equipment && Array.isArray(equipment)) {
		equipment.forEach(eq => {
			if (eq.slot) {
				const slotKey = eq.slot.toLowerCase();
				const itemName = eq.itemName ?? eq.item_name ?? 'Unknown';
				
				// Two-handed weapons display in both main hand and off hand
				if (slotKey === WEAPON_SLOTS.TWOHAND) {
					equipmentMap[WEAPON_SLOTS.MAINHAND] = itemName;
					equipmentMap[WEAPON_SLOTS.OFFHAND] = itemName;
					// Off hand is just occupied, not equipped
					occupiedSlots.add(WEAPON_SLOTS.OFFHAND);
				}
				else {
					equipmentMap[slotKey] = itemName;
				}
			}
		});
	}

	ctx.font = '13px "Liberation Sans", Arial, sans-serif';
	EQUIPMENT_SLOT_CONFIG.forEach((slot, index) => {
		const slotY = 290 + index * 26;
		const slotX = 345;

		// Slot icon and label (using emoji font)
		ctx.fillStyle = '#7289da';
		ctx.textAlign = 'left';
		ctx.font = '13px "Noto Color Emoji", "Segoe UI Emoji", "Liberation Sans", Arial, sans-serif';
		ctx.fillText(`${slot.icon} ${slot.label}:`, slotX, slotY);

		// Item name
		ctx.font = '13px "Liberation Sans", Arial, sans-serif';
		const itemName = equipmentMap[slot.key] ?? '—';
		const isOccupied = occupiedSlots.has(slot.key);
		
		// Gray/transparent for empty slots or occupied-but-not-equipped slots
		if (itemName === '—') {
			ctx.fillStyle = '#666666';
		}
		else if (isOccupied) {
			// Grayed and transparent for occupied
			ctx.fillStyle = 'rgba(150, 150, 150, 0.6)';
		}
		else {
			ctx.fillStyle = '#ffffff';
		}
		ctx.textAlign = 'left';

		// Truncate long item names, add parentheses if occupied
		let displayName = itemName;
		if (isOccupied) displayName = `(${itemName})`;
		const maxWidth = 135;
		while (ctx.measureText(displayName).width > maxWidth && displayName.length > 3) {
			displayName = displayName.slice(0, -4) + '...';
		}
		ctx.fillText(displayName, slotX + 115, slotY);
	});

	// === WEIGHT SECTION ===
	if (combatStats) {
		ctx.fillStyle = '#888888';
		ctx.font = '12px "Liberation Sans", Arial, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(`Weight: ${combatStats.currentWeight ?? 0}/${combatStats.maxWeight ?? 0}`, 30, 370);
	}

	// Watermark/footer
	ctx.fillStyle = '#4a4a6e';
	ctx.font = '11px "Liberation Sans", Arial, sans-serif';
	ctx.textAlign = 'right';
	ctx.fillText('Pioneer Certificate', width - 20, height - 15);

	console.log('[Canvas] Rendering complete, converting to PNG buffer');
	const buffer = canvas.toBuffer('image/png');
	console.log('[Canvas] Buffer created, size:', buffer.length, 'bytes');
	return buffer;
}

module.exports = {
	generateStatCard,
	EQUIPMENT_SLOT_CONFIG,
};

/**
 * populateButtonLabels.js
 * 
 * For every event option that has a `text` field but no `button_label`,
 * auto-generates a `button_label` by truncating `text` to MAX_LABEL_LEN chars.
 * 
 * Safe for Vietnamese / multi-byte text:
 *   - All file I/O uses explicit 'utf8' encoding via Node fs (not PowerShell)
 *   - No non-ASCII literals in source; ellipsis written as \u2026
 *   - js-yaml dump uses allowUnicode:true so Vietnamese is preserved as-is
 * 
 * Usage: node src/scripts/populateButtonLabels.js [--dry-run]
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONTENT_EVENTS_DIR = path.join(__dirname, '..', 'content', 'events');
const MAX_LABEL_LEN = 30;
const ELLIPSIS = '\u2026';
const DRY_RUN = process.argv.includes('--dry-run');
const RESET = process.argv.includes('--reset');

// Truncate a string to at most maxLen codepoints, breaking only at a word boundary.
// Uses Array.from so multi-byte (Vietnamese, emoji) codepoints are counted correctly.
function truncate(str, maxLen) {
	const chars = Array.from(str);
	if (chars.length <= maxLen) return str;
	// Walk back from maxLen-1 to find the last space
	let cutAt = maxLen - 1;
	while (cutAt > 0 && chars[cutAt] !== ' ') cutAt--;
	// If no space found at all, hard-cut at maxLen
	if (cutAt === 0) cutAt = maxLen - 1;
	// Trim trailing spaces before the ellipsis
	while (cutAt > 0 && chars[cutAt - 1] === ' ') cutAt--;
	return chars.slice(0, cutAt).join('') + ELLIPSIS;
}

// Extract an embedded proper name from option text.
// A proper name is a fully-ASCII capitalized word (e.g. "York", "Callira").
// Uses Unicode-aware lookahead/lookbehind to reject fragments of Vietnamese words
// like "Th" from "Thánh", where the ASCII run is followed by a Unicode letter.
// Requires the /u flag so \p{L} covers all Unicode letters.
function extractName(text) {
	// Strip template variables to avoid matching ${PlayerName}
	const stripped = text.replace(/\$\{[^}]*\}/g, '');
	// Match fully-ASCII capitalized words not adjacent to any Unicode letter
	// (?<!\p{L}) — not preceded by a Unicode letter
	// [A-Z][a-zA-Z]{2,} — uppercase + at least 2 more ASCII letters (3+ total)
	// (?!\p{L}) — not followed by a Unicode letter (catches Vietnamese fragments)
	const NAME_RE = /(?<!\p{L})([A-Z][a-zA-Z]{2,})(?!\p{L})/gu;
	const matches = [...stripped.matchAll(NAME_RE)].map(m => m[1]);
	return matches.length > 0 ? matches[0] : null;
}

function processFile(filePath) {
	const raw = fs.readFileSync(filePath, 'utf8');
	const doc = yaml.load(raw);

	if (!doc || !Array.isArray(doc.events)) return { changed: 0 };

	let changed = 0;

	for (const event of doc.events) {
		if (!Array.isArray(event.option)) continue;
		for (const option of event.option) {
			if (RESET && option.button_label !== undefined) {
				delete option.button_label;
				changed++;
				continue;
			}
			if (!option.text) continue;
			if (option.button_label !== undefined && option.button_label !== null) continue;

			const name = extractName(String(option.text));
			if (name) {
				// Text contains an embedded proper name — use it directly as the label
				option.button_label = name;
			}
			else {
				option.button_label = truncate(String(option.text), MAX_LABEL_LEN);
			}
			changed++;
		}
	}

	if (changed > 0 && !DRY_RUN) {
		const output = yaml.dump(doc, {
			allowUnicode: true,
			lineWidth: 120,
			noRefs: true,
		});
		fs.writeFileSync(filePath, output, 'utf8');
	}

	return { changed };
}

function main() {
	if (!fs.existsSync(CONTENT_EVENTS_DIR)) {
		console.error('Events directory not found:', CONTENT_EVENTS_DIR);
		process.exit(1);
	}

	const files = fs.readdirSync(CONTENT_EVENTS_DIR)
		.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
		.sort();

	let totalChanged = 0;

	for (const file of files) {
		const filePath = path.join(CONTENT_EVENTS_DIR, file);
		const { changed } = processFile(filePath);
		if (changed > 0) {
			console.log(`${DRY_RUN ? '[dry-run] ' : ''}${file}: ${changed} option(s) updated`);
			totalChanged += changed;
		}
	}

	if (totalChanged === 0) {
		console.log('No options needed updating.');
	}
	else {
		console.log(`\nTotal: ${totalChanged} button_label(s) ${DRY_RUN ? 'would be' : ''} populated.`);
	}
}

main();

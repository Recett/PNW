'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const CRON_VOTE_THRESHOLD = 6;

// In-memory vote state — cleared when bot restarts or vote resolves
// messageId -> Set of voter userIds
const _votesByMessage = new Map();

function openVote(messageId) {
	_votesByMessage.set(messageId, new Set());
}

function getVoters(messageId) {
	return _votesByMessage.get(messageId) || null;
}

function addVote(messageId, userId) {
	const voters = _votesByMessage.get(messageId);
	if (!voters) return null;
	voters.add(userId);
	return voters.size;
}

function removeVote(messageId, userId) {
	const voters = _votesByMessage.get(messageId);
	if (!voters) return null;
	voters.delete(userId);
	return voters.size;
}

function closeVote(messageId) {
	_votesByMessage.delete(messageId);
}

function buildCronVoteEmbed(count, resolved = false) {
	const bar = '\u2588'.repeat(count) + '\u2591'.repeat(Math.max(0, CRON_VOTE_THRESHOLD - count));
	if (resolved) {
		return new EmbedBuilder()
			.setColor(0x57F287)
			.setTitle('\u23E9 Cron Jobs Resumed')
			.setDescription(`${CRON_VOTE_THRESHOLD} votes reached. All cron jobs have been resumed.\nMissed ticks during the pause are skipped.`);
	}
	return new EmbedBuilder()
		.setColor(0xFEE75C)
		.setTitle('\u23F8\uFE0F Cron Jobs Paused — Vote to Resume')
		.setDescription(
			'All scheduled jobs are currently paused.\n' +
			'Cast your vote below. When **6 players** vote, cron jobs will resume.\n\n' +
			`**Votes:** \`${bar}\` ${count} / ${CRON_VOTE_THRESHOLD}`,
		);
}

function buildCronVoteRow(disabled = false) {
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('cronvote_cast')
			.setLabel('Vote to Resume')
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId('cronvote_withdraw')
			.setLabel('Withdraw Vote')
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	);
}

module.exports = {
	CRON_VOTE_THRESHOLD,
	openVote,
	getVoters,
	addVote,
	removeVote,
	closeVote,
	buildCronVoteEmbed,
	buildCronVoteRow,
};

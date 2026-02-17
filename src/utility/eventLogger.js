require('module-alias/register');
const fs = require('fs');
const path = require('path');

/**
 * Event Logger - Logs all event processing during registration
 * Usage: Import this in eventUtility.js and call logEvent() for each event processed
 */

class EventLogger {
	constructor() {
		this.sessionLogs = new Map();
		this.logDir = path.join(__dirname, '../logs');
		
		// Create logs directory if it doesn't exist
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, { recursive: true });
		}
	}

	/**
	 * Start a new logging session for a character
	 */
	startSession(characterId, sessionType = 'registration') {
		const sessionId = `${characterId}_${sessionType}_${Date.now()}`;
		this.sessionLogs.set(sessionId, {
			characterId,
			sessionType,
			startTime: new Date(),
			events: [],
			flagActions: [],
			stats: { J: 0, P: 0, T: 0, F: 0 },
		});
		return sessionId;
	}

	/**
	 * Log an event processing
	 */
	logEvent(sessionId, eventId, depth = 0) {
		if (!this.sessionLogs.has(sessionId)) return;
		
		const session = this.sessionLogs.get(sessionId);
		session.events.push({
			timestamp: new Date(),
			eventId,
			depth,
			order: session.events.length + 1,
		});
	}

	/**
	 * Log a flag action
 */
	logFlagAction(sessionId, eventId, flagName, flagValue, flagOperation, flagType) {
		if (!this.sessionLogs.has(sessionId)) return;
		
		const session = this.sessionLogs.get(sessionId);
		const value = parseInt(flagValue) || 0;
		
		session.flagActions.push({
			timestamp: new Date(),
			eventId,
			flagName,
			flagValue: value,
			flagOperation,
			flagType,
			order: session.flagActions.length + 1,
		});

		// Track virtue stats
		if (flagName === 'Justice') session.stats.J += value;
		if (flagName === 'Prudence') session.stats.P += value;
		if (flagName === 'Temperance') session.stats.T += value;
		if (flagName === 'Fortitude') session.stats.F += value;
	}

	/**
	 * End session and write log file
	 */
	endSession(sessionId) {
		if (!this.sessionLogs.has(sessionId)) return;
		
		const session = this.sessionLogs.get(sessionId);
		session.endTime = new Date();
		session.duration = session.endTime - session.startTime;

		// Generate report
		const report = this.generateReport(session);
		
		// Write to file
		const fileName = `${session.characterId}_${session.sessionType}_${session.startTime.toISOString().replace(/[:.]/g, '-')}.log`;
		const filePath = path.join(this.logDir, fileName);
		
		fs.writeFileSync(filePath, report, 'utf8');
		console.log(`[EventLogger] Log saved to: ${filePath}`);
		
		// Clean up
		this.sessionLogs.delete(sessionId);
		
		return filePath;
	}

	/**
	 * Generate human-readable report
	 */
	generateReport(session) {
		const lines = [];
		
		lines.push('='.repeat(80));
		lines.push(`EVENT LOG: ${session.sessionType.toUpperCase()}`);
		lines.push('='.repeat(80));
		lines.push(`Character ID: ${session.characterId}`);
		lines.push(`Start Time: ${session.startTime.toISOString()}`);
		lines.push(`End Time: ${session.endTime.toISOString()}`);
		lines.push(`Duration: ${session.duration}ms`);
		lines.push('');

		// Events processed
		lines.push(`EVENTS PROCESSED (${session.events.length} total):`);
		lines.push('-'.repeat(80));
		session.events.forEach((evt, idx) => {
			const indent = '  '.repeat(evt.depth);
			lines.push(`${idx + 1}. ${indent}${evt.eventId} (depth: ${evt.depth})`);
		});
		lines.push('');

		// Virtue flag actions
		const virtueActions = session.flagActions.filter(a => 
			['Justice', 'Prudence', 'Temperance', 'Fortitude'].includes(a.flagName)
		);

		lines.push(`VIRTUE FLAG ACTIONS (${virtueActions.length} total):`);
		lines.push('-'.repeat(80));
		virtueActions.forEach((action, idx) => {
			lines.push(`${idx + 1}. ${action.eventId}: ${action.flagName} ${action.flagOperation} ${action.flagValue} (type: ${action.flagType})`);
		});
		lines.push('');

		// Current totals
		const jptfTotal = session.stats.J + session.stats.P + session.stats.T + session.stats.F;
		lines.push(`VIRTUE TOTALS:`);
		lines.push('-'.repeat(80));
		lines.push(`Justice:     ${session.stats.J}`);
		lines.push(`Prudence:    ${session.stats.P}`);
		lines.push(`Temperance:  ${session.stats.T}`);
		lines.push(`Fortitude:   ${session.stats.F}`);
		lines.push(`TOTAL JPTF:  ${jptfTotal} ${jptfTotal > 24 ? '⚠️  EXCEEDS 24!' : '✓'}`);
		lines.push('');

		// Event frequency analysis
		const eventCounts = {};
		session.events.forEach(evt => {
			eventCounts[evt.eventId] = (eventCounts[evt.eventId] || 0) + 1;
		});

		const duplicates = Object.entries(eventCounts).filter(([id, count]) => count > 1);
		if (duplicates.length > 0) {
			lines.push(`DUPLICATE EVENTS (visited multiple times):`);
			lines.push('-'.repeat(80));
			duplicates.sort((a, b) => b[1] - a[1]).forEach(([eventId, count]) => {
				lines.push(`  ${eventId}: ${count} times`);
			});
			lines.push('');
		}

		// All flag actions
		if (session.flagActions.length > 0) {
			lines.push(`ALL FLAG ACTIONS (${session.flagActions.length} total):`);
			lines.push('-'.repeat(80));
			session.flagActions.forEach((action, idx) => {
				lines.push(`${idx + 1}. ${action.eventId}: ${action.flagName} = ${action.flagValue} (${action.flagOperation}, ${action.flagType})`);
			});
		}

		lines.push('');
		lines.push('='.repeat(80));
		lines.push('END OF LOG');
		lines.push('='.repeat(80));

		return lines.join('\n');
	}

	/**
	 * Get current session stats (for live monitoring)
	 */
	getSessionStats(sessionId) {
		if (!this.sessionLogs.has(sessionId)) return null;
		
		const session = this.sessionLogs.get(sessionId);
		return {
			eventsProcessed: session.events.length,
			flagActionsExecuted: session.flagActions.length,
			virtueStats: { ...session.stats },
			jptfTotal: session.stats.J + session.stats.P + session.stats.T + session.stats.F,
		};
	}

	/**
	 * Get full session data (for saving to database before ending session)
	 */
	getSessionData(sessionId) {
		if (!this.sessionLogs.has(sessionId)) return null;
		
		const session = this.sessionLogs.get(sessionId);
		return {
			characterId: session.characterId,
			sessionType: session.sessionType,
			startTime: session.startTime,
			events: session.events.map(evt => ({
				eventId: evt.eventId,
				depth: evt.depth,
				order: evt.order,
				timestamp: evt.timestamp,
			})),
			flagActions: session.flagActions.map(action => ({
				eventId: action.eventId,
				flagName: action.flagName,
				flagValue: action.flagValue,
				flagOperation: action.flagOperation,
				flagType: action.flagType,
				order: action.order,
				timestamp: action.timestamp,
			})),
			virtueStats: { ...session.stats },
			jptfTotal: session.stats.J + session.stats.P + session.stats.T + session.stats.F,
		};
	}
}

// Singleton instance
const eventLogger = new EventLogger();

module.exports = eventLogger;

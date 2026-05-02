const { EMOJI } = require('../../enums.js');

// Vietnamese UI strings for /interact command.
// Centralised here so source files stay human-readable.

const MSG = {
	// ── Move: static labels ───────────────────────────────────────────────
	MOVE_NO_DESCRIPTION:    '*No description.*',
	MOVE_STAMINA_COST:      'Stamina Cost',
	MOVE_STAMINA_CURRENT:   'Current Stamina',
	MOVE_CONFIRM_BUTTON:    'Confirm',
	MOVE_CANCEL_BUTTON:     'Cancel',
	MOVE_CONFIRM:           'Confirm move?',
	MOVE_CONFIRM_BATTLE:    `Confirm move? \n${EMOJI.WARNING} You are in an active battle! Leaving the area will be treated as a retreat and the battle will end.`,
	MOVE_CANCELLED:         'Move cancelled.',
	MOVE_CONFIRM_TIMEOUT:   'Move confirmation timed out.',

	// ── Move: dynamic messages ────────────────────────────────────────────
	moraleToLow:     (locationName, needed, current) => `Troop morale is too low to advance into **${locationName}**. (Required: ${needed}, Current: ${current})`,
	tooWounded:      (curHp, maxHp)                  => `You are too wounded to leave the Sick Bay! (HP: ${curHp}/${maxHp})`,
	notEnoughStamina:(cost)                           => `You don't have enough stamina to move. (Required: ${cost} stamina)`,
	movedTo:         (locationName)                   => `You have moved to **${locationName}**!`,
	enterChannel:    (channelId)                      => ` Head to <#${channelId}>`,
};

module.exports = { MSG };

/**
 * Discord channel ID constants.
 * Keys are used as the `channel` field in content/narrations/*.yaml.
 * For dynamically created channels (e.g. 'battle'), the ID is stored at runtime
 * in SystemSetting as 'channel.<key>' and resolved as a fallback by executeNarrateAction.
 */
module.exports = {
	STORYBOARD: '1476833138230562951',
	ANNOUNCEMENT: '1476833002183987242',
};

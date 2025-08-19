const Sequelize = require('sequelize');

const eventBase = (sequelize) => {
	return sequelize.define('event_base', {
		id: { type: Sequelize.STRING, primaryKey: true },
		title: Sequelize.STRING,
		avatar: Sequelize.STRING,
		illustration: Sequelize.STRING,
		text: Sequelize.STRING,
		default_child_event_id: Sequelize.STRING,
		choose_placeholder: Sequelize.STRING,
		hidden: Sequelize.BOOLEAN,
		npc: { type: Sequelize.STRING, allowNull: true },
		check: Sequelize.BOOLEAN,
	}, { timestamps: false });
};

const eventFlag = (sequelize) => {
	return sequelize.define('event_flag', {
		event_id: Sequelize.STRING,
		resolution_id: Sequelize.INTEGER,
		flag: Sequelize.STRING,
		amount: Sequelize.INTEGER,
		method: Sequelize.STRING,
		external: Sequelize.BOOLEAN,
		global: Sequelize.BOOLEAN,
	}, { timestamps: false });
};

const eventTag = (sequelize) => {
	return sequelize.define('event_tag', {
		event_id: Sequelize.STRING,
		tag: Sequelize.STRING,
	}, { timestamps: false });
};

const eventResolution = (sequelize) => {
	return sequelize.define('event_resolution', {
		event_id: Sequelize.STRING,
		resolution_id: Sequelize.STRING,
		text: Sequelize.STRING,
		required_flags: Sequelize.STRING,
		child_event_id: Sequelize.STRING,
	}, { timestamps: false });
};

const eventResolutionCheck = (sequelize) => {
	return sequelize.define('event_resolution_check', {
		resolution_id: Sequelize.STRING,
		check: Sequelize.STRING,
		value: Sequelize.INTEGER,
	}, { timestamps: false });
};

const eventCheck = (sequelize) => {
	return sequelize.define('event_check', {
		event_id: Sequelize.STRING,
		check: Sequelize.STRING,
		value: Sequelize.INTEGER,
	}, { timestamps: false });
};

module.exports = {
	eventBase,
	eventFlag,
	eventTag,
	eventResolution,
	eventResolutionCheck,
	eventCheck,
};
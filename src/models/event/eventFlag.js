module.exports = (sequelize) => {
	return sequelize.define('event_Flag', {
		event_id: {
			type: Sequelize.String,
			primaryKey: true,
		},
		flag: {
			type: Sequelize.String,
			primaryKey: true,
		},
		// resolution_id = 0 mean the flag will be modified instantly upon receiving the event
		resolution_id: {
			type: Sequelize.String,
			defaultValue: 0,
			primaryKey: true,
		},
		set: Sequelize.Integer,
		add: Sequelize.Integer,
		external: Sequelize.Boolean,
	}, {
		timestamps: false,
	});
};
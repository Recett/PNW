module.exports = (sequelize, DataTypes) => {
	return sequelize.define('event', {
		event_id: {
			type: Sequelize.String,
			primaryKey: true,
		},		
		event_text: {
			type: Sequelize.String,
			primaryKey: true,
		}
	}, {
		timestamps: false,
	});
};
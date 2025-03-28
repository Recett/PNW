module.exports = (sequelize, DataTypes) => {
	return sequelize.define('event_tag', {
		event_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},		
		resolution_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		resolution_text: Sequelize.STRING,
		tier: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};
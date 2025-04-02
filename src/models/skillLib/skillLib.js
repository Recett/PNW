module.exports = (sequelize) => {
	return sequelize.define('skill_lib', {
		skill_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};
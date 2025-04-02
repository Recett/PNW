module.exports = (sequelize) => {
	return sequelize.define('item_lib', {
		item_id: {
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
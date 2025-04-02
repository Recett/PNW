module.exports = (sequelize) => {
	return sequelize.define('character_equipment', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		head: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		body: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		leg: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		mainhand: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		offhand: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		trinket: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		belt: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		backpack: type: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};
module.exports = (sequelize) => {
	return sequelize.define('character_base', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		fullname: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		nickname: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		avatar: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		level: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		currentHp: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		maxHp: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		currentStamina: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		maxStamina: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		str: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		dex: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		agi: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		con: {
			type: Sequelize.INTEGER,
			allowNull: false,
		}
	}, {
		timestamps: false,
	});
};
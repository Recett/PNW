const Sequelize = require('sequelize');

const locationBase = (sequelize) => {
	return sequelize.define('location_base', {
		name: { type: Sequelize.STRING, allowNull: false },
		channel: { type: Sequelize.STRING, allowNull: false },
		description: Sequelize.STRING,
		type: Sequelize.STRING,
		role: Sequelize.STRING,
		lock: Sequelize.BOOLEAN,
		tag: Sequelize.JSON,
	}, { timestamps: false });
};

const locationCluster = (sequelize) => {
	return sequelize.define('location_cluster', {
		cluster_id: { type: Sequelize.STRING },
	}, { timestamps: false });
};

const locationLink = (sequelize) => {
	return sequelize.define('location_link', {
		location_id: Sequelize.STRING,
		linked_location_id: Sequelize.STRING,
	}, { timestamps: false });
};

const locationContain = (sequelize) => {
	return sequelize.define('location_contain', {
		location_id: Sequelize.STRING,
		object_id: Sequelize.STRING,
		type: Sequelize.STRING,
	}, { timestamps: false });
};

module.exports = {
	locationBase,
	locationCluster,
	locationLink,
	locationContain,
};
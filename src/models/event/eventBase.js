module.exports = (sequelize) => {
	return sequelize.define('event_base', {
		event_id: {
			type: Sequelize.String,
			primaryKey: true,
		},		
		event_text: {
			type: Sequelize.String,
			primaryKey: true,
		},
		default_child_event_id: {
			type: Sequelize.String,
		},		
		choose_placeholder: {
			type: Sequelize.String,
		}
	}, {
		timestamps: false,
	});
};
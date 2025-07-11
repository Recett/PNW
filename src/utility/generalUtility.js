const Discord = require('discord.js');

function pronoun(event, age, gender) {
	if (age <= 2) {
		if (gender % 2 != 0) {
			addressNC = 'cậu';
			addressC = 'Cậu';
		}
		else {
			addressNC = 'cô';
			addressC = 'Cô';
		}
	}
	else if (gender % 2 != 0) {
		addressNC = 'ông';
		addressC = 'Ông';
	}
	else {
		addressNC = 'bà';
		addressC = 'Bà';
	}
	event = event.replaceAll('. {2sp}', `. ${addressC}`);
	event = event.replaceAll(' {2sp}', ` ${addressNC}`);
	event = event.replaceAll('{2sp}', `${addressC}`);
	return event;
}

module.exports = {
	pronoun,
};

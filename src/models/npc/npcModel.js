const Sequelize = require('sequelize');

// All NPC content (npc_bases, npc_statuses, npc_abilities, npc_attack_links, npc_ability_links, npc_perks)
// migrated to YAML (contentStore.npcs). Only npcPurchase remains as a runtime table (npc_stocks).

const npcPurchase = (sequelize) => {
	return sequelize.define('npc_stock', {
		npc_id: Sequelize.STRING,
		item_id: Sequelize.STRING,
		purchased: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

module.exports = {
	npcPurchase,
};

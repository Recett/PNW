const { SystemSetting } = require('@root/dbObject.js');

class SystemSettingUtil {
	static async get(key) {
		const row = await SystemSetting.findOne({ where: { key } });
		if (!row) return null;
		return row.value;
	}

	static async set(key, value, scope = 'global', client_id = null, description = null) {
		const payload = { key, value, scope, client_id, description };
		// upsert: create or update
		await SystemSetting.upsert(payload);
		return await SystemSetting.findOne({ where: { key } });
	}

	static async remove(key) {
		return await SystemSetting.destroy({ where: { key } });
	}
}

module.exports = SystemSettingUtil;
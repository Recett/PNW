// Smart database sync utility
// Uses model definitions as source of truth, no separate migration files needed
const { GlobalFlag } = require('@root/dbObject.js');

class SmartSync {
	/**
	 * Check if database sync is needed and perform it safely
	 */
	static async checkAndSync() {
		try {
			const lastSync = await GlobalFlag.findOne({ 
				where: { flag_name: 'schema_last_sync' } 
			});
			
			// Get current model definitions hash
			const currentSchemaHash = await this.getSchemaHash();
			
			if (!lastSync || lastSync.flag_value !== currentSchemaHash) {
				console.log('🔄 Schema changes detected, syncing database...');
				
				// Use Sequelize alter instead of full sync for safety
				const sequelize = require('@root/dbObject.js').sequelize;
				await sequelize.sync({ alter: true });
				
				// Update sync marker
				await GlobalFlag.upsert({
					flag_name: 'schema_last_sync',
					flag_value: currentSchemaHash,
				});
				
				console.log('✅ Database schema updated successfully');
				return true;
			}
			
			console.log('📊 Database schema is up to date');
			return false;
		}
		catch (error) {
			console.error('❌ Schema sync failed:', error);
			throw error;
		}
	}
	
	/**
	 * Generate hash of all model definitions for change detection
	 */
	static async getSchemaHash() {
		const crypto = require('crypto');
		const fs = require('fs').promises;
		const path = require('path');
		
		// Read all model files and create hash
		const modelDir = path.join(__dirname, '../models');
		const modelFiles = await this.getAllModelFiles(modelDir);
		
		let combinedContent = '';
		for (const file of modelFiles.sort()) {
			const content = await fs.readFile(file, 'utf8');
			combinedContent += content;
		}
		
		return crypto.createHash('md5').update(combinedContent).digest('hex');
	}
	
	/**
	 * Recursively get all model files
	 */
	static async getAllModelFiles(dir) {
		const fs = require('fs').promises;
		const path = require('path');
		
		const files = [];
		const items = await fs.readdir(dir);
		
		for (const item of items) {
			const fullPath = path.join(dir, item);
			const stat = await fs.stat(fullPath);
			
			if (stat.isDirectory()) {
				files.push(...await this.getAllModelFiles(fullPath));
			}
			else if (item.endsWith('.js')) {
				files.push(fullPath);
			}
		}
		
		return files;
	}
}

module.exports = SmartSync;
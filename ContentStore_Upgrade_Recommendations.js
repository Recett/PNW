// Enhanced ContentStore Loading Recommendations

/**
 * UPGRADE 1: Add async loading with progress tracking
 */
async loadAsync(progressCallback) {
	if (this._loaded) return;
	
	console.log('[ContentStore] Loading YAML content...');
	const startTime = Date.now();
	
	const contentTypes = [
		{ name: 'weapons', dir: 'items', key: 'weapons' },
		{ name: 'armor', dir: 'items', key: 'armor' },
		{ name: 'other_items', dir: 'items', key: 'other_items' },
		{ name: 'enemies', dir: 'enemies', key: 'enemies' },
		{ name: 'events', dir: 'events', key: 'events' },
		// ... etc
	];
	
	for (let i = 0; i < contentTypes.length; i++) {
		const type = contentTypes[i];
		const records = await this.loadDirectoryAsync(type.dir, type.key);
		
		if (type.name.startsWith('weapons') || type.name.startsWith('armor') || type.name.startsWith('other_items')) {
			// Aggregate items from split files
			this.items = this.items || new ContentCollection('items', []);
			for (const record of records) {
				this.items._add(record);
			}
		} else {
			this[type.name] = new ContentCollection(type.name, records);
		}
		
		if (progressCallback) {
			progressCallback(i + 1, contentTypes.length, type.name);
		}
	}
	
	console.log(`[ContentStore] Loaded in ${Date.now() - startTime}ms`);
	this._loaded = true;
}

/**
 * UPGRADE 2: Add caching with file watching
 */
enableHotReload() {
	const fs = require('fs');
	const path = require('path');
	
	fs.watch(CONTENT_DIR, { recursive: true }, (eventType, filename) => {
		if (filename && (filename.endsWith('.yaml') || filename.endsWith('.yml'))) {
			console.log(`[ContentStore] Detected change: ${filename}`);
			this.reloadFile(filename);
		}
	});
}

/**
 * UPGRADE 3: Add memory optimization
 */
getMemoryUsage() {
	const usage = {};
	for (const [key, collection] of Object.entries(this)) {
		if (collection instanceof ContentCollection) {
			usage[key] = {
				count: collection.size,
				memoryMB: JSON.stringify(collection._records).length / (1024 * 1024)
			};
		}
	}
	return usage;
}

/**
 * UPGRADE 4: Add partial loading
 */
loadContentType(typeName) {
	if (!this._partialLoaded) this._partialLoaded = new Set();
	
	if (!this._partialLoaded.has(typeName)) {
		// Load only specific content type
		const records = loadDirectory(typeName, typeName);
		this[typeName] = new ContentCollection(typeName, records);
		this._partialLoaded.add(typeName);
	}
	
	return this[typeName];
}
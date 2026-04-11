const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { promisify } = require('util');

const CONTENT_DIR = path.join(__dirname, 'content');

// Async file operations
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// File cache for hot reloading
const fileCache = new Map(); // filepath -> { content, mtime }

// Lazy-load YAML editor when needed
let YamlEditor = null;

/**
 * Recursively freeze an object and all nested objects/arrays.
 * YAML content is immutable by design — consumers must shallow-copy
 * (e.g. `{ ...obj }` or `[...arr]`) before mutating.
 */
function deepFreeze(obj) {
	if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
		return obj;
	}
	Object.freeze(obj);
	for (const value of Object.values(obj)) {
		deepFreeze(value);
	}
	return obj;
}

/**
 * Sequelize-compatible in-memory collection backed by YAML content.
 * Provides findByPk, findOne, and findAll with the same signatures
 * used throughout the codebase so existing utility code needs
 * minimal changes when switching from Sequelize models.
 */
class ContentCollection {
	constructor(name, records = [], { idField = 'id' } = {}) {
		this.name = name;
		this.idField = idField;
		/** @type {Map<string, Object>} */
		this._byId = new Map();
		/** @type {Object[]} */
		this._records = [];

		for (const record of records) {
			this._add(record);
		}
	}

	_add(record) {
		deepFreeze(record);
		const id = record[this.idField];
		if (id != null) {
			if (this._byId.has(String(id))) {
				throw new Error(`[ContentStore] Duplicate ${this.name} id: ${id}`);
			}
			this._byId.set(String(id), record);
		}
		this._records.push(record);
	}

	get size() {
		return this._records.length;
	}

	// ── Sequelize-compatible lookups ──

	/**
	 * Look up a record by primary key.
	 * Supports the optional options object for API compatibility,
	 * but `include` is a no-op since associations are already embedded.
	 */
	findByPk(id) {
		if (id == null) return null;
		return this._byId.get(String(id)) || null;
	}

	/**
	 * Return the first record that matches all `where` conditions.
	 * @param {{ where?: Object }} options
	 */
	findOne(options = {}) {
		const { where } = options;
		if (!where) return this._records[0] || null;
		return this._records.find(r => this._matchWhere(r, where)) || null;
	}

	/**
	 * Return all records that match `where`, with optional ordering.
	 * @param {{ where?: Object, order?: Array }} options
	 */
	findAll(options = {}) {
		const { where, order } = options;
		let results = where
			? this._records.filter(r => this._matchWhere(r, where))
			: [...this._records];

		if (order && order.length > 0) {
			results = this._applyOrder(results, order);
		}

		return results;
	}

	/**
	 * Return all records (convenience shorthand).
	 */
	all() {
		return [...this._records];
	}

	// ── Internal helpers ──

	/**
	 * Match a record against a `where` clause.
	 * Supports flat field equality: { field: value }
	 * Supports nested dot paths: { 'nested.field': value }
	 */
	_matchWhere(record, where) {
		for (const [key, value] of Object.entries(where)) {
			const recordValue = this._getNestedValue(record, key);
			if (recordValue !== value) return false;
		}
		return true;
	}

	_getNestedValue(obj, path) {
		const parts = path.split('.');
		let current = obj;
		for (const part of parts) {
			if (current == null) return undefined;
			current = current[part];
		}
		return current;
	}

	_applyOrder(records, order) {
		return records.sort((a, b) => {
			for (const orderItem of order) {
				const [field, direction = 'ASC'] = Array.isArray(orderItem) ? orderItem : [orderItem];
				const aVal = this._getNestedValue(a, field);
				const bVal = this._getNestedValue(b, field);
				const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
				if (cmp !== 0) {
					return direction.toUpperCase() === 'DESC' ? -cmp : cmp;
				}
			}
			return 0;
		});
	}
}

// ── YAML file loading ──

/**
 * Read all .yaml / .yml files in a directory (non-recursive)
 * and merge them into a single array under a given root key.
 *
 * For example, given files that each contain `enemies: [...]`,
 * calling loadDirectory('enemies', 'enemies') returns a flat
 * array of all enemy records across all files in that directory.
 * 
 * @param {string} dirName - Directory name within content/
 * @param {string} rootKey - YAML root key to extract
 * @param {Object} options - Loading options
 * @param {boolean} options.useCache - Use file cache (default: true)
 * @param {boolean} options.async - Load asynchronously (default: false for compatibility)
 */
function loadDirectory(dirName, rootKey, options = {}) {
	const { useCache = true, async = false } = options;
	
	if (async) {
		return loadDirectoryAsync(dirName, rootKey, useCache);
	}
	
	const dirPath = path.join(CONTENT_DIR, dirName);
	if (!fs.existsSync(dirPath)) return [];

	const records = [];
	const files = fs.readdirSync(dirPath)
		.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
		.sort();

	for (const file of files) {
		const filePath = path.join(dirPath, file);
		let raw;
		
		if (useCache) {
			const cached = getCachedFile(filePath);
			if (cached) {
				raw = cached;
			} else {
				raw = fs.readFileSync(filePath, 'utf8');
				setCachedFile(filePath, raw);
			}
		} else {
			raw = fs.readFileSync(filePath, 'utf8');
		}
		
		const doc = yaml.load(raw);
		if (doc && doc[rootKey] && Array.isArray(doc[rootKey])) {
			records.push(...doc[rootKey]);
		}
	}

	return records;
}

/**
 * Async version of loadDirectory with better performance for large files
 */
async function loadDirectoryAsync(dirName, rootKey, useCache = true) {
	const dirPath = path.join(CONTENT_DIR, dirName);
	
	try {
		await stat(dirPath);
	} catch {
		return [];
	}

	const files = (await readdir(dirPath))
		.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
		.sort();

	const records = [];
	
	// Load files in parallel for better performance
	const promises = files.map(async (file) => {
		const filePath = path.join(dirPath, file);
		let raw;
		
		if (useCache) {
			const cached = await getCachedFileAsync(filePath);
			if (cached) {
				raw = cached;
			} else {
				raw = await readFile(filePath, 'utf8');
				setCachedFile(filePath, raw);
			}
		} else {
			raw = await readFile(filePath, 'utf8');
		}
		
		const doc = yaml.load(raw);
		if (doc && doc[rootKey] && Array.isArray(doc[rootKey])) {
			return doc[rootKey];
		}
		return [];
	});

	const results = await Promise.all(promises);
	for (const result of results) {
		records.push(...result);
	}

	return records;
}

/**
 * Get cached file content if it hasn't been modified
 */
function getCachedFile(filePath) {
	const cached = fileCache.get(filePath);
	if (!cached) return null;
	
	try {
		const stats = fs.statSync(filePath);
		if (stats.mtime <= cached.mtime) {
			return cached.content;
		}
		// File was modified, remove from cache
		fileCache.delete(filePath);
	} catch {
		// File doesn't exist, remove from cache
		fileCache.delete(filePath);
	}
	
	return null;
}

/**
 * Async version of getCachedFile
 */
async function getCachedFileAsync(filePath) {
	const cached = fileCache.get(filePath);
	if (!cached) return null;
	
	try {
		const stats = await stat(filePath);
		if (stats.mtime <= cached.mtime) {
			return cached.content;
		}
		// File was modified, remove from cache
		fileCache.delete(filePath);
	} catch {
		// File doesn't exist, remove from cache
		fileCache.delete(filePath);
	}
	
	return null;
}

/**
 * Cache file content with modification time
 */
function setCachedFile(filePath, content) {
	try {
		const stats = fs.statSync(filePath);
		fileCache.set(filePath, {
			content,
			mtime: stats.mtime
		});
	} catch {
		// Ignore errors when setting cache
	}
}

// ── Content store singleton ──

const store = {
	/** @type {ContentCollection} */
	items: null,
	/** @type {ContentCollection} */
	enemies: null,
	/** @type {ContentCollection} */
	events: null,
	/** @type {ContentCollection} */
	narrations: null,
	/** @type {ContentCollection} */
	npcs: null,
	/** @type {ContentCollection} */
	objects: null,
	/** @type {ContentCollection} */
	specials: null,
	/** @type {ContentCollection} */
	skills: null,
	/** @type {ContentCollection} */
	perks: null,
	/** @type {ContentCollection} */
	quests: null,
	/** @type {ContentCollection} */
	resourceNodes: null,
	/** @type {ContentCollection} */
	projects: null,
	/** @type {ContentCollection} */
	houseUpgrades: null,
	/** @type {ContentCollection} */
	statuses: null,
	/** @type {ContentCollection} */
	tasks: null,

	_loaded: false,
	_loadingPromise: null,
	_lazyCollections: new Set(['objects', 'specials', 'houseUpgrades']), // Collections to load on-demand

	/**
	 * Load all YAML content from src/content/.
	 * Must be called once during bot startup before any content is accessed.
	 * @param {Object} options - Loading options
	 * @param {boolean} options.async - Load asynchronously (default: false)
	 * @param {boolean} options.lazy - Enable lazy loading for some collections (default: true)
	 * @param {boolean} options.useCache - Use file caching (default: true)
	 */
	load(options = {}) {
		if (this._loaded) return Promise.resolve();
		if (this._loadingPromise) return this._loadingPromise;

		const { async = false, lazy = true, useCache = true } = options;

		if (async) {
			this._loadingPromise = this._loadAsync({ lazy, useCache });
			return this._loadingPromise;
		} else {
			this._loadSync({ lazy, useCache });
			return Promise.resolve();
		}
	},

	/**
	 * Synchronous loading (for backward compatibility)
	 */
	_loadSync(options = {}) {
		if (this._loaded) return;

		const { lazy = true, useCache = true } = options;
		console.log('[ContentStore] Loading YAML content...');

		// Load critical collections immediately
		const loadOptions = { useCache, async: false };

		// Load items from split files (weapons, armor, other_items)
		const weapons = loadDirectory('items', 'weapons', loadOptions);
		const armor = loadDirectory('items', 'armor', loadOptions);
		const otherItems = loadDirectory('items', 'other_items', loadOptions);
		const allItems = [...weapons, ...armor, ...otherItems];
		this.items = new ContentCollection('items', allItems);
		this.enemies = new ContentCollection('enemies', loadDirectory('enemies', 'enemies', loadOptions));
		this.events = new ContentCollection('events', [
			...loadDirectory('events', 'events', loadOptions),
			...loadDirectory('explore_event', 'events', loadOptions),
		]);
		this.narrations = new ContentCollection('narrations', loadDirectory('narrations', 'narrations', loadOptions));
		this.npcs = new ContentCollection('npcs', loadDirectory('npcs', 'npcs', loadOptions));
		this.skills = new ContentCollection('skills', loadDirectory('skills', 'skills', loadOptions));
		this.perks = new ContentCollection('perks', loadDirectory('perks', 'perks', loadOptions));
		this.quests = new ContentCollection('quests', loadDirectory('quests', 'quests', loadOptions));
		this.resourceNodes = new ContentCollection('resource_nodes', loadDirectory('resource_nodes', 'resource_nodes', loadOptions));
		this.projects = new ContentCollection('projects', loadDirectory('projects', 'projects', loadOptions));
		this.statuses = new ContentCollection('statuses', loadDirectory('statuses', 'statuses', loadOptions));
		this.tasks = new ContentCollection('tasks', loadDirectory('tasks', 'tasks', loadOptions));

		// Lazy load less critical collections
		if (lazy && this._lazyCollections.has('objects')) {
			this.objects = null; // Will be loaded on first access
		} else {
			this.objects = new ContentCollection('objects', loadDirectory('objects', 'objects', loadOptions));
		}

		if (lazy && this._lazyCollections.has('specials')) {
			this.specials = null; // Will be loaded on first access
		} else {
			this.specials = new ContentCollection('specials', loadDirectory('specials', 'specials', loadOptions), { idField: 'name' });
		}

		if (lazy && this._lazyCollections.has('houseUpgrades')) {
			this.houseUpgrades = null; // Will be loaded on first access
		} else {
			this.houseUpgrades = new ContentCollection('house_upgrades', loadDirectory('house_upgrades', 'house_upgrades', loadOptions));
		}

		this._loaded = true;

		console.log(
			`[ContentStore] Loaded: ` +
			`${this.items.size} items, ` +
			`${this.enemies.size} enemies, ` +
			`${this.events.size} events, ` +
			`${this.narrations.size} narrations, ` +
			`${this.npcs.size} npcs, ` +
			`${this.objects?.size ?? 'lazy'} objects, ` +
			`${this.specials?.size ?? 'lazy'} specials, ` +
			`${this.skills.size} skills, ` +
			`${this.perks.size} perks, ` +
			`${this.quests.size} quests, ` +
			`${this.resourceNodes.size} resource_nodes, ` +
			`${this.projects.size} projects, ` +
			`${this.houseUpgrades?.size ?? 'lazy'} house_upgrades, ` +
			`${this.statuses.size} statuses, ` +
			`${this.tasks.size} tasks`,
		);

		// Run cross-reference validation
		const errors = this.validate();
		if (errors.length > 0) {
			console.warn(`[ContentStore] ${errors.length} cross-reference warning(s):`);
			for (const err of errors) {
				console.warn(`  - ${err}`);
			}
		}
	},

	/**
	 * Asynchronous loading for better performance
	 */
	async _loadAsync(options = {}) {
		if (this._loaded) return;

		const { lazy = true, useCache = true } = options;
		console.log('[ContentStore] Loading YAML content asynchronously...');

		const loadOptions = { useCache, async: true };

		// Load items from split files in parallel
		const [weapons, armor, otherItems] = await Promise.all([
			loadDirectory('items', 'weapons', loadOptions),
			loadDirectory('items', 'armor', loadOptions),
			loadDirectory('items', 'other_items', loadOptions)
		]);
		const allItems = [...weapons, ...armor, ...otherItems];
		this.items = new ContentCollection('items', allItems);

		// Load critical collections in parallel
		const [enemies, events, narrations, npcs, skills, perks, quests, resourceNodes, projects, tasks] = await Promise.all([
			loadDirectory('enemies', 'enemies', loadOptions),
			loadDirectory('events', 'events', loadOptions),
			loadDirectory('narrations', 'narrations', loadOptions),
			loadDirectory('npcs', 'npcs', loadOptions),
			loadDirectory('skills', 'skills', loadOptions),
			loadDirectory('perks', 'perks', loadOptions),
			loadDirectory('quests', 'quests', loadOptions),
			loadDirectory('resource_nodes', 'resource_nodes', loadOptions),
			loadDirectory('projects', 'projects', loadOptions),
			loadDirectory('tasks', 'tasks', loadOptions)
		]);

		this.enemies = new ContentCollection('enemies', enemies);
		this.events = new ContentCollection('events', events);
		this.narrations = new ContentCollection('narrations', narrations);
		this.npcs = new ContentCollection('npcs', npcs);
		this.skills = new ContentCollection('skills', skills);
		this.perks = new ContentCollection('perks', perks);
		this.quests = new ContentCollection('quests', quests);
		this.resourceNodes = new ContentCollection('resource_nodes', resourceNodes);
		this.projects = new ContentCollection('projects', projects);
		this.tasks = new ContentCollection('tasks', tasks);

		const statuses = await loadDirectory('statuses', 'statuses', loadOptions);
		this.statuses = new ContentCollection('statuses', statuses);

		// Handle lazy loading for less critical collections
		if (!lazy || !this._lazyCollections.has('objects')) {
			const objects = await loadDirectory('objects', 'objects', loadOptions);
			this.objects = new ContentCollection('objects', objects);
		} else {
			this.objects = null;
		}

		if (!lazy || !this._lazyCollections.has('specials')) {
			const specials = await loadDirectory('specials', 'specials', loadOptions);
			this.specials = new ContentCollection('specials', specials, { idField: 'name' });
		} else {
			this.specials = null;
		}

		if (!lazy || !this._lazyCollections.has('houseUpgrades')) {
			const houseUpgrades = await loadDirectory('house_upgrades', 'house_upgrades', loadOptions);
			this.houseUpgrades = new ContentCollection('house_upgrades', houseUpgrades);
		} else {
			this.houseUpgrades = null;
		}

		this._loaded = true;
		this._loadingPromise = null;

		console.log(
			`[ContentStore] Loaded asynchronously: ` +
			`${this.items.size} items, ` +
			`${this.enemies.size} enemies, ` +
			`${this.events.size} events, ` +
			`${this.narrations.size} narrations, ` +
			`${this.npcs.size} npcs, ` +
			`${this.objects?.size ?? 'lazy'} objects, ` +
			`${this.specials?.size ?? 'lazy'} specials, ` +
			`${this.skills.size} skills, ` +
			`${this.perks.size} perks, ` +
			`${this.quests.size} quests, ` +
			`${this.resourceNodes.size} resource_nodes, ` +
			`${this.projects.size} projects, ` +
			`${this.houseUpgrades?.size ?? 'lazy'} house_upgrades, ` +
			`${this.statuses.size} statuses, ` +
			`${this.tasks.size} tasks`,
		);

		// Run cross-reference validation
		const errors = this.validate();
		if (errors.length > 0) {
			console.warn(`[ContentStore] ${errors.length} cross-reference warning(s):`);
			for (const err of errors) {
				console.warn(`  - ${err}`);
			}
		}
	},

	/**
	 * Load a lazy collection on first access
	 */
	_loadLazyCollection(name, dirName, rootKey, options = {}) {
		if (this[name] !== null) return this[name];
		
		console.log(`[ContentStore] Lazy loading ${name}...`);
		const records = loadDirectory(dirName, rootKey, { useCache: true, async: false });
		this[name] = new ContentCollection(name, records, options);
		console.log(`[ContentStore] Lazy loaded ${this[name].size} ${name}`);
		
		return this[name];
	},

	/**
	 * Get objects collection (lazy loading)
	 */
	get objects() {
		if (this._objects === undefined) {
			this._objects = this._lazyCollections.has('objects') ? null : undefined;
		}
		if (this._objects === null) {
			this._objects = this._loadLazyCollection('_objects', 'objects', 'objects');
		}
		return this._objects;
	},

	set objects(value) {
		this._objects = value;
	},

	/**
	 * Get specials collection (lazy loading)
	 */
	get specials() {
		if (this._specials === undefined) {
			this._specials = this._lazyCollections.has('specials') ? null : undefined;
		}
		if (this._specials === null) {
			this._specials = this._loadLazyCollection('_specials', 'specials', 'specials', { idField: 'name' });
		}
		return this._specials;
	},

	set specials(value) {
		this._specials = value;
	},

	/**
	 * Get houseUpgrades collection (lazy loading)
	 */
	get houseUpgrades() {
		if (this._houseUpgrades === undefined) {
			this._houseUpgrades = this._lazyCollections.has('houseUpgrades') ? null : undefined;
		}
		if (this._houseUpgrades === null) {
			this._houseUpgrades = this._loadLazyCollection('_houseUpgrades', 'house_upgrades', 'house_upgrades');
		}
		return this._houseUpgrades;
	},

	set houseUpgrades(value) {
		this._houseUpgrades = value;
	},

	/**
	 * Hot reload content from disk (useful for development)
	 */
	reload() {
		console.log('[ContentStore] Hot reloading content...');
		
		// Clear file cache
		fileCache.clear();
		
		// Reset state
		this._loaded = false;
		this._loadingPromise = null;
		
		// Clear lazy collections
		this._objects = undefined;
		this._specials = undefined;
		this._houseUpgrades = undefined;
		
		// Reload everything
		return this.load();
	},

	/**
	 * Clear cached data to free memory
	 */
	clearCache() {
		console.log('[ContentStore] Clearing file cache...');
		fileCache.clear();
	},

	/**
	 * Get cache statistics
	 */
	getCacheStats() {
		return {
			cachedFiles: fileCache.size,
			memoryUsage: process.memoryUsage(),
			loadedCollections: {
				items: this.items?.size ?? 0,
				enemies: this.enemies?.size ?? 0,
				events: this.events?.size ?? 0,
				narrations: this.narrations?.size ?? 0,
				npcs: this.npcs?.size ?? 0,
				objects: this._objects === null ? 'lazy' : (this._objects?.size ?? 0),
				specials: this._specials === null ? 'lazy' : (this._specials?.size ?? 0),
				skills: this.skills?.size ?? 0,
				perks: this.perks?.size ?? 0,
				quests: this.quests?.size ?? 0,
				resourceNodes: this.resourceNodes?.size ?? 0,
				projects: this.projects?.size ?? 0,
				houseUpgrades: this._houseUpgrades === null ? 'lazy' : (this._houseUpgrades?.size ?? 0),
				tasks: this.tasks?.size ?? 0
			}
		};
	},

	/**
	 * Get YAML editor instance
	 */
	getEditor() {
		if (!YamlEditor) {
			YamlEditor = require('./utility/yamlEditor');
			this._editor = new YamlEditor(CONTENT_DIR);
		}
		return this._editor;
	},

	/**
	 * Format YAML files for human readability
	 * @param {string|Array} files - Specific file paths or 'all' for all files
	 * @param {Object} options - Formatting options
	 */
	formatFiles(files = 'all', options = {}) {
		const editor = this.getEditor();
		
		const defaultOptions = {
			addComments: true,
			sortByProperty: 'id',
			validateSchema: true,
			backup: true,
			indent: 2,
			lineWidth: 100,
			enforceQuoting: true,  // Enforce YAML quoting conventions
			...options
		};
		
		if (files === 'all') {
			editor.formatAll(defaultOptions);
		} else if (Array.isArray(files)) {
			files.forEach(file => {
				editor.formatFile(file, defaultOptions);
			});
		} else if (typeof files === 'string') {
			editor.formatFile(files, defaultOptions);
		}
	},

	/**
	 * Create a new content entry with proper formatting
	 */
	createEntry(contentType, data) {
		const editor = this.getEditor();
		editor.createEntry(contentType, data);
		
		// Reload content to reflect changes
		this.reload();
	},

	/**
	 * Edit existing content (opens helper for manual editing)
	 */
	editContent(contentType, id) {
		const editor = this.getEditor();
		editor.editContent(contentType, id);
	},

	/**
	 * Generate human-readable documentation for content structure
	 */
	generateDocs() {
		console.log('\n📚 Discord RPG Bot - Content Structure Documentation\n');
		
		const collections = [
			{ name: 'items', desc: 'Weapons, armor, and other items' },
			{ name: 'enemies', desc: 'Combat encounters and enemy definitions' },
			{ name: 'events', desc: 'Story events, dialogues, and interactions' },
			{ name: 'narrations', desc: 'Prepared narration presets for admin broadcast use' },
			{ name: 'npcs', desc: 'Non-player characters' },
			{ name: 'skills', desc: 'Character skills and abilities' },
			{ name: 'perks', desc: 'Character perks and bonuses' },
			{ name: 'quests', desc: 'Quest definitions and objectives' },
			{ name: 'objects', desc: 'Interactive objects in the world' },
			{ name: 'specials', desc: 'Special abilities and effects' }
		];

		collections.forEach(({ name, desc }) => {
			const collection = this[name] || this[`_${name}`];
			const size = collection?.size ?? 0;
			const status = collection ? '✅' : (this._lazyCollections.has(name) ? '💤 lazy' : '❌');
			
			console.log(`${status} ${name.padEnd(15)} - ${size.toString().padStart(3)} entries - ${desc}`);
		});

		console.log('\n💡 Usage:');
		console.log('   store.formatFiles("all")           - Format all YAML files');
		console.log('   store.editContent("weapons", "1")  - Edit weapon with ID 1');
		console.log('   store.createEntry("weapons", {...}) - Add new weapon');
		console.log('   store.reload()                     - Reload content from files');
		console.log('\n📖 See YAML_Schema_Reference.md for complete schema documentation');
	},

	/**
	 * Validate cross-references between content types.
	 * Returns an array of error strings. Empty array = all valid.
	 */
	validate() {
		const errors = [];

		const check = (sourceType, record, field, targetCollection, targetType) => {
			const value = this._getNestedValue(record, field);
			if (value != null && !targetCollection.findByPk(value)) {
				errors.push(`${sourceType} "${record.id || record.name}" references ${targetType} "${value}" (field: ${field}) which does not exist`);
			}
		};

		const checkList = (sourceType, record, listField, idField, targetCollection, targetType) => {
			const list = this._getNestedValue(record, listField);
			if (!Array.isArray(list)) return;
			for (const entry of list) {
				const value = entry[idField];
				if (value != null && !targetCollection.findByPk(value)) {
					errors.push(`${sourceType} "${record.id || record.name}" references ${targetType} "${value}" (in ${listField}[].${idField}) which does not exist`);
				}
			}
		};

		// Enemy cross-references
		for (const enemy of this.enemies.all()) {
			check('enemy', enemy, 'start_event', this.events, 'event');
			if (enemy.reward && enemy.reward.items) {
				checkList('enemy', enemy, 'reward.items', 'id', this.items, 'item');
			}
		}

		// Event cross-references
		for (const event of this.events.all()) {
			check('event', event, 'next', this.events, 'event');
			if (event.combat) {
				check('event', event, 'combat.enemy', this.enemies, 'enemy');
				check('event', event, 'combat.on_victory', this.events, 'event');
				check('event', event, 'combat.on_defeat', this.events, 'event');
				check('event', event, 'combat.on_draw', this.events, 'event');
			}
			if (event.option) {
				for (const opt of event.option) {
					if (opt.next) {
						check('event', { id: `${event.id}.option.${opt.id}` }, 'next', this.events, 'event');
					}
				}
			}
			if (event.check) {
				for (const chk of event.check) {
					if (chk.on_success) {
						const proxy = { id: `${event.id}.check.${chk.name}`, on_success: chk.on_success };
						check('event', proxy, 'on_success', this.events, 'event');
					}
					if (chk.on_failure) {
						const proxy = { id: `${event.id}.check.${chk.name}`, on_failure: chk.on_failure };
						check('event', proxy, 'on_failure', this.events, 'event');
					}
				}
			}
			if (event.action) {
				for (const action of event.action) {
					if (action.type === 'item') {
						check('event', { id: `${event.id}.action` }, 'item', this.items, 'item');
					}
					if (action.type === 'event' && action.next) {
						const proxy = { id: `${event.id}.action`, next: action.next };
						check('event', proxy, 'next', this.events, 'event');
					}
					if (action.type === 'shop') {
						check('event', { id: `${event.id}.action`, npc: action.npc }, 'npc', this.npcs, 'npc');
					}
				}
			}
		}

		// Item special cross-references
		for (const item of this.items.all()) {
			if (item.special) {
				for (const keyword of Object.keys(item.special)) {
					// Only validate if specials collection is loaded
					if (this._specials !== null && !this.specials.findByPk(keyword)) {
						errors.push(`item "${item.id}" uses special keyword "${keyword}" which does not exist in specialLib`);
					}
				}
			}
		}

		// Skill parent references
		for (const skill of this.skills.all()) {
			if (skill.parent) {
				check('skill', skill, 'parent', this.skills, 'skill');
			}
		}

		// Perk skill references
		for (const perk of this.perks.all()) {
			check('perk', perk, 'skill', this.skills, 'skill');
		}

		// Resource node item references
		for (const node of this.resourceNodes.all()) {
			check('resource_node', node, 'resource_item', this.items, 'item');
		}

		// Project prerequisites
		for (const project of this.projects.all()) {
			if (project.prerequisites) {
				for (const prereqId of project.prerequisites) {
					if (!this.projects.findByPk(prereqId)) {
						errors.push(`project "${project.id}" requires project "${prereqId}" which does not exist`);
					}
				}
			}
		}

		// House upgrade prerequisites
		if (this._houseUpgrades !== null) {
			for (const upgrade of this.houseUpgrades.all()) {
				if (upgrade.prerequisites) {
					for (const prereqId of upgrade.prerequisites) {
						if (!this.houseUpgrades.findByPk(prereqId)) {
							errors.push(`house_upgrade "${upgrade.id}" requires upgrade "${prereqId}" which does not exist`);
						}
					}
				}
			}
		}

		return errors;
	},

	_getNestedValue(obj, path) {
		const parts = path.split('.');
		let current = obj;
		for (const part of parts) {
			if (current == null) return undefined;
			current = current[part];
		}
		return current;
	},
};

// Auto-load content when module is first required (backward compatible)
store.load({ async: false, lazy: true, useCache: true });

module.exports = store;

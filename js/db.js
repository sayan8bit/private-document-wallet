// Private Document Wallet — IndexedDB Wrapper
const DB_NAME = 'PrivateDocWallet';
const DB_VERSION = 1;

let _db = null;

const DB = {
  // Open / Initialize DB
  async open() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db = e.target.result;

        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('category', 'category', { unique: false });
          folderStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('folderId', 'folderId', { unique: false });
          docStore.createIndex('createdAt', 'createdAt', { unique: false });
          docStore.createIndex('name', 'name', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror = e => reject(e.target.error);
    });
  },

  // Generic helpers
  async _getStore(storeName, mode = 'readonly') {
    const db = await this.open();
    return db.transaction(storeName, mode).objectStore(storeName);
  },

  async _req(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = e => resolve(e.target.result);
      request.onerror = e => reject(e.target.error);
    });
  },

  // ── FOLDERS ──────────────────────────────────────────────
  async getFolders() {
    const store = await this._getStore('folders');
    return this._req(store.getAll());
  },

  async getFolder(id) {
    const store = await this._getStore('folders');
    return this._req(store.get(id));
  },

  async saveFolder(folder) {
    const store = await this._getStore('folders', 'readwrite');
    folder.updatedAt = Date.now();
    if (!folder.id) folder.id = 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    if (!folder.createdAt) folder.createdAt = Date.now();
    return this._req(store.put(folder));
  },

  async deleteFolder(id) {
    // Delete folder and all its documents
    const docs = await this.getDocumentsByFolder(id);
    for (const doc of docs) await this.deleteDocument(doc.id);
    const store = await this._getStore('folders', 'readwrite');
    return this._req(store.delete(id));
  },

  async updateFolderStats(folderId) {
    const docs = await this.getDocumentsByFolder(folderId);
    const folder = await this.getFolder(folderId);
    if (!folder) return;
    folder.count = docs.length;
    folder.size = docs.reduce((sum, d) => sum + (d.size || 0), 0);
    await this.saveFolder(folder);
    return folder;
  },

  // ── DOCUMENTS ────────────────────────────────────────────
  async getDocumentsByFolder(folderId) {
    const store = await this._getStore('documents');
    const index = store.index('folderId');
    return this._req(index.getAll(folderId));
  },

  async getAllDocuments() {
    const store = await this._getStore('documents');
    return this._req(store.getAll());
  },

  async getDocument(id) {
    const store = await this._getStore('documents');
    return this._req(store.get(id));
  },

  async saveDocument(doc) {
    const store = await this._getStore('documents', 'readwrite');
    doc.updatedAt = Date.now();
    if (!doc.id) doc.id = 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    if (!doc.createdAt) doc.createdAt = Date.now();
    await this._req(store.put(doc));
    await this.updateFolderStats(doc.folderId);
    return doc;
  },

  async deleteDocument(id) {
    const doc = await this.getDocument(id);
    const store = await this._getStore('documents', 'readwrite');
    await this._req(store.delete(id));
    if (doc) await this.updateFolderStats(doc.folderId);
  },

  async getRecentDocuments(limit = 20) {
    const all = await this.getAllDocuments();
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },

  async searchDocuments(query) {
    const all = await this.getAllDocuments();
    const q = query.toLowerCase();
    return all.filter(d => d.name.toLowerCase().includes(q));
  },

  async searchFolders(query) {
    const all = await this.getFolders();
    const q = query.toLowerCase();
    return all.filter(f => f.name.toLowerCase().includes(q));
  },

  // ── SETTINGS ─────────────────────────────────────────────
  async getSetting(key) {
    const store = await this._getStore('settings');
    const result = await this._req(store.get(key));
    return result ? result.value : null;
  },

  async setSetting(key, value) {
    const store = await this._getStore('settings', 'readwrite');
    return this._req(store.put({ key, value }));
  },

  async deleteSetting(key) {
    const store = await this._getStore('settings', 'readwrite');
    return this._req(store.delete(key));
  },

  // ── STATS ─────────────────────────────────────────────────
  async getTotalStats() {
    const [folders, docs] = await Promise.all([this.getFolders(), this.getAllDocuments()]);
    const totalSize = docs.reduce((sum, d) => sum + (d.size || 0), 0);
    return { folderCount: folders.length, docCount: docs.length, totalSize };
  }
};

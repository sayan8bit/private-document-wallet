// Private Document Wallet — Minimalist, Clean & Fast App Logic

const App = {
  currentView: 'home',
  currentFolderId: null,
  currentDocId: null,
  viewStack: [],
  isGridView: true,
  activeCategoryFilter: 'all',
  cameraStream: null,

  // ── Init ──────────────────────────────────────────────────
  async init() {
    try {
      this._initTheme();
      await DB.open();
      await this._seedInitialData();
      this._setupDragAndDrop();
      this._registerServiceWorker();
      await this.showView('home');
      this._setupInstallBanner();
      console.log('DocVault initialized.');
    } catch (err) {
      console.error('Init error:', err);
      this.showToast('Init error: ' + err.message, 'error');
    }
  },

  // ── Theme Switcher ────────────────────────────────────────
  _initTheme() {
    const saved = localStorage.getItem('pdw_theme') || 'dark';
    if (saved === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
    this._updateThemeUI();
  },

  toggleTheme() {
    const isLight = document.body.classList.toggle('theme-light');
    localStorage.setItem('pdw_theme', isLight ? 'light' : 'dark');
    this._updateThemeUI();
    this.showToast(isLight ? '☀️ Light theme enabled' : '🌙 Dark theme enabled', 'info');
  },

  _updateThemeUI() {
    const isLight = document.body.classList.contains('theme-light');
    const label = document.getElementById('theme-label');
    if (label) label.textContent = isLight ? 'Clean Light Theme' : 'Cyber Dark Theme';
  },

  async _seedInitialData() {
    // Purge any previous demo files if present
    const allDocs = await DB.getAllDocuments();
    const demoNames = ['Passport_Scan.pdf', 'National_ID_Card.png', 'Driving_License.png', 'Bank_Statement_Q3.pdf', 'Health_Insurance_Policy.pdf'];
    for (const doc of allDocs) {
      if (demoNames.includes(doc.name)) {
        await DB.deleteDocument(doc.id);
      }
    }

    const existing = await DB.getFolders();
    if (existing.length > 0) return;

    // Clean folder structure
    const defaults = [
      { id: 'f_kyc', name: 'KYC Documents', category: 'kyc', icon: '🪪' },
      { id: 'f_identity', name: 'Identity Cards', category: 'identity', icon: '👤' },
      { id: 'f_bank', name: 'Bank Documents', category: 'bank', icon: '🏦' },
      { id: 'f_insurance', name: 'Insurance Docs', category: 'insurance', icon: '🛡️' },
      { id: 'f_education', name: 'Educational Docs', category: 'education', icon: '🎓' },
      { id: 'f_vehicle', name: 'Vehicle Proofs', category: 'vehicle', icon: '🚗' },
      { id: 'f_medical', name: 'Medical Reports', category: 'medical', icon: '🏥' },
      { id: 'f_work', name: 'Work Documents', category: 'work', icon: '💼' }
    ];

    for (const f of defaults) {
      await DB.saveFolder({ ...f, count: 0, size: 0, createdAt: Date.now() });
    }
  },

  _setupDragAndDrop() {
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        this.handleFileUpload(e.dataTransfer.files);
      }
    });
  },

  async _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (e) {
        console.warn('SW notice:', e);
      }
    }
  },

  _setupInstallBanner() {
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      const banner = document.getElementById('install-banner');
      if (banner) banner.classList.add('visible');
    });

    document.getElementById('install-btn')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        document.getElementById('install-banner')?.classList.remove('visible');
      }
      deferredPrompt = null;
    });

    document.getElementById('install-dismiss')?.addEventListener('click', () => {
      document.getElementById('install-banner')?.classList.remove('visible');
    });
  },

  // ── Router ────────────────────────────────────────────────
  async showView(name, pushStack = true) {
    if (pushStack && this.currentView !== name) {
      this.viewStack.push(this.currentView);
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${name}`);
    if (view) {
      view.classList.add('active');
      UI.animateIn(view, 'slide-up');
    }
    this.currentView = name;

    // Update bottom nav & sidebar active highlights
    document.querySelectorAll('.nav-item, .sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === name);
    });

    // Render corresponding view data
    if (name === 'home')     await this.renderHome();
    if (name === 'recent')   await this.renderRecent();
    if (name === 'settings') await this.renderSettings();
  },

  goBack() {
    const prev = this.viewStack.pop();
    if (prev) {
      this.showView(prev, false);
    } else {
      this.showView('home', false);
    }
  },

  // ── Category Filter ───────────────────────────────────────
  async filterCategory(categoryId, pillElement) {
    this.activeCategoryFilter = categoryId;
    document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
    if (pillElement) pillElement.classList.add('active');

    const folders = await DB.getFolders();
    const filtered = categoryId === 'all'
      ? folders
      : folders.filter(f => f.category === categoryId);

    this._renderFolderList(filtered);
  },

  // ── Home View ─────────────────────────────────────────────
  async renderHome() {
    const [folders, recentDocs, stats] = await Promise.all([
      DB.getFolders(),
      DB.getRecentDocuments(5),
      DB.getTotalStats()
    ]);

    // Update stats bar
    const storageMain = document.getElementById('stat-main-storage');
    const storagePill = document.getElementById('storage-pill-count');

    if (storageMain) storageMain.textContent = `${stats.docCount} Documents • ${Crypto.formatSize(stats.totalSize)}`;
    if (storagePill) storagePill.textContent = `${stats.folderCount} Folders`;

    const filtered = this.activeCategoryFilter === 'all'
      ? folders
      : folders.filter(f => f.category === this.activeCategoryFilter);

    this._renderFolderList(filtered);
    this._renderHomeRecentDocs(recentDocs);
  },

  _renderFolderList(folders) {
    const grid = document.getElementById('folders-grid');
    if (!grid) return;

    if (folders.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📂</div>
          <div class="empty-text">No folders found</div>
          <div class="empty-sub">Create a folder to start organizing documents</div>
        </div>`;
      return;
    }

    grid.innerHTML = folders.map(f => UI.renderFolderCard(f)).join('');
  },

  _renderHomeRecentDocs(docs) {
    const container = document.getElementById('home-recent-docs');
    if (!container) return;

    if (!docs || docs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px">
          <div class="empty-sub">No recent files yet</div>
        </div>`;
      return;
    }

    container.innerHTML = docs.map(d => UI.renderDocCard(d)).join('');
  },

  toggleView() {
    this.isGridView = !this.isGridView;
    const grid = document.getElementById('folders-grid');
    if (grid) {
      grid.style.gridTemplateColumns = this.isGridView ? '' : '1fr';
    }
    this.renderHome();
  },

  // ── Search ────────────────────────────────────────────────
  async handleSearch(query) {
    if (!query || !query.trim()) {
      await this.renderHome();
      return;
    }

    const [folders, docs] = await Promise.all([
      DB.searchFolders(query),
      DB.searchDocuments(query)
    ]);

    const grid = document.getElementById('folders-grid');
    const recent = document.getElementById('home-recent-docs');
    if (!grid) return;

    if (recent) recent.innerHTML = '';

    let html = '';
    if (folders.length > 0) {
      html += folders.map(f => UI.renderFolderCard(f)).join('');
    }
    if (docs.length > 0) {
      html += docs.map(d => UI.renderDocCard(d)).join('');
    }
    if (folders.length === 0 && docs.length === 0) {
      html = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No matches found for "${UI.escHtml(query)}"</div></div>`;
    }

    grid.innerHTML = html;
  },

  // ── Folder View ───────────────────────────────────────────
  async openFolder(folderId) {
    this.currentFolderId = folderId;
    const folder = await DB.getFolder(folderId);
    if (!folder) return;

    const titleEl = document.getElementById('folder-header-title');
    if (titleEl) titleEl.textContent = folder.name;

    await this.renderFolderDocs();
    await this.showView('folder');
  },

  async renderFolderDocs() {
    const docs = await DB.getDocumentsByFolder(this.currentFolderId);
    const container = document.getElementById('folder-docs');
    if (!container) return;

    if (docs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <div class="empty-text">Folder is empty</div>
          <div class="empty-sub">Import files or scan documents with your camera</div>
          <div style="display:flex;gap:10px;margin-top:16px">
            <button class="btn-primary" onclick="App.triggerUpload()">📁 Import File</button>
            <button class="btn-secondary" onclick="App.openCameraScanner()">📷 Scan Document</button>
          </div>
        </div>`;
      return;
    }

    container.innerHTML = docs
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(d => UI.renderDocCard(d))
      .join('');
  },

  // ── Upload Document ───────────────────────────────────────
  triggerUpload() {
    const input = document.getElementById('file-input');
    if (input) input.click();
  },

  async handleFileUpload(files) {
    if (!files || !files.length) return;

    const targetFolderId = this.currentFolderId || 'f_kyc';

    for (const file of Array.from(files)) {
      try {
        const data = await this._readFileAsDataURL(file);
        let thumbnail = null;

        if (file.type.startsWith('image/')) {
          thumbnail = await this._generateThumbnail(data);
        }

        const doc = {
          folderId: targetFolderId,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          data: data,
          thumbnail: thumbnail,
          createdAt: Date.now()
        };

        await DB.saveDocument(doc);
      } catch (err) {
        console.error('File upload error:', err);
        this.showToast('Failed to load: ' + file.name, 'error');
      }
    }

    if (this.currentView === 'folder') {
      await this.renderFolderDocs();
    } else {
      await this.renderHome();
    }

    this.showToast(`${files.length} document${files.length > 1 ? 's' : ''} saved locally ✅`, 'success');
  },

  _readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async _generateThumbnail(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 180;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  },

  // ── Document Viewer ───────────────────────────────────────
  async openDocument(docId) {
    this.currentDocId = docId;
    const doc = await DB.getDocument(docId);
    if (!doc) {
      this.showToast('Document not found', 'error');
      return;
    }

    const title = document.getElementById('doc-viewer-title');
    const content = document.getElementById('doc-viewer-content');

    if (title) title.textContent = doc.name;

    if (content) {
      if (doc.mimeType && (doc.mimeType.startsWith('image/') || doc.data.startsWith('data:image/'))) {
        content.innerHTML = `<img src="${doc.data}" alt="${UI.escHtml(doc.name)}" class="doc-preview-img" />`;
      } else if (doc.mimeType === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf')) {
        content.innerHTML = `
          <div style="width:100%;height:100%;display:flex;flex-direction:column">
            <iframe src="${doc.data}" class="pdf-iframe" title="${UI.escHtml(doc.name)}"></iframe>
          </div>`;
      } else {
        const icon = UI.getFileIcon(doc.mimeType, doc.name);
        const color = UI.getFileColor(doc.mimeType, doc.name);
        content.innerHTML = `
          <div style="text-align:center;padding:32px">
            <div style="width:72px;height:72px;border-radius:18px;background:${color}20;color:${color};font-size:36px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
              ${icon}
            </div>
            <div style="font-size:16px;font-weight:700;margin-bottom:4px">${UI.escHtml(doc.name)}</div>
            <div style="font-size:12px;color:var(--text-dim);margin-bottom:16px">${Crypto.formatSize(doc.size)}</div>
            <button class="btn-primary" onclick="App.downloadDocument('${doc.id}')">⬇️ Download File</button>
          </div>`;
      }
    }

    await this.showView('viewer');
  },

  async downloadDocument(docId) {
    const targetId = docId || this.currentDocId;
    const doc = await DB.getDocument(targetId);
    if (!doc) return;

    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast('Download started ⬇️', 'success');
  },

  async shareDocument(docId) {
    const targetId = docId || this.currentDocId;
    const doc = await DB.getDocument(targetId);
    if (!doc) return;

    if (navigator.share) {
      try {
        const blob = await (await fetch(doc.data)).blob();
        const file = new File([blob], doc.name, { type: doc.mimeType });
        await navigator.share({
          files: [file],
          title: doc.name,
          text: 'Shared from DocVault'
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          this.downloadDocument(targetId);
        }
      }
    } else {
      this.downloadDocument(targetId);
    }
  },

  async deleteDocument(docId) {
    const targetId = docId || this.currentDocId;
    const doc = await DB.getDocument(targetId);
    if (!doc) return;

    UI.showModal({
      title: 'Delete Document',
      body: `Are you sure you want to permanently delete <strong>"${UI.escHtml(doc.name)}"</strong>?`,
      confirmText: 'Delete',
      dangerous: true,
      onConfirm: async () => {
        await DB.deleteDocument(targetId);
        if (this.currentView === 'viewer') {
          this.goBack();
        } else if (this.currentView === 'folder') {
          await this.renderFolderDocs();
        } else {
          await this.renderHome();
        }
        this.showToast('Document deleted 🗑️', 'info');
      }
    });
  },

  async renameDocument(docId) {
    const targetId = docId || this.currentDocId;
    const doc = await DB.getDocument(targetId);
    if (!doc) return;

    UI.showPrompt({
      title: 'Rename Document',
      placeholder: 'Enter new document name',
      value: doc.name,
      onConfirm: async (newName) => {
        doc.name = newName;
        await DB.saveDocument(doc);
        if (this.currentView === 'viewer') {
          document.getElementById('doc-viewer-title').textContent = newName;
        } else if (this.currentView === 'folder') {
          await this.renderFolderDocs();
        } else {
          await this.renderHome();
        }
        this.showToast('Document renamed ✏️', 'success');
      }
    });
  },

  // ── Folder Management ─────────────────────────────────────
  showCreateFolder() {
    const categories = UI.CATEGORIES.filter(c => c.id !== 'custom');
    const opts = categories.map(c => `
      <div class="cat-picker-opt" data-id="${c.id}" onclick="App._selectCategory('${c.id}')">
        <span>${c.icon}</span>
        <span>${c.name}</span>
      </div>`
    ).join('');

    const existing = document.getElementById('create-folder-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'create-folder-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">Create New Folder</div>
        <div class="modal-body">
          <input class="modal-input" id="folder-name-input" type="text" placeholder="Folder name (e.g., Tax Returns)" autofocus />
          <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;margin:12px 0 6px">Choose Category</div>
          <div class="cat-picker-grid">${opts}</div>
          <input type="hidden" id="folder-cat-input" value="kyc" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="document.getElementById('create-folder-overlay').remove()">Cancel</button>
          <button class="btn-primary" onclick="App._confirmCreateFolder()">Create Folder</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this._selectCategory('kyc');
    setTimeout(() => document.getElementById('folder-name-input')?.focus(), 50);
  },

  _selectCategory(catId) {
    document.querySelectorAll('.cat-picker-opt').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === catId);
    });
    const inp = document.getElementById('folder-cat-input');
    if (inp) inp.value = catId;
  },

  async _confirmCreateFolder() {
    const name = document.getElementById('folder-name-input')?.value.trim();
    const category = document.getElementById('folder-cat-input')?.value || 'custom';
    if (!name) {
      this.showToast('Please enter a folder name', 'error');
      return;
    }

    const cat = UI.getCategoryConfig(category);
    await DB.saveFolder({
      name: name,
      category: category,
      icon: cat.icon,
      count: 0,
      size: 0,
      createdAt: Date.now()
    });

    document.getElementById('create-folder-overlay')?.remove();
    await this.renderHome();
    this.showToast('Folder created! 📁', 'success');
  },

  async renameFolder(folderId) {
    const targetId = folderId || this.currentFolderId;
    const folder = await DB.getFolder(targetId);
    if (!folder) return;

    UI.showPrompt({
      title: 'Rename Folder',
      placeholder: 'Folder name',
      value: folder.name,
      onConfirm: async (newName) => {
        folder.name = newName;
        await DB.saveFolder(folder);
        if (this.currentView === 'folder') {
          document.getElementById('folder-header-title').textContent = newName;
        }
        await this.renderHome();
        this.showToast('Folder renamed ✏️', 'success');
      }
    });
  },

  async deleteFolder(folderId) {
    const targetId = folderId || this.currentFolderId;
    const folder = await DB.getFolder(targetId);
    if (!folder) return;

    UI.showModal({
      title: 'Delete Folder',
      body: `Delete <strong>"${UI.escHtml(folder.name)}"</strong> and all documents inside it?`,
      confirmText: 'Delete Folder',
      dangerous: true,
      onConfirm: async () => {
        await DB.deleteFolder(targetId);
        if (this.currentView === 'folder') {
          this.goBack();
        }
        await this.renderHome();
        this.showToast('Folder deleted 🗑️', 'info');
      }
    });
  },

  // ── Document Scanner (Camera) ─────────────────────────────
  async openCameraScanner() {
    const existing = document.getElementById('scanner-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'scanner-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:500px">
        <div class="modal-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>📷 Document Scanner</span>
          <button class="icon-btn" onclick="App.closeCameraScanner()">✕</button>
        </div>
        <div class="scanner-viewport">
          <video id="scanner-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>
          <div class="scanner-laser"></div>
        </div>
        <div class="modal-actions" style="margin-top:14px">
          <button class="btn-secondary" onclick="App.closeCameraScanner()">Cancel</button>
          <button class="btn-primary" onclick="App.captureScan()">📸 Snap &amp; Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      const video = document.getElementById('scanner-video');
      if (video) video.srcObject = this.cameraStream;
    } catch (err) {
      console.warn('Camera fallback:', err);
      this.closeCameraScanner();
      this.triggerUpload();
    }
  },

  closeCameraScanner() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    document.getElementById('scanner-overlay')?.remove();
  },

  async captureScan() {
    const video = document.getElementById('scanner-video');
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const thumbnail = await this._generateThumbnail(dataUrl);

    const targetFolderId = this.currentFolderId || 'f_kyc';
    const docName = `Scan_${new Date().toISOString().slice(0, 10)}_${Math.floor(Math.random() * 1000)}.jpg`;

    const doc = {
      folderId: targetFolderId,
      name: docName,
      mimeType: 'image/jpeg',
      size: Math.round(dataUrl.length * 0.75),
      data: dataUrl,
      thumbnail: thumbnail,
      createdAt: Date.now()
    };

    await DB.saveDocument(doc);
    this.closeCameraScanner();

    if (this.currentView === 'folder') {
      await this.renderFolderDocs();
    } else {
      await this.renderHome();
    }

    this.showToast('Document saved to vault 📸', 'success');
  },

  // ── Recent View ───────────────────────────────────────────
  async renderRecent() {
    const docs = await DB.getRecentDocuments(50);
    const container = document.getElementById('recent-docs-list');
    if (!container) return;

    if (!docs || docs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <div class="empty-text">No recent documents</div>
          <div class="empty-sub">Import files or scan documents with your camera</div>
        </div>`;
      return;
    }

    container.innerHTML = docs.map(d => UI.renderDocCard(d)).join('');
  },

  // ── Settings View ─────────────────────────────────────────
  async renderSettings() {
    this._updateThemeUI();
  },

  async exportBackup() {
    try {
      const [folders, docs] = await Promise.all([
        DB.getFolders(),
        DB.getAllDocuments()
      ]);
      const backup = {
        version: '2.1.0',
        exportedAt: new Date().toISOString(),
        folders,
        docs
      };
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DocVault_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('Backup downloaded 💾', 'success');
    } catch (err) {
      this.showToast('Export failed: ' + err.message, 'error');
    }
  },

  async importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.folders && Array.isArray(data.folders)) {
          for (const f of data.folders) await DB.saveFolder(f);
        }
        if (data.docs && Array.isArray(data.docs)) {
          for (const d of data.docs) await DB.saveDocument(d);
        }
        await this.renderHome();
        this.showToast('Backup restored successfully ✅', 'success');
      } catch (err) {
        this.showToast('Invalid backup file: ' + err.message, 'error');
      }
    };
    input.click();
  },

  confirmClearData() {
    UI.showModal({
      title: '⚠️ Wipe All Local Data',
      body: 'This will permanently delete ALL folders and documents stored in this browser vault.',
      confirmText: 'Wipe Everything',
      dangerous: true,
      onConfirm: async () => {
        try {
          const req = indexedDB.deleteDatabase('PrivateDocWallet');
          req.onsuccess = () => location.reload();
          req.onerror = () => location.reload();
        } catch (e) {
          location.reload();
        }
      }
    });
  },

  // ── Toast Notification ────────────────────────────────────
  showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }
};

window.App = App;

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());

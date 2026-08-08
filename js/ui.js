// Private Document Wallet — Optimized UI Rendering Helpers

const UI = {
  // ── Category Config ──────────────────────────────────────
  CATEGORIES: [
    { id: 'kyc',       name: 'KYC Documents',    icon: '🪪', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
    { id: 'identity',  name: 'Identity Cards',    icon: '👤', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' },
    { id: 'bank',      name: 'Bank Documents',    icon: '🏦', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
    { id: 'insurance', name: 'Insurance Docs',    icon: '🛡️', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.12)' },
    { id: 'education', name: 'Educational Docs',  icon: '🎓', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
    { id: 'vehicle',   name: 'Vehicle Proofs',    icon: '🚗', color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.12)' },
    { id: 'medical',   name: 'Medical Reports',   icon: '🏥', color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.12)' },
    { id: 'work',      name: 'Work Documents',    icon: '💼', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' },
    { id: 'custom',    name: 'Custom Folder',     icon: '📁', color: '#475569', bg: 'rgba(71, 85, 105, 0.12)' }
  ],

  getCategoryConfig(catId) {
    return this.CATEGORIES.find(c => c.id === catId) || this.CATEGORIES[this.CATEGORIES.length - 1];
  },

  getFileIcon(type, name = '') {
    const n = (name || '').toLowerCase();
    if ((type && type.startsWith('image/')) || n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg')) return '🖼️';
    if (type === 'application/pdf' || n.endsWith('.pdf')) return '📕';
    if (n.endsWith('.doc') || n.endsWith('.docx')) return '📝';
    if (n.endsWith('.xls') || n.endsWith('.xlsx')) return '📊';
    return '📄';
  },

  getFileColor(type, name = '') {
    const n = (name || '').toLowerCase();
    if ((type && type.startsWith('image/')) || n.endsWith('.png') || n.endsWith('.jpg')) return '#059669';
    if (type === 'application/pdf' || n.endsWith('.pdf')) return '#DC2626';
    if (n.endsWith('.doc') || n.endsWith('.docx')) return '#2563EB';
    if (n.endsWith('.xls') || n.endsWith('.xlsx')) return '#0D9488';
    return '#6366F1';
  },

  // ── Render Folder Card (Grid) ────────────────────────────
  renderFolderCard(folder) {
    const cat = this.getCategoryConfig(folder.category);
    const count = folder.count || 0;
    const size = Crypto.formatSize(folder.size || 0);
    const icon = folder.icon || cat.icon;
    const color = cat.color || '#2563EB';
    const bg = cat.bg || 'rgba(37, 99, 235, 0.12)';
    const pct = Math.min(100, (count / 10) * 100);

    return `
      <div class="folder-card" onclick="App.openFolder('${folder.id}')" role="button" tabindex="0">
        <div class="folder-card-top">
          <div class="folder-icon-box" style="background:${bg}; color:${color}">
            <span>${icon}</span>
          </div>
          <button class="folder-dots-btn" onclick="event.stopPropagation();UI.showFolderMenu('${folder.id}',event)" title="Options" aria-label="Folder options">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>
        <div class="folder-card-info">
          <div class="folder-card-name" title="${this.escHtml(folder.name)}">${this.escHtml(folder.name)}</div>
          <div class="folder-card-meta">${count === 0 ? '<span class="empty-pill">0 files</span>' : `${count} item${count !== 1 ? 's' : ''} • ${size}`}</div>
          ${count > 0 ? `
          <div class="folder-progress-bar">
            <div class="folder-progress-fill" style="width:${pct}%;background:${color}"></div>
          </div>` : ''}
        </div>
      </div>
    `;
  },

  // ── Render Document Card (Inside folder) ─────────────────
  renderDocCard(doc) {
    const icon = this.getFileIcon(doc.mimeType, doc.name);
    const color = this.getFileColor(doc.mimeType, doc.name);
    const date = Crypto.formatDate(doc.createdAt);
    const size = Crypto.formatSize(doc.size);
    const hasThumb = doc.thumbnail || (doc.mimeType && doc.mimeType.startsWith('image/') ? doc.data : null);

    return `
      <div class="doc-row-card" onclick="App.openDocument('${doc.id}')" role="button" tabindex="0">
        <div class="doc-row-thumb" style="${hasThumb ? `background-image:url(${hasThumb})` : `background:${color}20`}">
          ${hasThumb ? '' : `<span style="font-size:20px">${icon}</span>`}
        </div>
        <div class="doc-row-info">
          <div class="doc-row-title">${this.escHtml(doc.name)}</div>
          <div class="doc-row-meta">${size} • ${date}</div>
        </div>
        <div class="doc-row-actions">
          <button class="icon-btn" onclick="event.stopPropagation();App.downloadDocument('${doc.id}')" title="Download">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="icon-btn" onclick="event.stopPropagation();UI.showDocMenu('${doc.id}',event)" title="Options">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  // ── Render Recent Document Row ───────────────────────────
  renderRecentDocRow(doc) {
    return this.renderDocCard(doc);
  },

  // ── Context Menus ─────────────────────────────────────────
  showFolderMenu(folderId, event) {
    const existing = document.querySelector('.ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.innerHTML = `
      <button onclick="App.openFolder('${folderId}')">📂 Open Folder</button>
      <button onclick="App.renameFolder('${folderId}')">✏️ Rename</button>
      <button class="danger" onclick="App.deleteFolder('${folderId}')">🗑️ Delete</button>
    `;

    const rect = event.currentTarget.getBoundingClientRect();
    menu.style.top = Math.min(rect.bottom + 6, window.innerHeight - 150) + 'px';
    menu.style.left = Math.max(10, Math.min(rect.left - 40, window.innerWidth - 180)) + 'px';
    document.body.appendChild(menu);

    setTimeout(() => {
      const close = e => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 50);
  },

  showDocMenu(docId, event) {
    const existing = document.querySelector('.ctx-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.innerHTML = `
      <button onclick="App.openDocument('${docId}')">👁️ View</button>
      <button onclick="App.downloadDocument('${docId}')">⬇️ Download</button>
      <button onclick="App.shareDocument('${docId}')">🔗 Share</button>
      <button onclick="App.renameDocument('${docId}')">✏️ Rename</button>
      <button class="danger" onclick="App.deleteDocument('${docId}')">🗑️ Delete</button>
    `;

    const rect = event.currentTarget.getBoundingClientRect();
    menu.style.top = Math.min(rect.bottom + 6, window.innerHeight - 200) + 'px';
    menu.style.left = Math.max(10, Math.min(rect.left - 60, window.innerWidth - 180)) + 'px';
    document.body.appendChild(menu);

    setTimeout(() => {
      const close = e => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 50);
  },

  // ── Modal & Prompt ────────────────────────────────────────
  showModal({ title, body, confirmText = 'OK', cancelText = 'Cancel', onConfirm, dangerous = false }) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-title">${title}</div>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${cancelText ? `<button class="btn-secondary modal-cancel">${cancelText}</button>` : ''}
          <button class="btn-primary modal-confirm" style="${dangerous ? 'background:var(--danger)' : ''}">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-cancel')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('.modal-confirm')?.addEventListener('click', () => {
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm();
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    return overlay;
  },

  showPrompt({ title, placeholder = '', value = '', onConfirm }) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-title">${title}</div>
        <div class="modal-body">
          <input class="modal-input" type="text" placeholder="${placeholder}" value="${this.escHtml(value)}" autofocus />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary modal-cancel">Cancel</button>
          <button class="btn-primary modal-confirm">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.modal-input');
    input.focus();
    input.select();

    const confirm = () => {
      const val = input.value.trim();
      if (val) {
        overlay.remove();
        if (typeof onConfirm === 'function') onConfirm(val);
      }
    };

    overlay.querySelector('.modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.modal-confirm').addEventListener('click', confirm);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') overlay.remove();
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
  },

  escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  animateIn(el, cls = 'slide-up') {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
};

window.UI = UI;


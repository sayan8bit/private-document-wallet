// Private Document Wallet — Crypto Helpers (PIN hashing via Web Crypto)

const Crypto = {
  // Generate a random hex salt
  generateSalt(length = 16) {
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Hash PIN + salt using SHA-256
  async hashPIN(pin, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Create a stored PIN credential { hash, salt }
  async createPINCredential(pin) {
    const salt = this.generateSalt();
    const hash = await this.hashPIN(pin, salt);
    return { hash, salt };
  },

  // Verify a PIN against stored credential
  async verifyPIN(pin, credential) {
    const hash = await this.hashPIN(pin, credential.salt);
    return hash === credential.hash;
  },

  // Simple base64 encode/decode for data storage
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  },

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  },

  // Format bytes to human-readable
  formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  // Format date
  formatDate(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    const day = 86400000;
    if (diff < day) return 'Today';
    if (diff < 2 * day) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  // Generate unique ID
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
};

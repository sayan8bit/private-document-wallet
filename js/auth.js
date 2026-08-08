// Private Document Wallet — Authentication Module

const Auth = {
  LOCK_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  _lockTimer: null,
  _isAuthenticated: false,

  // ── Session ────────────────────────────────────────────
  get isAuthenticated() { return this._isAuthenticated; },

  setAuthenticated(val) {
    this._isAuthenticated = val;
    if (val) {
      sessionStorage.setItem('pdw_session', '1');
      this.startLockTimer();
    } else {
      sessionStorage.removeItem('pdw_session');
      this.stopLockTimer();
    }
  },

  checkSession() {
    return sessionStorage.getItem('pdw_session') === '1';
  },

  // ── PIN ────────────────────────────────────────────────
  hasPIN() {
    return !!localStorage.getItem('pdw_pin_cred');
  },

  getPINCredential() {
    const raw = localStorage.getItem('pdw_pin_cred');
    return raw ? JSON.parse(raw) : null;
  },

  async setPIN(pin) {
    const cred = await Crypto.createPINCredential(pin);
    localStorage.setItem('pdw_pin_cred', JSON.stringify(cred));
    return cred;
  },

  async verifyPIN(pin) {
    const cred = this.getPINCredential();
    if (!cred) return false;
    return Crypto.verifyPIN(pin, cred);
  },

  async changePIN(oldPin, newPin) {
    const valid = await this.verifyPIN(oldPin);
    if (!valid) throw new Error('Incorrect current PIN');
    await this.setPIN(newPin);
  },

  // ── Biometric (WebAuthn) ───────────────────────────────
  isBiometricSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials);
  },

  async isBiometricAvailable() {
    if (!this.isBiometricSupported()) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch { return false; }
  },

  hasBiometric() {
    return !!localStorage.getItem('pdw_bio_cred');
  },

  async registerBiometric() {
    if (!this.isBiometricSupported()) throw new Error('Biometric not supported');

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const options = {
      challenge,
      rp: { name: 'Private Document Wallet', id: location.hostname || 'localhost' },
      user: { id: userId, name: 'user@pdw', displayName: 'Document Wallet User' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        requireResidentKey: false
      },
      timeout: 60000,
      attestation: 'none'
    };

    try {
      const cred = await navigator.credentials.create({ publicKey: options });
      const credData = {
        id: cred.id,
        rawId: Array.from(new Uint8Array(cred.rawId)),
        type: cred.type
      };
      localStorage.setItem('pdw_bio_cred', JSON.stringify(credData));
      return true;
    } catch (err) {
      console.error('Biometric registration failed:', err);
      throw err;
    }
  },

  async verifyBiometric() {
    const stored = localStorage.getItem('pdw_bio_cred');
    if (!stored) return false;

    const credData = JSON.parse(stored);
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const options = {
      challenge,
      allowCredentials: [{
        id: new Uint8Array(credData.rawId),
        type: 'public-key',
        transports: ['internal']
      }],
      userVerification: 'required',
      timeout: 60000
    };

    try {
      await navigator.credentials.get({ publicKey: options });
      return true;
    } catch (err) {
      console.error('Biometric verify failed:', err);
      return false;
    }
  },

  removeBiometric() {
    localStorage.removeItem('pdw_bio_cred');
  },

  // ── Auto Lock ──────────────────────────────────────────
  startLockTimer() {
    this.stopLockTimer();
    this._lockTimer = setTimeout(() => {
      this.lock();
    }, this.LOCK_TIMEOUT);
  },

  stopLockTimer() {
    if (this._lockTimer) { clearTimeout(this._lockTimer); this._lockTimer = null; }
  },

  resetLockTimer() {
    if (this._isAuthenticated) this.startLockTimer();
  },

  lock() {
    this.setAuthenticated(false);
    App.showView('lock');
    App.showToast('App locked due to inactivity', 'info');
  },

  // ── Clear all data ─────────────────────────────────────
  async clearAll() {
    localStorage.clear();
    sessionStorage.clear();
    const req = indexedDB.deleteDatabase('PrivateDocWallet');
    return new Promise((resolve) => {
      req.onsuccess = req.onerror = () => resolve();
    });
  }
};

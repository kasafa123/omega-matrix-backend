(function() {
    'use strict';

    // ================== KONFIGURASI BACKEND ==================
    const API_BASE_URL = 'https://backend-omega-kasafa.pxxl.click/api'; // Sesuaikan jika perlu

    const TELEGRAM_BOT_TOKEN = ''; // Isi jika ingin notifikasi Telegram
    const TELEGRAM_CHAT_ID = '';

    function sendTelegramAlert(message) {
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
        }).catch(() => {});
    }

    // ================== DATABASE INDEXEDDB ==================
    const Database = {
        db: null,
        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('OmegaIntelDB', 2);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('incidents')) {
                        const incidentStore = db.createObjectStore('incidents', { keyPath: 'id' });
                        incidentStore.createIndex('timestamp', 'rawDate', { unique: false });
                        incidentStore.createIndex('region', 'region', { unique: false });
                        incidentStore.createIndex('type', 'type', { unique: false });
                        incidentStore.createIndex('geofenced', 'geofenced', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('geofences')) {
                        const geofenceStore = db.createObjectStore('geofences', { keyPath: 'id' });
                        geofenceStore.createIndex('name', 'name', { unique: false });
                    }
                    if (!db.objectStoreNames.contains('audit_log')) {
                        db.createObjectStore('audit_log', { autoIncrement: true });
                    }
                    if (!db.objectStoreNames.contains('settings')) {
                        db.createObjectStore('settings', { keyPath: 'key' });
                    }
                };
                request.onsuccess = (e) => {
                    this.db = e.target.result;
                    console.log('✅ Database IndexedDB initialized');
                    log('📀 IndexedDB ready', 'ok');
                    resolve();
                };
                request.onerror = (e) => reject(e);
            });
        },
        async saveIncident(incident) {
            if (!this.db) return;
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('incidents', 'readwrite');
                const store = tx.objectStore('incidents');
                incident.synced = false;
                incident.lastModified = Date.now();
                const request = store.put(incident);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e);
            });
        },
        async getIncidents(filter = {}) {
            if (!this.db) return [];
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('incidents', 'readonly');
                const store = tx.objectStore('incidents');
                const index = store.index('timestamp');
                const results = [];
                const range = filter.since ? IDBKeyRange.lowerBound(filter.since) : null;
                const request = index.openCursor(range, 'prev');
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        results.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                request.onerror = (e) => reject(e);
            });
        },
        async saveGeofence(geofence) {
            if (!this.db) return;
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('geofences', 'readwrite');
                const store = tx.objectStore('geofences');
                const request = store.put(geofence);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e);
            });
        },
        async getGeofences() {
            if (!this.db) return [];
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('geofences', 'readonly');
                const store = tx.objectStore('geofences');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e);
            });
        },
        async deleteGeofence(id) {
            if (!this.db) return;
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('geofences', 'readwrite');
                const store = tx.objectStore('geofences');
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e);
            });
        },
        async saveAuditLog(log) {
            if (!this.db) return;
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('audit_log', 'readwrite');
                const store = tx.objectStore('audit_log');
                const request = store.add(log);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e);
            });
        },
        async getAuditLogs(limit = 50) {
            if (!this.db) return [];
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('audit_log', 'readonly');
                const store = tx.objectStore('audit_log');
                const request = store.openCursor(null, 'prev');
                const results = [];
                let count = 0;
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && count < limit) {
                        results.push(cursor.value);
                        count++;
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                request.onerror = (e) => reject(e);
            });
        },
        async saveSetting(key, value) {
            if (!this.db) return;
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('settings', 'readwrite');
                const store = tx.objectStore('settings');
                const request = store.put({ key, value, updated: Date.now() });
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e);
            });
        },
        async getSetting(key) {
            if (!this.db) return null;
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction('settings', 'readonly');
                const store = tx.objectStore('settings');
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result?.value);
                request.onerror = (e) => reject(e);
            });
        },
        async clearAll() {
            const stores = ['incidents', 'geofences', 'audit_log', 'settings'];
            for (const storeName of stores) {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                await store.clear();
            }
            log('🗑️ All data cleared', 'warn');
        }
    };

    // Fungsi tambahan untuk mengirim insiden ke backend
    async function sendIncidentToServer(incident) {
        try {
            const authData = localStorage.getItem('omega_auth');
            let token = null;
            if (authData) {
                const parsed = JSON.parse(authData);
                token = parsed.token;
            }
            const response = await fetch(`${API_BASE_URL}/incidents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(incident)
            });
            if (!response.ok) throw new Error('Server error');
            log(`📡 Insiden ${incident.id} berhasil dikirim ke server`, 'ok');
        } catch (error) {
            log(`⚠️ Gagal mengirim insiden ke server: ${error.message}`, 'warn');
        }
    }

    // ================== AUTHENTICATION ==================
    const Auth = {
        currentUser: null,
        sessionToken: null,
        permissions: {
            admin: ['view_all', 'delete', 'export', 'manage_users', 'geofence_all', 'view_audit'],
            supervisor: ['view_all', 'export', 'geofence_create', 'view_audit'],
            analyst: ['view', 'geofence_view']
        },
        async init() {
            const saved = localStorage.getItem('omega_auth');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    if (data.expiry && data.expiry > Date.now()) {
                        this.currentUser = data.user;
                        this.sessionToken = data.token;
                        document.getElementById('auth-panel').style.display = 'none';
                        this.updateUI();
                    } else {
                        localStorage.removeItem('omega_auth');
                    }
                } catch (e) {}
            }
            window.addEventListener('online', () => this.updateOnlineStatus());
            window.addEventListener('offline', () => this.updateOnlineStatus());
            this.updateOnlineStatus();
        },
        updateOnlineStatus() {
            const offlineIndicator = document.getElementById('offline-indicator');
            if (!offlineIndicator) return;
            if (!navigator.onLine) {
                offlineIndicator.classList.add('show');
                log('📴 Offline mode active', 'warn');
            } else {
                offlineIndicator.classList.remove('show');
                log('📶 Back online', 'ok');
            }
        },
        async login() {
            const username = document.getElementById('username')?.value;
            const password = document.getElementById('password')?.value;
            const role = document.getElementById('role-select')?.value;
            if (!username || !password) {
                document.getElementById('auth-message').textContent = '❌ Username and password required';
                return;
            }
            try {
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (!response.ok) {
                    document.getElementById('auth-message').textContent = `❌ ${data.message}`;
                    return;
                }
                const token = data.token;
                const user = data.user;
                this.currentUser = {
                    username: user.username,
                    role: user.role,
                    loginTime: Date.now(),
                    permissions: this.permissions[user.role] || []
                };
                this.sessionToken = token;
                const sessionData = {
                    user: this.currentUser,
                    token: token,
                    expiry: Date.now() + (24 * 60 * 60 * 1000)
                };
                localStorage.setItem('omega_auth', JSON.stringify(sessionData));
                document.getElementById('auth-panel').style.display = 'none';
                this.updateUI();
                await this.auditLog('LOGIN', { username, role: user.role });
                log(`🔐 User ${username} (${user.role}) logged in`, 'ok');
                await this.loadUserSettings();
                this.showToast(`✅ Welcome, ${username}!`);
            } catch (error) {
                document.getElementById('auth-message').textContent = '❌ Gagal terhubung ke server';
                log(`❌ Login error: ${error.message}`, 'err');
            }
        },
        logout() {
            this.auditLog('LOGOUT', { username: this.currentUser?.username });
            localStorage.removeItem('omega_auth');
            this.currentUser = null;
            this.sessionToken = null;
            document.getElementById('auth-panel').style.display = 'flex';
            document.getElementById('user-info').style.display = 'none';
            document.getElementById('admin-tools').style.display = 'none';
            log('🔐 Logged out', 'info');
            this.showToast('👋 Logged out');
        },
        showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast show';
            setTimeout(() => toast.classList.remove('show'), 3000);
        },
        updateUI() {
            if (!this.currentUser) return;
            document.getElementById('user-name').textContent = this.currentUser.username;
            document.getElementById('user-role').textContent = this.currentUser.role.toUpperCase();
            document.getElementById('user-role-indicator').style.backgroundColor = 
                this.currentUser.role === 'admin' ? 'var(--red)' :
                this.currentUser.role === 'supervisor' ? 'var(--yellow)' : 'var(--green)';
            document.getElementById('user-info').style.display = 'flex';
            if (this.hasPermission('export') || this.hasPermission('delete') || this.hasPermission('view_audit')) {
                document.getElementById('admin-tools').style.display = 'flex';
            } else {
                document.getElementById('admin-tools').style.display = 'none';
            }
            this.applyPermissions();
        },
        hasPermission(action) {
            if (!this.currentUser) return false;
            return this.currentUser.permissions.includes(action) || this.currentUser.permissions.includes('admin');
        },
        applyPermissions() {
            document.querySelectorAll('[data-permission]').forEach(el => {
                const required = el.dataset.permission.split(' ');
                const hasAny = required.some(p => this.hasPermission(p));
                el.style.display = hasAny ? '' : 'none';
            });
        },
        async loadUserSettings() {
            if (!this.currentUser) return;
            const settingsKey = `user_settings_${this.currentUser.username}`;
            const saved = localStorage.getItem(settingsKey);
            if (saved) {
                try {
                    const settings = JSON.parse(saved);
                    if (settings.alertPreferences) {
                        document.getElementById('alert-war').checked = settings.alertPreferences.war ?? true;
                        document.getElementById('alert-nuclear').checked = settings.alertPreferences.nuclear ?? false;
                        document.getElementById('alert-breaking').checked = settings.alertPreferences.breaking ?? true;
                        document.getElementById('alert-geofence').checked = settings.alertPreferences.geofence ?? true;
                        document.getElementById('alert-sound').checked = settings.alertPreferences.sound ?? false;
                    }
                } catch (e) {}
            }
        },
        async saveUserSettings() {
            if (!this.currentUser) return;
            const settings = {
                alertPreferences: {
                    war: document.getElementById('alert-war')?.checked ?? true,
                    nuclear: document.getElementById('alert-nuclear')?.checked ?? false,
                    breaking: document.getElementById('alert-breaking')?.checked ?? true,
                    geofence: document.getElementById('alert-geofence')?.checked ?? true,
                    sound: document.getElementById('alert-sound')?.checked ?? false
                }
            };
            const settingsKey = `user_settings_${this.currentUser.username}`;
            localStorage.setItem(settingsKey, JSON.stringify(settings));
            await this.auditLog('SETTINGS_SAVED', { user: this.currentUser.username });
        },
        async auditLog(action, details) {
            const log = {
                timestamp: Date.now(),
                user: this.currentUser?.username || 'anonymous',
                action: action,
                details: details,
                userAgent: navigator.userAgent
            };
            const logsKey = 'audit_logs';
            const existing = localStorage.getItem(logsKey);
            const logs = existing ? JSON.parse(existing) : [];
            logs.unshift(log);
            if (logs.length > 100) logs.pop();
            localStorage.setItem(logsKey, JSON.stringify(logs));
        }
    };
    window.Auth = Auth;

    // ================== AUDIT ==================
    const Audit = {
        async showPanel() {
            const panel = document.getElementById('audit-panel');
            const body = document.getElementById('audit-body');
            const logsKey = 'audit_logs';
            const existing = localStorage.getItem(logsKey);
            const logs = existing ? JSON.parse(existing) : [];
            if (logs.length === 0) {
                body.innerHTML = '<div style="color:#666; padding:10px; text-align:center">No audit logs</div>';
            } else {
                body.innerHTML = logs.map(log => `
                    <div class="audit-item">
                        <div class="audit-time">${new Date(log.timestamp).toLocaleTimeString()}</div>
                        <div><span class="audit-action">${log.action}</span> by <span class="audit-user">${log.user}</span></div>
                        <div style="color:#666; font-size:6px">${JSON.stringify(log.details)}</div>
                    </div>
                `).join('');
            }
            panel.classList.add('show');
        },
        hidePanel() {
            document.getElementById('audit-panel').classList.remove('show');
        }
    };
    window.Audit = Audit;

    // ================== BACKUP SYSTEM ==================
    const BackupSystem = {
        async getKeyFromPassword(password, salt) {
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
            return crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );
        },
        async encrypt(data, password) {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await this.getKeyFromPassword(password, salt);
            const encoded = new TextEncoder().encode(JSON.stringify(data));
            const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
            const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
            result.set(salt, 0);
            result.set(iv, salt.length);
            result.set(new Uint8Array(ciphertext), salt.length + iv.length);
            return btoa(String.fromCharCode(...result));
        },
        async decrypt(encoded, password) {
            const data = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
            const salt = data.slice(0, 16);
            const iv = data.slice(16, 28);
            const ciphertext = data.slice(28);
            const key = await this.getKeyFromPassword(password, salt);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            return JSON.parse(new TextDecoder().decode(decrypted));
        },
        async exportAll() {
            if (!Auth.hasPermission('export')) return Auth.showToast('❌ Permission denied');
            const password = prompt('Enter encryption password for backup:');
            if (!password) return;
            const data = {
                version: '14.1',
                timestamp: Date.now(),
                geofences: Geofencing.fences,
                incidents: await Database.getIncidents({ since: 0 }),
                settings: {
                    alertPreferences: {
                        war: document.getElementById('alert-war')?.checked ?? true,
                        nuclear: document.getElementById('alert-nuclear')?.checked ?? false,
                        breaking: document.getElementById('alert-breaking')?.checked ?? true,
                        geofence: document.getElementById('alert-geofence')?.checked ?? true,
                        sound: document.getElementById('alert-sound')?.checked ?? false
                    }
                }
            };
            try {
                const encrypted = await this.encrypt(data, password);
                const blob = new Blob([encrypted], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `omega-backup-${new Date().toISOString().split('T')[0]}.enc`;
                a.click();
                URL.revokeObjectURL(url);
                Auth.auditLog('EXPORT', { size: data.incidents?.length });
                Auth.showToast('✅ Backup encrypted and saved');
            } catch (e) {
                Auth.showToast('❌ Encryption failed');
                console.error(e);
            }
        },
        async import(file) {
            if (!Auth.hasPermission('export')) return Auth.showToast('❌ Permission denied');
            const password = prompt('Enter password to decrypt backup:');
            if (!password) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = await this.decrypt(e.target.result, password);
                    if (data.geofences) {
                        Geofencing.fences = data.geofences;
                        Geofencing.save();
                        Geofencing.render();
                    }
                    if (data.settings?.alertPreferences) {
                        document.getElementById('alert-war').checked = data.settings.alertPreferences.war ?? true;
                        document.getElementById('alert-nuclear').checked = data.settings.alertPreferences.nuclear ?? false;
                        document.getElementById('alert-breaking').checked = data.settings.alertPreferences.breaking ?? true;
                        document.getElementById('alert-geofence').checked = data.settings.alertPreferences.geofence ?? true;
                        document.getElementById('alert-sound').checked = data.settings.alertPreferences.sound ?? false;
                    }
                    Auth.showToast('✅ Backup restored');
                    Auth.auditLog('IMPORT', {});
                } catch (error) {
                    Auth.showToast('❌ Invalid password or corrupted file');
                    console.error(error);
                }
            };
            reader.readAsText(file);
        }
    };
    window.BackupSystem = BackupSystem;

    // ================== PROXY MANAGER (DENGAN FRESHRSS) ==================
    const ProxyManager = {
        activeCount: 0,
        proxies: [
            // ----- PROXY FRESHRSS (PRIORITAS UTAMA) -----
            {
                name: 'FreshRSS',
                fetch: async (url, srcInfo) => {
                    // Ganti dengan URL RSS Intel Anda (dengan tunnel)
                    const feedUrl = 'https://pregnancy-firefox-obj-movements.trycloudflare.com/freshrss/freshrss-1.28.1/?a=rss&get=c_2&state=3&user=admin&token=kasafa123&hours=168';
                    try {
                        const res = await fetch(feedUrl);
                        const rssText = await res.text();
                        const parser = new DOMParser();
                        const xml = parser.parseFromString(rssText, 'text/xml');
                        const items = Array.from(xml.querySelectorAll('item')).map(item => ({
                            title: item.querySelector('title')?.textContent || '',
                            link: item.querySelector('link')?.textContent || '',
                            date: item.querySelector('pubDate')?.textContent || new Date().toISOString(),
                            src: 'FreshRSS',
                            srcR: srcInfo.r,
                            srcT: srcInfo.t
                        }));
                        return { ok: true, items, type: 'xml' };
                    } catch (err) {
                        console.error('FreshRSS error:', err);
                        return { ok: false, items: [] };
                    }
                }
            },
            // ----- PROXY BAWAAN (SEBAGAI CADANGAN) -----
            { name: 'RSS2JSON', fetch: async (url) => {
                const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=20`, { signal: AbortSignal.timeout(12000) });
                const data = await res.json();
                if (data.status === 'ok' && data.items) return { ok: true, items: data.items, type: 'rss2json' };
                throw new Error('Invalid');
            }},
            { name: 'AllOrigins', fetch: async (url) => {
                const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(12000) });
                return { ok: true, data: await res.text(), type: 'xml' };
            }},
            { name: 'CorsProxy', fetch: async (url) => {
                const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(12000) });
                return { ok: true, data: await res.text(), type: 'xml' };
            }},
            { name: 'ThingProxy', fetch: async (url) => {
                const res = await fetch(`https://thingproxy.freeboard.io/fetch/${url}`, { signal: AbortSignal.timeout(12000) });
                return { ok: true, data: await res.text(), type: 'xml' };
            }}
        ],
        async fetchFeed(url, srcInfo) {
            const items = [];
            for (const proxy of this.proxies) {
                try {
                    const result = await proxy.fetch(url, srcInfo);
                    if (result.type === 'rss2json' && result.items) {
                        for (const i of result.items) {
                            if (i.title) items.push({ title: i.title, link: i.link || '', date: i.pubDate || new Date().toISOString(), src: srcInfo.n, srcR: srcInfo.r, srcT: srcInfo.t });
                        }
                        return items;
                    }
                    if (result.type === 'xml' && result.data) {
                        const doc = new DOMParser().parseFromString(result.data, 'text/xml');
                        doc.querySelectorAll('item, entry').forEach(entry => {
                            const title = entry.querySelector('title')?.textContent;
                            if (title) items.push({ title, link: entry.querySelector('link')?.textContent || entry.querySelector('link')?.getAttribute('href') || '', date: entry.querySelector('pubDate, published, updated')?.textContent || new Date().toISOString(), src: srcInfo.n, srcR: srcInfo.r, srcT: srcInfo.t });
                        });
                        if (items.length > 0) return items;
                    }
                } catch {}
            }
            return items;
        },
        updateStatus(working, total) {
            this.activeCount = working;
            const el = document.getElementById('proxy-active');
            if (el) { el.textContent = `${working}/${total}`; el.className = 'sync-value ' + (working > total/2 ? 'good' : 'warning'); }
        }
    };

    // ================== GEOFENCING ==================
    const Geofencing = {
        fences: [],
        circles: new Map(),
        alertCount: 0,
        viewEnabled: true,
        PRESETS: {
            'GAZA': { coords: [31.5, 34.47], radius: 30, color: '#ff4d4d' },
            'KYIV': { coords: [50.45, 30.52], radius: 80, color: '#4ecdc4' },
            'TEHRAN': { coords: [35.69, 51.39], radius: 60, color: '#ff9f43' },
            'TAIWAN': { coords: [23.7, 120.96], radius: 150, color: '#1da1f2' },
            'SEOUL': { coords: [37.57, 126.98], radius: 50, color: '#ff0050' },
            'MOSCOW': { coords: [55.76, 37.62], radius: 100, color: '#a855f7' },
            'BEIJING': { coords: [39.9, 116.41], radius: 80, color: '#ffaa00' },
            'JERUSALEM': { coords: [31.77, 35.21], radius: 40, color: '#ffe66d' }
        },
        async init() {
            const saved = await Database.getGeofences();
            if (saved && saved.length > 0) {
                this.fences = saved;
            } else {
                const local = localStorage.getItem('omega_geofences');
                if (local) {
                    try {
                        this.fences = JSON.parse(local);
                        for (const f of this.fences) {
                            await Database.saveGeofence(f);
                        }
                    } catch (e) {}
                }
            }
            this.fences.forEach(f => this.drawCircle(f));
            this.render();
            this.updateStats();
            log('◎ Geofencing initialized', 'geo');
        },
        save() {
            localStorage.setItem('omega_geofences', JSON.stringify(this.fences));
            this.fences.forEach(f => Database.saveGeofence(f));
        },
        add(fence) {
            if (!Auth.hasPermission('geofence_all') && !Auth.hasPermission('geofence_create')) {
                Auth.showToast('❌ Permission denied');
                return;
            }
            fence.id = fence.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            fence.alerts = 0;
            fence.triggered = false;
            this.fences.push(fence);
            this.save();
            this.drawCircle(fence);
            this.render();
            this.updateStats();
            log(`◎ Geofence added: ${fence.name} (${fence.radius}km)`, 'geo');
            Auth.showToast(`◎ Geofence "${fence.name}" activated`, 'geo');
            Auth.auditLog('GEOFENCE_ADD', { name: fence.name, coords: fence.coords });
            return fence;
        },
        async remove(id) {
            if (!Auth.hasPermission('geofence_all') && !Auth.hasPermission('delete')) {
                Auth.showToast('❌ Permission denied');
                return;
            }
            const fence = this.fences.find(f => f.id === id);
            if (fence) {
                if (this.circles.has(id)) {
                    S.map.removeLayer(this.circles.get(id));
                    this.circles.delete(id);
                }
                this.fences = this.fences.filter(f => f.id !== id);
                this.save();
                await Database.deleteGeofence(id);
                this.render();
                this.updateStats();
                log(`◎ Geofence removed: ${fence.name}`, 'geo');
                Auth.auditLog('GEOFENCE_REMOVE', { name: fence.name });
            }
        },
        drawCircle(fence) {
            if (!S.map || !this.viewEnabled) return;
            if (this.circles.has(fence.id)) {
                S.map.removeLayer(this.circles.get(fence.id));
            }
            const circle = L.circle(fence.coords, {
                radius: fence.radius * 1000,
                color: fence.color,
                fillColor: fence.color,
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '10,5',
                className: 'geofence-circle'
            }).addTo(S.map);
            circle.bindPopup(`
                <div style="font-size:9px;text-align:center">
                    <b style="color:${fence.color}">◎ ${fence.name}</b><br>
                    Radius: ${fence.radius}km<br>
                    Alerts: ${fence.alerts || 0}
                </div>
            `);
            this.circles.set(fence.id, circle);
        },
        getDistance(coords1, coords2) {
            const R = 6371;
            const dLat = (coords2[0] - coords1[0]) * Math.PI / 180;
            const dLon = (coords2[1] - coords1[1]) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(coords1[0] * Math.PI / 180) * Math.cos(coords2[0] * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        },
        check(item) {
            const results = [];
            for (const fence of this.fences) {
                const distance = this.getDistance(item.coords, fence.coords);
                if (distance <= fence.radius) {
                    results.push({
                        fence,
                        distance: Math.round(distance * 10) / 10
                    });
                    fence.alerts = (fence.alerts || 0) + 1;
                    fence.triggered = true;
                    this.alertCount++;
                }
            }
            if (results.length > 0) {
                this.save();
                this.render();
                this.updateStats();
                this.triggerAlert(item, results[0]);
            }
            return results;
        },
        triggerAlert(item, result) {
            if (!document.getElementById('alert-geofence')?.checked) return;
            const alertEl = document.getElementById('geofence-alert');
            const zoneEl = document.getElementById('geo-alert-zone');
            const distEl = document.getElementById('geo-alert-dist');
            if (zoneEl) zoneEl.textContent = result.fence.name;
            if (distEl) distEl.textContent = `${result.distance}km from center | ${item.loc}`;
            if (alertEl) {
                alertEl.classList.add('show');
                setTimeout(() => alertEl.classList.remove('show'), 5000);
            }
            Auth.showToast(`◎ ${result.fence.name}: ${item.title.substring(0, 40)}...`, 'geo');
            log(`◎ GEOFENCE: ${result.fence.name} | ${result.distance}km | ${item.loc}`, 'geo');
            Auth.auditLog('GEOFENCE_TRIGGER', { fence: result.fence.name, item: item.id });
            sendTelegramAlert(`◎ GEOFENCE TRIGGERED\nZone: ${result.fence.name}\nDistance: ${result.distance}km\nLocation: ${item.loc}\n${item.title}\n${item.link}`);
        },
        render() {
            const list = document.getElementById('geofence-list');
            if (!list) return;
            if (this.fences.length === 0) {
                list.innerHTML = '<div style="color:#666;font-size:7px;text-align:center;padding:10px">No geofences active</div>';
                return;
            }
            list.innerHTML = this.fences.map(f => `
                <div class="geofence-item${f.triggered ? ' triggered' : ''}" id="geo-${f.id}">
                    <div class="geofence-dot" style="border-color:${f.color};${f.triggered ? 'background:' + f.color : ''}"></div>
                    <div class="geofence-info">
                        <div class="geofence-name">${f.name}</div>
                        <div class="geofence-meta">${f.radius}km • ${f.coords[0].toFixed(2)}, ${f.coords[1].toFixed(2)}</div>
                    </div>
                    <div class="geofence-alerts">${f.alerts || 0}</div>
                    <span class="geofence-remove" onclick="Geofencing.remove('${f.id}')">✕</span>
                </div>
            `).join('');
            this.fences.forEach(f => f.triggered = false);
        },
        updateStats() {
            const zonesEl = document.getElementById('geo-zones');
            const alertsEl = document.getElementById('geo-alerts');
            if (zonesEl) zonesEl.textContent = this.fences.length;
            if (alertsEl) alertsEl.textContent = this.alertCount;
        },
        toggleView() {
            this.viewEnabled = !this.viewEnabled;
            const btn = document.getElementById('geofence-toggle');
            const status = document.getElementById('geofence-view-status');
            if (this.viewEnabled) {
                this.fences.forEach(f => this.drawCircle(f));
                btn.classList.add('geo-active');
                status.textContent = 'ON';
                log('◎ Geofence view ON', 'geo');
            } else {
                this.circles.forEach(c => S.map.removeLayer(c));
                this.circles.clear();
                btn.classList.remove('geo-active');
                status.textContent = 'OFF';
                log('◎ Geofence view OFF', 'info');
            }
        },
        getItemGeofenceInfo(item) {
            for (const fence of this.fences) {
                const distance = this.getDistance(item.coords, fence.coords);
                if (distance <= fence.radius) {
                    return { fence, distance: Math.round(distance * 10) / 10 };
                }
            }
            return null;
        }
    };
    window.Geofencing = Geofencing;

    window.addPresetGeofence = function(name) {
        const preset = Geofencing.PRESETS[name];
        if (!preset) return;
        if (Geofencing.fences.find(f => f.name === name)) {
            Auth.showToast(`⚠️ "${name}" already exists`, 'alert');
            return;
        }
        Geofencing.add({
            name: name,
            coords: preset.coords,
            radius: preset.radius,
            color: preset.color
        });
    };

    window.addCustomGeofence = function() {
        const name = document.getElementById('geo-name').value.trim();
        const radius = parseInt(document.getElementById('geo-radius').value) || 50;
        const lat = parseFloat(document.getElementById('geo-lat').value);
        const lng = parseFloat(document.getElementById('geo-lng').value);
        if (!name) { Auth.showToast('⚠️ Enter zone name', 'alert'); return; }
        if (isNaN(lat) || isNaN(lng)) { Auth.showToast('⚠️ Enter valid coordinates', 'alert'); return; }
        if (radius < 1 || radius > 500) { Auth.showToast('⚠️ Radius must be 1-500km', 'alert'); return; }
        const colors = ['#ff4d4d', '#4ecdc4', '#ff9f43', '#1da1f2', '#ff0050', '#a855f7', '#00ff41', '#ffaa00'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        Geofencing.add({
            name: name,
            coords: [lat, lng],
            radius: radius,
            color: color
        });
        document.getElementById('geo-name').value = '';
        document.getElementById('geo-lat').value = '';
        document.getElementById('geo-lng').value = '';
    };

    window.toggleGeofenceView = function() {
        Geofencing.toggleView();
    };

    // ================== PANEL TOGGLE FUNCTIONS ==================
    window.toggleCollapse = function(header) {
        const body = header.nextElementSibling;
        const icon = header.querySelector('.collapse-icon');
        body.classList.toggle('hidden');
        icon.textContent = body.classList.contains('hidden') ? '▶' : '▼';
    };
    window.toggleLeftPanel = function() {
        const c = document.getElementById('left-container');
        const t = document.getElementById('left-toggle');
        c.classList.toggle('collapsed');
        t.textContent = c.classList.contains('collapsed') ? '▶' : '◀';
        t.style.left = c.classList.contains('collapsed') ? '10px' : '268px';
    };
    window.toggleRightPanel = function() {
        const c = document.getElementById('right-container');
        const t = document.getElementById('right-toggle');
        c.classList.toggle('collapsed');
        t.textContent = c.classList.contains('collapsed') ? '◀' : '▶';
        t.style.right = c.classList.contains('collapsed') ? '10px' : '158px';
    };
    window.toggleRegionBox = function() {
        const b = document.getElementById('region-box');
        const t = document.getElementById('region-toggle');
        b.classList.toggle('collapsed');
        t.textContent = b.classList.contains('collapsed') ? '▲' : '▼';
        t.style.bottom = b.classList.contains('collapsed') ? '10px' : '48px';
    };
    window.resizeBottom = function(mode) {
        const p = document.getElementById('bottom-panel');
        const m = document.getElementById('map-wrap');
        p.classList.remove('collapsed', 'expanded');
        m.classList.remove('bottom-expanded');
        if (mode === 'collapse') p.classList.add('collapsed');
        else if (mode === 'expand') { p.classList.add('expanded'); m.classList.add('bottom-expanded'); }
        setTimeout(() => { if (S.map) S.map.invalidateSize(); }, 350);
    };

    // ================== AI THREAT ANALYSIS ==================
    const AI = {
        calculateThreatScore(item) {
            let score = 0;
            const text = item.title.toUpperCase();
            if (/NUCLEAR|WMD|ATOMIC/.test(text)) score += 50;
            if (/ATTACK|STRIKE|BOMB|MISSILE|AIRSTRIKE/.test(text)) score += 30;
            if (/KILLED|DEAD|CASUALTIES|MASSACRE/.test(text)) score += 25;
            if (/WAR|INVASION|COMBAT/.test(text)) score += 20;
            if (/THREAT|WARNING|ALERT/.test(text)) score += 15;
            if (/TERROR|TERRORIST/.test(text)) score += 20;
            if (/EXPLOSION|BLAST/.test(text)) score += 18;
            const criticalZones = ['ISRAEL', 'GAZA', 'UKRAINE', 'TAIWAN', 'IRAN', 'NORTH KOREA'];
            if (criticalZones.some(z => text.includes(z))) score *= 1.5;
            const age = Date.now() - new Date(item.rawDate);
            if (age < 3600000) score += 10;
            if (age < 1800000) score += 15;
            if (/BREAKING|JUST IN|URGENT/.test(text)) score += 12;
            if (item.geofenced) score += 10;
            return Math.min(100, Math.round(score));
        },
        analyzeSentiment(text) {
            const upper = text.toUpperCase();
            let score = 50;
            if (/KILL|DEAD|ATTACK|DESTROY|BOMB|WAR/.test(upper)) score -= 30;
            if (/THREAT|DANGER|CRISIS|TERROR/.test(upper)) score -= 20;
            if (/EXPLOSION|CASUALTIES|VICTIM/.test(upper)) score -= 25;
            if (/PEACE|CEASEFIRE|AGREEMENT|DEAL/.test(upper)) score += 30;
            if (/SUCCESS|WIN|VICTORY/.test(upper)) score += 20;
            if (/RESCUE|SAVE|HELP/.test(upper)) score += 15;
            return Math.max(0, Math.min(100, score));
        },
        generateSummary(item) {
            const score = this.calculateThreatScore(item);
            const sentiment = this.analyzeSentiment(item.title);
            let summary = '🤖 AI Analysis: ';
            if (score > 70) summary += 'CRITICAL THREAT DETECTED. ';
            else if (score > 40) summary += 'Elevated threat level. ';
            else summary += 'Monitoring situation. ';
            if (sentiment < 30) summary += 'Highly negative event. ';
            else if (sentiment < 50) summary += 'Negative developments. ';
            if (item.type === 'war') summary += 'Conflict-related. ';
            if (item.type === 'emergency') summary += 'EMERGENCY. ';
            if (item.geofenced) summary += `GEOFENCED (${item.geofenceInfo.fence.name}). `;
            summary += `Score: ${score}/100`;
            return summary;
        },
        getGlobalThreatLevel(items) {
            if (!items.length) return 0;
            const scores = items.map(i => this.calculateThreatScore(i));
            const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
            const max = Math.max(...scores);
            return Math.round((avg * 0.6) + (max * 0.4));
        }
    };

    // ================== NOTIFICATION SYSTEM ==================
    const Notifications = {
        show(message, type = 'info') {
            Auth.showToast(message);
        },
        checkAlerts(item) {
            const score = AI.calculateThreatScore(item);
            if (score > 70 && document.getElementById('alert-war')?.checked) {
                this.show(`⚠️ HIGH THREAT: ${item.title.substring(0,50)}...`, 'alert');
                sendTelegramAlert(`⚠️ HIGH THREAT (${score}/100)\n${item.title}\nLocation: ${item.loc}\n${item.link}`);
            }
            if (/NUCLEAR|WMD/.test(item.title.toUpperCase()) && document.getElementById('alert-nuclear')?.checked) {
                this.show(`☢️ NUCLEAR ALERT: ${item.title.substring(0,50)}...`, 'alert');
                sendTelegramAlert(`☢️ NUCLEAR ALERT\n${item.title}\n${item.loc}\n${item.link}`);
            }
            if (/BREAKING/.test(item.title.toUpperCase()) && document.getElementById('alert-breaking')?.checked) {
                this.show(`📰 BREAKING: ${item.title.substring(0,50)}...`, 'info');
            }
        }
    };
    window.Notifications = Notifications;

    // ================== EXPORT FUNCTIONS ==================
    window.exportItemJSON = function() {
        if (!Auth.hasPermission('export')) { Auth.showToast('❌ Permission denied'); return; }
        if (S.idx < 0 || S.idx >= S.items.length) return;
        const item = S.items[S.idx];
        const data = { 
            title: item.title, location: item.loc, coordinates: item.coords, 
            region: item.region, type: item.type, source: item.src, link: item.link, 
            timestamp: item.rawDate, threatScore: AI.calculateThreatScore(item), 
            sentiment: AI.analyzeSentiment(item.title),
            geofenced: item.geofenced || false,
            geofenceInfo: item.geofenceInfo || null,
            exportedBy: Auth.currentUser?.username
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `intel_${Date.now()}.json`; a.click();
        Auth.showToast('✅ JSON exported'); 
        log('📥 Exported JSON', 'ok');
        Auth.auditLog('EXPORT_JSON', { item: item.id });
    };

    window.exportItemPDF = function() {
        if (!Auth.hasPermission('export')) { Auth.showToast('❌ Permission denied'); return; }
        if (S.idx < 0 || S.idx >= S.items.length) return;
        const item = S.items[S.idx];
        if (typeof window.jspdf === 'undefined') { Auth.showToast('⚠️ PDF library loading...', 'alert'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(16); doc.text('OMEGA INTELLIGENCE REPORT', 20, 20);
        doc.setFontSize(10); doc.text(`Generated: ${new Date().toISOString()}`, 20, 30);
        doc.text(`Generated by: ${Auth.currentUser?.username || 'anonymous'}`, 20, 36);
        doc.text(`Threat Score: ${AI.calculateThreatScore(item)}/100`, 20, 42);
        if (item.geofenced) doc.text(`GEOFENCE ALERT: ${item.geofenceInfo.fence.name}`, 20, 48);
        doc.setFontSize(12); doc.text('INCIDENT DETAILS', 20, 60);
        doc.setFontSize(10); const lines = doc.splitTextToSize(item.title, 170); doc.text(lines, 20, 70);
        doc.text(`Location: ${item.loc}`, 20, 90); doc.text(`Coordinates: ${item.coords[0]}, ${item.coords[1]}`, 20, 96);
        doc.text(`Region: ${item.region}`, 20, 102); doc.text(`Source: ${item.src}`, 20, 108);
        doc.save(`intel_report_${Date.now()}.pdf`);
        Auth.showToast('✅ PDF exported'); 
        log('📥 Exported PDF', 'ok');
        Auth.auditLog('EXPORT_PDF', { item: item.id });
    };

    window.shareItem = function() {
        if (S.idx < 0 || S.idx >= S.items.length) return;
        const item = S.items[S.idx];
        let text = `OMEGA INTEL: ${item.title}\nLocation: ${item.loc}\nSource: ${item.src}\n${item.link}`;
        if (item.geofenced) text += `\n⚠️ GEOFENCE: ${item.geofenceInfo.fence.name}`;
        if (navigator.share) { 
            navigator.share({ title: 'OMEGA Intelligence', text }).catch(() => {}); 
        } else { 
            navigator.clipboard.writeText(text).then(() => { 
                Auth.showToast('✅ Copied to clipboard'); 
            }); 
        }
        log('📤 Shared item', 'ok');
        Auth.auditLog('SHARE', { item: item.id });
    };

    window.clearAllData = async function() {
        if (!Auth.hasPermission('delete')) { Auth.showToast('❌ Permission denied'); return; }
        if (confirm('⚠️ Clear all data? This cannot be undone!')) {
            await Database.clearAll();
            localStorage.clear();
            location.reload();
        }
    };

    // ================== MAP CONTROLS ==================
    let satelliteLayer = null, satelliteEnabled = false, heatmapEnabled = false;

    window.toggleHeatmap = function() {
        heatmapEnabled = !heatmapEnabled;
        const btn = document.getElementById('heatmap-toggle'), status = document.getElementById('heatmap-status');
        if (heatmapEnabled) {
            S.items.filter(i => i.type === 'war' || i.type === 'emergency').forEach(item => {
                L.circle(item.coords, { radius: 100000 * (AI.calculateThreatScore(item) / 100), color: 'transparent', fillColor: '#ff0000', fillOpacity: 0.3, className: 'heatmap-circle' }).addTo(S.layer);
            });
            btn.classList.add('active'); status.textContent = 'ON'; log('🔥 Heatmap ON', 'ok');
        } else {
            S.layer.eachLayer(layer => { if (layer.options?.className === 'heatmap-circle') S.layer.removeLayer(layer); });
            btn.classList.remove('active'); status.textContent = 'OFF'; log('🔥 Heatmap OFF', 'info');
        }
    };

    window.toggleSatellite = function() {
        satelliteEnabled = !satelliteEnabled;
        const btn = document.getElementById('satellite-toggle'), status = document.getElementById('satellite-status');
        if (satelliteEnabled) {
            satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 18}).addTo(S.map);
            btn.classList.add('active'); status.textContent = 'ON'; log('🛰️ Satellite ON', 'ok');
        } else {
            if (satelliteLayer) { S.map.removeLayer(satelliteLayer); satelliteLayer = null; }
            btn.classList.remove('active'); status.textContent = 'OFF'; log('🛰️ Satellite OFF', 'info');
        }
    };

    // ================== TIME SYNC ==================
    const TimeSync = {
        offset: 0, lastSync: null, synced: false, serverStatus: [],
        servers: [
            { name: 'WorldTime-1', url: 'https://worldtimeapi.org/api/timezone/Etc/UTC' },
            { name: 'WorldTime-2', url: 'https://worldtimeapi.org/api/ip' },
            { name: 'TimeAPI', url: 'https://timeapi.io/api/Time/current/zone?timeZone=UTC' },
        ],
        async sync() {
            const status = document.getElementById('ntp-status');
            const serverList = document.getElementById('server-list');
            if (status) { status.textContent = 'Syncing...'; status.className = 'sync-value warning'; }
            this.serverStatus = [];
            for (const server of this.servers) {
                try {
                    const start = performance.now();
                    const response = await fetch(server.url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
                    const latency = Math.round(performance.now() - start);
                    if (!response.ok) { this.serverStatus.push({ name: server.name, ok: false }); continue; }
                    const data = await response.json();
                    let serverTime = null;
                    if (data.unixtime) serverTime = data.unixtime * 1000;
                    else if (data.dateTime) serverTime = new Date(data.dateTime + 'Z').getTime();
                    if (serverTime) {
                        this.offset = serverTime - Date.now() + Math.round(latency / 2);
                        this.lastSync = new Date(); this.synced = true;
                        this.serverStatus.push({ name: server.name, ok: true, latency });
                        if (status) { status.textContent = '✓ Synced'; status.className = 'sync-value good'; }
                        document.getElementById('time-offset').textContent = `${this.offset > 0 ? '+' : ''}${this.offset}ms`;
                        document.querySelectorAll('.clock-sync').forEach(el => { el.textContent = '✓ Synced'; el.className = 'clock-sync'; });
                        log(`🌐 NTP: ${server.name} | ${latency}ms`, 'ntp');
                        break;
                    }
                } catch (e) { this.serverStatus.push({ name: server.name, ok: false }); }
            }
            let html = '';
            for (const s of this.serverStatus) {
                const color = s.ok ? '#0f0' : '#f00';
                html += `<div class="server-item"><div class="server-dot" style="background:${color}"></div><span class="server-name">${s.name}</span><span style="color:${color}">${s.ok ? s.latency + 'ms' : '✗'}</span></div>`;
            }
            if (serverList) serverList.innerHTML = html;
            if (!this.synced && status) {
                status.textContent = 'Local'; status.className = 'sync-value warning';
                document.querySelectorAll('.clock-sync').forEach(el => { el.textContent = '⚠ Local'; el.className = 'clock-sync error'; });
            }
            return this.synced;
        },
        now() { return new Date(Date.now() + this.offset); },
        getTimeForZone(tz) {
            try {
                const now = this.now();
                return { time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz }), date: now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }) };
            } catch { return { time: '--:--:--', date: '--/--/----' }; }
        }
    };

    // ================== SOURCES ==================
    const SOURCES = [
        {n:'G-WORLD', r:'GL', t:'news', u:'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US'},
        {n:'G-BREAKING', r:'GL', t:'news', u:'https://news.google.com/rss/search?q=breaking+news&hl=en-US'},
        {n:'G-WAR', r:'GL', t:'news', u:'https://news.google.com/rss/search?q=war+OR+conflict+OR+attack&hl=en-US'},
        {n:'G-GAZA', r:'ME', t:'news', u:'https://news.google.com/rss/search?q=gaza+OR+israel+OR+hamas&hl=en-US'},
        {n:'G-UKRAINE', r:'EU', t:'news', u:'https://news.google.com/rss/search?q=ukraine+OR+russia+war&hl=en-US'},
        {n:'G-IRAN', r:'ME', t:'news', u:'https://news.google.com/rss/search?q=iran+OR+tehran&hl=en-US'},
        {n:'G-CHINA', r:'AS', t:'news', u:'https://news.google.com/rss/search?q=china+OR+taiwan+OR+beijing&hl=en-US'},
        {n:'BBC', r:'EU', t:'news', u:'https://feeds.bbci.co.uk/news/world/rss.xml'},
        {n:'CNN', r:'AM', t:'news', u:'http://rss.cnn.com/rss/edition_world.rss'},
        {n:'ALJAZEERA', r:'ME', t:'news', u:'https://www.aljazeera.com/xml/rss/all.xml'},
        {n:'GUARDIAN', r:'EU', t:'news', u:'https://www.theguardian.com/world/rss'},
        {n:'REUTERS', r:'GL', t:'news', u:'https://news.google.com/rss/search?q=site:reuters.com&hl=en-US'},
        {n:'𝕏 TRENDING', r:'GL', t:'twitter', u:'https://news.google.com/rss/search?q=twitter+OR+"X"+trending&hl=en-US'},
        {n:'TIKTOK', r:'GL', t:'tiktok', u:'https://news.google.com/rss/search?q=tiktok+viral&hl=en-US'},
        {n:'REDDIT', r:'GL', t:'social', u:'https://www.reddit.com/r/worldnews/.rss'},
        {n:'AP', r:'GL', t:'news', u:'https://feeds.apnews.com/apf-topnews'},
        {n:'WSJ', r:'AM', t:'news', u:'https://feeds.a.dj.com/rss/RSSWorldNews.xml'},
        {n:'BLOOMBERG', r:'GL', t:'news', u:'https://feeds.bloomberg.com/markets/news.rss'},
        {n:'FT', r:'GL', t:'news', u:'https://www.ft.com/rss/home'},
        {n:'NPR', r:'AM', t:'news', u:'https://feeds.npr.org/1001/rss.xml'},
        {n:'CBC', r:'AM', t:'news', u:'https://www.cbc.ca/webfeed/rss/rss.xml'},
        {n:'LEMONDE', r:'EU', t:'news', u:'https://www.lemonde.fr/rss/une.xml'},
        {n:'SPIEGEL', r:'EU', t:'news', u:'https://www.spiegel.de/international/index.rss'},
        {n:'ELPAIS', r:'EU', t:'news', u:'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada'},
        {n:'SCMP', r:'AS', t:'news', u:'https://www.scmp.com/rss/91/feed'},
        {n:'JAPANTIMES', r:'AS', t:'news', u:'https://www.japantimes.co.jp/feed/news'},
        {n:'TIMESOFINDIA', r:'AS', t:'news', u:'https://timesofindia.indiatimes.com/rssfeedstopstories.cms'},
        {n:'SMH', r:'OC', t:'news', u:'https://www.smh.com.au/rss/feed.xml'},
        {n:'NZHERALD', r:'OC', t:'news', u:'https://www.nzherald.co.nz/arc/outboundfeeds/rss/'},
        {n:'NEWS24', r:'AF', t:'news', u:'https://www.news24.com/feeds'},
        {n:'MAVERICK', r:'AF', t:'news', u:'https://www.dailymaverick.co.za/feed/'},
        {n:'JPOST', r:'ME', t:'news', u:'https://www.jpost.com/rss'},
        {n:'GULFNEWS', r:'ME', t:'news', u:'http://www.gulf-times.com/rssFeed/9'},
        {n:'TECHRUNCH', r:'GL', t:'tech', u:'https://techcrunch.com/feed/'},
        {n:'THEVERGE', r:'GL', t:'tech', u:'https://www.theverge.com/rss/index.xml'},
        {n:'WIRED', r:'GL', t:'tech', u:'https://www.wired.com/feed/rss'},
        {n:'KREBS', r:'GL', t:'security', u:'https://krebsonsecurity.com/feed/'},
        {n:'SCHNEIER', r:'GL', t:'security', u:'https://www.schneier.com/feed/'},
        {n:'NASA', r:'GL', t:'science', u:'https://www.nasa.gov/rss/dyn/breaking_news.rss'},
        {n:'NATURE', r:'GL', t:'science', u:'https://www.nature.com/nature.rss'},
        {n:'SCIENCE', r:'GL', t:'science', u:'https://www.sciencemag.org/rss/news_current.xml'}
    ];

    // ================== LOKASI ==================
    const LOCS = {
        "AFGANISTAN": [33.9, 67.7],
        "AFRIKA SELATAN": [-30.5, 22.9],
        "AFRIKA TENGAH": [6.6, 20.9],
        "ALBANIA": [41.1, 20.1],
        "ALJAZAIR": [28.0, 1.6],
        "AMERIKA SERIKAT": [37.0, -95.7],
        "ANDORRA": [42.5, 1.5],
        "ANGOLA": [-11.2, 17.8],
        "ANGUILLA (UK)": [18.2, -63.0],
        "ANTARKTIKA": [-90.0, 0.0],
        "ANTIGUA & BARBUDA": [17.0, -61.7],
        "ARAB SAUDI": [23.8, 45.0],
        "ARGENTINA": [-38.4, -63.6],
        "ARMENIA": [40.0, 45.0],
        "ARUBA (NL)": [12.5, -70.0],
        "AUSTRALIA": [-25.2, 133.7],
        "AUSTRIA": [47.5, 14.5],
        "AZERBAIJAN": [40.1, 47.5],
        "BAHAMA": [25.0, -77.3],
        "BAHRAIN": [26.0, 50.5],
        "BANGLADESH": [23.6, 90.3],
        "BARBADOS": [13.1, -59.5],
        "BELANDA": [52.1, 5.2],
        "BELARUS": [53.7, 27.9],
        "BELGIA": [50.5, 4.4],
        "BELIZE": [17.1, -88.4],
        "BENIN": [9.3, 2.3],
        "BERMUDA (UK)": [32.3, -64.7],
        "BHUTAN": [27.5, 90.4],
        "BOLIVIA": [-16.2, -63.5],
        "BOSNIA & HERZ.": [43.9, 17.6],
        "BOTSWANA": [-22.3, 24.6],
        "BRASIL": [-14.2, -51.9],
        "BRITANIA RAYA": [55.3, -3.4],
        "BRUNEI": [4.5, 114.7],
        "BULGARIA": [42.7, 25.4],
        "BURKINA FASO": [12.2, -1.5],
        "BURUNDI": [-3.3, 29.9],
        "CABO VERDE": [16.0, -24.0],
        "CEKO": [49.8, 15.4],
        "CHAD": [15.4, 18.7],
        "CHILE": [-35.6, -71.5],
        "CHINA": [35.8, 104.1],
        "DENMARK": [56.2, 9.5],
        "DJIBOUTI": [11.8, 42.5],
        "DOMINIKA": [15.4, -61.3],
        "EKUADOR": [-1.8, -78.1],
        "EL SALVADOR": [13.7, -88.8],
        "ERITREA": [15.1, 39.7],
        "ESTONIA": [58.5, 25.0],
        "ETHIOPIA": [9.1, 40.4],
        "FIJI": [-17.7, 178.0],
        "FILIPINA": [12.8, 121.7],
        "FINLANDIA": [61.9, 25.7],
        "GABON": [-0.8, 11.6],
        "GAMBIA": [13.4, -15.3],
        "GEORGIA": [42.3, 43.3],
        "GHANA": [7.9, -1.0],
        "GRENADA": [12.1, -61.6],
        "GREENLAND (DK)": [71.7, -42.6],
        "GUATEMALA": [15.7, -90.2],
        "GUINEA": [9.9, -9.6],
        "GUINEA KHATULISTIWA": [1.6, 10.2],
        "GUYANA": [4.8, -58.9],
        "HAITI": [18.9, -72.2],
        "HONDURAS": [15.1, -86.2],
        "HONGARIA": [47.1, 19.5],
        "INDIA": [20.5, 78.9],
        "INDONESIA": [-0.7, 113.9],
        "IRAK": [33.2, 43.6],
        "IRAN": [32.4, 53.6],
        "IRLANDIA": [53.4, -8.2],
        "ISLANDIA": [64.9, -18.0],
        "ISRAEL": [31.0, 34.8],
        "ITALIA": [41.8, 12.5],
        "JAMAIKA": [18.1, -77.2],
        "JEPANG": [36.2, 138.2],
        "JERMAN": [51.1, 10.4],
        "YORDANIA": [30.5, 36.2],
        "KAMBOJA": [12.5, 104.9],
        "KAMERUN": [7.3, 12.3],
        "KANADA": [56.1, -106.3],
        "KAZAKHSTAN": [48.0, 66.9],
        "KENYA": [0.0, 37.9],
        "KIRGIZSTAN": [41.2, 74.7],
        "KIRIBATI": [-1.8, -157.3],
        "LEBANON": [33.8, 35.8],
        "LESOTHO": [-29.6, 28.2],
        "LIBERIA": [6.4, -9.4],
        "LIBYA": [26.3, 17.2],
        "LIECHTENSTEIN": [47.1, 9.5],
        "LITUANIA": [55.1, 23.8],
        "LUXEMBOURG": [49.8, 6.1],
        "MADAGASKAR": [-18.7, 46.8],
        "MAKAU (CN)": [22.1, 113.5],
        "MAKEDONIA UTARA": [41.6, 21.7],
        "MALAWI": [-13.2, 34.3],
        "MALAYSIA": [4.2, 101.9],
        "MALI": [17.5, -3.9],
        "MALTA": [35.9, 14.3],
        "MAROKO": [31.7, -7.0],
        "MAURITANIA": [21.0, -10.9],
        "MAURITIUS": [-20.3, 57.5],
        "MEKSIKO": [23.6, -102.5],
        "MESIR": [26.8, 30.8],
        "MOLDOVA": [47.4, 28.3],
        "MONAKO": [43.7, 7.4],
        "MONGOLIA": [46.8, 103.8],
        "MONTENEGRO": [42.7, 19.3],
        "MOZAMBIK": [-18.6, 35.5],
        "MYANMAR": [21.9, 95.9],
        "NAMIBIA": [-22.9, 18.4],
        "NEPAL": [28.3, 84.1],
        "NIGERIA": [9.0, 8.6],
        "NIUE": [-19.0, -169.8],
        "NORWEGIA": [60.4, 8.4],
        "OMAN": [21.4, 55.9],
        "PAKISTAN": [30.3, 69.3],
        "PALAU": [7.5, 134.5],
        "PALESTINA": [31.9, 35.2],
        "PANAMA": [8.5, -80.7],
        "PAPUA NUGINI": [-6.3, 143.9],
        "PARAGUAY": [-23.4, -58.4],
        "PERU": [-9.1, -75.0],
        "POLANDIA": [51.9, 19.1],
        "PORTUGAL": [39.3, -8.2],
        "PUERTO RICO (US)": [18.2, -66.5],
        "PRANCIS": [46.2, 2.2],
        "QATAR": [25.3, 51.1],
        "RUMANIA": [45.9, 24.9],
        "RUSIA": [61.5, 105.3],
        "RWANDA": [-1.9, 29.8],
        "SAMOA": [-13.7, -170.7],
        "SAN MARINO": [43.9, 12.4],
        "SELANDIA BARU": [-40.9, 174.8],
        "SENEGAL": [14.4, -14.4],
        "SEYCHELLES": [-4.6, 55.4],
        "SINGAPURA": [1.3, 103.8],
        "SIPRUS": [35.1, 33.4],
        "SLOVENIA": [46.1, 14.9],
        "SOMALIA": [5.1, 46.1],
        "SPANYOL": [40.4, -3.7],
        "SRI LANKA": [7.8, 80.7],
        "SUDAN": [12.8, 30.2],
        "SUDAN SELATAN": [6.8, 31.3],
        "SURIAH": [34.8, 38.9],
        "SURINAME": [3.9, -56.0],
        "SWEDIA": [60.1, 18.6],
        "SWISS": [46.8, 8.2],
        "TAIWAN": [23.6, 120.9],
        "TAJIKISTAN": [38.8, 71.2],
        "TANZANIA": [-6.3, 34.8],
        "THAILAND": [15.8, 100.9],
        "TIMOR LESTE": [-8.8, 125.7],
        "TOGO": [8.6, 0.8],
        "TONGA": [-21.1, -175.2],
        "TUNISIA": [33.8, 9.5],
        "TURKI": [38.9, 35.2],
        "TURKMENISTAN": [38.9, 59.5],
        "UGANDA": [1.3, 32.2],
        "UKRAINA": [48.3, 31.1],
        "URUGUAY": [-32.5, -55.7],
        "UZBEKISTAN": [41.3, 64.5],
        "VATIKAN": [41.9, 12.4],
        "VIETNAM": [14.0, 108.2],
        "YAMAN": [15.5, 48.5],
        "YUNANI": [39.0, 21.8],
        "ZAMBIA": [-13.1, 27.8],
        "ZIMBABWE": [-19.0, 29.1],
        "ZURICH (TITIK Z)": [47.3, 8.5],
        "COMOROS": [-11.6, 43.3],
        "NAURU": [-0.5, 166.9],
        "COOK ISLANDS": [-21.2, -159.7],
        "DOMINICAN REPUBLIC": [18.7, -70.2],
        "FEDERATED STATES OF MICRONESIA": [7.4, 151.8],
        "GUINEA-BISSAU": [11.8, -15.0],
        "IVORY COAST (PANTAI GADING)": [7.5, -5.5],
        "KYRGYZSTAN": [41.2, 74.7],
        "LAOS": [19.8, 102.4],
        "LATVIA": [56.8, 24.6],
        "MARSHALL ISLANDS": [7.1, 171.1],
        "MONTSERRAT (UK)": [16.7, -62.1],
        "SAO TOME & PRINCIPE": [0.1, 6.6],
        "SOLOMON ISLANDS": [-9.6, 160.1],
        "ST. KITTS & NEVIS": [17.3, -62.7],
        "ST. LUCIA": [13.9, -60.9],
        "ST. VINCENT & GRENADINES": [13.2, -61.2],
        "TRINIDAD & TOBAGO": [10.6, -61.2],
        "TUVALU": [-7.1, 177.6],
        "VANUATU": [-15.3, 166.9],
        "AMERICAN SAMOA": [-14.2, -170.7],
        "BOUVET ISLAND": [-54.4, 3.4],
        "CAYMAN ISLANDS": [19.3, -81.2],
        "CHRISTMAS ISLAND": [-10.4, 105.6],
        "COCOS (KEELING) ISLANDS": [-12.1, 96.8],
        "FALKLAND ISLANDS": [-51.7, -59.5],
        "FAROE ISLANDS": [61.8, -6.9],
        "FRENCH GUIANA": [3.9, -53.1],
        "FRENCH POLYNESIA": [-17.6, -149.4],
        "GUAM": [13.4, 144.7],
        "HEARD & MCDONALD IS.": [-53.1, 72.5],
        "ISLE OF MAN": [54.2, -4.5],
        "JERSEY & GUERNSEY": [49.2, -2.1],
        "MAYOTTE": [-12.8, 45.1],
        "NEW CALEDONIA": [-20.9, 165.6],
        "NORFOLK ISLAND": [-29.0, 167.9],
        "NORTHERN MARIANA IS.": [15.0, 145.6],
        "RÉUNION": [-21.1, 55.5],
        "SOUTH GEORGIA": [-54.4, -36.5],
        "SVALBARD": [77.8, 20.9],
        "TOKELAU": [-9.2, -171.8],
        "WALLIS & FUTUNA": [-13.2, -176.2],

        "GAZA": [31.5, 34.47],
        "RAFAH": [31.28, 34.25],
        "ISRAEL": [31.05, 34.85],
        "ISRAELI": [31.05, 34.85],
        "TEL AVIV": [32.09, 34.78],
        "JERUSALEM": [31.77, 35.21],
        "NETANYAHU": [31.77, 35.21],
        "IDF": [31.95, 35.23],
        "HAMAS": [31.5, 34.47],
        "PALESTINIAN": [31.95, 35.23],
        "UKRAINE": [48.38, 31.17],
        "UKRAINIAN": [48.38, 31.17],
        "KYIV": [50.45, 30.52],
        "ZELENSKY": [50.45, 30.52],
        "RUSSIA": [61.52, 105.32],
        "RUSSIAN": [55.76, 37.62],
        "MOSCOW": [55.76, 37.62],
        "PUTIN": [55.76, 37.62],
        "LEBANON": [33.85, 35.86],
        "HEZBOLLAH": [33.89, 35.5],
        "SYRIA": [34.8, 39],
        "IRAN": [32.43, 53.69],
        "IRANIAN": [35.69, 51.39],
        "TEHRAN": [35.69, 51.39],
        "IRAQ": [33.22, 43.68],
        "YEMEN": [15.55, 48.52],
        "HOUTHI": [15.37, 44.19],
        "SAUDI": [23.89, 45.08],
        "TURKEY": [38.96, 35.24],
        "EGYPT": [26.82, 30.8],
        "USA": [37.09, -95.71],
        "WASHINGTON": [38.91, -77.04],
        "BIDEN": [38.91, -77.04],
        "TRUMP": [38.91, -77.04],
        "UK": [55.38, -3.44],
        "LONDON": [51.51, -0.13],
        "FRANCE": [46.23, 2.21],
        "PARIS": [48.86, 2.35],
        "GERMANY": [51.17, 10.45],
        "BERLIN": [52.52, 13.41],
        "NATO": [50.88, 4.43],
        "CHINA": [35.86, 104.2],
        "CHINESE": [35.86, 104.2],
        "BEIJING": [39.9, 116.41],
        "TAIWAN": [23.7, 120.96],
        "JAPAN": [36.2, 138.25],
        "TOKYO": [35.68, 139.65],
        "KOREA": [35.91, 127.77],
        "NORTH KOREA": [40.34, 127.51],
        "INDIA": [20.59, 78.96],
        "PAKISTAN": [30.38, 69.35],
        "INDONESIA": [-0.79, 113.92],
        "AUSTRALIA": [-25.27, 133.78]
    };

    const REGION_KW = {
        AM:['USA','US ','AMERICA','WASHINGTON','BIDEN','TRUMP','CANADA','MEXICO','BRAZIL'],
        EU:['UK','BRITAIN','LONDON','FRANCE','PARIS','GERMANY','BERLIN','UKRAINE','KYIV','RUSSIA','MOSCOW','PUTIN','ZELENSKY','NATO'],
        ME:['ISRAEL','GAZA','HAMAS','HEZBOLLAH','IRAN','IRAQ','SYRIA','LEBANON','YEMEN','HOUTHI','SAUDI','TURKEY','JERUSALEM','NETANYAHU','TEHRAN','PALESTINIAN','IDF'],
        AS:['CHINA','BEIJING','TAIWAN','JAPAN','TOKYO','KOREA','INDIA','PAKISTAN','INDONESIA'],
        AF:['AFRICA','EGYPT','SOUTH AFRICA','NIGERIA','KENYA','SUDAN'],
        OC:['AUSTRALIA','SYDNEY','NEW ZEALAND']
    };

    function detectRegion(t) { const u = t.toUpperCase(); for (const [r,kw] of Object.entries(REGION_KW)) for (const k of kw) if (u.includes(k)) return r; return 'GL'; }
    function getCoords(t) { const u = t.toUpperCase(); for (const [k,c] of Object.entries(LOCS)) if (u.includes(k)) return {coords:c,loc:k}; return {coords:[30,30],loc:'GLOBAL'}; }
    function classify(t, srcType) { 
        const u = t.toUpperCase(); 
        if (srcType === 'twitter') return 'twitter';
        if (srcType === 'tiktok') return 'tiktok';
        if (/NUCLEAR|PANDEMIC|EARTHQUAKE|TSUNAMI|TERROR|MASSACRE/i.test(u)) return 'emergency'; 
        if (/WAR|ATTACK|BOMB|MISSILE|STRIKE|MILITARY|AIRSTRIKE|KILLED|DEAD|BATTLE|HAMAS|HEZBOLLAH|IDF|NATO|ROCKET|DRONE|EXPLOSION|INVASION/i.test(u)) return 'war'; 
        return 'normal'; 
    }
    function isBreaking(t) { return /BREAKING|JUST IN|URGENT|ALERT/i.test(t.toUpperCase()); }
    function formatTime(d) { 
        try { 
            const diff = Math.floor((TimeSync.now().getTime() - new Date(d).getTime()) / 1000);
            if (diff < 0) return 'now';
            if (diff < 60) return `${diff}s ago`;
            if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
            return `${Math.floor(diff/86400)}d ago`;
        } catch { return 'now'; } 
    }

    const S = { map:null, layer:null, titles:new Set(), items:[], markers:new Map(), activeMarker:null, idx:0, cycling:true, wars:0, total:0, sources:0, start:Date.now(), first:true, countdown:30, filter:'all', stats:{AM:0,EU:0,ME:0,AS:0,AF:0,OC:0}, isUpdating:false, retryCount:0 };
    const CFG = { refresh: 30000, cycle: 8000, max: 100, batch: 5, zoomLevel: 6, ntpInterval: 180000 };
    const $ = id => document.getElementById(id);
    const REGION_CLR = {AM:'#ff6b6b',EU:'#4ecdc4',ME:'#ffe66d',AS:'#ff9f43',AF:'#a55eea',OC:'#26de81',GL:'#888'};

    // Mode refresh
    let currentMode = localStorage.getItem('refreshMode') || 'normal';
    function setRefreshMode(mode) {
        currentMode = mode;
        localStorage.setItem('refreshMode', mode);
        document.querySelectorAll('#mode-fast, #mode-normal, #mode-eco').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`mode-${mode}`).classList.add('active');
        if (mode === 'fast') CFG.refresh = 30000;
        else if (mode === 'normal') CFG.refresh = 300000;
        else CFG.refresh = 1800000;
        S.countdown = Math.floor(CFG.refresh / 1000);
        log(`📡 Mode refresh: ${mode} (${CFG.refresh/1000}s)`, 'info');
    }
    window.setRefreshMode = setRefreshMode;
    setRefreshMode(currentMode);

    function log(m, t='info') {
        const el = $('logs'); if (!el) return;
        const ts = TimeSync.now().toLocaleTimeString('en-GB');
        const ic = {ok:'✓',err:'✗',warn:'⚠',info:'►',ntp:'🌐',geo:'◎'};
        const d = document.createElement('div');
        d.className = `log log-${t}`;
        d.innerHTML = `<span class="log-ts">[${ts}]</span> ${ic[t]||'►'} ${m}`;
        el.insertBefore(d, el.firstChild);
        while (el.children.length > 50) el.lastChild.remove();
    }

    function showError(msg) { const el = $('error-box'); if (el) { el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 5000); } }

    function updateClocks() {
        const zones = [{id:'jkt',tz:'Asia/Jakarta'},{id:'kyv',tz:'Europe/Kiev'},{id:'jer',tz:'Asia/Jerusalem'},{id:'lon',tz:'Europe/London'},{id:'nyc',tz:'America/New_York'},{id:'tok',tz:'Asia/Tokyo'}];
        zones.forEach(({id, tz}) => {
            const timeData = TimeSync.getTimeForZone(tz);
            const cEl = $(`c-${id}`), dEl = $(`d-${id}`);
            if (cEl) cEl.textContent = timeData.time;
            if (dEl) dEl.textContent = timeData.date;
        });
        const stEl = $('server-time'); if (stEl) stEl.textContent = TimeSync.now().toLocaleTimeString('en-GB');
        const up = Math.floor((Date.now() - S.start) / 1000);
        const upEl = $('s-up'); if (upEl) upEl.textContent = `${String(Math.floor(up/3600)).padStart(2,'0')}:${String(Math.floor((up%3600)/60)).padStart(2,'0')}:${String(up%60).padStart(2,'0')}`;
        const nuEl = $('next-update'); if (nuEl) { nuEl.textContent = S.countdown + 's'; nuEl.className = 'update-value' + (S.countdown <= 5 ? ' warning' : ''); }
        const rbEl = $('refresh-bar'); if (rbEl) rbEl.style.width = ((CFG.refresh/1000 - S.countdown) / (CFG.refresh/1000) * 100) + '%';
        const globalThreat = AI.getGlobalThreatLevel(S.items);
        const tfEl = $('threat-fill'), tsEl = $('threat-score');
        if (tfEl) tfEl.style.width = globalThreat + '%';
        if (tsEl) tsEl.textContent = globalThreat + '/100';
        let threatText = 'Nominal';
        if (globalThreat > 70) threatText = '⚠️ CRITICAL';
        else if (globalThreat > 50) threatText = '⚡ ELEVATED';
        else if (globalThreat > 30) threatText = '👁️ MONITORING';
        const aiEl = $('ai-status'); if (aiEl) aiEl.textContent = threatText;
    }

    function initMap() {
        try {
            const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:18,subdomains:'abcd'});
            S.map = L.map('map',{zoomControl:false,attributionControl:false,layers:[dark],minZoom:2,worldCopyJump:true}).setView([25,30],2);
            S.layer = L.layerGroup().addTo(S.map);
            S.map.on('click', () => { clearActive(); hideDetail(); });
            Geofencing.init();
            const geoBtn = document.getElementById('geofence-toggle');
            if (geoBtn) geoBtn.classList.add('geo-active');
            log('Map initialized','ok');
            return true;
        } catch(e) { log('Map error: ' + e.message,'err'); return false; }
    }

    function clearActive() {
        if (S.activeMarker) { S.activeMarker._path?.classList.remove('marker-active'); S.activeMarker.closePopup(); }
        S.activeMarker = null;
        document.querySelectorAll('.news').forEach(n => n.classList.remove('active'));
    }

    function hideDetail() { $('detail-panel')?.classList.remove('show'); S.cycling = true; }
    window.hideDetail = hideDetail;

    async function fetchAll() {
        let all = [], ok = 0;
        for (let i = 0; i < SOURCES.length; i += CFG.batch) {
            const batch = SOURCES.slice(i, i + CFG.batch);
            const results = await Promise.allSettled(batch.map(src => ProxyManager.fetchFeed(src.u, src)));
            for (const r of results) { if (r.status === 'fulfilled' && r.value.length > 0) { all = all.concat(r.value); ok++; } }
            if (i + CFG.batch < SOURCES.length) await new Promise(r => setTimeout(r, 500));
        }
        ProxyManager.updateStatus(ok, SOURCES.length);
        S.sources = ok;
        return all;
    }

    function createMarker(item) {
        let clr = item.type==='emergency'?'#fff':item.type==='war'?'#f00':item.type==='twitter'?'#1da1f2':item.type==='tiktok'?'#ff0050':'#0f4';
        const radius = item.type==='war'?7:5;
        const marker = L.circleMarker(item.coords, {
            color: item.geofenced ? '#a855f7' : clr, 
            fillColor: clr, 
            fillOpacity: 0.7, 
            radius: radius, 
            weight: item.geofenced ? 3 : 2
        }).addTo(S.layer);
        let popupContent = `<div style="font-size:9px"><b style="color:${REGION_CLR[item.region]}">${item.loc}</b><br>${item.title.substring(0,60)}...<br><span style="color:#666">${item.src}</span>`;
        if (item.geofenced) {
            popupContent += `<br><span style="color:#a855f7">◎ ${item.geofenceInfo.fence.name} (${item.geofenceInfo.distance}km)</span>`;
        }
        popupContent += '</div>';
        marker.bindPopup(popupContent);
        marker.on('click', (e) => { L.DomEvent.stopPropagation(e); S.cycling=false; selectItem(S.items.findIndex(x=>x.id===item.id)); setTimeout(()=>S.cycling=true,20000); });
        S.markers.set(item.id, marker);
    }

    function createNewsEl(item) {
        const d = document.createElement('div');
        d.className = `news ${item.type}${item.geofenced ? ' geofenced' : ''}`;
        d.dataset.id = item.id; d.dataset.r = item.region.toLowerCase(); d.dataset.t = item.type;
        if (item.geofenced) d.dataset.geo = 'true';
        const score = AI.calculateThreatScore(item);
        let badgeClass = 'low'; if (score > 70) badgeClass = 'high'; else if (score > 40) badgeClass = 'medium';
        const srcIcon = item.type==='twitter'?'𝕏':item.type==='tiktok'?'♪':'📰';
        let html = `<div class="threat-badge ${badgeClass}">${score}</div>`;
        if (item.geofenced) {
            html += `<div class="geo-badge">◎</div>`;
        }
        html += `<div class="news-top"><span class="news-loc">${item.loc}</span><span class="news-region" style="background:${REGION_CLR[item.region]}">${item.region}</span><span class="news-time">${item.time}</span></div><div class="news-title">${item.title}</div><div class="news-src">${srcIcon} ${item.src}`;
        if (item.geofenced) {
            html += ` • <span style="color:#a855f7">◎ ${item.geofenceInfo.fence.name}</span>`;
        }
        html += `</div>`;
        d.innerHTML = html;
        d.onclick = () => { S.cycling=false; selectItem(S.items.findIndex(x=>x.id===item.id)); setTimeout(()=>S.cycling=true,20000); };
        return d;
    }

    function selectItem(idx) {
        if (idx < 0 || idx >= S.items.length) return;
        const item = S.items[idx]; S.idx = idx;
        document.querySelectorAll('.news').forEach(n => n.classList.remove('active'));
        document.querySelector(`.news[data-id="${item.id}"]`)?.classList.add('active');
        document.querySelector(`.news[data-id="${item.id}"]`)?.scrollIntoView({behavior:'smooth', block:'center'});
        const marker = S.markers.get(item.id);
        if (marker) { clearActive(); S.activeMarker = marker; marker._path?.classList.add('marker-active'); marker.openPopup(); }
        if (S.map) S.map.flyTo(item.coords, CFG.zoomLevel, {duration: 1});
        const score = AI.calculateThreatScore(item), sentiment = AI.analyzeSentiment(item.title), summary = AI.generateSummary(item);
        
        const dLoc=$('d-loc'),dTitle=$('d-title'),dSummary=$('d-summary'),dSrc=$('d-src'),dRegion=$('d-region'),dType=$('d-type'),dThreat=$('d-threat'),dCoords=$('d-coords'),dSev=$('d-sev'),dVerified=$('d-verified'),dLink=$('d-link'),sentimentEl=$('d-sentiment');
        const detailHeader = $('detail-header');
        const geoAlert = $('d-geo-alert');
        const geoItem = $('d-geo-item');
        const geoDistItem = $('d-geo-dist-item');
        
        if (item.geofenced && item.geofenceInfo) {
            if (geoAlert) {
                geoAlert.style.display = 'block';
                $('d-geo-zone').textContent = item.geofenceInfo.fence.name;
                $('d-geo-dist').textContent = item.geofenceInfo.distance + 'km';
            }
            if (geoItem) {
                geoItem.style.display = 'block';
                $('d-geo-name').textContent = item.geofenceInfo.fence.name;
            }
            if (geoDistItem) {
                geoDistItem.style.display = 'block';
                $('d-geo-distance').textContent = item.geofenceInfo.distance + 'km';
            }
            if (detailHeader) detailHeader.classList.add('geo-alert');
        } else {
            if (geoAlert) geoAlert.style.display = 'none';
            if (geoItem) geoItem.style.display = 'none';
            if (geoDistItem) geoDistItem.style.display = 'none';
            if (detailHeader) detailHeader.classList.remove('geo-alert');
        }
        
        if(dLoc)dLoc.textContent='📡 '+item.loc; if(dTitle)dTitle.textContent=item.title; if(dSummary)dSummary.textContent=summary;
        if(dSrc)dSrc.textContent=item.src; if(dRegion)dRegion.textContent=item.region; if(dType)dType.textContent=item.type.toUpperCase();
        if(dThreat)dThreat.textContent=score+'/100'; if(dCoords)dCoords.textContent=`${item.coords[0].toFixed(4)}°, ${item.coords[1].toFixed(4)}°`;
        if(dSev){dSev.textContent={emergency:'CRITICAL',war:'HIGH',twitter:'VIRAL',tiktok:'TRENDING',normal:'INFO'}[item.type]||'INFO';dSev.className='detail-val'+(['war','emergency'].includes(item.type)?' crit':'');}
        if(dVerified)dVerified.textContent=S.sources>5?'✓ Yes':'⚠ Unverified'; if(dLink)dLink.href=item.link;
        if(sentimentEl){sentimentEl.style.width=sentiment+'%';sentimentEl.style.background=sentiment<30?'#f00':sentiment<50?'#f90':sentiment<70?'#ff0':'#0f0';}
        $('detail-panel')?.classList.add('show');
    }

    window.flyTo = (coords, zoom) => { if (S.map) { S.map.flyTo(coords, zoom, {duration: 1.5}); hideDetail(); } };

    function applyFilter(f) {
        S.filter = f;
        document.querySelectorAll('.fbtn').forEach(b => b.classList.toggle('on', b.dataset.f === f));
        document.querySelectorAll('.region-item').forEach(r => r.classList.remove('active'));
        if (['AM','EU','ME','AS','AF','OC'].includes(f)) document.querySelector(`.region-item[data-r="${f}"]`)?.classList.add('active');
        document.querySelectorAll('.news').forEach(n => { 
            let show = f === 'all' || f === n.dataset.t || f === n.dataset.r.toUpperCase();
            if (f === 'geofenced') show = n.dataset.geo === 'true';
            n.style.display = show ? '' : 'none'; 
        });
        S.markers.forEach((marker, id) => {
            const item = S.items.find(x => x.id === id); if (!item) return;
            let show = f === 'all' || f === item.type || f === item.region;
            if (f === 'geofenced') show = item.geofenced;
            if (show) { if (!S.map.hasLayer(marker)) S.layer.addLayer(marker); }
            else { if (S.map.hasLayer(marker)) S.layer.removeLayer(marker); }
        });
    }
    window.applyFilter = applyFilter;

    function showBreaking(title) { const bt=$('breaking-text'),ba=$('breaking-alert'); if(bt)bt.textContent=title.substring(0,80)+'...'; if(ba)ba.classList.add('show'); setTimeout(()=>ba?.classList.remove('show'),4000); }

    function updateAnalysis() {
        const ratio = S.total ? ((S.wars / S.total) * 100).toFixed(1) : 0;
        let lvl = 'STABLE', clr = '#00ff41';
        if (ratio > 15) { lvl = 'ELEVATED'; clr = '#ffaa00'; }
        if (ratio > 30) { lvl = 'HIGH'; clr = '#ff6600'; }
        if (ratio > 45) { lvl = 'CRITICAL'; clr = '#ff0000'; }
        const geoCount = S.items.filter(i => i.geofenced).length;
        const trendData = [
            {label: '1H', value: Math.min(S.items.filter(i => (Date.now() - new Date(i.rawDate)) < 3600000).length, 50)},
            {label: '6H', value: Math.min(S.items.filter(i => (Date.now() - new Date(i.rawDate)) < 21600000).length, 50)},
            {label: '24H', value: Math.min(S.items.length, 50)}
        ];
        const analysis = $('analysis');
        if (analysis) {
            analysis.innerHTML = `<div class="analysis-head">>> OMEGA v14.1 | NTP: ${TimeSync.synced ? '✓' : '⚠'}</div>
            <div class="analysis-row"><span class="analysis-lbl">TOTAL INTEL</span><span class="analysis-val" style="color:#00ff41">${S.total}</span></div>
            <div class="analysis-row"><span class="analysis-lbl">CONFLICTS</span><span class="analysis-val" style="color:#ff0000">${S.wars}</span></div>
            <div class="analysis-row"><span class="analysis-lbl">◎ GEOFENCED</span><span class="analysis-val" style="color:#a855f7">${geoCount}</span></div>
            <div class="analysis-row"><span class="analysis-lbl">RATIO</span><span class="analysis-val" style="color:${clr}">${ratio}%</span></div>
            <div class="analysis-row"><span class="analysis-lbl">SOURCES</span><span class="analysis-val">${S.sources}/${SOURCES.length}</span></div>
            <div class="threat-section"><div style="color:#666;font-size:8px">THREAT LEVEL</div><div class="threat-lvl" style="color:${clr}">${lvl}</div></div>
            <div class="trend-chart"><div style="color:#888;font-size:7px;margin-bottom:4px">ACTIVITY</div>${trendData.map(d=>`<div class="chart-bar"><span class="chart-label">${d.label}</span><div class="chart-fill" style="width:${d.value*2}%"></div></div>`).join('')}</div>
            <div class="region-stats">
                <div class="rstat-row" onclick="applyFilter('AM')"><span style="color:#ff6b6b">● AM</span><span>${S.stats.AM}</span></div>
                <div class="rstat-row" onclick="applyFilter('EU')"><span style="color:#4ecdc4">● EU</span><span>${S.stats.EU}</span></div>
                <div class="rstat-row" onclick="applyFilter('ME')"><span style="color:#ffe66d">● ME</span><span>${S.stats.ME}</span></div>
                <div class="rstat-row" onclick="applyFilter('AS')"><span style="color:#ff9f43">● AS</span><span>${S.stats.AS}</span></div>
            </div>`;
        }
    }

    async function update() {
        if (S.isUpdating) return;
        S.isUpdating = true;
        log('🔄 Syncing feeds...', 'info');
        const sStatus = $('s-status'); if (sStatus) { sStatus.textContent = 'SYNCING'; sStatus.style.color = 'var(--yellow)'; }
        $('refresh-btn')?.classList.add('loading');
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) syncStatus.classList.add('show');
        try {
            const items = await fetchAll();
            if (!items.length) {
                S.retryCount++;
                if (S.retryCount < 3) { log(`⚠ Retry ${S.retryCount}/3...`, 'warn'); setTimeout(() => { S.isUpdating = false; update(); }, 5000); $('refresh-btn')?.classList.remove('loading'); if (syncStatus) syncStatus.classList.remove('show'); return; }
                throw new Error('No data after retries');
            }
            S.retryCount = 0;
            items.sort((a, b) => new Date(b.date) - new Date(a.date));
            const feed = $('feed');
            if (S.first && feed) { feed.innerHTML = ''; S.first = false; }
            let wars = 0, added = 0, breaking = null;
            const stats = {AM:0, EU:0, ME:0, AS:0, AF:0, OC:0};
            for (const raw of items.slice(0, CFG.max)) {
                if (!raw.title || S.titles.has(raw.title)) continue;
                S.titles.add(raw.title);
                const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                const type = classify(raw.title, raw.srcT);
                const geo = getCoords(raw.title);
                const region = detectRegion(raw.title) || raw.srcR || 'GL';
                if (type === 'war' || type === 'emergency') wars++;
                if (stats[region] !== undefined) stats[region]++;
                
                const item = { id, title: raw.title, link: raw.link, src: raw.src, type, region, loc: geo.loc, coords: geo.coords, time: formatTime(raw.date), rawDate: raw.date };
                
                const geoResults = Geofencing.check(item);
                if (geoResults.length > 0) {
                    item.geofenced = true;
                    item.geofenceInfo = geoResults[0];
                }
                
                S.items.unshift(item);
                await Database.saveIncident(item);
                sendIncidentToServer(item);
                if (feed) feed.insertBefore(createNewsEl(item), feed.firstChild);
                createMarker(item);
                added++;
                Notifications.checkAlerts(item);
                if (isBreaking(raw.title) && !breaking) breaking = raw.title;
            }
            while (S.items.length > CFG.max) { const old = S.items.pop(); S.markers.get(old.id)?.remove(); S.markers.delete(old.id); }
            while (feed && feed.children.length > CFG.max) feed.lastChild.remove();
            S.wars = wars; S.total = S.titles.size; S.stats = stats;
            const sConf=$('s-conf'),sSrc=$('s-src'),sMarkers=$('s-markers'),sIntel=$('s-intel');
            if(sConf)sConf.textContent=String(wars).padStart(2,'0'); if(sSrc)sSrc.textContent=`${S.sources}/${SOURCES.length}`;
            if(sMarkers)sMarkers.textContent=S.markers.size; if(sIntel)sIntel.textContent=S.total;
            const rAm=$('r-am'),rEu=$('r-eu'),rMe=$('r-me'),rAs=$('r-as'),rAf=$('r-af'),rOc=$('r-oc');
            if(rAm)rAm.textContent=stats.AM; if(rEu)rEu.textContent=stats.EU; if(rMe)rMe.textContent=stats.ME;
            if(rAs)rAs.textContent=stats.AS; if(rAf)rAf.textContent=stats.AF; if(rOc)rOc.textContent=stats.OC;
            if (added > 0) {
                const nc=$('new-count'),sb=$('s-badge');
                if(nc){nc.textContent=`+${added}`;nc.style.display='inline';} if(sb){sb.className='badge new';sb.textContent=`+${added} NEW`;}
                setTimeout(()=>{if(nc)nc.style.display='none';if(sb){sb.className='badge';sb.textContent=`${S.sources} LIVE`;}},5000);
            }
            if (breaking) showBreaking(breaking);
            log(`✅ +${added} items from ${S.sources} sources`, 'ok');
            if (sStatus) { sStatus.textContent = 'LIVE'; sStatus.style.color = 'var(--green)'; }
            updateAnalysis(); applyFilter(S.filter);
            await Auth.saveUserSettings();
        } catch(e) {
            log('❌ Error: ' + e.message, 'err');
            showError('Connection failed - retrying...');
            if ($('s-status')) { $('s-status').textContent = 'RETRY'; $('s-status').style.color = 'var(--yellow)'; }
        }
        S.isUpdating = false; S.countdown = Math.floor(CFG.refresh / 1000);
        $('refresh-btn')?.classList.remove('loading');
        if (syncStatus) syncStatus.classList.remove('show');
    }

    window.manualRefresh = () => { log('👆 Manual refresh', 'info'); S.retryCount = 0; S.countdown = 0; update(); };

    function cycle() { setInterval(() => { if (!S.cycling || !S.items.length) return; const visible = [...document.querySelectorAll('.news')].filter(n => n.style.display !== 'none'); if (!visible.length) return; S.idx = (S.idx + 1) % visible.length; selectItem(S.items.findIndex(x => x.id === visible[S.idx].dataset.id)); }, CFG.cycle); }
    function countdown() { setInterval(() => { if (S.countdown > 0) S.countdown--; else if (!S.isUpdating) { S.countdown = Math.floor(CFG.refresh / 1000); update(); } }, 1000); }

    function keyboard() {
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') hideDetail();
            if (e.key.toLowerCase() === 'r') manualRefresh();
            if (e.key.toLowerCase() === 'h') toggleHeatmap();
            if (e.key.toLowerCase() === 'g') toggleGeofenceView();
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); S.idx = (S.idx + 1) % S.items.length; selectItem(S.idx); }
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); S.idx = (S.idx - 1 + S.items.length) % S.items.length; selectItem(S.idx); }
            if (e.key === ' ') { e.preventDefault(); S.cycling = !S.cycling; log(`Auto-cycle: ${S.cycling ? 'ON' : 'OFF'}`, S.cycling ? 'ok' : 'warn'); }
        });
    }

    function setup() {
        document.querySelectorAll('.fbtn:not(.refresh-btn)').forEach(b => b.onclick = () => applyFilter(b.dataset.f));
        document.querySelectorAll('.region-item').forEach(r => r.onclick = () => applyFilter(r.dataset.r));
        const searchBox = document.getElementById('search-box');
        if (searchBox) { searchBox.addEventListener('input', (e) => { const query = e.target.value.toLowerCase(); document.querySelectorAll('.news').forEach(n => { const title = n.querySelector('.news-title')?.textContent.toLowerCase() || ''; n.style.display = title.includes(query) || query === '' ? '' : 'none'; }); }); }
        document.querySelectorAll('.alert-checkbox').forEach(cb => {
            cb.addEventListener('change', () => Auth.saveUserSettings());
        });
        // Help panel
        document.getElementById('help-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('help-content').classList.toggle('show');
        });
        document.addEventListener('click', function() {
            document.getElementById('help-content').classList.remove('show');
        });
    }

    async function init() {
        log('🚀 OMEGA MATRIX v14.1 ENTERPRISE (BACKEND INTEGRATED)', 'ok');
        await Database.init();
        await Auth.init();
        await TimeSync.sync();
        setInterval(() => TimeSync.sync(), CFG.ntpInterval);
        initMap();
        updateClocks();
        setInterval(updateClocks, 1000);
        keyboard();
        setup();
        countdown();
        setTimeout(() => { update(); cycle(); }, 1500);
        log('✅ Enterprise system initialized', 'ok');
        Auth.showToast('🎯 OMEGA MATRIX v14.1 ONLINE');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

// F11 Fullscreen Toggle
document.addEventListener('keydown', function(e) {
    if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
    }
});
document.addEventListener('fullscreenchange', function() {
    if (window.S && window.S.map) setTimeout(() => window.S.map.invalidateSize(), 100);
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW error:', err));
    });
}
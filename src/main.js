// --- GLOBAL CONSTANTS & CONFIG ---
const CONFIG = {
    VERSION: '2.6.0-Pro',
    BUILD: '2026-Beta',
    ANIMATION_SPEED: 300,
    SWIPE_THRESHOLD: 120, 
    DEBOUNCE_RATE: 350,
    SCROLL_MEMORY: true
};

// --- LOGGING & DEV TOOLS ---
const Log = {
    history: [],
    listeners: [],
    
    _print(mod, msg, color) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { time: timestamp, mod, msg, color };
        this.history.push(logEntry);
        
        // Console Output (Conditional)
        if (State.devMode || color === '#ef4444') {
            console.log(`%c[${mod}] ${msg}`, `color: ${color}; font-weight: bold;`);
        }
        
        // Notify Listeners (for on-screen console)
        this.listeners.forEach(cb => cb(logEntry));
    },
    
    info: (mod, msg) => Log._print(mod, msg, '#3b82f6'),
    warn: (mod, msg) => Log._print(mod, msg, '#f59e0b'),
    err: (mod, msg) => Log._print(mod, msg, '#ef4444'),
    success: (mod, msg) => Log._print(mod, msg, '#10b981'),
    dev: (mod, msg) => Log._print(mod, msg, '#8b5cf6'),
    
    subscribe(callback) {
        this.listeners.push(callback);
    },
    
    exportLogs() {
        const text = this.history.map(l => `[${l.time}] [${l.mod}] ${l.msg}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sniplit-logs-${Date.now()}.txt`;
        a.click();
    }
};

const DevTools = {
    init() {
        // Anti-Tamper / Console Detection
        setInterval(() => {
            if (State.devMode) return;
            const start = performance.now();
            // debugger; // Minimal obfuscation trigger
            const end = performance.now();
            if (end - start > 100) {
               this.triggerProtection();
            }
        }, 2000);

        // Prevent Context Menu & Shortcuts
        document.addEventListener('contextmenu', event => {
            if (!State.devMode) event.preventDefault();
        });
        document.addEventListener('keydown', (e) => {
            if (!State.devMode && (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I'))) {
                e.preventDefault();
                this.triggerProtection();
            }
        });
        
        Log.dev('DevTools', 'Security Protocols Active');
    },
    
    triggerProtection() {
        if (State.devMode) return; 
        
        // Professional Lockout Screen
        document.body.innerHTML = `
            <div style="
                position: fixed; inset: 0; background: #000; color: #fff;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                font-family: 'Courier New', monospace; text-align: center; z-index: 99999;
                padding: 2rem;
            ">
                <div style="
                    width: 80px; height: 80px; border: 2px solid #ef4444; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; margin-bottom: 2rem;
                    box-shadow: 0 0 30px rgba(239, 68, 68, 0.4); animation: pulse 2s infinite;
                ">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <h1 style="font-size: 2rem; font-weight: 900; letter-spacing: -1px; margin-bottom: 0.5rem; color: #ef4444;">SYSTEM LOCKOUT</h1>
                <p style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; color: #52525b; margin-bottom: 3rem;">Security Violation Detected</p>
                
                <div style="background: #18181b; padding: 1.5rem; border-radius: 12px; border: 1px solid #27272a; max-width: 400px; width: 100%;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.75rem; color: #a1a1aa;">
                        <span>ERROR CODE</span>
                        <span style="font-family: monospace; color: #ef4444;">0xSEC_INSPECT</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.75rem; color: #a1a1aa;">
                        <span>TIMESTAMP</span>
                        <span style="font-family: monospace;">${new Date().toISOString()}</span>
                    </div>
                    <p style="margin-top: 1rem; font-size: 0.8rem; line-height: 1.5; color: #71717a;">
                        The application has entered safe mode due to unauthorized debugger attachment or DOM inspection.
                    </p>
                </div>
                
                <button onclick="location.reload()" style="
                    margin-top: 3rem; padding: 1rem 3rem; background: #fff; color: #000;
                    border: none; border-radius: 9999px; font-weight: 800; font-size: 0.8rem;
                    text-transform: uppercase; letter-spacing: 1px; cursor: pointer;
                    box-shadow: 0 10px 30px rgba(255,255,255,0.1); transition: transform 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    Reboot System
                </button>
            </div>
            <style>@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }</style>
        `;
    },

    toggleDevMode() {
        State.devMode = !State.devMode;
        UI.toast(`Developer Mode: ${State.devMode ? 'ENGAGED' : 'DISABLED'}`);
        if (State.devMode) {
            document.body.classList.add('dev-mode-active');
            UI.renderDevDashboard();
        } else {
            document.body.classList.remove('dev-mode-active');
            const dash = document.getElementById('dev-dashboard');
            if (dash) dash.remove();
        }
        Database.save('dev_mode', State.devMode);
    }
};

// --- SECURITY & SANITIZATION ---
const Security = {
    escapeHtml: (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    },
    safeText: (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
    unescapeHtml: (unsafe) => {
        if (!unsafe) return '';
        const doc = new DOMParser().parseFromString(unsafe, "text/html");
        return doc.documentElement.textContent;
    },
    validateUsername: (input) => {
        const name = input.trim().toLowerCase();
        if (name.length < 2) return { valid: false, reason: "Name too short." };
        if (name.length > 20) return { valid: false, reason: "Name too long." };
        if (!/^[a-z0-9\s]*$/.test(name)) return { valid: false, reason: "Invalid characters." };
        return { valid: true, reason: "" };
    }
};

// --- STATE MANAGEMENT ---
const State = {
    user: null,
    devMode: false,
    preferences: {
        quality: true, 
        viz: true, 
        vizColor: 'white',
        haptics: true, 
        historyEnabled: true,
        lightMode: false, 
        favoriteGenre: 'Pop', 
        streamSource: 'auto',
        normalize: true, 
        crossfade: false, 
        gapless: false, 
        allowExplicit: true,
        reduceMotion: false
    },
    searchHistory: [],
    currentTrack: null,
    queue: [],
    history: [],
    favorites: [],
    playlists: [],
    followedArtists: [],
    blockedArtists: [],
    dislikedSongs: [],
    localFiles: [],
    podcasts: [], 
    isPlaying: false,
    isLoading: false,
    loop: 'none',
    isShuffle: false,
    genres: new Set(),
    wrapped: { slide: 0, data: {} },
    db: null,
    isLINKMode: false,
    analytics: { totalSecondsListened: 0, appOpens: 0, tracksPlayed: 0 },
    viewStack: ['home'],
    scrollPositions: {},
    
    // Runtime flags
    userInteractingWithLyrics: false,
    lyricsScrollTimeout: null,
    lastTabSwitch: Date.now()
};

const LINK_DB = {
    // Format: "normalized artist name normalized track name": "YouTubeVideoID"
    "kyslingo grey": "dGLOVZrWBl0",
    "ken carson overseas": "80M6sAU9DY4",
    "ken carson freestyle 2": "LcjkHLlcTi4",
    "ken carson paranoid": "_nkK3GHbBwY"
};

// --- DATABASE (INDEXEDDB + LOCALSTORAGE FALLBACK) ---
const Database = {
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SniplitDB', 14);
            
            const loadTimeout = setTimeout(() => {
                UI.showDatabaseRecoveryOption();
            }, 3000); 

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                ['settings', 'playlists', 'followed', 'analytics', 'localfiles', 'blocked', 'disliked', 'podcasts'].forEach(store => {
                    if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
                });
            };
            request.onsuccess = (e) => {
                clearTimeout(loadTimeout);
                this.db = e.target.result;
                Log.success('DB', 'Connected v2.6');
                resolve();
            };
            request.onerror = (e) => {
                clearTimeout(loadTimeout);
                Log.err('DB', e);
                UI.showDatabaseRecoveryOption();
                reject(e);
            }
        });
    },
    async save(key, val) {
        try {
            const tx = this.db.transaction('settings', 'readwrite');
            tx.objectStore('settings').put(val, key);
            
            if (key === 'preferences' || key === 'user_name' || key === 'dev_mode') {
                localStorage.setItem(`sniplit_${key}`, JSON.stringify(val));
            }
        } catch (e) { Log.err('DB', 'Save Error'); }
    },
    async get(key) {
        if (key === 'preferences' || key === 'user_name') {
            const local = localStorage.getItem(`sniplit_${key}`);
            if (local) return JSON.parse(local);
        }
        
        return new Promise(res => {
            const tx = this.db.transaction('settings', 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
    },
    
    // --- WRAPPER METHODS (FIXED) ---
    async getPlaylists() {
        return this.getList('playlists');
    },
    async savePlaylists(lists) {
        return this.saveList('playlists', lists);
    },
    async getFollowed() {
        return this.getList('followed');
    },
    async saveFollowed(list) {
        return this.saveList('followed', list);
    },

    async saveList(storeName, list) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        list.forEach(item => store.put(item));
    },
    async getList(storeName) {
        return new Promise(res => {
            if (!this.db.objectStoreNames.contains(storeName)) { res([]); return; }
            const tx = this.db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = () => res([]);
        });
    },
    async wipe() {
        UI.triggerConfirm("Emergency Wipe", "This will clear all data to fix corruption. Continue?", () => {
            localStorage.clear();
            indexedDB.deleteDatabase('SniplitDB');
            location.reload();
        });
    }
};

// --- ROUTER & SCROLL MANAGER ---
const Router = {
    historyStack: [],
    
    go(viewId, params = null) {
        this.saveScrollPosition();
        
        const current = document.querySelector('.view-section:not(.hidden)');
        if (current && current.id !== `view-${viewId}`) {
            this.historyStack.push({ id: current.id.replace('view-', ''), params: State.currentContextParams });
        }
        this.switch(viewId, params);
    },
    
    back() {
        this.saveScrollPosition();
        if (this.historyStack.length > 0) {
            const prev = this.historyStack.pop();
            this.switch(prev.id, prev.params);
        } else {
            this.switch('home');
        }
    },
    
    saveScrollPosition() {
        const current = document.querySelector('.view-section:not(.hidden)');
        if (current) {
            const viewport = document.getElementById('view-port');
            State.scrollPositions[current.id] = viewport.scrollTop;
        }
    },
    
    restoreScrollPosition(viewId) {
        const viewport = document.getElementById('view-port');
        const pos = State.scrollPositions[`view-${viewId}`];
        if (pos !== undefined) {
            requestAnimationFrame(() => viewport.scrollTop = pos);
        } else {
            viewport.scrollTop = 0;
        }
    },

    switch(viewId, params = null) {
        State.currentContextParams = params;
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        
        const target = document.getElementById(`view-${viewId}`);
        if (target) target.classList.remove('hidden');

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        if (['home', 'search', 'library'].includes(viewId)) {
            const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
            if (btn) btn.classList.add('active');
        }

        const q = document.getElementById('view-queue');
        if (q && !q.classList.contains('queue-hidden')) UI.toggleQueue();

        this.restoreScrollPosition(viewId);

        if (viewId === 'home') UI.loadHomeData();
        if (viewId === 'library') UI.renderLibrary();
        if (viewId === 'podcasts') Podcasts.render();
    }
};

// --- AUDIO ENGINE ---
const AudioEngine = {
    el: new Audio(),
    ctx: null,
    analyser: null,
    source: null,

    init() {
        this.el.crossOrigin = "anonymous";

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                if (State.isPlaying) {
                    this.toggle(); 
                    UI.toast("Playback Paused (Background)");
                }
            }
        });

        this.el.addEventListener('loadstart', () => { State.isLoading = true; UI.updateMiniPlayerState(); });
        this.el.addEventListener('canplay', () => { State.isLoading = false; UI.updateMiniPlayerState(); });
        this.el.addEventListener('timeupdate', () => { if (!State.isLINKMode) this.onTimeUpdate(); });
        this.el.addEventListener('ended', () => { if (!State.isLINKMode) Queue.next(); });
        
        this.el.addEventListener('play', () => {
            if (State.isLINKMode) return;
            State.isPlaying = true; State.isLoading = false;
            UI.updatePlaybackState();
            if (!this.ctx) this.initAudioContext();
        });
        
        this.el.addEventListener('pause', () => {
            if (State.isLINKMode) return;
            State.isPlaying = false;
            UI.updatePlaybackState();
        });

        setInterval(() => {
            UI.updateMiniPlayerState();
            if (State.isPlaying && State.isLINKMode && LINKEngine.player && LINKEngine.player.getCurrentTime) {
                this.onTimeUpdate(LINKEngine.player.getCurrentTime(), LINKEngine.player.getDuration());
                LyricsEngine.sync();
            }
        }, 300);

        Log.success('Audio', 'Engine Init');
        LINKEngine.init();
    },

    initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 256; 
            
            this.source = this.ctx.createMediaElementSource(this.el);
            this.source.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);
            Log.info('Audio', 'Web Audio API Connected');
        } catch (e) { Log.warn('Audio', 'Visualizer restricted'); }
    },

 load(track, autoplay = true) {
    if (!track) return;

    State.currentTrack = track;
    State.isLoading = true;

    // 1. Stop EVERYTHING first
    this.el.pause();
    this.el.removeAttribute('src'); // Strictly remove source
    this.el.load(); // Reset internal state

    // Check for blocked artist
    if (State.blockedArtists.includes(track.artistName)) {
        UI.toast("Skipping Blocked Artist");
        Queue.next();
        return;
    }

    // 2. Database Lookup
    const key = this.normalizeKey(`${track.artistName} ${track.trackName}`);
    const ytId = LINK_DB[key];

    // 3. Logic: YouTube vs Native
    // Check if Source is Auto/YT AND we found an ID in the DB
    const useYouTube = (State.preferences.streamSource === 'auto' || State.preferences.streamSource === 'yt') && ytId;

    if (useYouTube) {
        // --- PATH A: YOUTUBE ---
        Log.info('Audio', `Playing via YouTube: ${key}`);
        State.isLINKMode = true;
        
        // Load the video (using the pending logic if needed)
        LINKEngine.loadVideo(ytId);
        
        if (!autoplay) LINKEngine.pause();

    } else {
        // --- PATH B: NATIVE (iTunes/Local) ---
        Log.info('Audio', `Playing via Native: ${track.trackName}`);
        State.isLINKMode = false;
        
        this.el.src = track.previewUrl || track.localUrl;
        if (autoplay) {
            const playPromise = this.el.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    Log.warn('Audio', 'Autoplay prevented');
                    State.isPlaying = false;
                    UI.updatePlaybackState();
                });
            }
        }
    }

    // 4. Finish Up
    this.postLoadProcess(track);
},

    postLoadProcess(track) {
        State.analytics.tracksPlayed++;
        Database.save('analytics', State.analytics);

        State.history.unshift(track);
        const uniqueHistory = [];
        const seenIds = new Set();
        for (const t of State.history) {
            if (!seenIds.has(t.trackId)) {
                seenIds.add(t.trackId);
                uniqueHistory.push(t);
            }
        }
        State.history = uniqueHistory.slice(0, 100);
        Database.save('history', State.history);

        if (track.primaryGenreName) State.genres.add(track.primaryGenreName);

        UI.updatePlayerUI();
        LyricsEngine.fetch(track);
        this.updateMediaSession();
    },

   normalizeKey(str) {
    if (!str) return '';
    
    let clean = str.toLowerCase();

    // 1. Remove "featuring" variations
    // Matches: (feat. artist), [feat. artist], feat. artist, ft. artist
    clean = clean.replace(/(\(feat\.|\(ft\.|\[feat\.|\[ft\.| feat\. | ft\. | featuring )[^)]*\)?/gi, '');

    // 2. Remove "problem causing queries" inside brackets
    // Matches: (Official Video), (Lyrics), [Audio], (Music Video), etc.
    // This catches most of the differences between iTunes and YouTube titles
    clean = clean.replace(/(\[.*?\]|\(.*?\))/g, '');

    // 3. Remove Hyphens and everything after (Optional)
    // Useful if iTunes has "Song - Album Version" but YouTube is just "Song"
    // Uncomment the next line if you want to ignore everything after a hyphen
    // clean = clean.split('-')[0];

    // 4. Remove special characters (keep numbers and letters)
    clean = clean.replace(/[^\w\s]/gi, '');

    // 5. Collapse multiple spaces and trim
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
},

    toggle() {
    if (State.isLINKMode) { 
        // YouTube Engine Control
        State.isPlaying ? LINKEngine.pause() : LINKEngine.play(); 
    } else { 
        // Native Engine Control
        if (!this.el.src) return; 
        this.el.paused ? this.el.play() : this.el.pause(); 
    }
    
    // Toggle Global State
    State.isPlaying = !State.isPlaying;
    UI.updatePlaybackState(); 
    
    // Haptics
    if (State.preferences.haptics && navigator.vibrate) navigator.vibrate(15);
    
    // Update Lock Screen Media Session
    this.updateMediaSession();
},

   seek(val) {
    // Determine duration based on active engine
    const duration = State.isLINKMode ? LINKEngine.getDuration() : this.el.duration;
    if (!duration) return;
    
    // Calculate time in seconds
    const time = (val / 100) * duration;
    
    // Execute seek on active engine
    if (State.isLINKMode) {
        LINKEngine.seekTo(time);
    } else {
        this.el.currentTime = time;
    }
},

onTimeUpdate() {
    let currentTime = 0;
    let duration = 0;

    if (State.isLINKMode) {
        // Get data from YouTube
        currentTime = LINKEngine.getTime();
        duration = LINKEngine.getDuration();
    } else {
        // Get data from Native Audio
        currentTime = this.el.currentTime;
        duration = this.el.duration;
    }

    if (!duration) return;

    // --- UPDATE UI PROGRESS BAR ---
    const pct = (currentTime / duration) * 100;

    const slider = document.getElementById('player-progress');
    if (slider) {
        slider.value = pct || 0;
        slider.style.background = `linear-gradient(to right, var(--text-primary) ${pct}%, var(--bg-elevated) ${pct}%)`;
    }

    const miniBar = document.getElementById('mini-progress');
    if (miniBar) miniBar.style.width = `${pct || 0}%`;

    // --- UPDATE TIME TEXT ---
    const curEl = document.getElementById('time-cur');
    const totEl = document.getElementById('time-total');
    if (curEl) curEl.innerText = this.formatTime(currentTime);
    if (totEl) totEl.innerText = this.formatTime(duration);

    // --- UPDATE MEDIA SESSION (Lock Screen) ---
    // We do this less frequently to save performance
    if (Math.floor(currentTime) % 5 === 0 && 'mediaSession' in navigator) {
        try {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: 1,
                position: currentTime
            });
        } catch (e) { }
    }
},

    formatTime(s) {
        if (!s || isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const r = Math.floor(s % 60);
        return `${m}:${r < 10 ? '0' : ''}${r}`;
    },

    updateMediaSession() {
        if ('mediaSession' in navigator && State.currentTrack) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: Security.unescapeHtml(State.currentTrack.trackName),
                artist: Security.unescapeHtml(State.currentTrack.artistName),
                album: Security.unescapeHtml(State.currentTrack.collectionName),
                artwork: [{ src: State.currentTrack.artworkUrl100.replace('100x100', '600x600'), sizes: '600x600', type: 'image/jpeg' }]
            });

            navigator.mediaSession.setActionHandler('play', () => this.toggle());
            navigator.mediaSession.setActionHandler('pause', () => this.toggle());
            navigator.mediaSession.setActionHandler('previoustrack', () => Queue.prev());
            navigator.mediaSession.setActionHandler('nexttrack', () => Queue.next());
        }
    }
};

const LINKEngine = {
    player: null,
    isReady: false,
    pendingVideoId: null, // Stores video if we click before API loads
    container: null,

    init() {
        // 1. Create the hidden container dynamically
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'yt-audio-hidden-player';
            // Strictly hidden
            this.container.style.cssText = 'position: fixed; top: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; visibility: hidden;';
            document.body.appendChild(this.container);
        }

        if (window.YT && window.YT.Player) {
            // API already loaded
            this.createPlayer();
        } else {
            // Load API
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            document.body.appendChild(tag);
            
            window.onYouTubeIframeAPIReady = () => {
                this.createPlayer();
            };
        }
    },

    createPlayer() {
        this.player = new YT.Player('yt-audio-hidden-player', {
            height: '1',
            width: '1',
            videoId: '',
            playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1 },
            events: {
                'onReady': (event) => {
                    this.isReady = true;
                    Log.success('LINK', 'YouTube Engine Ready');
                    
                    // CRITICAL FIX: Play the pending video if we clicked earlier
                    if (this.pendingVideoId) {
                        Log.info('LINK', `Loading pending video: ${this.pendingVideoId}`);
                        this.player.loadVideoById(this.pendingVideoId);
                        this.pendingVideoId = null;
                    }
                },
                'onStateChange': (e) => {
                    if (e.data === YT.PlayerState.ENDED) Queue.next();
                },
                'onError': (e) => {
                    Log.err('LINK', 'YouTube Error');
                    // If YouTube fails, fallback to native? 
                    // (Optional advanced step, but for now just log it)
                }
            }
        });
    },

    loadVideo(id) {
        if (this.isReady && this.player) {
            this.player.loadVideoById(id);
            return true;
        } else {
            // Not ready yet? Store it.
            Log.warn('LINK', 'Engine not ready, queuing video...');
            this.pendingVideoId = id;
            return false; 
        }
    },
    
    // ... keep your play, pause, seekTo, getTime, getDuration methods the same ...
    play() { if (this.player && this.player.playVideo) this.player.playVideo(); },
    pause() { if (this.player && this.player.pauseVideo) this.player.pauseVideo(); },
    seekTo(seconds) { if (this.player && this.player.seekTo) this.player.seekTo(seconds, true); },
    getTime() { return this.player ? this.player.getCurrentTime() : 0; },
    getDuration() { return this.player ? this.player.getDuration() : 0; }
};

// --- LYRICS ENGINE ---
const LyricsEngine = {
    lines: [],
    
    async fetch(track) {
        const container = document.getElementById('lyrics-container');
        const panel = document.getElementById('lyrics-panel');
        
        this.lines = [];
        container.innerHTML = '<div class="flex flex-col items-center justify-center h-full opacity-50"><div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4"></div><p class="text-xs">Searching...</p></div>';

        panel.addEventListener('touchstart', () => {
            State.userInteractingWithLyrics = true;
            clearTimeout(State.lyricsScrollTimeout);
            State.lyricsScrollTimeout = setTimeout(() => {
                State.userInteractingWithLyrics = false;
            }, 3000); 
        });

        try {
            const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artistName)}&track_name=${encodeURIComponent(track.trackName)}`);
            if (!res.ok) throw new Error("API Error");
            const data = await res.json();
            
            if (data && data.syncedLyrics) {
                this.parseSynced(data.syncedLyrics);
            } else if (data && data.plainLyrics) {
                this.parsePlain(data.plainLyrics);
            } else {
                throw new Error("No lyrics");
            }
        } catch (e) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-center px-6">
                <i data-lucide="music-2" class="w-8 h-8 mb-2 opacity-30"></i>
                <p class="text-sm font-bold opacity-50">Lyrics Unavailable</p>
            </div>`;
            if (window.lucide) lucide.createIcons();
        }
    },
    
    parseSynced(text) {
        this.lines = text.split('\n').map(line => {
            const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
            if (match) return { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() };
            return null;
        }).filter(l => l);
        this.render();
    },

    parsePlain(text) {
        this.lines = text.split('\n').map(line => ({ time: null, text: line }));
        this.render();
    },
    
    render() {
        const container = document.getElementById('lyrics-container');
        if (!container) return;
        
        container.innerHTML = this.lines.map((l, i) => `
            <div id="lyric-${i}" 
                 class="lyric-line text-center text-xl font-bold py-2 transition-all duration-500 cursor-pointer select-none opacity-40 hover:opacity-100" 
                 onclick="AudioEngine.seek(${l.time ? (l.time / AudioEngine.el.duration * 100) : 0})">
                ${l.text || '...'}
            </div>`
        ).join('');
        
        container.innerHTML += '<div class="h-[50vh]"></div>';
    },
    
    sync() {
        if (this.lines.length === 0 || !State.isPlaying) return;
        if (this.lines[0].time === null) return; 

        const curTime = State.isLINKMode ? LINKEngine.getTime() : AudioEngine.el.currentTime;
        
        let activeIdx = -1;
        for (let i = 0; i < this.lines.length; i++) {
            if (curTime >= this.lines[i].time) {
                activeIdx = i;
            } else {
                break;
            }
        }

        document.querySelectorAll('.lyric-line').forEach(el => {
            el.classList.remove('active', 'scale-110', 'opacity-100');
            el.classList.add('opacity-40');
        });

        if (activeIdx !== -1) {
            const el = document.getElementById(`lyric-${activeIdx}`);
            if (el) {
                el.classList.add('active', 'scale-110', 'opacity-100');
                el.classList.remove('opacity-40');
                
                if (!State.userInteractingWithLyrics) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }
};

// --- PODCAST ENGINE ---
const Podcasts = {
    async render() {
        UI.switchView('library');
        const hero = document.getElementById('list-hero');
        const list = document.getElementById('list-tracks');
        
        hero.innerHTML = `
            <div class="flex items-end gap-5 animate-slide-up">
                <div class="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-700 rounded-xl flex items-center justify-center shadow-xl">
                    <i data-lucide="mic" class="w-10 h-10 text-white"></i>
                </div>
                <div>
                    <h1 class="text-3xl font-black tracking-tight" style="color: var(--text-primary);">Podcasts</h1>
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-4" style="color: var(--text-tertiary);">Top Shows</p>
                </div>
            </div>`;
            
        list.innerHTML = '<div class="py-10 text-center"><div class="animate-spin w-6 h-6 border-2 border-current rounded-full inline-block"></div></div>';
        
        // Fetch real podcasts (using generic search term for demo)
        const podcasts = await API.search('podcast');
        
        list.innerHTML = '';
        if (podcasts.length === 0) {
             list.innerHTML = '<p class="text-center opacity-50 py-10">No podcasts available.</p>';
        } else {
            podcasts.forEach((p, i) => {
                 list.innerHTML += `
                    <div class="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)]" onclick="Queue.set([${UI.esc(p)}])">
                        <img src="${p.artworkUrl100}" class="w-12 h-12 rounded-lg object-cover">
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-sm text-[var(--text-primary)] truncate">${Security.safeText(p.trackName || p.collectionName)}</p>
                            <p class="text-xs opacity-50 truncate">${Security.safeText(p.artistName)}</p>
                        </div>
                        <button class="p-2"><i data-lucide="play-circle" class="w-5 h-5 opacity-50"></i></button>
                    </div>
                `;
            });
        }
        
        if (window.lucide) lucide.createIcons();
    }
};

const Library = {
    async toggleLike() {
        if (!State.currentTrack) return;
        const idx = State.favorites.findIndex(t => t.trackId === State.currentTrack.trackId);
        if (idx > -1) {
            State.favorites.splice(idx, 1);
            UI.toast("Removed from Favorites");
        } else {
            State.favorites.push(State.currentTrack);
            UI.toast("Liked Song");
        }
        // Save to DB
        Database.saveList('favorites', State.favorites);
        // Force Update UI
        UI.updatePlayerUI();
        if (document.getElementById('view-library').classList.contains('hidden') === false) UI.renderLibrary();
    },
    createPlaylist(name) {
        if (!name) return;
        const newPl = { id: 'pl-' + Date.now(), name: name, tracks: [], image: null };
        State.playlists.push(newPl);
        Database.savePlaylists(State.playlists);
        UI.renderLibrary();
        UI.toast(`Created ${name}`);
    },
    async addToPlaylist(playlistId) {
        if (!State.currentTrack) return;
        const pl = State.playlists.find(p => p.id === playlistId);
        if (pl) {
            pl.tracks.push(State.currentTrack);
            await Database.savePlaylists(State.playlists);
            UI.toast(`Added to ${pl.name}`);
            document.getElementById('modal-add-playlist').classList.add('hidden');
        }
    },
    async deletePlaylist(id) {
        UI.triggerConfirm("Delete Playlist", "Are you sure?", async () => {
            State.playlists = State.playlists.filter(p => p.id !== id);
            await Database.savePlaylists(State.playlists);
            Router.back();
            UI.toast("Playlist Deleted");
        });
    },
    async removeFromPlaylist(playlistId, trackId) {
        const pl = State.playlists.find(p => p.id === playlistId);
        if (pl) {
            pl.tracks = pl.tracks.filter(t => t.trackId !== trackId);
            await Database.savePlaylists(State.playlists);
            UI.renderPlaylistView(pl);
        }
    }
};

// --- LOCAL FILES ---
const LocalFiles = {
    triggerFile() {
        document.getElementById('local-file-input').click();
    },
    triggerFolder() {
        document.getElementById('local-folder-input').click();
    },
    init() {
        const fileInput = document.getElementById('local-file-input');
        if (fileInput) fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        
        let folderInput = document.getElementById('local-folder-input');
        if (!folderInput) {
            folderInput = document.createElement('input');
            folderInput.type = 'file';
            folderInput.id = 'local-folder-input';
            folderInput.className = 'hidden';
            folderInput.webkitdirectory = true;
            folderInput.multiple = true;
            document.getElementById('app-container').appendChild(folderInput);
            folderInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        }
    },
    
    async handleFiles(fileList) {
        if (!fileList || fileList.length === 0) return;
        UI.toast(`Processing ${fileList.length} files...`);
        
        const newTracks = [];

        for (const f of Array.from(fileList)) {
            if (f.type.startsWith('audio/') || f.name.endsWith('.mp3') || f.name.endsWith('.m4a')) {
                let artist = "Unknown Artist";
                let title = f.name.replace(/\.[^/.]+$/, "");
                
                if (title.includes('-')) {
                    const parts = title.split('-');
                    artist = parts[0].trim();
                    title = parts[1].trim();
                }

                newTracks.push({
                    id: `loc-${Date.now()}-${Math.random()}`,
                    trackId: `loc-${f.name}`,
                    trackName: title,
                    artistName: artist,
                    collectionName: f.webkitRelativePath ? f.webkitRelativePath.split('/')[0] : "Local Import",
                    artworkUrl100: "src/SNIPLIT.png", 
                    previewUrl: URL.createObjectURL(f),
                    localUrl: URL.createObjectURL(f),
                    isLocal: true,
                    fileSize: f.size
                });
            }
        }

        if (newTracks.length > 0) {
            State.localFiles = [...State.localFiles, ...newTracks];
            await Database.saveList('localfiles', State.localFiles);
            Queue.set(newTracks);
            UI.togglePlayer(true);
            UI.toggleQueue(true);
            UI.toast(`Imported ${newTracks.length} tracks`);
        } else {
            UI.toast("No valid audio files found.");
        }
    }
};

// --- QUEUE & API ---
const Queue = {
    index: -1,
    set(list, startIdx = 0) {
        if (!list || list.length === 0) return;
        State.queue = [...list];
        this.index = startIdx;
        AudioEngine.load(State.queue[this.index]);
        UI.renderQueuePage();
    },
    add(track) {
        State.queue.push(track);
        UI.toast("Added to Queue");
        UI.renderQueuePage();
    },
    next() {
        if (State.loop === 'one') {
            AudioEngine.el.currentTime = 0; LINKEngine.seekTo(0);
            return;
        }
        
        if (State.isShuffle) {
            this.index = Math.floor(Math.random() * State.queue.length);
        } else {
            this.index++;
        }

        if (this.index >= State.queue.length) {
            this.smartRadio();
            return;
        }
        AudioEngine.load(State.queue[this.index]);
    },
    prev() {
        const curTime = State.isLINKMode ? LINKEngine.getTime() : AudioEngine.el.currentTime;
        if (curTime > 3) {
            if (State.isLINKMode) LINKEngine.seekTo(0); else AudioEngine.el.currentTime = 0;
            return;
        }
        this.index--;
        if (this.index < 0) this.index = State.queue.length - 1;
        AudioEngine.load(State.queue[this.index]);
    },
    toggleLoop() {
        const modes = ['none', 'one', 'all'];
        State.loop = modes[(modes.indexOf(State.loop) + 1) % modes.length];
        const btn = document.getElementById('loop-btn');
        if (btn) {
            btn.className = State.loop !== 'none' ? 'p-2 text-[var(--accent-secondary)]' : 'p-2 text-[var(--text-tertiary)]';
            btn.innerHTML = `<i data-lucide="repeat${State.loop === 'one' ? '-1' : ''}" class="w-5 h-5"></i>`;
            if(window.lucide) lucide.createIcons();
        }
        UI.toast(`Loop: ${State.loop.toUpperCase()}`);
    },
    toggleShuffle() {
        State.isShuffle = !State.isShuffle;
        const btn = document.getElementById('shuffle-btn');
        if (btn) btn.className = State.isShuffle ? 'p-2 text-[var(--accent-secondary)]' : 'p-2 text-[var(--text-tertiary)]';
        UI.toast(`Shuffle: ${State.isShuffle ? 'On' : 'Off'}`);
    },
    async smartRadio() {
        UI.toast("Loading Radio...");
        const seed = State.currentTrack ? State.currentTrack.primaryGenreName : State.preferences.favoriteGenre;
        const results = await API.search(`${seed} hits`);
        
        const newTracks = results.filter(t => !State.history.some(h => h.trackId === t.trackId));
        
        if (newTracks.length > 0) {
            State.queue.push(...newTracks.slice(0, 5));
            this.next();
        } else {
            this.index = 0; 
            AudioEngine.load(State.queue[0]);
        }
    }
};

const API = {
    async search(query) {
        try {
            const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=25&country=US`);
            const data = await res.json();
            return data.results;
        } catch (e) {
            Log.err('API', e.message);
            return [];
        }
    },
    async getArtistDiscography(id) {
        try {
            const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=album&limit=8`);
            const data = await res.json();
            return data.results;
        } catch (e) { return []; }
    },
    async getAlbumTracks(collectionId) {
        try {
            const res = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song`);
            const data = await res.json();
            return data.results.slice(1);
        } catch (e) { return []; }
    }
};

// --- UI MANAGER ---
const UI = {
    async init() {
        DevTools.init(); 
        await Database.init(); 

        const loggedIn = await Onboarding.check();
        if (!loggedIn) {
            document.getElementById('splash-screen').style.display = 'none';
            return;
        }

        LocalFiles.init();

        window.addEventListener('resize', this.debounce(() => this.initVisualizer(), 200));
        
        const searchInput = document.getElementById('main-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(async (e) => {
                const val = e.target.value;
                if (val.length < 2) {
                    document.getElementById('search-results').innerHTML = '';
                    document.getElementById('search-history-panel').classList.remove('hidden');
                    return;
                }
                document.getElementById('search-loading').classList.remove('hidden');
                document.getElementById('search-history-panel').classList.add('hidden');
                const results = await API.search(val);
                document.getElementById('search-loading').classList.add('hidden');
                this.renderSearchResults(results);
            }, CONFIG.DEBOUNCE_RATE));
        }

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) this.loadNextHomeSection();
        }, { root: document.getElementById('view-port'), threshold: 0.1 });
        const sentinel = document.getElementById('scroll-sentinel');
        if(sentinel) observer.observe(sentinel);

        await this.initData();
        
        setInterval(() => {
            const now = new Date();
            const el = document.getElementById('system-time');
            if(el) el.innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }, 1000);
    },

    updateMiniPlayerState() {
        // Handled by timer in AudioEngine
    },
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    async initData() {
        const prefs = await Database.get('preferences');
        if (prefs) State.preferences = { ...State.preferences, ...prefs };
        
        if (State.preferences.lightMode) document.body.classList.add('light-mode');
        
        State.user = await Database.get('user_name');
        if (document.getElementById('greeting')) document.getElementById('greeting').innerText = `Hi, ${State.user}`;

        State.history = await Database.get('history') || [];
        State.searchHistory = await Database.get('search_history') || [];
        State.favorites = await Database.getPlaylists('favorites'); 
        State.playlists = await Database.getPlaylists();
        State.followedArtists = await Database.getFollowed();
        State.blockedArtists = await Database.getList('blocked');
        State.localFiles = await Database.getList('localfiles');

        AudioEngine.init();
        this.initVisualizer();
        if (window.lucide) lucide.createIcons();
        this.loadHomeData();
        
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 800);
        }
    },
    
    showDatabaseRecoveryOption() {
        UI.triggerConfirm(
            "Database Timeout", 
            "Sniplit is taking too long to load data. Your database might be corrupted.", 
            () => Database.wipe()
        );
    },

    async loadHomeData() {
        const grid = document.getElementById('recents-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        // Random "Quick Picks" Section
        const recents = State.history.slice(0, 4);
        
        if (recents.length === 0) {
            grid.innerHTML = `<div class="col-span-2 p-6 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center">
                <p class="text-xs opacity-50">Start listening to build your history.</p>
            </div>`;
        } else {
            recents.forEach(t => {
                grid.innerHTML += `<div class="flex items-center gap-3 surface p-3 rounded-xl transition active:scale-95" onclick="Queue.set([${this.esc(t)}])">
                    <img src="${t.artworkUrl100}" class="w-10 h-10 rounded-lg bg-[var(--bg-elevated)]">
                    <div class="min-w-0">
                        <p class="text-[11px] font-bold truncate text-[var(--text-primary)]">${Security.safeText(t.trackName)}</p>
                        <p class="text-[9px] font-bold uppercase truncate text-[var(--text-tertiary)]">${Security.safeText(t.artistName)}</p>
                    </div>
                </div>`;
            });
        }
        
        // Discovery Section (Made For You)
        this.setDiscoveryMode('daily'); 
    },
    
    async setDiscoveryMode(mode) {
        document.querySelectorAll('#view-home button[id^="tab-"]').forEach(b => {
            b.className = "px-4 py-1.5 surface text-[var(--text-secondary)] text-[10px] font-bold uppercase rounded-full whitespace-nowrap transition hover:bg-[var(--bg-surface-hover)]";
        });
        document.getElementById(`tab-${mode}`).className = "px-4 py-1.5 bg-[var(--text-primary)] text-[var(--text-inverse)] text-[10px] font-bold uppercase rounded-full whitespace-nowrap transition shadow-lg";
        
        const container = document.getElementById('for-you-grid');
        container.innerHTML = '<div class="col-span-3 text-center py-10"><div class="w-6 h-6 border-2 border-current rounded-full animate-spin inline-block"></div></div>';
        
        let term = "top 100 hits";
        if (mode === 'daily') term = `${State.preferences.favoriteGenre} hits`;
        if (mode === 'radio') term = "radio hits current";
        if (mode === 'discover') term = "alternative indie new";
        
        const results = await API.search(term);
        const clean = results.filter(t => !State.blockedArtists.includes(t.artistName));
        
        container.innerHTML = '';
        clean.slice(0, 6).forEach(t => {
            container.innerHTML += `
                <div class="flex-shrink-0 w-32 space-y-2 cursor-pointer group snap-start" onclick="Queue.set([${this.esc(t)}])">
                    <div class="relative overflow-hidden rounded-xl aspect-square">
                        <img src="${t.artworkUrl100.replace('100x100', '400x400')}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    </div>
                    <div class="px-1">
                        <p class="text-[11px] font-bold truncate text-[var(--text-primary)]">${Security.safeText(t.trackName)}</p>
                        <p class="text-[9px] font-bold uppercase truncate text-[var(--text-tertiary)]">${Security.safeText(t.artistName)}</p>
                    </div>
                </div>`;
        });
    },

    homeGenres: ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'R&B', 'Latin', 'Country', 'Jazz', 'Classical', 'Metal'],
    homeGenreIdx: 0,
    async loadNextHomeSection() {
        if (this.homeGenreIdx >= this.homeGenres.length) return;
        const genre = this.homeGenres[this.homeGenreIdx++];
        
        const container = document.getElementById('home-genres-container');
        const section = document.createElement('div');
        section.className = "animate-slide-up";
        container.appendChild(section);
        
        // Random Variation for "Quick Picks"
        const searchTerm = Math.random() > 0.5 ? `${genre} hits` : `Best of ${genre}`;
        
        const results = await API.search(searchTerm);
        const clean = results.filter(t => !State.blockedArtists.includes(t.artistName));
        
        section.innerHTML = `
            <div class="flex justify-between items-end mb-4">
                <h2 class="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">${genre}</h2>
                <button onclick="Router.go('search'); document.getElementById('main-search').value='${genre}'; document.getElementById('main-search').dispatchEvent(new Event('input'))" class="text-[9px] font-bold uppercase opacity-50">See All</button>
            </div>
            <div class="grid grid-cols-2 gap-4">
                ${clean.slice(0, 4).map(t => `
                    <div class="flex items-center gap-3 p-2 surface rounded-xl active:scale-95 transition" onclick="Queue.set([${this.esc(t)}])">
                        <img src="${t.artworkUrl100}" class="w-12 h-12 rounded-lg object-cover">
                        <div class="min-w-0">
                            <p class="text-xs font-bold truncate text-[var(--text-primary)]">${Security.safeText(t.trackName)}</p>
                            <p class="text-[9px] font-bold uppercase truncate text-[var(--text-tertiary)]">${Security.safeText(t.artistName)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderSearchResults(results) {
        const container = document.getElementById('search-results');
        container.innerHTML = '';
        
        const clean = results.filter(t => !State.blockedArtists.includes(t.artistName));
        if (clean.length === 0) {
            container.innerHTML = `<p class="text-center py-10 text-xs opacity-50">No results found.</p>`;
            return;
        }
        
        clean.forEach(t => {
            container.innerHTML += `
                <div class="flex items-center gap-4 p-3 rounded-xl surface mb-2 active:scale-95 transition" onclick="Queue.set([${this.esc(t)}])">
                    <img src="${t.artworkUrl100}" class="w-12 h-12 rounded-lg object-cover">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate text-[var(--text-primary)]">${Security.safeText(t.trackName)}</p>
                        <p class="text-xs font-bold uppercase truncate text-[var(--text-tertiary)]" onclick="event.stopPropagation(); UI.openArtistProfile({artistId:'${t.artistId}', artistName:'${Security.escapeHtml(t.artistName).replace(/'/g, "\\'")}'})">${Security.safeText(t.artistName)}</p>
                    </div>
                    <button class="p-2 text-[var(--text-tertiary)]" onclick="event.stopPropagation(); Queue.add(${this.esc(t)})"><i data-lucide="plus-circle" class="w-5 h-5"></i></button>
                </div>
            `;
        });
        if(window.lucide) lucide.createIcons();
    },

    async openArtistProfile(ctx) {
        Router.go('artist', ctx); 
        let view = document.getElementById('view-artist');
        if (!view) {
            view = document.createElement('section');
            view.id = 'view-artist';
            view.className = 'view-section hidden pt-20 pb-24 px-6';
            document.getElementById('view-port').appendChild(view);
        }
        
        view.innerHTML = `
            <button onclick="Router.back()" class="mb-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]"><i data-lucide="arrow-left" class="w-3 h-3"></i> Back</button>
            <div class="animate-slide-up">
                <h1 class="text-4xl font-black tracking-tighter mb-2 text-[var(--text-primary)]">${Security.safeText(ctx.artistName)}</h1>
                <div class="flex gap-3 mb-8">
                    <button id="follow-btn" onclick="UI.toggleFollow('${ctx.artistId}', '${Security.escapeHtml(ctx.artistName).replace(/'/g, "\\'")}')" class="px-6 py-2 bg-[var(--text-primary)] text-[var(--text-inverse)] rounded-full text-xs font-bold uppercase tracking-widest">Follow</button>
                    <button onclick="UI.blockArtist('${Security.escapeHtml(ctx.artistName).replace(/'/g, "\\'")}')" class="p-2 surface rounded-full text-red-500"><i data-lucide="ban" class="w-4 h-4"></i></button>
                </div>
                <h3 class="text-xs font-bold uppercase tracking-widest mb-4 text-[var(--text-tertiary)]">Top Songs</h3>
                <div id="artist-top-tracks" class="space-y-2 mb-8"></div>
                <h3 class="text-xs font-bold uppercase tracking-widest mb-4 text-[var(--text-tertiary)]">Albums</h3>
                <div id="artist-albums" class="grid grid-cols-2 gap-4"></div>
            </div>
        `;
        if(window.lucide) lucide.createIcons();
        Router.switch('artist'); 

        const tracks = await API.search(ctx.artistName);
        const albums = await API.getArtistDiscography(ctx.artistId);
        
        const trackContainer = document.getElementById('artist-top-tracks');
        if (trackContainer) {
            tracks.slice(0, 5).forEach((t, i) => {
                trackContainer.innerHTML += `
                    <div class="flex items-center gap-4 py-2 border-b border-[var(--border-subtle)]" onclick="Queue.set([${this.esc(t)}])">
                        <span class="text-xs font-mono w-4 opacity-50">${i+1}</span>
                        <div class="flex-1 font-bold text-sm text-[var(--text-secondary)]">${Security.safeText(t.trackName)}</div>
                    </div>
                `;
            });
        }
        
        const albumContainer = document.getElementById('artist-albums');
        if (albumContainer && albums.length > 1) {
            albums.slice(1).forEach(a => {
                albumContainer.innerHTML += `
                    <div class="space-y-2" onclick="UI.openAlbum('${a.collectionId}', '${Security.escapeHtml(a.collectionName).replace(/'/g, "\\'")}', '${a.artworkUrl100}')">
                        <img src="${a.artworkUrl100.replace('100x100','300x300')}" class="w-full aspect-square rounded-xl shadow-lg">
                        <p class="text-xs font-bold truncate text-[var(--text-primary)]">${Security.safeText(a.collectionName)}</p>
                    </div>
                `;
            });
        }
    },

    async openAlbum(id, name, art) {
        Router.go('list', {type: 'album', id: id});
        const hero = document.getElementById('list-hero');
        const list = document.getElementById('list-tracks');
        
        hero.innerHTML = `
            <div class="flex items-end gap-4 animate-slide-up">
                <img src="${art.replace('100x100','300x300')}" class="w-28 h-28 rounded-xl shadow-2xl">
                <div>
                    <h1 class="text-xl font-black leading-tight text-[var(--text-primary)]">${Security.safeText(name)}</h1>
                    <p class="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Album</p>
                </div>
            </div>
        `;
        list.innerHTML = '<div class="py-10 text-center"><div class="animate-spin w-6 h-6 border-2 border-current rounded-full inline-block"></div></div>';
        
        const tracks = await API.getAlbumTracks(id);
        list.innerHTML = '';
        tracks.forEach((t, i) => {
            list.innerHTML += `
                <div class="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)]" onclick="Queue.set([${this.esc(t)}])">
                    <span class="text-xs font-mono w-4 opacity-50">${i+1}</span>
                    <div class="flex-1 font-bold text-sm text-[var(--text-secondary)]">${Security.safeText(t.trackName)}</div>
                </div>
            `;
        });
    },

    updatePlayerUI() {
        const t = State.currentTrack;
        if (!t) return;
        
        document.getElementById('mini-player').classList.remove('hidden');
        document.getElementById('mini-title').innerText = Security.unescapeHtml(t.trackName);
        document.getElementById('mini-artist').innerText = Security.unescapeHtml(t.artistName);
        document.getElementById('mini-art').src = t.artworkUrl100;
        
        document.getElementById('player-title').innerText = Security.unescapeHtml(t.trackName);
        document.getElementById('player-artist').innerText = Security.unescapeHtml(t.artistName);
        document.getElementById('player-art').src = t.artworkUrl100.replace('100x100', '600x600');
        
        const isLiked = State.favorites.some(f => f.trackId === t.trackId);
        const likeBtn = document.getElementById('like-btn');
        if (likeBtn) {
            const colorClass = isLiked ? (State.preferences.lightMode ? 'text-black' : 'text-white') : 'text-[var(--text-tertiary)]';
            likeBtn.innerHTML = `<i data-lucide="heart" class="w-6 h-6 ${isLiked ? 'fill-current' : ''} ${colorClass}"></i>`;
        }
        
        if (window.lucide) lucide.createIcons();
    },

    updatePlaybackState() {
        const icon = State.isPlaying ? 'pause' : 'play';
        document.getElementById('mini-play-icon').outerHTML = `<i id="mini-play-icon" data-lucide="${icon}" class="w-5 h-5 fill-[var(--text-primary)] text-[var(--text-primary)]"></i>`;
        document.getElementById('main-play-btn').innerHTML = `<i data-lucide="${icon}" class="w-10 h-10 fill-[var(--text-inverse)] text-[var(--text-inverse)]"></i>`;
        if(window.lucide) lucide.createIcons();
    },

    togglePlayer(show) {
        const p = document.getElementById('full-player');
        if (show) {
            p.classList.remove('hidden');
            requestAnimationFrame(() => p.classList.remove('translate-y-full'));
            let startY = 0;
            p.ontouchstart = (e) => startY = e.touches[0].clientY;
            p.ontouchmove = (e) => {
                const diff = e.touches[0].clientY - startY;
                if (diff > CONFIG.SWIPE_THRESHOLD) this.togglePlayer(false);
            };
        } else {
            p.classList.add('translate-y-full');
            setTimeout(() => p.classList.add('hidden'), 500);
        }
    },
     toggleLyrics() {
        const p = document.getElementById('lyrics-panel');
        if (p) {
            const isHidden = getComputedStyle(p).display === 'none';
            p.style.display = isHidden ? 'flex' : 'none';
        }
    },
    toggleQueue() {
        const q = document.getElementById('view-queue');
        const isHidden = q.classList.contains('queue-hidden');
        if (isHidden) {
            q.classList.remove('queue-hidden');
            q.classList.add('queue-visible');
            this.renderQueuePage();
        } else {
            q.classList.remove('queue-visible');
            q.classList.add('queue-hidden');
        }
    },
     openArtistFromPlayer() {
        if (State.currentTrack) UI.openArtistProfile(State.currentTrack);
    },
      toggleFollow(id, name) {
        const idx = State.followedArtists.findIndex(a => a.name === name);
        const btn = document.getElementById('follow-btn');
        if (idx > -1) {
            State.followedArtists.splice(idx, 1);
            if (btn) {
                btn.innerText = "Follow";
                btn.className = "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition surface text-[var(--text-primary)] border border-[var(--border-default)]";
            }
            UI.toast(`Unfollowed ${name}`);
        } else {
            State.followedArtists.push({ id, name });
            if (btn) {
                btn.innerText = "Following";
                btn.className = "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition bg-[var(--text-primary)] text-[var(--text-inverse)]";
            }
            UI.toast(`Following ${name}`);
        }
        Database.saveFollowed(State.followedArtists);
        this.renderLibrary();
    },

    blockCurrentArtist() {
        if (!State.currentTrack) return;
        this.blockArtist(State.currentTrack.artistName);
    },

    blockArtist(name) {
        if (!State.blockedArtists.includes(name)) {
            State.blockedArtists.push(name);
            Database.saveList('blocked', State.blockedArtists);
            UI.triggerAlert("Artist Blocked", `${name} has been removed from discovery.`);
            // Reload current view if needed
            if (State.currentContextParams && State.currentContextParams.type === 'artist') {
                this.openArtistProfile(State.currentContextParams);
            } else {
                // Refresh home to remove blocked items
                this.loadHomeData();
            }
        }
    },

    dislikeSong() {
        if (!State.currentTrack) return;
        if (!State.dislikedSongs.some(d => d.trackId === State.currentTrack.trackId)) {
            State.dislikedSongs.push(State.currentTrack);
            Database.saveList('disliked', State.dislikedSongs);
            UI.toast("Song Disliked");
            Queue.next();
        }
    },
     showWrapped() {
        if (Wrapped.calculate()) {
            State.wrapped.slide = 0;
            Wrapped.renderSlide();
            const modal = document.getElementById('wrapped-modal');
            if (modal) modal.classList.remove('hidden');
            const btn = document.getElementById('wrapped-next-btn');
            if (btn) {
                btn.innerText = "Next";
                btn.onclick = () => Wrapped.nextSlide();
            }
        }
    },
     openAddToPlaylist() {
        if (!State.currentTrack) return;
        const list = document.getElementById('playlist-select-list');
        if (!list) return;
        list.innerHTML = '';
        if (State.playlists.length === 0) {
            list.innerHTML = '<p class="text-xs text-center mt-10 font-bold uppercase opacity-50">No Playlists</p><button onclick="UI.showCreatePlaylist()" class="w-full mt-4 py-3 bg-[var(--text-primary)] text-[var(--text-inverse)] text-xs font-bold uppercase rounded-lg">Create One</button>';
        } else {
            State.playlists.forEach(pl => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left p-4 surface rounded-xl flex items-center justify-between border border-[var(--border-subtle)] mb-2 hover:bg-[var(--bg-surface-hover)] transition';
                btn.innerHTML = `<span class="font-bold text-sm" style="color: var(--text-primary);">${Security.escapeHtml(pl.name)}</span> <span class="text-[10px] font-bold" style="color: var(--text-tertiary);">${pl.tracks.length} Songs</span>`;
                btn.onclick = () => Library.addToPlaylist(pl.id);
                list.appendChild(btn);
            });
        }
        const modal = document.getElementById('modal-add-playlist');
        if (modal) modal.classList.remove('hidden');
    },
    showCreatePlaylist() {
        UI.triggerPrompt('Create Playlist', 'Enter playlist name', (name) => Library.createPlaylist(name));
    },
    renderQueuePage() {
        const list = document.getElementById('queue-up-next-list');
        list.innerHTML = '';
        State.queue.slice(Queue.index + 1).forEach((t, i) => {
            list.innerHTML += `
                <div class="flex items-center gap-4 p-3 surface rounded-xl mb-2" onclick="Queue.set(State.queue, ${Queue.index + 1 + i})">
                    <img src="${t.artworkUrl100}" class="w-10 h-10 rounded-lg">
                    <div class="min-w-0">
                        <p class="text-xs font-bold truncate text-[var(--text-primary)]">${Security.safeText(t.trackName)}</p>
                        <p class="text-[9px] font-bold uppercase truncate text-[var(--text-tertiary)]">${Security.safeText(t.artistName)}</p>
                    </div>
                </div>
            `;
        });
        
        const t = State.currentTrack;
        if (t) {
            document.getElementById('queue-now-playing').innerHTML = `
                <img src="${t.artworkUrl100}" class="w-20 h-20 rounded-xl shadow-lg">
                <div>
                    <p class="text-xs font-bold uppercase text-[var(--accent-secondary)] mb-1">Playing Now</p>
                    <h2 class="text-lg font-black text-[var(--text-primary)]">${Security.safeText(t.trackName)}</h2>
                    <p class="text-xs font-bold text-[var(--text-tertiary)]">${Security.safeText(t.artistName)}</p>
                </div>
            `;
        }
    },

    openSettings() { 
        document.getElementById('modal-settings').classList.remove('hidden'); 
        // Inject dynamic buttons if needed (Changelog / Bug Report)
        this.addSettingLinks();
    },
    closeSettings() { document.getElementById('modal-settings').classList.add('hidden'); },
    
    addSettingLinks() {
        // Find a place to inject or ensure they exist
        // This is a dynamic injection for the requested Changelog/Bug links
        const container = document.querySelector('#modal-settings .overflow-y-auto');
        if (!document.getElementById('setting-extra-links')) {
            const extra = document.createElement('div');
            extra.id = 'setting-extra-links';
            extra.className = 'pt-4 space-y-2';
            extra.innerHTML = `
                <h3 class="text-xs font-bold uppercase tracking-widest ml-2 text-[var(--text-tertiary)]">Support</h3>
                <button onclick="UI.showChangelog()" class="w-full text-left p-4 rounded-xl surface text-sm font-bold uppercase tracking-wider hover:bg-[var(--bg-surface-hover)] transition">Changelog</button>
                <button onclick="UI.showReportBug()" class="w-full text-left p-4 rounded-xl surface text-sm font-bold uppercase tracking-wider hover:bg-[var(--bg-surface-hover)] transition">Report a Bug</button>
            `;
            // Insert before the Data section (last element usually)
            container.insertBefore(extra, container.lastElementChild);
        }
    },
    
    showChangelog() {
        UI.triggerAlert("Changelog v2.6", "• Added Podcast Support\n• New Developer Mode\n• Enhanced Light Mode\n• Improved Swipe Gestures\n• Security Updates");
    },
    
    showReportBug() {
        UI.triggerPrompt("Report Issue", "Describe the bug...", (val) => {
            Log.warn('BugReport', val);
            UI.toast("Report Sent. Thank you.");
        });
    },

    toggleSetting(key, el) {
        State.preferences[key] = !State.preferences[key];
        Database.save('preferences', State.preferences);
        el.classList.toggle('active');
        if (key === 'viz') this.initVisualizer();
    },

    toggleLightMode(el) {
        State.preferences.lightMode = !State.preferences.lightMode;
        document.body.classList.toggle('light-mode');
        Database.save('preferences', State.preferences);
        el.classList.toggle('active');
        UI.toast(State.preferences.lightMode ? "Light Mode Active" : "Dark Mode Active");
        this.updatePlayerUI(); 
    },

    renderLibrary() {
        const list = document.getElementById('library-list');
        if (!list) return;
        
        const card = (icon, title, count, onClick, color) => `
            <div class="flex items-center gap-4 p-4 surface rounded-2xl mb-3 active:scale-95 transition" onclick="${onClick}">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center ${color}">
                    <i data-lucide="${icon}" class="w-6 h-6 text-white"></i>
                </div>
                <div>
                    <h4 class="text-sm font-bold text-[var(--text-primary)]">${title}</h4>
                    <p class="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">${count}</p>
                </div>
            </div>
        `;
        
        list.innerHTML = `
            ${card('heart', 'Liked Songs', `${State.favorites.length} Tracks`, 'UI.renderLikedSongs()', 'bg-gradient-to-br from-pink-500 to-red-600')}
            ${card('mic-2', 'Following', `${State.followedArtists.length} Artists`, 'UI.renderFollowing()', 'bg-gradient-to-br from-purple-500 to-indigo-600')}
            ${card('hard-drive', 'Local Files', `${State.localFiles.length} Files`, 'UI.renderLocalLibrary()', 'bg-gradient-to-br from-emerald-500 to-teal-600')}
            ${card('folder', 'Playlists', `${State.playlists.length} Lists`, 'UI.renderPlaylists()', 'bg-gradient-to-br from-blue-500 to-cyan-600')}
            ${card('rss', 'Podcasts', 'New', 'Router.go(\'podcasts\')', 'bg-gradient-to-br from-orange-500 to-yellow-600')}
        `;
        
        if (window.lucide) lucide.createIcons();
    },
    
    renderDevDashboard() {
        if (document.getElementById('dev-dashboard')) return;
        const div = document.createElement('div');
        div.id = 'dev-dashboard';
        div.className = 'fixed top-20 right-4 w-64 bg-black/90 text-green-400 font-mono text-[10px] p-2 rounded border border-green-900 z-[9999] pointer-events-auto';
        div.innerHTML = `
            <div class="flex justify-between border-b border-green-900 pb-1 mb-1">
                <strong>DEV CONSOLE</strong>
                <button onclick="UI.toggleDevMode()">X</button>
            </div>
            <div id="dev-logs" class="h-32 overflow-y-auto mb-2"></div>
            <div>MEM: <span id="dev-mem">--</span></div>
            <div>STATE: ${State.isPlaying ? 'PLAY' : 'PAUSE'}</div>
            <button onclick="Log.exportLogs()" class="mt-1 w-full border border-green-900 hover:bg-green-900/50">EXPORT LOGS</button>
        `;
        document.body.appendChild(div);
        
        // Log stream
        Log.subscribe((entry) => {
            const l = document.getElementById('dev-logs');
            if(l) {
                l.innerHTML += `<div>> ${entry.msg}</div>`;
                l.scrollTop = l.scrollHeight;
            }
        });
        
        // Mem update
        setInterval(() => {
            const mem = performance.memory;
            if (mem && document.getElementById('dev-mem')) {
                document.getElementById('dev-mem').innerText = Math.round(mem.usedJSHeapSize / 1024 / 1024) + "MB";
            }
        }, 1000);
    },
    
    renderLikedSongs() {
        Router.go('list', {type: 'liked'});
        document.getElementById('list-hero').innerHTML = `<h1 class="text-3xl font-black text-[var(--text-primary)] mb-4">Liked Songs</h1>`;
        const list = document.getElementById('list-tracks');
        list.innerHTML = State.favorites.map((t, i) => `
            <div class="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)]" onclick="Queue.set([${this.esc(t)}])">
                <span class="text-xs font-mono w-4 opacity-50">${i+1}</span>
                <div class="flex-1 font-bold text-sm text-[var(--text-secondary)]">${Security.safeText(t.trackName)}</div>
                <button onclick="event.stopPropagation(); Library.toggleLike(State.favorites[${i}])" class="text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `).join('');
        if(window.lucide) lucide.createIcons();
    },
    
    renderFollowing() {
        Router.go('list', {type: 'following'});
        document.getElementById('list-hero').innerHTML = `<h1 class="text-3xl font-black text-[var(--text-primary)] mb-4">Following</h1>`;
        const list = document.getElementById('list-tracks');
        list.innerHTML = State.followedArtists.map(a => `
             <div class="flex items-center gap-4 p-3 surface rounded-xl mb-2" onclick="UI.openArtistProfile({artistName:'${Security.escapeHtml(a.name).replace(/'/g, "\\'")}', artistId:'${a.id}'})">
                <div class="w-10 h-10 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center"><i data-lucide="user" class="w-5 h-5"></i></div>
                <p class="font-bold text-sm text-[var(--text-primary)]">${Security.safeText(a.name)}</p>
             </div>
        `).join('');
        if(window.lucide) lucide.createIcons();
    },

    renderLocalLibrary() {
        Router.go('list', {type: 'local'});
        document.getElementById('list-hero').innerHTML = `
            <div class="flex justify-between items-end mb-4">
                <h1 class="text-3xl font-black text-[var(--text-primary)]">Local Files</h1>
                <div class="flex gap-2">
                    <button onclick="LocalFiles.triggerFile()" class="p-2 surface rounded-full"><i data-lucide="file-plus" class="w-4 h-4"></i></button>
                    <button onclick="LocalFiles.triggerFolder()" class="p-2 surface rounded-full"><i data-lucide="folder-plus" class="w-4 h-4"></i></button>
                </div>
            </div>`;
            
        const list = document.getElementById('list-tracks');
        if (State.localFiles.length === 0) {
            list.innerHTML = `<div class="text-center py-10 opacity-50">
                <p class="text-sm font-bold">No Local Files</p>
                <p class="text-xs">Import MP3, WAV, or Folders</p>
            </div>`;
        } else {
            list.innerHTML = State.localFiles.map((t, i) => `
                <div class="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)]" onclick="Queue.set([${this.esc(t)}])">
                    <i data-lucide="music" class="w-4 h-4 opacity-50"></i>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-sm text-[var(--text-primary)] truncate">${Security.safeText(t.trackName)}</p>
                        <p class="text-xs opacity-50 truncate">${Security.safeText(t.collectionName)}</p>
                    </div>
                </div>
            `).join('');
        }
        if(window.lucide) lucide.createIcons();
    },
    
    // --- ACTIONS & UTILS ---
    switchView(id) { Router.switch(id); }, // Proxy for Podcasts module

    toast(msg) {
        const t = document.getElementById('toast');
        if (t) {
            t.innerText = msg;
            t.style.opacity = '1';
            t.style.transform = 'translate(-50%, 0px)';
            setTimeout(() => {
                t.style.opacity = '0';
                t.style.transform = 'translate(-50%, -20px)';
            }, 2500);
        }
    },
    
    triggerConfirm(title, msg, onYes) {
        const c = document.getElementById('ui-confirm');
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-msg').innerText = msg;
        
        const btn = document.getElementById('confirm-yes-btn');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            onYes();
            c.classList.remove('active');
        });
        
        c.classList.add('active');
    },
    
    triggerPrompt(title, placeholder, onSubmit) {
        // Simple prompt shim using confirm modal structure
        const p = document.getElementById('ui-prompt');
        if (p) {
            document.getElementById('prompt-title').innerText = title;
            const input = document.getElementById('prompt-input');
            input.placeholder = placeholder;
            input.value = '';
            
            const btn = document.getElementById('prompt-yes-btn');
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                onSubmit(input.value);
                p.classList.remove('active');
            });
            p.classList.add('active');
        } else {
            // Fallback
            const val = prompt(title, placeholder);
            if (val) onSubmit(val);
        }
    },
    
    closePrompt() {
        const p = document.getElementById('ui-prompt');
        if (p) p.classList.remove('active');
    },
    
    triggerAlert(title, msg) {
        const c = document.getElementById('ui-alert');
        if (c) {
            document.getElementById('alert-title').innerText = title;
            document.getElementById('alert-msg').innerText = msg;
            c.classList.add('active');
        } else {
            alert(`${title}\n${msg}`);
        }
    },
    closeAlert() {
        const c = document.getElementById('ui-alert');
        if(c) c.classList.remove('active');
    },

    closeConfirm() { document.getElementById('ui-confirm').classList.remove('active'); },

    esc(obj) { return JSON.stringify(obj).replace(/"/g, '&quot;'); },
    
    initVisualizer() {
        const canvas = document.getElementById('viz-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        let width, height;
        const resize = () => {
            if(!canvas.parentElement) return;
            width = canvas.width = canvas.parentElement.offsetWidth;
            height = canvas.height = canvas.parentElement.offsetHeight;
        };
        window.addEventListener('resize', resize);
        setInterval(resize, 1000); 

        const draw = () => {
            requestAnimationFrame(draw);
            
            // Logic: Check Viz Toggle & Lyrics Visibility
            if(!State.preferences.viz) { 
                ctx.clearRect(0,0,width,height); 
                return; 
            }

            ctx.clearRect(0, 0, width, height);
            const lyricsPanel = document.getElementById('lyrics-panel');
            const isLyricsVisible = !lyricsPanel.classList.contains('hidden') && State.isPlaying;
            
            let opacity = State.preferences.vizOpacity || 1.0;
            let lineWidth = 1.5;
            
            if (isLyricsVisible) {
                opacity *= 0.5; // Fade out significantly
                lineWidth = 1; // Thinner lines
            }

            if (State.isPlaying && AudioEngine.analyser && !State.isLINKMode) {
                const bufferLength = AudioEngine.analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                AudioEngine.analyser.getByteTimeDomainData(dataArray);
                
                ctx.lineWidth = lineWidth;
              if (State.preferences.lightMode) { ctx.strokeStyle = `black`; } else { ctx.strokeStyle = `white`; }
                ctx.beginPath();
                const sliceWidth = width * 1.0 / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * height / 2;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    x += sliceWidth;
                }
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.stroke();
            }
        };
        draw();
    },

};

const Onboarding = {
    async check() {
        const user = await Database.get('user_name');
        if (!user) {
            document.getElementById('onboarding-layer').classList.remove('hidden');
            return false;
        }
        return true;
    },
    finish() {
        const name = document.getElementById('survey-name').value;
        const check = Security.validateUsername(name);
        if(!check.valid) { UI.toast(check.reason); return; }
        
        const genre = document.getElementById('ob-genre-select').value;
        State.preferences.favoriteGenre = genre;
        
        Database.save('user_name', name);
        Database.save('preferences', State.preferences).then(() => location.reload());
    }
};

window.onload = UI.init.bind(UI);

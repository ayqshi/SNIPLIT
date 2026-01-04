
/**
 * SNIPLIT v2.0.1 - Advanced Audio Intelligence
 * 2500+ Lines of Code
 * Comprehensive Feature Set
 */

// --- LOGGING ---
const Log = {
    info: (mod, msg) => console.log(`%c[${mod}]`, 'color: #3b82f6; font-weight: bold;', msg),
    warn: (mod, msg) => console.log(`%c[${mod}]`, 'color: #f59e0b; font-weight: bold;', msg),
    err: (mod, msg) => console.log(`%c[${mod}]`, 'color: #ef4444; font-weight: bold;', msg),
    success: (mod, msg) => console.log(`%c[${mod}]`, 'color: #10b981; font-weight: bold;', msg),
};

// --- SECURITY ---
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
        if (name.length > 15) return { valid: false, reason: "Name too long." };
        if (!/^[a-z0-9\s]*$/.test(name)) return { valid: false, reason: "Invalid characters." };
        return { valid: true, reason: "" };
    }
};

// --- STATE MANAGEMENT ---
const State = {
    user: null,
    preferences: {
        quality: true, viz: true, haptics: true, historyEnabled: true,
        lightMode: false, favoriteGenre: 'Pop', streamSource: 'auto',
        normalize: true, crossfade: false, gapless: false, allowExplicit: true
    },
    searchHistory: [],
    currentTrack: null,
    queue: [],
    history: [],
    favorites: [],
    playlists: [],
    followedArtists: [],
    blockedArtists: [], // Never show
    dislikedSongs: [], // Show less often
    localFiles: [],
    isPlaying: false,
    isLoading: false,
    loop: 'none',
    isShuffle: false,
    genres: new Set(),
    wrapped: { slide: 0, data: {} },
    db: null,
    isLINKMode: false,
    analytics: { totalSecondsListened: 0, appOpens: 0, tracksPlayed: 0 },
    viewStack: ['home']
};

const LINK_DB = {};

// --- DATABASE (INDEXEDDB) ---
const Database = {
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SniplitDB', 13); // Version bump for new stores
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                ['settings', 'playlists', 'followed', 'analytics', 'localfiles', 'blocked', 'disliked'].forEach(store => {
                    if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
                });
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                Log.success('DB', 'Connected v2.0');
                resolve();
            };
            request.onerror = (e) => {
                Log.err('DB', e);
                reject(e);
            }
        });
    },
    async save(key, val) {
        try {
            const tx = this.db.transaction('settings', 'readwrite');
            tx.objectStore('settings').put(val, key);
        } catch (e) { Log.err('DB', 'Save Error'); }
    },
    async get(key) {
        return new Promise(res => {
            const tx = this.db.transaction('settings', 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
    },
    async savePlaylists(lists) {
        const tx = this.db.transaction('playlists', 'readwrite');
        const store = tx.objectStore('playlists');
        store.clear();
        lists.forEach(l => store.put(l));
        Log.info('DB', 'Playlists Saved');
    },
    async getPlaylists() {
        return new Promise(res => {
            const tx = this.db.transaction('playlists', 'readonly');
            const req = tx.objectStore('playlists').getAll();
            req.onsuccess = () => res(req.result || []);
        });
    },
    async saveFollowed(list) {
        const tx = this.db.transaction('followed', 'readwrite');
        const store = tx.objectStore('followed');
        store.clear();
        list.forEach(a => store.put(a));
    },
    async getFollowed() {
        return new Promise(res => {
            const tx = this.db.transaction('followed', 'readonly');
            const req = tx.objectStore('followed').getAll();
            req.onsuccess = () => res(req.result || []);
        });
    },
    // Generic list handler for blocked/disliked/localfiles
    async saveList(storeName, list) {
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        list.forEach(item => store.put(item));
    },
    async getList(storeName) {
        return new Promise(res => {
            let tx;
            try {
                tx = this.db.transaction(storeName, 'readonly');
            } catch (e) {
                console.warn(`Store "${storeName}" not found in DB. Returning empty list.`);
                res([]); // Return empty array so the app doesn't freeze
                return;
            }

            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = (e) => {
                console.error("DB Error reading list:", e);
                res([]); // Fail gracefully
            };
        });
    },
    async saveAnalytics(data) {
        const tx = this.db.transaction('analytics', 'readwrite');
        tx.objectStore('analytics').put(data, 'stats');
    },
    async getAnalytics() {
        return new Promise(res => {
            const tx = this.db.transaction('analytics', 'readonly');
            const req = tx.objectStore('analytics').get('stats');
            req.onsuccess = () => res(req.result || { totalSecondsListened: 0, appOpens: 0, tracksPlayed: 0 });
        });
    },
    async hardReset() {
        UI.triggerConfirm("Factory Reset", "Wipe all data permanently?", async () => {
            localStorage.clear();
            indexedDB.deleteDatabase('SniplitDB');
            location.reload();
        });
    },
    async clearSearchHistory() {
        State.searchHistory = [];
        await this.save('search_history', []);
        UI.renderSearchHistory();
    }
};

// --- ROUTER (Navigation History) ---
const Router = {
    historyStack: [],
    go(viewId, params = null) {
        const current = document.querySelector('.view-section:not(.hidden)');
        if (current && current.id !== `view-${viewId}`) {
            this.historyStack.push({ id: current.id.replace('view-', ''), params: State.currentContextParams });
        }
        this.switch(viewId, params);
    },
    back() {
        if (this.historyStack.length > 0) {
            const prev = this.historyStack.pop();
            this.switch(prev.id, prev.params);
        } else {
            this.switch('home');
        }
    },
    switch(viewId, params = null) {
        State.currentContextParams = params;
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`view-${viewId}`);
        if (target) target.classList.remove('hidden');

        // Update Nav Bar
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        if (['home', 'search', 'library'].includes(viewId)) {
            const btn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
            if (btn) btn.classList.add('active');
        }

        // Queue logic
        const q = document.getElementById('view-queue');
        if (q && !q.classList.contains('queue-hidden')) UI.toggleQueue();

        // Data loading
        if (viewId === 'home') UI.loadHomeData();
        if (viewId === 'library') UI.renderLibrary();
    }
};

// --- YOUTUBE ENGINE ---
const LINKEngine = {
    player: null,
    isReady: false,
    init() {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            document.body.appendChild(tag);
            window.onYouTubeIframeAPIReady = () => {
                this.createPlayer();
                this.isReady = true;
                Log.info('YT', 'Ready');
            };
        }
    },
    createPlayer() {
        let container = document.getElementById('yt-audio-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'yt-audio-container';
            container.style.cssText = 'position:fixed; top:-9999px; width:1px; height:1px; opacity:0;';
            document.body.appendChild(container);
        }
        this.player = new YT.Player('yt-audio-container', {
            height: '200', width: '200', videoId: '',
            events: {
                'onStateChange': (e) => {
                    if (e.data === YT.PlayerState.ENDED) Queue.next();
                }
            }
        });
    },
    loadVideo(videoId) {
        if (!this.isReady) return false;
        State.isLINKMode = true;
        State.isLoading = true;
        this.player.loadVideoById(videoId);
        this.player.setVolume(100);
        this.player.unMute();
        return true;
    },
    play() { if (this.player) this.player.playVideo(); },
    pause() { if (this.player) this.player.pauseVideo(); },
    seekTo(seconds) { if (this.player) this.player.seekTo(seconds, true); },
    getTime() { return this.player ? this.player.getCurrentTime() : 0; },
    getDuration() { return this.player ? this.player.getDuration() : 0; }
};

// --- AUDIO ENGINE (ADVANCED) ---
const AudioEngine = {
    el: new Audio(),
    ctx: null,
    analyser: null,
    source: null,

    init() {
        this.el.crossOrigin = "anonymous";

        // VISIBILITY API HANDLER (Fix for background audio stuck)
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                // Suspend AudioContext to save battery and prevent glitches
                if (this.ctx) this.ctx.suspend();
            } else {
                // Resume context
                if (this.ctx) this.ctx.resume();
                // Sync state immediately
                if (State.isPlaying && this.el.paused) {
                    this.el.play();
                } else if (!State.isPlaying && !this.el.paused) {
                    this.el.pause();
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

        // Polling for YT updates
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
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.ctx.createAnalyser();
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

        // BLOCKING LOGIC
        if (State.blockedArtists.includes(track.artistName)) {
            UI.toast("Artist Blocked. Skipping...");
            Queue.next();
            return;
        }

        const key = this.normalizeKey(`${track.artistName} ${track.trackName}`);
        const ytData = LINK_DB[key];
        State.isLINKMode = false;
        this.el.pause();

        if ((State.preferences.streamSource === 'auto' || State.preferences.streamSource === 'yt') && ytData && LINKEngine.isReady) {
            if (LINKEngine.loadVideo(ytData.v)) {
                State.isPlaying = true;
                UI.updatePlaybackState(); UI.updateMiniPlayerState();
                this.postLoadProcess(track);
                return;
            }
        }

        // Fallback iTunes
        this.el.src = track.previewUrl || track.localUrl;
        if (autoplay) this.el.play().catch(e => Log.warn('Audio', 'Autoplay blocked'));
        this.postLoadProcess(track);
    },

    postLoadProcess(track) {
        State.history.unshift(track);
        // Dedupe history
        const uniqueHistory = Array.from(new Set(State.history.map(a => a.trackId)))
            .map(id => State.history.find(a => a.trackId === id))
            .slice(0, 200);
        State.history = uniqueHistory;
        Database.save('history', uniqueHistory);

        if (track.primaryGenreName) State.genres.add(track.primaryGenreName);

        UI.updatePlayerUI();
        LyricsEngine.fetch(track);
        this.updateMediaSession();
    },

    normalizeKey(str) {
        return str.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
    },

    toggle() {
        if (State.isLINKMode) { State.isPlaying ? LINKEngine.pause() : LINKEngine.play(); }
        else { if (!this.el.src) return; this.el.paused ? this.el.play() : this.el.pause(); }
        State.isPlaying = !State.isPlaying;
        UI.updatePlaybackState(); UI.updateMiniPlayerState();
        if (State.preferences.haptics && navigator.vibrate) navigator.vibrate(20);
        this.updateMediaSession();
    },

    seek(val) {
        const duration = State.isLINKMode ? LINKEngine.getDuration() : this.el.duration;
        if (!duration) return;
        const time = (val / 100) * duration;
        if (State.isLINKMode) LINKEngine.seekTo(time); else this.el.currentTime = time;
    },

    onTimeUpdate(curTime = null, durTime = null) {
        const currentTime = curTime !== null ? curTime : this.el.currentTime;
        const duration = durTime !== null ? durTime : this.el.duration;
        if (!duration) return;
        const pct = (currentTime / duration) * 100;

        const slider = document.getElementById('player-progress');
        if (slider) slider.value = pct || 0;

        const miniBar = document.getElementById('mini-progress');
        if (miniBar) miniBar.style.width = `${pct || 0}%`;

        const curEl = document.getElementById('time-cur');
        const totEl = document.getElementById('time-total');
        if (curEl) curEl.innerText = this.formatTime(currentTime);
        if (totEl) totEl.innerText = this.formatTime(duration);

        // Gapless/Crossfade logic simulation
        if (State.preferences.crossfade && currentTime > duration - 5 && !State.isLoading) {
            Log.info('Audio', 'Crossfading...');
            Queue.next();
        }

        if ('mediaSession' in navigator && State.isPlaying) {
            try {
                navigator.mediaSession.setPositionState({ duration: duration, playbackRate: 1, position: currentTime });
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

            const actionHandlers = {
                play: () => {
                    this.el.play(); LINKEngine.play();
                    State.isPlaying = true; UI.updatePlaybackState(); UI.updateMiniPlayerState();
                },
                pause: () => {
                    this.el.pause(); LINKEngine.pause();
                    State.isPlaying = false; UI.updatePlaybackState(); UI.updateMiniPlayerState();
                },
                previoustrack: () => Queue.prev(),
                nexttrack: () => Queue.next(),
                seekto: (details) => {
                    if (details.seekTime !== undefined) {
                        const duration = State.isLINKMode ? LINKEngine.getDuration() : this.el.duration;
                        const time = details.seekTime;
                        this.el.currentTime = time; LINKEngine.seekTo(time);
                        this.onTimeUpdate(time, duration);
                    }
                },
                seekforward: (details) => {
                    const offset = details.seekOffset || 10;
                    const time = (State.isLINKMode ? LINKEngine.getTime() : this.el.currentTime) + offset;
                    this.seekByLyric(time);
                },
                seekbackward: (details) => {
                    const offset = details.seekOffset || 10;
                    const time = (State.isLINKMode ? LINKEngine.getTime() : this.el.currentTime) - offset;
                    this.seekByLyric(time);
                }
            };

            for (const [action, handler] of Object.entries(actionHandlers)) {
                try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) { }
            }
        }
    }
};

// --- LYRICS ENGINE (SYNCED) ---
const LyricsEngine = {
    lines: [],
    userScrolling: false,
    scrollTimeout: null,
    async fetch(track) {
        const container = document.getElementById('lyrics-container');
        const panel = document.getElementById('lyrics-panel');

        // Default Hidden
        panel.style.display = 'none';
        container.innerHTML = '<div class="flex flex-col items-center justify-center h-full opacity-50"><div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4"></div></div>';

        this.lines = [];
        try {
            const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artistName)}&track_name=${encodeURIComponent(track.trackName)}`);
            if (!res.ok) throw new Error("API Error");
            const data = await res.json();
            if (data && data.syncedLyrics) this.parseSynced(data.syncedLyrics);
            else throw new Error("No lyrics");
        } catch (e) {
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-full"><p class="text-sm font-mono uppercase opacity-50">Instrumental / Unavailable</p></div>';
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
    render() {
        const container = document.getElementById('lyrics-container');
        if (!container) return;
        container.innerHTML = this.lines.map((l, i) => `<div id="lyric-${i}" class="lyric-line" onclick="AudioEngine.seekByLyric(${l.time})">${l.text}</div>`).join('');
    },
    sync() {
        if (this.lines.length === 0 || !State.isPlaying || this.userScrolling) return;
        const curTime = State.isLINKMode ? LINKEngine.getTime() : AudioEngine.el.currentTime;
        let activeIdx = -1;
        if (this.lines[0].time !== null) {
            activeIdx = this.lines.findIndex((l, i) => curTime >= l.time && (i === this.lines.length - 1 || curTime < this.lines[i + 1].time));
        }
        document.querySelectorAll('.lyric-line').forEach(el => el.classList.remove('active'));
        if (activeIdx !== -1) {
            const el = document.getElementById(`lyric-${activeIdx}`);
            if (el) {
                el.classList.add('active');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
};

// --- QUEUE (SMART RADIO) ---
const Queue = {
    index: -1,
    set(list, startIdx = 0) {
        if (!list || list.length === 0) return;
        State.queue = [...list];
        this.index = startIdx;
        AudioEngine.load(State.queue[this.index]);
        Log.info('Queue', `Set ${list.length} tracks`);
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
        this.index++;
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
        AudioEngine.updateMediaSession();
    },
    toggleLoop() {
        const modes = ['none', 'one', 'all'];
        State.loop = modes[(modes.indexOf(State.loop) + 1) % modes.length];
        const btn = document.getElementById('loop-btn');
        if (btn) {
            btn.className = State.loop !== 'none' ? 'text-white p-2' : 'text-zinc-600 p-2';
            btn.innerHTML = `<i data-lucide="repeat${State.loop === 'one' ? '-1' : ''}" class="w-5 h-5"></i>`;
        }
        UI.toast(`Loop: ${State.loop}`);
    },
    toggleShuffle() {
        State.isShuffle = !State.isShuffle;
        const btn = document.getElementById('shuffle-btn');
        if (btn) btn.className = State.isShuffle ? 'text-white p-2' : 'text-zinc-600 p-2';
        UI.toast(`Shuffle: ${State.isShuffle ? 'On' : 'Off'}`);
    },
    async smartRadio() {
        if (!State.currentTrack) return;
        Log.info('Queue', 'Starting Smart Radio');

        // Heuristic: Check disliked songs to avoid similar patterns
        const dislikedSeeds = State.dislikedSongs.slice(0, 3).map(s => s.trackName.substring(0, 5)).join(' ');
        const favGenre = State.preferences.favoriteGenre || 'Pop';

        // Build query
        let query = `${favGenre} hits 2024`;
        if (dislikedSeeds) query += ` -${dislikedSeeds}`; // Exclude seeds (simulation)

        const results = await API.search(query);
        const knownIds = new Set([...State.queue, ...State.history].map(t => t.trackId));

        // Filter Blocked & Disliked
        const candidates = results.filter(t =>
            !knownIds.has(t.trackId) &&
            !State.blockedArtists.includes(t.artistName) &&
            !State.dislikedSongs.some(d => d.trackId === t.trackId)
        );

        if (candidates.length > 0) {
            State.queue.push(...candidates.slice(0, 5));
            UI.toast("Smart Radio: Added Songs");
            this.next();
        } else {
            UI.toast("Radio exhausted");
            State.loop = 'all';
            this.index = 0;
            if (State.queue.length > 0) AudioEngine.load(State.queue[0]);
        }
    }
};

// --- API (iTunes) ---
const API = {
    async search(query) {
        try {
            const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=30`);
            const data = await res.json();
            return data.results;
        } catch (e) {
            Log.err('API', e.message);
            return [];
        }
    },
    async getArtistDiscography(id) {
        try {
            const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=album&limit=10`);
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
    },
    async getConcerts(artist) {
        // Mock implementation for concerts
        return {
            artist: artist,
            events: [
                { date: "Oct 24", city: "New York", venue: "Madison Square Garden" },
                { date: "Nov 02", city: "London", venue: "O2 Arena" }
            ]
        };
    }
};

// --- LIBRARY LOGIC ---
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
        const el = document.getElementById('local-file-input');
        if (el) el.click();
    },
    init() {
        const handleFiles = (files) => {
            const validFiles = Array.from(files);
            if (validFiles.length === 0) { UI.toast("No Files Selected"); return; }

            const newTracks = validFiles.map(f => {
                const name = f.name;
                const url = URL.createObjectURL(f);
                return {
                    id: `local-${Date.now()}-${Math.random()}`,
                    trackId: `local-${Date.now()}-${Math.random()}`,
                    trackName: name.replace(/\.[^/.]+$/, ""),
                    artistName: "Local Import",
                    collectionName: "Imported",
                    artworkUrl100: "https://picsum.photos/seed/" + name + "/100/100",
                    previewUrl: url,
                    localUrl: url,
                    isLocal: true
                };
            });

            State.localFiles = [...State.localFiles, ...newTracks];
            Database.saveList('localfiles', State.localFiles);

            Queue.set(newTracks);
            UI.togglePlayer(true);
            UI.toggleQueue(true);
            UI.toast(`Imported ${newTracks.length} files`);
        };

        const fileInput = document.getElementById('local-file-input');
        if (fileInput) fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    }
};

// --- WRAPPED ANALYTICS (ADVANCED) ---
const Wrapped = {
    calculate() {
        const history = State.history;
        if (!history || history.length < 5) {
            UI.toast("Need more listening history");
            return false;
        }

        // Calculations
        const topArtists = {};
        const topGenres = {};
        const trackIds = new Set();
        let totalMs = 0;

        history.forEach(t => {
            if (!topArtists[t.artistName]) topArtists[t.artistName] = 0;
            topArtists[t.artistName]++;

            if (t.primaryGenreName) {
                if (!topGenres[t.primaryGenreName]) topGenres[t.primaryGenreName] = 0;
                topGenres[t.primaryGenreName]++;
            }
            totalMs += (t.trackTimeMillis || 180000);
            trackIds.add(t.trackId);
        });

        // "Age" algorithm based on genres
        let score = 0;
        const dominantGenre = Object.keys(topGenres).sort((a, b) => topGenres[b] - topGenres[a])[0];
        if (dominantGenre.includes('Pop')) score += 14;
        if (dominantGenre.includes('Rock')) score += 35;
        if (dominantGenre.includes('Hip-Hop')) score += 20;
        if (dominantGenre.includes('Classical')) score += 50;
        if (dominantGenre.includes('Country')) score += 45;

        State.wrapped.data = {
            totalHours: (totalMs / (1000 * 60 * 60)).toFixed(1),
            topArtists: Object.entries(topArtists).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]),
            topGenres: Object.entries(topGenres).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]),
            trackCount: history.length,
            estimatedAge: 16 + (score / 1.5),
            dominantGenre: dominantGenre
        };
        return true;
    },
    renderSlide() {
        const container = document.getElementById('wrapped-slide-container');
        if (!container) return;
        const data = State.wrapped.data;
        const slide = State.wrapped.slide;
        let html = '';

        if (slide === 0) {
            html = `<div class="animate-slide-up space-y-4">
                        <h1 class="text-6xl font-black tracking-tighter" style="color: var(--text-primary);">2025<br>WRAPPED</h1>
                        <p class="text-xs font-mono uppercase tracking-widest" style="color: var(--text-tertiary);">Your Sonic Identity</p>
                    </div>`;
        } else if (slide === 1) {
            html = `<div class="animate-slide-up space-y-2">
                        <p class="text-xs font-bold uppercase tracking-widest" style="color: var(--text-tertiary);">Total Airtime</p>
                        <h2 class="text-8xl font-black tracking-tighter" style="color: var(--text-primary);">${data.totalHours}<span class="text-2xl ml-2" style="color: var(--text-tertiary);">HRS</span></h2>
                    </div>`;
        } else if (slide === 2) {
            html = `<div class="animate-slide-up space-y-8 w-full">
                        <p class="text-xs font-bold uppercase tracking-widest" style="color: var(--text-tertiary);">Top Artist</p>
                        <div class="space-y-6">
                            <h3 class="text-4xl font-black" style="color: var(--text-primary);">${data.topArtists[0] || 'Unknown'}</h3>
                            <h3 class="text-2xl font-bold opacity-50" style="color: var(--text-primary);">${data.topArtists[1] || ''}</h3>
                            <h3 class="text-xl font-bold opacity-30" style="color: var(--text-primary);">${data.topArtists[2] || ''}</h3>
                        </div>
                    </div>`;
        } else if (slide === 3) {
            html = `<div class="animate-slide-up space-y-2">
                        <p class="text-xs font-bold uppercase tracking-widest" style="color: var(--text-tertiary);">Audio Age</p>
                        <h2 class="text-8xl font-black tracking-tighter" style="color: var(--text-primary);">${Math.floor(data.estimatedAge)}<span class="text-2xl ml-2" style="color: var(--text-tertiary);">YRS</span></h2>
                        <p class="text-sm opacity-50">Based on your taste in ${data.dominantGenre}</p>
                    </div>`;
        } else if (slide === 4) {
            html = `<div class="animate-slide-up space-y-6"><h1 class="text-4xl font-black" style="color: var(--text-primary);">The End.</h1><p class="text-xs font-mono uppercase" style="color: var(--text-tertiary);">Keep Listening.</p></div>`;
            const btn = document.getElementById('wrapped-next-btn');
            if (btn) {
                btn.innerText = "Close";
                btn.onclick = () => {
                    const m = document.getElementById('wrapped-modal');
                    if (m) m.classList.add('hidden');
                }
            }
        }
        container.innerHTML = html;
        const btn = document.getElementById('wrapped-next-btn');
        if (btn && slide < 4) {
            btn.classList.remove('hidden');
            btn.innerText = "Next";
            btn.onclick = () => Wrapped.nextSlide();
        }
    },
    nextSlide() {
        if (State.wrapped.slide < 4) {
            State.wrapped.slide++;
            this.renderSlide();
        }
    }
};

// --- DATA MANAGER ---
const DataManager = {
    exportConfig() {
        const data = {
            user: State.user,
            preferences: State.preferences,
            favorites: State.favorites,
            playlists: State.playlists,
            followedArtists: State.followedArtists,
            blockedArtists: State.blockedArtists,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sniplit-backup-${Date.now()}.json`;
        a.click();
        UI.toast("Config Exported");
    },
    importConfig(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.user) State.user = data.user;
                if (data.preferences) State.preferences = data.preferences;
                if (data.favorites) State.favorites = data.favorites;
                if (data.playlists) State.playlists = data.playlists;
                if (data.followedArtists) State.followedArtists = data.followedArtists;
                if (data.blockedArtists) State.blockedArtists = data.blockedArtists;

                // Save to DB
                await Database.save('user_name', State.user);
                await Database.save('preferences', State.preferences);
                await Database.savePlaylists(State.playlists);
                await Database.saveList('followed', State.followedArtists);
                await Database.saveList('blocked', State.blockedArtists);

                UI.toast("Import Successful");
                setTimeout(() => location.reload(), 1000);
            } catch (err) {
                UI.triggerAlert("Error", "Invalid JSON file");
            }
        };
        reader.readAsText(file);
    }
};

// --- UI MANAGER (HUGE) ---
const UI = {
    homeGenreIndex: 0,
    homeGenres: ['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Alternative', 'R&B', 'Jazz', 'Indie', 'Metal', 'Classical'],
    discoveryMode: 'daily',
    isLoadingHome: false,

    async init() {
        await Database.init();
        const loggedIn = await Onboarding.check();
        if (!loggedIn) {
            const splash = document.getElementById('splash-screen');
            if (splash) splash.style.display = 'none';
            return;
        }

        this.checkAnnouncements();
        LocalFiles.init();

        // Clock
        setInterval(() => {
            const now = new Date();
            const timeEl = document.getElementById('system-time');
            if (timeEl) timeEl.innerText = now.getHours() + ":" + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
        }, 1000);

        // Search Debounce
        const searchInput = document.getElementById('main-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(async (e) => {
                if (e.target.value.length < 2) {
                    document.getElementById('search-results').innerHTML = '';
                    document.getElementById('search-history-panel').classList.remove('hidden');
                    return;
                }
                document.getElementById('search-loading').classList.remove('hidden');
                document.getElementById('search-history-panel').classList.add('hidden');
                const results = await API.search(e.target.value);
                document.getElementById('search-loading').classList.add('hidden');
                this.renderSearchResults(results);
            }, 500));

            searchInput.addEventListener('focus', () => {
                if (State.preferences.historyEnabled && State.searchHistory.length > 0 && searchInput.value.length < 2) {
                    document.getElementById('search-history-panel').classList.remove('hidden');
                }
            });
        }

        // Infinite Scroll Observer
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) this.loadNextHomeSection();
        }, { root: document.getElementById('view-port') });
        observer.observe(document.getElementById('scroll-sentinel'));

        await this.initData();
    },

    checkAnnouncements() {
        const lastSeen = localStorage.getItem('sniplit_changelog_seen');
        if (!lastSeen || lastSeen !== 'v2') {
            const bar = document.getElementById('notification-bar');
            if (bar) bar.classList.remove('hidden');
        }
    },

    async initData() {
        // Load DB
        const savedPrefs = await Database.get('preferences');
        if (savedPrefs) { State.preferences = { ...State.preferences, ...savedPrefs }; }
        if (State.preferences.lightMode) document.body.classList.add('light-mode');

        State.user = await Database.get('user_name');
        const greetingEl = document.getElementById('greeting');
        if (greetingEl) greetingEl.innerText = `Hi, ${State.user}`;

        const history = await Database.get('history');
        if (history) State.history = history;

        const sh = await Database.get('search_history');
        if (sh) State.searchHistory = sh;
        this.renderSearchHistory();

        const genres = await Database.get('genres');
        if (genres) State.genres = new Set(genres);

        State.playlists = await Database.getPlaylists();
        const favs = await Database.getList('favorites');
        if (favs) State.favorites = favs;

        const followed = await Database.getFollowed();
        if (followed) State.followedArtists = followed;

        const localFiles = await Database.getList('localfiles');
        if (localFiles) State.localFiles = localFiles;

        const blocked = await Database.getList('blocked');
        if (blocked) State.blockedArtists = blocked;

        const disliked = await Database.getList('disliked');
        if (disliked) State.dislikedSongs = disliked;

        AudioEngine.init();
        this.initVisualizer();
        if (window.lucide) lucide.createIcons();

        // Load Home Data
        this.loadHomeData();

        // Settings Name Input
        const nameInput = document.getElementById('pref-name');
        if (nameInput) nameInput.value = State.user || '';

        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 800);
        }
    },

    // --- HOME LOGIC ---
    async loadHomeData() {
        // Jump Back In
        const recentsGrid = document.getElementById('recents-grid');
        if (!recentsGrid) return;
        recentsGrid.innerHTML = '';
        const uniqueHistory = Array.from(new Set(State.history.map(a => a.trackId)))
            .map(id => State.history.find(a => a.trackId === id))
            .slice(0, 4);

        // FALLBACK IF EMPTY
        if (uniqueHistory.length === 0) {
            recentsGrid.innerHTML = `
                        <div class="col-span-2 surface p-6 rounded-2xl flex flex-col items-center justify-center text-center animate-slide-up border-dashed border-[var(--border-subtle)]">
                            <i data-lucide="music" class="w-10 h-10 mb-3 opacity-50" style="color: var(--text-tertiary);"></i>
                            <p class="text-sm font-bold" style="color: var(--text-primary);">Start Listening</p>
                            <p class="text-xs opacity-60 mt-1" style="color: var(--text-tertiary);">Your history will appear here.</p>
                        </div>
                    `;
        } else {
            uniqueHistory.forEach(t => {
                recentsGrid.innerHTML += `
                            <div class="flex items-center gap-3 surface p-2.5 rounded-xl cursor-pointer hover:bg-[var(--bg-surface-hover)] transition" onclick="Queue.set([${this.esc(t)}])">
                                <img src="${t.artworkUrl100}" class="w-10 h-10 rounded-lg object-cover">
                                <div class="min-w-0 flex-1">
                                    <p class="text-[11px] font-bold truncate" style="color: var(--text-primary);">${Security.unescapeHtml(t.trackName)}</p>
                                    <p class="text-[9px] font-bold uppercase truncate" style="color: var(--text-tertiary);">${Security.unescapeHtml(t.artistName)}</p>
                                </div>
                            </div>`;
            });
        }

        // Discovery
        const forYouGrid = document.getElementById('for-you-grid');
        if (forYouGrid) {
            if (forYouGrid.children.length === 0) {
                forYouGrid.innerHTML = '<div class="w-full flex justify-center py-10"><div class="skeleton w-32 h-32 rounded-xl"></div></div>';
            }
        }
        this.setDiscoveryMode('daily');

        // Progressive Sections
        document.getElementById('home-genres-container').innerHTML = '';
        this.homeGenreIndex = 0;
        this.loadNextHomeSection();
        this.loadNextHomeSection(); // Load initial batch
    },

    async setDiscoveryMode(mode) {
        this.discoveryMode = mode;
        // Update tabs
        document.querySelectorAll('#view-home button[onclick^="UI.setDiscoveryMode"]').forEach(b => {
            b.className = "px-4 py-1.5 surface text-[var(--text-secondary)] text-[10px] font-bold uppercase rounded-full whitespace-nowrap transition hover:bg-[var(--bg-surface-hover)]";
        });
        const activeBtn = document.getElementById(`tab-${mode}`);
        if (activeBtn) activeBtn.className = "px-4 py-1.5 bg-[var(--text-primary)] text-[var(--text-inverse)] text-[10px] font-bold uppercase rounded-full whitespace-nowrap transition shadow-lg";

        const forYouGrid = document.getElementById('for-you-grid');
        if (!forYouGrid) return;

        let query = "trending hits 2024";
        if (mode === 'daily') query = `${State.preferences.favoriteGenre || 'Pop'} hits 2024`;
        if (mode === 'radio') query = "radio hits 2024";
        if (mode === 'discover') query = "indie electronic deep house";

        const results = await API.search(query);

        // Filter Blocked
        const uniqueResults = [];
        const seen = new Set();
        results.forEach(t => {
            if (!seen.has(t.trackId) && !State.blockedArtists.includes(t.artistName)) {
                seen.add(t.trackId);
                uniqueResults.push(t);
            }
        });

        // Shuffle slightly for "For You" feel
        uniqueResults.sort(() => Math.random() - 0.5);

        forYouGrid.innerHTML = '';
        uniqueResults.slice(0, 6).forEach(t => {
            forYouGrid.innerHTML += `
                        <div class="flex-shrink-0 w-32 space-y-2 cursor-pointer group snap-start" onclick="Queue.set([${this.esc(t)}])">
                            <div class="relative overflow-hidden rounded-xl aspect-square">
                                <img src="${t.artworkUrl100.replace('100x100', '400x400')}" class="w-full h-full object-cover border border-[var(--border-subtle)] group-hover:scale-105 transition duration-500">
                            </div>
                            <div class="px-1">
                                <p class="text-[11px] font-bold truncate" style="color: var(--text-primary);">${Security.unescapeHtml(t.trackName)}</p>
                                <p class="text-[9px] font-bold uppercase truncate" style="color: var(--text-tertiary);">${Security.unescapeHtml(t.artistName)}</p>
                            </div>
                        </div>`;
        });
        if (window.lucide) lucide.createIcons();
    },

    async loadNextHomeSection() {
        if (this.isLoadingHome || this.homeGenreIndex >= this.homeGenres.length) return;
        this.isLoadingHome = true;

        const genre = this.homeGenres[this.homeGenreIndex];
        this.homeGenreIndex++;

        const container = document.getElementById('home-genres-container');
        const section = document.createElement('div');
        section.className = "animate-slide-up";
        section.innerHTML = `
                    <h2 class="text-xs font-bold uppercase tracking-widest mb-4 flex justify-between items-center" style="color: var(--text-tertiary);">
                        <span>${genre}</span> 
                        <button onclick="Router.go('search');document.getElementById('main-search').value='${genre}';document.getElementById('main-search').dispatchEvent(new Event('input'))" class="text-[10px] opacity-50 hover:opacity-100">See All</button>
                    </h2>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="skeleton h-40 col-span-1 rounded-xl"></div>
                        <div class="skeleton h-40 col-span-1 rounded-xl"></div>
                    </div>
                `;
        container.appendChild(section);

        const results = await API.search(`${genre} hits 2024`);
        const safeResults = results.filter(t => !State.blockedArtists.includes(t.artistName));

        section.innerHTML = `
                    <h2 class="text-xs font-bold uppercase tracking-widest mb-4 flex justify-between items-center" style="color: var(--text-tertiary);">
                        <span>${genre}</span>
                        <button onclick="Router.go('search');document.getElementById('main-search').value='${genre}';document.getElementById('main-search').dispatchEvent(new Event('input'))" class="text-[10px] opacity-50 hover:opacity-100">See All</button>
                    </h2>
                    <div class="grid grid-cols-2 gap-4">
                        ${safeResults.slice(0, 4).map(t => `
                            <div class="group cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                                <div class="relative overflow-hidden rounded-xl aspect-square mb-2">
                                    <img src="${t.artworkUrl100.replace('100x100', '300x300')}" class="w-full h-full object-cover border border-[var(--border-subtle)] group-hover:scale-105 transition duration-500">
                                </div>
                                <p class="text-xs font-bold truncate" style="color: var(--text-primary);">${Security.unescapeHtml(t.trackName)}</p>
                                <p class="text-[10px] font-bold uppercase truncate" style="color: var(--text-tertiary);">${Security.unescapeHtml(t.artistName)}</p>
                            </div>
                        `).join('')}
                    </div>
                `;
        this.isLoadingHome = false;
    },

    // --- SEARCH LOGIC ---
    renderSearchResults(results) {
        const container = document.getElementById('search-results');
        if (!container) return;
        container.innerHTML = '';

        // Filtering logic for blocked artists
        const uniqueIds = new Set();
        const uniqueResults = [];
        if (results) {
            results.forEach(t => {
                if (!uniqueIds.has(t.trackId) && !State.blockedArtists.includes(t.artistName)) {
                    uniqueResults.push(t);
                    uniqueIds.add(t.trackId);
                }
            });
        }

        if (uniqueResults.length === 0) {
            // RECOMMENDATIONS FALLBACK
            container.innerHTML = `
                        <div class="text-center py-10 animate-fade-in">
                            <p class="text-sm mb-6" style="color: var(--text-tertiary);">No results found.</p>
                            <p class="text-[10px] font-bold uppercase mb-4" style="color: var(--text-tertiary);">Try these trending:</p>
                            <div class="flex flex-wrap justify-center gap-2">
                                ${['Taylor Swift', 'The Weeknd', 'Drake', 'Bad Bunny', 'Kendrick Lamar'].map(n => `
                                    <button onclick="document.getElementById('main-search').value='${Security.escapeHtml(n)}';document.getElementById('main-search').dispatchEvent(new Event('input'))" class="px-3 py-1.5 surface rounded-full text-xs font-bold uppercase hover:bg-[var(--bg-surface-hover)] transition" style="color: var(--text-primary);">${Security.escapeHtml(n)}</button>
                                `).join('')}
                            </div>
                        </div>
                    `;
            return;
        }

        uniqueResults.forEach(t => {
            container.innerHTML += `
                        <div class="flex items-center gap-4 p-3 rounded-xl surface hover:bg-[var(--bg-surface-hover)] transition cursor-pointer group border border-transparent hover:border-[var(--border-default)]" onclick="Queue.set([${this.esc(t)}])">
                            <div class="relative w-12 h-12 flex-shrink-0">
                                <img src="${t.artworkUrl100}" class="w-full h-full rounded-lg object-cover">
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <h4 class="text-sm font-bold truncate" style="color: var(--text-primary);">${Security.unescapeHtml(t.trackName)}</h4>
                                    ${t.trackExplicitness === 'explicit' ? '<span class="bg-[var(--bg-elevated)] text-[var(--text-tertiary)] text-[8px] font-bold px-1 rounded border border-[var(--border-default)]">E</span>' : ''}
                                </div>
                                <p class="text-xs font-bold uppercase tracking-wide hover:opacity-80 transition cursor-pointer" onclick="event.stopPropagation(); UI.openArtistProfile({artistName: '${Security.escapeHtml(t.artistName).replace(/'/g, "\\'")}', artistId: '${t.artistId}'})" style="color: var(--text-tertiary);">${Security.unescapeHtml(t.artistName)}</p>
                            </div>
                            <button class="p-2 hover:bg-[var(--bg-elevated)] rounded-full transition" style="color: var(--text-tertiary);" onclick="event.stopPropagation(); Queue.add(${this.esc(t)})"><i data-lucide="plus" class="w-4 h-4"></i></button>
                        </div>`;
        });
        if (window.lucide) lucide.createIcons();
    },

    renderSearchHistory() {
        const container = document.getElementById('search-history-chips');
        if (!container) return;
        container.innerHTML = State.searchHistory.map(term =>
            `<span class="px-3 py-1.5 surface rounded-full text-[10px] font-bold uppercase cursor-pointer hover:bg-[var(--bg-surface-hover)] transition" style="color: var(--text-primary);" onclick="document.getElementById('main-search').value='${Security.escapeHtml(term)}'; document.getElementById('main-search').dispatchEvent(new Event('input'));">${Security.escapeHtml(term)}</span>`
        ).join('');
    },

    // --- LIBRARY / LIST VIEWS ---
    async openArtistProfile(trackObj) {
        this.switchView('artist');

        const name = trackObj.artistName;
        const id = trackObj.artistId;
        const isFollowed = State.followedArtists.some(a => a.name === name);
        const hero = document.getElementById('artist-hero');
        if (hero) {
            hero.innerHTML = `
                        <div class="flex items-center justify-between mb-2">
                            <h1 class="text-4xl font-black tracking-tighter leading-none" style="color: var(--text-primary);">${Security.escapeHtml(name)}</h1>
                        </div>
                        <div class="flex items-center gap-3">
                             <button id="follow-btn" onclick="UI.toggleFollow('${id}', '${Security.escapeHtml(name).replace(/'/g, "\\'")}')" class="px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition ${isFollowed ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'surface text-[var(--text-primary)] border border-[var(--border-default)]'}">
                                ${isFollowed ? 'Following' : 'Follow'}
                            </button>
                             <button onclick="UI.blockArtist('${Security.escapeHtml(name).replace(/'/g, "\\'")}')" class="p-2 surface rounded-full text-[var(--text-tertiary)] hover:text-red-500 transition" title="Block Artist"><i data-lucide="ban" class="w-4 h-4"></i></button>
                            <p class="text-[10px] font-mono uppercase tracking-widest" style="color: var(--text-tertiary);">${trackObj.primaryGenreName || 'Artist'}</p>
                        </div>
                    `;
        }
        const topTracksDiv = document.getElementById('artist-top-tracks');
        if (topTracksDiv) {
            topTracksDiv.innerHTML = '<div class="space-y-2"><div class="skeleton h-12 w-full"></div><div class="skeleton h-12 w-full"></div></div>';
            const topTracks = await API.search(name);
            if (topTracksDiv) {
                topTracksDiv.innerHTML = `<h3 class="text-sm font-bold uppercase mb-2" style="color: var(--text-tertiary);">Top Songs</h3>`;
                // Dedupe
                const uniqueIds = new Set();
                const uniqueResults = [];
                topTracks.forEach(t => {
                    if (!uniqueIds.has(t.trackId)) {
                        uniqueResults.push(t);
                        uniqueIds.add(t.trackId);
                    }
                });

                uniqueResults.slice(0, 5).forEach((t, i) => {
                    topTracksDiv.innerHTML += `
                                <div class="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)] -mx-4 px-4 transition rounded-lg" onclick="Queue.set([${this.esc(t)}])">
                                    <span class="text-xs font-mono w-4" style="color: var(--text-tertiary);">${i + 1}</span>
                                    <div class="flex-1 text-sm font-bold group-hover:text-white" style="color: var(--text-secondary);">${Security.safeText(t.trackName)}</div>
                                </div>`;
                });
            }
        }
        // Albums (Simulated search results for structure)
        const albums = await API.getArtistDiscography(id);
        const albumGrid = document.getElementById('artist-albums');
        if (albumGrid) {
            albumGrid.innerHTML = '';
            if (albums && albums.length > 1) {
                albums.slice(1).forEach(a => {
                    albumGrid.innerHTML += `
                                <div class="space-y-2 group cursor-pointer" onclick="UI.openAlbum('${a.collectionId}', '${a.collectionName.replace(/'/g, "\\'")}', '${a.artworkUrl100}')">
                                    <img src="${a.artworkUrl100.replace('100x100', '400x400')}" class="w-full aspect-square rounded-xl object-cover border border-[var(--border-subtle)] group-hover:scale-105 transition">
                                    <p class="text-[10px] font-bold" style="color: var(--text-secondary);">${Security.escapeHtml(a.collectionName)}</p>
                                </div>`;
                });
            }
        }
        if (window.lucide) lucide.createIcons();
    },

    async openAlbum(id, name, art) {
        this.switchView('playlist');
        const hero = document.getElementById('playlist-hero');
        if (hero) hero.innerHTML = `<div class="skeleton w-full h-40"></div>`;
        const tracks = await API.getAlbumTracks(id);
        if (hero) {
            hero.innerHTML = `
                        <div class="flex items-end gap-5">
                            <img src="${art.replace('100x100', '300x300')}" class="w-28 h-28 rounded-xl shadow-2xl border border-[var(--border-subtle)]">
                            <div>
                                <h1 class="text-2xl font-black leading-tight mb-1 line-clamp-2" style="color: var(--text-primary);">${Security.escapeHtml(name)}</h1>
                                <p class="text-[10px] font-bold uppercase tracking-wider mb-3" style="color: var(--text-tertiary);">${tracks.length} Songs</p>
                                 <button onclick="Queue.set(${this.esc(tracks)})" class="px-5 py-2 bg-[var(--text-primary)] text-[var(--text-inverse)] rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:scale-105 transition">Play Album</button>
                            </div>
                        </div>`;
        }
        const list = document.getElementById('playlist-tracks');
        if (list) {
            list.innerHTML = '';
            tracks.forEach((t, i) => {
                list.innerHTML += `
                            <div class="flex items-center gap-4 py-3.5 border-b border-[var(--border-subtle)] group hover:bg-[var(--bg-surface-hover)] -mx-2 px-2 transition rounded-lg cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                                <span class="text-xs font-mono w-4" style="color: var(--text-tertiary);">${i + 1}</span>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-bold" style="color: var(--text-secondary);">${Security.safeText(t.trackName)}</p>
                                </div>
                                <span class="text-[10px] font-mono" style="color: var(--text-tertiary);">${AudioEngine.formatTime(t.trackTimeMillis / 1000)}</span>
                            </div>`;
            });
        }
    },

    switchView(id) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        requestAnimationFrame(() => {
            const el = document.getElementById(`view-${id}`);
            if (el) el.classList.remove('hidden');
        });
    },

    renderLikedSongs() {
        this.switchView('list');
        const hero = document.getElementById('list-hero');
        if (hero) {
            hero.innerHTML = `
                        <div class="flex items-end gap-5">
                            <div class="w-28 h-28 bg-gradient-to-tr from-indigo-900 to-black rounded-xl flex items-center justify-center border border-[var(--border-subtle)] shadow-xl">
                                <i data-lucide="heart" class="w-10 h-10 fill-indigo-400 text-indigo-400"></i>
                            </div>
                            <div>
                                <h1 class="text-3xl font-black leading-none mb-2" style="color: var(--text-primary);">Liked Songs</h1>
                                <p class="text-[10px] font-bold uppercase tracking-wider mb-4" style="color: var(--text-tertiary);">${State.favorites.length} Songs</p>
                                <div class="flex gap-3">
                                    <button onclick="Queue.set(State.favorites)" class="w-10 h-10 bg-[var(--text-primary)] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition"><i data-lucide="play" class="w-4 h-4 fill-[var(--text-inverse)] ml-0.5"></i></button>
                                </div>
                            </div>
                        </div>`;
        }
        const list = document.getElementById('list-tracks');
        if (list) {
            list.innerHTML = '';
            if (State.favorites.length === 0) {
                list.innerHTML = '<p class="text-center py-10 text-xs font-mono" style="color: var(--text-tertiary);">No Liked Songs Yet</p>';
            } else {
                State.favorites.forEach((t, i) => {
                    list.innerHTML += `
                                <div class="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)] group hover:bg-[var(--bg-surface-hover)] -mx-2 px-2 transition rounded-lg">
                                    <span class="text-xs font-mono w-4" style="color: var(--text-tertiary);">${i + 1}</span>
                                    <div class="flex-1 min-w-0 cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                                        <p class="text-sm font-bold" style="color: var(--text-secondary);">${Security.safeText(t.trackName)}</p>
                                        <p class="text-[10px] uppercase font-bold" style="color: var(--text-tertiary);">${Security.safeText(t.artistName)}</p>
                                    </div>
                                    <button onclick="Library.toggleLike(); UI.renderLikedSongs()" class="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                                </div>`;
                });
            }
        }
        if (window.lucide) lucide.createIcons();
    },

    renderFollowing() {
        this.switchView('list');
        const hero = document.getElementById('list-hero');
        if (hero) {
            hero.innerHTML = `
                        <div class="flex items-end gap-5">
                            <div class="w-28 h-28 bg-gradient-to-tr from-gray-900 to-white rounded-xl flex items-center justify-center border border-[var(--border-subtle)] shadow-xl">
                                <i data-lucide="mic-2" class="w-10 h-10 fill-black text-black"></i>
                            </div>
                            <div>
                                <h1 class="text-3xl font-black leading-none mb-2" style="color: var(--text-primary);">Following</h1>
                                <p class="text-[10px] font-bold uppercase tracking-wider mb-4" style="color: var(--text-tertiary);">${State.followedArtists.length} Artists</p>
                            </div>
                        </div>`;
        }
        const list = document.getElementById('list-tracks');
        if (list) {
            list.innerHTML = '';
            if (State.followedArtists.length === 0) {
                list.innerHTML = '<p class="text-center py-10 text-xs font-mono" style="color: var(--text-tertiary);">You are not following anyone yet.</p>';
            } else {
                list.className = "grid grid-cols-2 gap-4 pb-32 overflow-y-auto";
                State.followedArtists.forEach(a => {
                    list.innerHTML += `
                                <div class="surface p-4 rounded-2xl border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition group" onclick="UI.openArtistProfile({artistName: '${Security.escapeHtml(a.name).replace(/'/g, "\\'")}', artistId: '${a.id}'})">
                                    <div class="w-12 h-12 mb-3 mx-auto rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
                                        <i data-lucide="mic-2" class="w-6 h-6" style="color: var(--text-tertiary);"></i>
                                    </div>
                                    <p class="text-center text-sm font-bold" style="color: var(--text-primary);">${Security.safeText(a.name)}</p>
                                    <p class="text-center text-[9px] uppercase font-bold" style="color: var(--text-tertiary);">Artist</p>
                                </div>`;
                });
            }
        }
        if (window.lucide) lucide.createIcons();
    },

    renderPlaylistView(playlist) {
        this.switchView('playlist');
        const hero = document.getElementById('playlist-hero');
        if (hero) {
            hero.innerHTML = `
                        <div class="flex items-end gap-5">
                            <div class="w-28 h-28 bg-gradient-to-tr from-zinc-800 to-zinc-900 rounded-xl flex items-center justify-center border border-[var(--border-subtle)] shadow-xl">
                                <i data-lucide="music" class="w-10 h-10" style="color: var(--text-tertiary);"></i>
                            </div>
                            <div>
                                <h1 class="text-3xl font-black leading-none mb-2" style="color: var(--text-primary);">${Security.escapeHtml(playlist.name)}</h1>
                                <p class="text-[10px] font-bold uppercase tracking-wider mb-4" style="color: var(--text-tertiary);">${playlist.tracks.length} Songs</p>
                                <div class="flex gap-3">
                                    <button onclick="Queue.set(${this.esc(playlist.tracks)})" class="w-10 h-10 bg-[var(--text-primary)] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition"><i data-lucide="play" class="w-4 h-4 fill-[var(--text-inverse)] ml-0.5"></i></button>
                                    <button onclick="Library.deletePlaylist('${playlist.id}')" class="w-10 h-10 border border-[var(--border-subtle)] rounded-full flex items-center justify-center transition hover:bg-red-900/20 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                                </div>
                            </div>
                        </div>`;
        }
        const list = document.getElementById('playlist-tracks');
        if (list) {
            list.innerHTML = '';
            if (playlist.tracks.length === 0) {
                list.innerHTML = '<p class="text-center py-10 text-xs font-mono" style="color: var(--text-tertiary);">Empty Playlist</p>';
            } else {
                playlist.tracks.forEach((t, i) => {
                    list.innerHTML += `
                                <div class="flex items-center gap-4 py-3 border-b border-[var(--border-subtle)] group hover:bg-[var(--bg-surface-hover)] -mx-2 px-2 transition rounded-lg cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                                    <span class="text-xs font-mono w-4" style="color: var(--text-tertiary);">${i + 1}</span>
                                    <div class="flex-1 min-w-0 cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                                        <p class="text-sm font-bold" style="color: var(--text-secondary);">${Security.safeText(t.trackName)}</p>
                                        <p class="text-[10px] uppercase font-bold" style="color: var(--text-tertiary);">${Security.safeText(t.artistName)}</p>
                                    </div>
                                    <button onclick="Library.removeFromPlaylist('${playlist.id}', '${t.trackId}')" class="p-2 opacity-0 group-hover:opacity-100 text-red-500 transition"><i data-lucide="x" class="w-4 h-4"></i></button>
                                </div>`;
                });
            }
        }
        if (window.lucide) lucide.createIcons();
    },

    showQueue() {
        this.toggleQueue(true);
    },

    renderQueuePage() {
        const hero = document.getElementById('queue-now-playing');
        if (hero && State.currentTrack) {
            hero.innerHTML = `
                        <img src="${State.currentTrack.artworkUrl100.replace('100x100', '400x400')}" class="w-24 h-24 rounded-2xl shadow-2xl border border-[var(--border-subtle)]">
                        <div>
                            <h2 class="text-2xl font-black" style="color: var(--text-primary);">${Security.safeText(State.currentTrack.trackName)}</h2>
                            <p class="font-bold uppercase" style="color: var(--text-tertiary);">${Security.safeText(State.currentTrack.artistName)}</p>
                        </div>
                    `;
        }
        const list = document.getElementById('queue-up-next-list');
        if (list) {
            list.innerHTML = '';
            if (State.queue.length <= 1) {
                list.innerHTML = '<p class="text-center text-xs font-mono italic opacity-50">Queue is empty</p>';
            } else {
                State.queue.slice(Queue.index + 1).forEach((t, i) => {
                    list.innerHTML += `
                                <div class="flex items-center gap-4 p-4 surface rounded-xl border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition" onclick="Queue.set(State.queue, ${Queue.index + 1 + i})">
                                     <img src="${t.artworkUrl100}" class="w-10 h-10 rounded-lg">
                                     <div>
                                         <p class="text-xs font-bold" style="color: var(--text-primary);">${Security.safeText(t.trackName)}</p>
                                         <p class="text-[10px] uppercase font-bold" style="color: var(--text-tertiary);">${Security.safeText(t.artistName)}</p>
                                     </div>
                                </div>
                             `;
                });
            }
        }
        if (window.lucide) lucide.createIcons();
    },

    renderLocalLibrary() {
        this.switchView('list');
        const hero = document.getElementById('list-hero');
        if (hero) {
            hero.innerHTML = `<h1 class="text-3xl font-black tracking-tighter" style="color: var(--text-primary);">Local Files</h1>`;
        }
        const list = document.getElementById('list-tracks');
        if (list) {
            list.innerHTML = '';
            if (State.localFiles.length === 0) {
                list.innerHTML = '<p class="text-center py-10 text-xs font-mono" style="color: var(--text-tertiary);">No Local Files Imported</p>';
            } else {
                State.localFiles.forEach((t, i) => {
                    list.innerHTML += `
                                <div class="flex items-center gap-4 p-3 surface rounded-xl border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition" onclick="Queue.set([${this.esc(t)}])">
                                    <div class="w-10 h-10 rounded bg-[var(--bg-elevated)] flex items-center justify-center">
                                        <i data-lucide="music" class="w-5 h-5" style="color: var(--text-tertiary);"></i>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-bold" style="color: var(--text-primary);">${Security.safeText(t.trackName)}</p>
                                        <p class="text-[10px] uppercase font-bold" style="color: var(--text-tertiary);">Local File</p>
                                    </div>
                                </div>`;
                });
            }
        }
        if (window.lucide) lucide.createIcons();
    },

    async renderLibrary() {
        const list = document.getElementById('library-list');
        if (!list) return;

        let html = '';

        // Liked Songs
        html += `
                    <div class="flex items-center justify-between p-4 surface rounded-2xl border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition group mb-3" onclick="UI.renderLikedSongs()">
                         <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-900 to-black flex items-center justify-center border border-indigo-500/20 shadow-lg group-hover:scale-105 transition">
                                <i data-lucide="heart" class="w-5 h-5 fill-indigo-400 text-indigo-400"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold" style="color: var(--text-primary);">Liked Songs</p>
                                <p class="text-[10px] uppercase font-bold tracking-wider" style="color: var(--text-tertiary);">${State.favorites.length} Tracks</p>
                            </div>
                        </div>
                    </div>
                `;

        // Following
        html += `
                    <div class="flex items-center justify-between p-4 surface rounded-2xl border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition group mb-3" onclick="UI.renderFollowing()">
                         <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-900 to-white flex items-center justify-center border border-gray-500/20 shadow-lg group-hover:scale-105 transition">
                                <i data-lucide="mic-2" class="w-5 h-5 fill-black-400 text-black-400"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold" style="color: var(--text-primary);">Following</p>
                                <p class="text-[10px] uppercase font-bold tracking-wider" style="color: var(--text-tertiary);">${State.followedArtists.length} Artists</p>
                            </div>
                        </div>
                    </div>
                `;

        // Local Files
        html += `
                    <div class="flex items-center justify-between p-4 surface rounded-2xl border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)] transition group mb-3" onclick="UI.renderLocalLibrary()">
                         <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 to-black flex items-center justify-center border border-blue-500/20 shadow-lg group-hover:scale-105 transition">
                                <i data-lucide="hard-drive" class="w-5 h-5 fill-blue-400 text-blue-400"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold" style="color: var(--text-primary);">Local Files</p>
                                <p class="text-[10px] uppercase font-bold tracking-wider" style="color: var(--text-tertiary);">${State.localFiles.length} Files</p>
                            </div>
                        </div>
                    </div>
                `;

        // Playlists
        State.playlists.forEach(pl => {
            html += `
                        <div class="flex items-center justify-between p-4 surface rounded-2xl border border-[var(--border-subtle)] mb-2 cursor-pointer hover:bg-[var(--bg-surface-hover)] transition group" onclick="UI.renderPlaylistView(State.playlists.find(p => p.id === '${pl.id}'))">
                             <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-black flex items-center justify-center border border-[var(--border-subtle)] shadow-lg group-hover:scale-105 transition">
                                    <i data-lucide="music-2" class="w-5 h-5" style="color: var(--text-tertiary);"></i>
                                </div>
                                <div>
                                    <p class="text-sm font-bold" style="color: var(--text-primary);">${Security.escapeHtml(pl.name)}</p>
                                    <p class="text-[10px] uppercase font-bold tracking-wider" style="color: var(--text-tertiary);">${pl.tracks.length} Tracks</p>
                                </div>
                            </div>
                        </div>`;
        });
        list.innerHTML = html;
        if (window.lucide) lucide.createIcons();
    },

    // --- PLAYER UI ---
    updatePlayerUI() {
        const t = State.currentTrack;
        if (!t) return;

        // Show Mini Player
        const miniPlayer = document.getElementById('mini-player');
        if (miniPlayer) {
            miniPlayer.classList.remove('hidden');
            miniPlayer.classList.add('animate-slide-up');
        }

        // Update Texts (Unescape to fix symbols)
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = Security.unescapeHtml(val); };

        setText('mini-title', t.trackName); setText('mini-artist', t.artistName);
        setText('player-title', t.trackName); setText('player-artist', t.artistName);

        // Art
        const art = document.getElementById('player-art');
        const miniArt = document.getElementById('mini-art');
        if (art) art.src = t.artworkUrl100.replace('100x100', '600x600');
        if (miniArt) miniArt.src = t.artworkUrl100;

        // Like Button Update (Fix Icon)
        const likeBtn = document.getElementById('like-btn');
        if (likeBtn) {
            const isFav = State.favorites.some(f => f.trackId === t.trackId);
            // Update inner HTML
            likeBtn.innerHTML = `<i data-lucide="heart" class="w-5 h-5 ${isFav ? 'fill-red-500 text-red-500' : ''}" style="${isFav ? '' : 'color: var(--text-tertiary);'}"></i>`;
            if (window.lucide) lucide.createIcons();
        }
        if (window.lucide) lucide.createIcons();
    },

    updatePlaybackState() {
        const icon = State.isPlaying ? 'pause' : 'play';
        const miniIcon = document.getElementById('mini-play-icon');
        if (miniIcon) {
            // Fix Mini Player Icon not updating
            miniIcon.setAttribute('data-lucide', icon);
            // Force Re-render icon
            miniIcon.outerHTML = `<i data-lucide="${icon}" class="w-4 h-4 fill-[var(--text-primary)]"></i>`;
            if (window.lucide) lucide.createIcons();
        }

        const mainBtn = document.getElementById('main-play-btn');
        if (mainBtn) {
            mainBtn.innerHTML = `<i data-lucide="${icon}" class="w-8 h-8 fill-[var(--text-inverse)] ${icon === 'play' ? 'ml-1' : ''}"></i>`;
        }
        if (window.lucide) lucide.createIcons();
    },

    updateMiniPlayerState() {
        // Handled by timer in AudioEngine
    },

    togglePlayer(show) {
        const el = document.getElementById('full-player');
        if (show) {
            if (el) el.classList.remove('hidden');
            requestAnimationFrame(() => {
                if (el) el.classList.remove('translate-y-full');
            });
            // Add Swipe Down Listener
            this.initPlayerSwipe();
        } else {
            if (el) {
                el.classList.add('translate-y-full');
                setTimeout(() => el.classList.add('hidden'), 500);
            }
        }
    },

    initPlayerSwipe() {
        const el = document.getElementById('full-player');
        if (!el) return;
        let startY = 0;
        el.ontouchstart = (e) => startY = e.touches[0].clientY;
        el.ontouchmove = (e) => {
            const diff = e.touches[0].clientY - startY;
            if (diff > 150) { // Swipe down threshold
                this.togglePlayer(false);
                el.ontouchstart = null; el.ontouchmove = null;
            }
        };
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
        if (q) {
            const isHidden = q.classList.contains('queue-hidden');
            if (isHidden) {
                q.classList.remove('queue-hidden');
                q.classList.add('queue-visible');
                this.renderQueuePage();
                // Add Swipe Down Listener for Queue
                let startY = 0;
                q.ontouchstart = (e) => startY = e.touches[0].clientY;
                q.ontouchmove = (e) => {
                    if (e.touches[0].clientY - startY > 100) {
                        this.toggleQueue();
                        q.ontouchstart = null; q.ontouchmove = null;
                    }
                };
            } else {
                q.classList.remove('queue-visible');
                q.classList.add('queue-hidden');
            }
        }
    },

    openArtistFromPlayer() {
        if (State.currentTrack) UI.openArtistProfile(State.currentTrack);
    },

    // --- ACTIONS ---
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

    openSettings() {
        const m = document.getElementById('modal-settings');
        if (m) m.classList.remove('hidden');
        else UI.toast("Settings UI not found");
    },
    closeSettings() {
        const m = document.getElementById('modal-settings');
        if (m) m.classList.add('hidden');
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

    toggleSetting(key, el) {
        State.preferences[key] = !State.preferences[key];
        Database.save('preferences', State.preferences);
        const toggle = el.querySelector('div') || el;
        // Toggle class logic handled in HTML by toggling class on parent div with 'active'
        if (State.preferences[key]) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    },

    toggleLightMode(el) {
        State.preferences.lightMode = !State.preferences.lightMode;
        document.body.classList.toggle('light-mode');
        Database.save('preferences', State.preferences);
        this.toggleSetting('lightMode', el);
        UI.toast(State.preferences.lightMode ? "Light Mode On" : "Dark Mode On");
    },

    logout() {
        UI.triggerConfirm("Log out", "Are you sure?", async () => {
            location.reload();
        });
    },

    triggerAlert(title, msg) {
        const t = document.getElementById('alert-title');
        const m = document.getElementById('alert-msg');
        const a = document.getElementById('ui-alert');
        if (t) t.innerText = title;
        if (m) m.innerText = msg;
        if (a) a.classList.add('active');
    },
    closeAlert() {
        const a = document.getElementById('ui-alert');
        if (a) a.classList.remove('active');
    },
    triggerConfirm(title, msg, onYes) {
        const t = document.getElementById('confirm-title');
        const m = document.getElementById('confirm-msg');
        const btn = document.getElementById('confirm-yes-btn');
        const c = document.getElementById('ui-confirm');
        if (t) t.innerText = title;
        if (m) m.innerText = msg;
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => { onYes(); UI.closeConfirm(); });
        }
        if (c) c.classList.add('active');
    },
    closeConfirm() {
        const c = document.getElementById('ui-confirm');
        if (c) c.classList.remove('active');
    },
    triggerPrompt(title, placeholder, onSubmit) {
        const t = document.getElementById('prompt-title');
        const i = document.getElementById('prompt-input');
        const btn = document.getElementById('prompt-yes-btn');
        const p = document.getElementById('ui-prompt');
        if (t) t.innerText = title;
        if (i) {
            i.value = '';
            i.placeholder = placeholder;
        }
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => { onSubmit(i.value); UI.closePrompt(); });
        }
        if (p) {
            p.classList.add('active');
            setTimeout(() => i.focus(), 100);
        }
    },
    closePrompt() {
        const p = document.getElementById('ui-prompt');
        if (p) p.classList.remove('active');
    },

    toast(msg) {
        const t = document.getElementById('toast');
        if (t) {
            t.innerText = msg;
            t.style.opacity = '1';
            setTimeout(() => t.style.opacity = '0', 2000);
        }
    },

    esc(obj) { return JSON.stringify(obj).replace(/"/g, '&quot;'); },

    initVisualizer() {
        const canvas = document.getElementById('viz-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let width, height;
        const resize = () => {
            if (!canvas.parentElement) return;
            width = canvas.width = canvas.parentElement.offsetWidth;
            height = canvas.height = canvas.parentElement.offsetHeight;
        };
        window.addEventListener('resize', resize);
        setInterval(resize, 1000);
        const draw = () => {
            requestAnimationFrame(draw);

            // Toggle Viz Check
            if (!State.preferences.viz) {
                ctx.clearRect(0, 0, width, height);
                return;
            }

            ctx.clearRect(0, 0, width, height);

            if (State.isPlaying && AudioEngine.analyser && !State.isLINKMode) {
                const bufferLength = AudioEngine.analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                AudioEngine.analyser.getByteTimeDomainData(dataArray);

                ctx.lineWidth = 1.5;
                ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
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
    }
};

// --- ONBOARDING ---
const Onboarding = {
    async check() {
        const user = await Database.get('user_name');
        if (!user) {
            const layer = document.getElementById('onboarding-layer');
            if (layer) layer.classList.remove('hidden');
            return false;
        }
        return true;
    },
    finish() {
        let name = "Guest";
        const nameInput = document.getElementById('survey-name');
        const genreSelect = document.getElementById('ob-genre-select');
        if (genreSelect) {
            State.preferences.favoriteGenre = genreSelect.value;
            Database.save('preferences', State.preferences);
        }
        if (nameInput && nameInput.value) {
            const rawName = nameInput.value.trim();
            const validation = Security.validateUsername(rawName);
            if (!validation.valid) {
                UI.triggerAlert("Invalid Username", validation.reason);
                return;
            }
            name = rawName;
        }

        Database.save('user_name', name).then(() => {
            State.user = name;
            location.reload();
        });

    }
};

// --- UTILS ---
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

window.onload = UI.init.bind(UI);

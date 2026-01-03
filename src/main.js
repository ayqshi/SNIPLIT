const Log = {
    info: (mod, msg) => console.log(`%c[${mod}]`, 'color: #3b82f6; font-weight: bold; background: #eff6ff; padding: 2px 6px; border-radius: 4px;', msg),
    warn: (mod, msg) => console.log(`%c[${mod}]`, 'color: #f59e0b; font-weight: bold; background: #fffbeb; padding: 2px 6px; border-radius: 4px;', msg),
    err: (mod, msg) => console.log(`%c[${mod}]`, 'color: #ef4444; font-weight: bold; background: #fef2f2; padding: 2px 6px; border-radius: 4px;', msg),
    success: (mod, msg) => console.log(`%c[${mod}]`, 'color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;', msg),
};

const Security = {
    escapeHtml: (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },
    safeText: (unsafe) => {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;") 
            // Preserve apostrophes
            .replace(/'/g, "'"); 
    },
    safeJSON: (str, fallback) => {
        try { return JSON.parse(str); } catch(e) { Log.err('Security', 'JSON Parse Error'); return fallback || {}; }
    },
    
    // EXTENSIVE PROFANITY LIST
    validateUsername: (input) => {
        const name = input.trim().toLowerCase();
        
        // 1. Length Checks
        if (name.length < 2) return { valid: false, reason: "Name must be at least 2 characters." };
        if (name.length > 15) return { valid: false, reason: "Name is too long (max 15 characters)." };
        
        // 2. Invalid Characters (Only allow A-Z, 0-9, spaces)
        if (!/^[a-z0-9\s]*$/.test(name)) {
            return { valid: false, reason: "Name contains invalid characters. Use letters and numbers only." };
        }
        
        // 3. Inappropriate/Reserved Names
        const reserved = ['admin', 'root', 'system', 'moderator', 'sniplit', 'guest'];
        if (reserved.includes(name)) return { valid: false, reason: "This name is not allowed." };

        // 4. Profanity Filter
        const bannedWords = [
            'fuck', 'fucking', 'shit', 'shitty', 'bitch', 'bitching', 'whore', 'slut', 'bastard', 'cunt',
            'nigger', 'nigga', 'chink', 'spic', 'fag', 'faggot', 'gay', 'lesbo', 'dyke',
            'pussy', 'dick', 'cock', 'penis', 'anal', 'ass', 'arse',
            'sex', 'cum', 'jizz', 'semen', 'orgasm', 'porn',
            'rape', 'murder', 'kill', 'death', 'suicide', 'kys',
            'hitler', 'nazi', 'kkk', 'isis', 'terrorist',
            'retard', 'retarded', 'autistic', 'cripple', 'down syndrome',
            'idiot', 'stupid', 'dumb', 'moron', 'lame',
            'nigga', 'niggas', 'fuk', 'fuk', 'fuking', 'sux', 'blowjob',
            'wanker', 'tosser', 'bellend', 'twat', 'cunt', 'fuk',
            'coon', 'spook', 'kike', 'gook', 'chink', 'gyp', 'wop', 'wetback',
            'tranny', 'shemale', 'ladyboy', 'he-she',
            'simp', 'incel', 'virgin', 'chad', 'based',
            'clit', 'vagina', 'nipple', 'butt', 'booty', 'thot',
            'paki', 'sandnigger', 'indian', 'negro', 'muligno',
            'crackhead', 'junkie', 'meth', 'heroin', 'cocaine',
            'pedo', 'pedophile', 'rape', 'molest', 'groomer',
            'suck', 'sucks', 'sucking', 'sucker'
        ];
        
        // Check for exact matches or substrings
        for (let word of bannedWords) {
            if (name.includes(word)) {
                return { valid: false, reason: "Name contains inappropriate content." };
            }
        }

        return { valid: true, reason: "" };
    }
};

const State = {
    user: null,
    preferences: { quality: true, viz: true, vizOpacity: 1.0, haptics: true, historyEnabled: true, lightMode: false, favoriteGenre: 'Pop' },
    searchHistory: [],
    currentTrack: null,
    queue: [],
    history: [], 
    favorites: [],
    playlists: [], 
    followedArtists: [],
    localFiles: [], 
    isPlaying: false,
    isLoading: false,
    loop: 'none',
    isShuffle: false,
    genres: new Set(),
    wrapped: { slide: 0, data: {} },
    db: null,
    isLINKMode: false,
    analytics: {
        totalSecondsListened: 0,
        appOpens: 0,
        tracksPlayed: 0
    }
};

// --- STATIC LINK DATABASE ---
const LINK_DB = {};

// --- DATABASE ---
const Database = {
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SniplitDB', 8); 
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
                if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('followed')) db.createObjectStore('followed', { keyPath: 'name' });
                if (!db.objectStoreNames.contains('analytics')) db.createObjectStore('analytics', { keyPath: 'id' });
                
                if (!db.objectStoreNames.contains('localfiles')) {
                    try {
                        db.createObjectStore('localfiles', { keyPath: 'id' });
                    } catch(err) {
                        Log.warn('DB', 'Could not create localfiles store (might already exist)');
                    }
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                Log.success('DB', 'IndexedDB Connected');
                resolve();
            };
            request.onerror = (e) => {
                Log.err('DB', 'Connection Failed');
                reject(e);
            }
        });
    },
    async save(key, val) {
        try {
            const tx = this.db.transaction('settings', 'readwrite');
            tx.objectStore('settings').put(val, key);
        } catch(e) {
            Log.err('DB', `Save failed for ${key}`);
        }
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
        Log.info('DB', 'Followed Saved');
    },
    async getFollowed() {
        return new Promise(res => {
            const tx = this.db.transaction('followed', 'readonly');
            const req = tx.objectStore('followed').getAll();
            req.onsuccess = () => res(req.result || []);
        });
    },
    async saveAnalytics(data) {
        const tx = this.db.transaction('analytics', 'readwrite');
        const store = tx.objectStore('analytics');
        store.put(data); 
    },
    async getAnalytics() {
        return new Promise(res => {
            const tx = this.db.transaction('analytics', 'readonly');
            const req = tx.objectStore('analytics').get('stats');
            req.onsuccess = () => res(req.result || { id: 'stats', totalSecondsListened: 0, appOpens: 0, tracksPlayed: 0 });
        });
    },
    async saveLocalFiles(files) {
        try {
            const tx = this.db.transaction('localfiles', 'readwrite');
            const store = tx.objectStore('localfiles');
            store.clear();
            files.forEach(f => store.put(f));
            Log.info('DB', `Saved ${files.length} Local Files`);
        } catch(e) {
            Log.err('DB', 'Failed to save local files. Store might not exist yet.');
        }
    },
    async getLocalFiles() {
        return new Promise(res => {
            try {
                const tx = this.db.transaction('localfiles', 'readonly');
                const req = tx.objectStore('localfiles').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = (e) => {
                    Log.err('DB', 'Failed to get local files');
                    res([]); 
                };
            } catch(e) {
                Log.warn('DB', 'Local files store not found, returning empty');
                res([]);
            }
        });
    },
    async hardReset() {
        UI.triggerConfirm("Factory Reset", "This will wipe all data. Confirm?", async () => {
            localStorage.clear();
            const req = indexedDB.deleteDatabase('SniplitDB');
            req.onsuccess = () => {
                Log.success('System', 'Database Wiped');
                location.reload();
            };
            req.onerror = () => UI.triggerAlert("Error", "Could not delete DB");
        });
    },
    async clearSearchHistory() {
        State.searchHistory = [];
        await this.save('search_history', []);
        UI.renderSearchHistory();
    }
};



const LINKEngine = {
    player: null,
    isReady: false,
    init() {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            window.onLINKIframeAPIReady = () => {
                this.createPlayer();
                this.isReady = true;
                Log.info('YT', 'API Ready');
            };
        }
    },
    createPlayer() {
        let container = document.getElementById('yt-audio-container');
        if(!container) {
            container = document.createElement('div');
            container.id = 'yt-audio-container';
            container.style.cssText = 'position:fixed; top:-9999px; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none;';
            document.body.appendChild(container);
        }
        this.player = new YT.Player('yt-audio-container', {
            height: '200',
            width: '200',
            videoId: '',
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'disablekb': 1,
                'origin': window.location.origin 
            },
            events: {
                'onReady': () => {
                    State.isLoading = false; // Reset loading when YT ready
                    Log.info('YT', 'Player Instance Ready');
                },
                'onStateChange': (e) => {
                    // Update Loading State
                    if (e.data === YT.PlayerState.BUFFERING) State.isLoading = true;
                    if (e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) State.isLoading = false;

                    if (e.data === YT.PlayerState.ENDED) {
                        Queue.onTrackEnd();
                    }
                }
            }
        });
    },
    loadVideo(videoId, startSeconds = 0) {
        if (!this.isReady || !this.player) return false;
        State.isLINKMode = true;
        State.isLoading = true; 
        this.player.loadVideoById(videoId, startSeconds);
        this.player.setVolume(100); 
        this.player.unMute(); 
        return true;
    },
    play() { if(this.player) this.player.playVideo(); },
    pause() { if(this.player) this.player.pauseVideo(); },
    seekTo(seconds) { if(this.player) this.player.seekTo(seconds, true); },
    getTime() { return this.player ? this.player.getCurrentTime() : 0; },
    getDuration() { return this.player ? this.player.getDuration() : 0; }
};


// --- AUDIO ENGINE ---
const AudioEngine = {
    el: new Audio(),
    ctx: null,
    analyser: null,
    source: null,
    
    init() {
        this.el.crossOrigin = "anonymous";
        
        this.el.addEventListener('loadstart', () => { State.isLoading = true; UI.updateMiniPlayerState(); });
        this.el.addEventListener('canplay', () => { State.isLoading = false; UI.updateMiniPlayerState(); });
        this.el.addEventListener('timeupdate', () => {
            if(!State.isLINKMode) this.onTimeUpdate();
        });
        this.el.addEventListener('ended', () => {
            if(!State.isLINKMode) Queue.next(); 
        });
        this.el.addEventListener('play', () => {
            if(State.isLINKMode) return;
            State.isPlaying = true;
            State.isLoading = false;
            UI.updatePlaybackState();
            UI.updateMiniPlayerState();
            if(!this.ctx) this.initAudioContext();
        });
        this.el.addEventListener('pause', () => {
            if(State.isLINKMode) return;
            State.isPlaying = false;
            UI.updatePlaybackState();
            UI.updateMiniPlayerState();
        });
        
        setInterval(() => {
            UI.updateMiniPlayerState(); 
            if(State.isPlaying && State.isLINKMode && LINKEngine.player && LINKEngine.player.getCurrentTime) {
                this.onTimeUpdate(LINKEngine.player.getCurrentTime(), LINKEngine.player.getDuration());
                LyricsEngine.sync();
            }
        }, 300); 

        Log.success('Audio', 'Engine Initialized');
        LINKEngine.init();
    },

    initAudioContext() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 2048; 
            this.source = this.ctx.createMediaElementSource(this.el);
            this.source.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);
            Log.info('Audio', 'Web Audio API Connected');
        } catch(e) {
            Log.warn('Audio', 'Visualizer not supported (CORS/Browser restriction)');
        }
    },

    load(track, autoplay = true) {
        if(!track) return;
        State.currentTrack = track;
        State.isLoading = true; 

        const key = this.normalizeKey(`${track.artistName} ${track.trackName}`);
        const ytData = LINK_DB[key];
        
        State.isLINKMode = false;
        this.el.pause();

        if (ytData) {
            Log.info('YT-Audio', `Found Match for: ${key}`);
            track.trackTimeMillis = ytData.d; 
            
            if (LINKEngine.isReady) {
                const loaded = LINKEngine.loadVideo(ytData.v);
                if (loaded) {
                    State.isPlaying = true; 
                    UI.updatePlaybackState();
                    UI.updateMiniPlayerState();
                    this.postLoadProcess(track);
                    return;
                }
            } else {
                Log.warn('YT-Audio', 'API not ready, falling back to preview');
            }
        }

        Log.info('Audio', `Loading iTunes Preview: ${track.trackName}`);
        this.el.src = track.previewUrl || track.localUrl;
        if(autoplay) {
            this.el.play().catch(e => {
                Log.warn('Audio', 'Autoplay prevented');
                State.isLoading = false;
            });
        }
        
        this.postLoadProcess(track);
    },

    postLoadProcess(track) {
        State.history.unshift(track);
        State.history = Array.from(new Set(State.history.map(a => a.trackId)))
            .map(id => State.history.find(a => a.trackId === id))
            .slice(0, 200);
        
        if(track.primaryGenreName) State.genres.add(track.primaryGenreName);
        
        UI.updatePlayerUI();
        LyricsEngine.fetch(track);
        this.updateMediaSession();
        Log.info('Audio', `Loaded: ${track.trackName}`);
    },

    normalizeKey(str) {
        return str.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
    },

    toggle() {
        if(State.isLINKMode) {
            if(State.isPlaying) LINKEngine.pause();
            else LINKEngine.play();
        } else {
            if(!this.el.src) return;
            this.el.paused ? this.el.play() : this.el.pause();
        }
        State.isPlaying = !State.isPlaying;
        UI.updatePlaybackState();
        UI.updateMiniPlayerState();
        if(State.preferences.haptics && navigator.vibrate) navigator.vibrate(20);
        this.updateMediaSession();
    },

    seek(val) {
        const duration = State.isLINKMode ? LINKEngine.getDuration() : this.el.duration;
        if(!duration) return;
        const time = (val / 100) * duration;
        if(State.isLINKMode) LINKEngine.seekTo(time);
        else this.el.currentTime = time;
    },

    seekByLyric(time) {
        State.isLoading = true; 
        if(State.isLINKMode) {
            LINKEngine.seekTo(time);
            LINKEngine.play();
        } else {
            this.el.currentTime = time;
            this.el.play();
        }
        State.isPlaying = true;
        UI.updatePlaybackState();
    },

    onTimeUpdate(curTime = null, durTime = null) {
        const currentTime = curTime !== null ? curTime : this.el.currentTime;
        const duration = durTime !== null ? durTime : this.el.duration;

        if(!duration) return;
        const pct = (currentTime / duration) * 100;
        
        const slider = document.getElementById('player-progress');
        if(slider) slider.value = pct || 0;
        
        const miniBar = document.getElementById('mini-progress');
        if(miniBar) miniBar.style.width = `${pct || 0}%`;

        const curEl = document.getElementById('time-cur');
        const totEl = document.getElementById('time-total');
        if(curEl) curEl.innerText = this.formatTime(currentTime);
        if(totEl) totEl.innerText = this.formatTime(duration);
        
        State.analytics.totalSecondsListened += 0.3;

        if ('mediaSession' in navigator && State.isPlaying) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: duration,
                    playbackRate: 1,
                    position: currentTime
                });
            } catch(e) {}
        }
    },
    
    formatTime(s) {
        if(!s || isNaN(s)) return "0:00";
        const m = Math.floor(s/60);
        const r = Math.floor(s%60);
        return `${m}:${r < 10 ? '0' : ''}${r}`;
    },

    updateMediaSession() {
        if ('mediaSession' in navigator && State.currentTrack) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: State.currentTrack.trackName,
                artist: State.currentTrack.artistName,
                album: State.currentTrack.collectionName,
                artwork: [{ src: State.currentTrack.artworkUrl100.replace('100x100', '600x600'), sizes: '600x600', type: 'image/jpeg' }]
            });

            const actionHandlers = {
                play: () => { 
                    this.el.play(); LINKEngine.play(); 
                    State.isPlaying=true; UI.updatePlaybackState(); UI.updateMiniPlayerState();
                },
                pause: () => { 
                    this.el.pause(); LINKEngine.pause(); 
                    State.isPlaying=false; UI.updatePlaybackState(); UI.updateMiniPlayerState();
                },
                previoustrack: () => Queue.prev(),
                nexttrack: () => Queue.next(),
                seekto: (details) => {
                    if (details.seekTime && details.seekTime !== undefined) {
                        const duration = State.isLINKMode ? LINKEngine.getDuration() : this.el.duration;
                        const time = details.seekTime;
                        this.el.currentTime = time;
                        LINKEngine.seekTo(time);
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
                try { navigator.mediaSession.setActionHandler(action, handler); } catch (e) {}
            }
        }
    }
};

// --- ONBOARDING (With Profanity Check) ---
const Onboarding = {
    async check() {
        const user = await Database.get('user_name');
        if(!user) {
            const layer = document.getElementById('onboarding-layer');
            if(layer) layer.classList.remove('hidden');
            return false;
        }
        State.user = user;
        const prefs = await Database.get('preferences');
        if(prefs) {
            State.preferences = { ...State.preferences, ...prefs };
            if(State.preferences.favoriteGenre) {
                 const sel = document.getElementById('ob-genre-select');
                 if(sel) sel.value = State.preferences.favoriteGenre;
            }
        }
        return true;
    },

    agreeTerms() {
        const termsSection = document.getElementById('ob-terms');
        const surveySection = document.getElementById('ob-survey');
        
        if(termsSection) termsSection.classList.add('hidden');
        if(surveySection) surveySection.classList.remove('hidden');
    },

    finish() {
        let name = "Guest"; 
        const nameInput = document.getElementById('survey-name');
        const genreSelect = document.getElementById('ob-genre-select');
        
        if (nameInput && nameInput.value) {
            const rawName = nameInput.value.trim();
            
            // --- PROFANITY & VALIDATION CHECK ---
            const validation = Security.validateUsername(rawName);
            if (!validation.valid) {
                UI.triggerAlert("Invalid Username", validation.reason);
                nameInput.classList.add('border-red-500'); // Red border feedback
                // Reset to white after error display
                setTimeout(() => nameInput.classList.remove('border-red-500'), 3000);
                return; // STOP PROCESSING
            }
            
            name = rawName;
        }

        if (!name) {
            name = "Guest"; 
        }

        // Save Genre Preference
        if(genreSelect) {
            State.preferences.favoriteGenre = genreSelect.value;
            Database.save('preferences', State.preferences);
        }

        Database.save('user_name', name).then(() => {
            State.user = name;
            UI.initData();
        });
    }
};

// --- LYRICS ENGINE ---
const LyricsEngine = {
    lines: [],
    userScrolling: false,
    scrollTimeout: null,
    async fetch(track) {
        const container = document.getElementById('lyrics-container');
        if(container) {
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-full py-20 opacity-50"><div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4"></div><p class="text-xs font-mono uppercase">Scanning Database...</p></div>';
        }
        this.lines = [];
        try {
            const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artistName)}&track_name=${encodeURIComponent(track.trackName)}`);
            if(!res.ok) throw new Error("API Error");
            const data = await res.json();
            if (data && data.syncedLyrics) this.parseSynced(data.syncedLyrics);
            else if (data && data.plainLyrics) this.parsePlain(data.plainLyrics);
            else throw new Error("No lyrics");
        } catch (e) {
            if(container) {
                container.innerHTML = '<div class="flex flex-col items-center justify-center h-full"><i data-lucide="music-2" class="w-8 h-8 text-zinc-700 mb-2"></i><p class="text-zinc-600 text-xs font-bold uppercase">Instrumental / No Lyrics</p></div>';
                lucide.createIcons();
            }
        }
        if(container) {
            container.addEventListener('touchstart', () => { this.userScrolling = true; clearTimeout(this.scrollTimeout); });
            container.addEventListener('touchend', () => { this.scrollTimeout = setTimeout(() => { this.userScrolling = false; }, 3000); });
        }
    },
    parseSynced(text) {
        this.lines = text.split('\n').map(line => {
            const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
            if (match) return { time: parseInt(match[1])*60 + parseFloat(match[2]), text: match[3].trim() };
            return null;
        }).filter(l => l);
        this.render();
    },
    parsePlain(text) {
        this.lines = text.split('\n').map((l, i) => ({ text: l, time: null }));
        this.render();
    },
    render() {
        const container = document.getElementById('lyrics-container');
        if(!container) return;
        container.innerHTML = this.lines.map((l, i) => `<div id="lyric-${i}" class="lyric-line" onclick="AudioEngine.seekByLyric(${l.time})">${l.text}</div>`).join('');
    },
    sync() {
        if (this.lines.length === 0 || !State.isPlaying || this.userScrolling) return;
        const curTime = State.isLINKMode ? LINKEngine.getTime() : AudioEngine.el.currentTime;
        let activeIdx = -1;
        if (this.lines[0].time !== null) {
            activeIdx = this.lines.findIndex((l, i) => curTime >= l.time && (i === this.lines.length - 1 || curTime < this.lines[i+1].time));
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

// --- QUEUE (Intelligent Radio) ---
const Queue = {
    index: -1,
    set(list, startIdx = 0) {
        if(!list || list.length === 0) return;
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
    remove(index) {
        if (index === this.index) {
            if (State.queue.length === 1) { this.next(); } 
            else {
                State.queue.splice(index, 1);
                AudioEngine.load(State.queue[index]);
            }
        } else if (index < this.index) {
            State.queue.splice(index, 1);
            this.index--;
        } else {
            State.queue.splice(index, 1);
        }
        UI.renderQueuePage();
    },
    next() {
        if (State.loop === 'one') {
            AudioEngine.el.currentTime = 0;
            LINKEngine.seekTo(0);
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
            if(State.isLINKMode) LINKEngine.seekTo(0);
            else AudioEngine.el.currentTime = 0;
            return;
        }
        this.index--;
        if (this.index < 0) this.index = State.queue.length - 1;
        AudioEngine.load(State.queue[this.index]);
        AudioEngine.updateMediaSession();
    },
    onTrackEnd() { this.next(); AudioEngine.updateMediaSession();},
    toggleLoop() {
        const modes = ['none', 'one', 'all'];
        State.loop = modes[(modes.indexOf(State.loop) + 1) % modes.length];
        const btn = document.getElementById('loop-btn');
        if(btn) {
            btn.className = State.loop !== 'none' ? 'text-white p-2' : 'text-zinc-600 p-2';
            btn.innerHTML = `<i data-lucide="repeat${State.loop === 'one' ? '-1' : ''}" class="w-5 h-5"></i>`;
            lucide.createIcons();
        }
        UI.toast(`Loop: ${State.loop}`);
    },
    toggleShuffle() {
        State.isShuffle = !State.isShuffle;
        const btn = document.getElementById('shuffle-btn');
        if(btn) {
            btn.className = State.isShuffle ? 'text-white p-2' : 'text-zinc-600 p-2';
            lucide.createIcons();
        }
        UI.toast(`Shuffle: ${State.isShuffle ? 'On' : 'Off'}`);
    },

    async smartRadio() {
        if (!State.currentTrack) return;
        Log.info('Queue', 'Starting Smart Radio');

        let candidates = [];

        // 1. Check remaining queue for Genre Match
        const currentGenre = State.currentTrack.primaryGenreName;
        if (currentGenre && State.queue.length > 1) {
            const remaining = State.queue.slice(Queue.index + 1);
            const genreMatches = remaining.filter(t => t.primaryGenreName === currentGenre);
            if (genreMatches.length > 0) {
                candidates = genreMatches;
                Log.info('Queue', 'Found matching songs in queue');
            }
        }

        // 2. If no queue matches, use User's Favorite Genre
        if (candidates.length === 0) {
            const favGenre = State.preferences.favoriteGenre || 'Trending'; // Default to Trending
            const searchTerm = `${favGenre} Hits 2024`;
            Log.info('Queue', `Searching API for Genre: ${favGenre}`);
            const results = await API.search(searchTerm);
            const knownIds = new Set([...State.queue, ...State.history].map(t => t.trackId));
            candidates = results.filter(t => !knownIds.has(t.trackId));
        }

        if (candidates.length > 0) {
            State.queue.push(...candidates.slice(0, 5));
            UI.toast("Smart Radio: Adding Similar Songs");
            this.next();
        } else {
            UI.toast("Radio ran out of tracks");
            State.loop = 'all';
            this.index = 0;
            if(State.queue.length > 0) AudioEngine.load(State.queue[0]);
        }
    },
    
    startRadio() { this.smartRadio(); }
};

const API = {
    async search(query) {
        try {
            Log.info('API', `Search: ${query}`);
            const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=30`);
            if(!res.ok) throw new Error("Network");
            const data = await res.json();
            return data.results;
        } catch(e) { 
            Log.err('API', e.message);
            return []; 
        }
    },
    async getArtistDiscography(id) {
        try {
            const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=album&limit=10`);
            const data = await res.json();
            return data.results;
        } catch(e) { return []; }
    },
    async getAlbumTracks(collectionId) {
        try {
            const res = await fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song`);
            const data = await res.json();
            return data.results.slice(1); 
        } catch (e) { return []; }
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
            UI.toast("Added to Favorites");
        }
        Database.save('favorites', State.favorites);
        UI.updatePlayerUI();
        UI.renderLibrary();
    },
    createPlaylist(name) {
        if(!name) return;
        const newPl = { id: 'pl-' + Date.now(), name: name, tracks: [], image: null };
        State.playlists.push(newPl);
        Database.savePlaylists(State.playlists);
        UI.renderLibrary();
        UI.toast(`Created ${name}`);
    },
    async addToPlaylist(playlistId) {
        if(!State.currentTrack) return;
        const pl = State.playlists.find(p => p.id === playlistId);
        if(pl) {
            pl.tracks.push(State.currentTrack);
            await Database.savePlaylists(State.playlists);
            const modal = document.getElementById('modal-add-playlist');
            if(modal) modal.classList.remove('active');
            UI.toast(`Added to ${pl.name}`);
        }
    },
    async deletePlaylist(id) {
        UI.triggerConfirm("Delete Playlist", "Are you sure?", async () => {
            State.playlists = State.playlists.filter(p => p.id !== id);
            await Database.savePlaylists(State.playlists);
            UI.back();
            UI.toast("Playlist Deleted");
        });
    },
    async removeFromPlaylist(playlistId, trackId) {
        const pl = State.playlists.find(p => p.id === playlistId);
        if(pl) {
            pl.tracks = pl.tracks.filter(t => t.trackId !== trackId);
            await Database.savePlaylists(State.playlists);
            UI.renderPlaylistView(pl);
        }
    }
};

const LocalFiles = {
    triggerFile() { 
        const el = document.getElementById('local-file-input');
        if(el) el.click(); 
    },
    clear() {
        UI.triggerConfirm("Clear Local Files", "Remove all imported files?", async () => {
             State.localFiles = [];
             await Database.saveLocalFiles([]);
             UI.renderLocalLibrary();
             UI.toast("Local Files Cleared");
        });
    },

    init() {
        const handleFiles = (files) => {
             const validFiles = Array.from(files); 
             if(validFiles.length === 0) { UI.toast("No Files Selected"); return; }

             const newTracks = validFiles.map(f => {
                const name = f.name;
                const url = URL.createObjectURL(f);
                return {
                    id: `local-${Date.now()}-${Math.random()}`,
                    trackId: `local-${Date.now()}-${Math.random()}`,
                    trackName: name.replace(/\.[^/.]+$/, ""),
                    artistName: "Local Import",
                    collectionName: "Imported",
                    artworkUrl100: "https://picsum.photos/seed/"+name+"/100/100", 
                    previewUrl: url,
                    localUrl: url,
                    isLocal: true
                };
            });
            
            State.localFiles = [...State.localFiles, ...newTracks];
            Database.saveLocalFiles(State.localFiles);
            
            Queue.set(newTracks);
            UI.togglePlayer(true);
            UI.toggleQueue(true);
            UI.toast(`Imported ${newTracks.length} files`);
        };
        
        const fileInput = document.getElementById('local-file-input');
        if(fileInput) fileInput.setAttribute('accept', '*');
        if(fileInput) fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
    }
};

const Wrapped = {
    calculate() {
        const history = State.history;
        if (!history || history.length < 5) {
            UI.toast("Need more listening history");
            return false;
        }
        const topArtists = {};
        const topGenres = {};
        let totalMs = 0;
        history.forEach(t => {
            if(!topArtists[t.artistName]) topArtists[t.artistName] = 0;
            topArtists[t.artistName]++;
            if(t.primaryGenreName) {
                 if(!topGenres[t.primaryGenreName]) topGenres[t.primaryGenreName] = 0;
                 topGenres[t.primaryGenreName]++;
            }
            totalMs += (t.trackTimeMillis || 180000); 
        });
        State.wrapped.data = {
            totalHours: (totalMs / (1000*60*60)).toFixed(1),
            topArtists: Object.entries(topArtists).sort((a,b) => b[1] - a[1]).slice(0, 3).map(x => x[0]),
            topGenres: Object.entries(topGenres).sort((a,b) => b[1] - a[1]).slice(0, 3).map(x => x[0]),
            trackCount: history.length
        };
        return true;
    },
    renderSlide() {
        const container = document.getElementById('wrapped-slide-container');
        if(!container) return;
        const data = State.wrapped.data;
        const slide = State.wrapped.slide;
        let html = '';
        if (slide === 0) {
            html = `<div class="slide-enter space-y-4"><h1 class="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-600">2025<br>WRAPPED</h1><p class="text-zinc-400 font-mono tracking-widest text-xs uppercase">Your Music Analysis</p></div>`;
        } else if (slide === 1) {
            html = `<div class="slide-enter space-y-2"><p class="text-zinc-500 uppercase text-xs font-bold tracking-widest">Total Airtime</p><h2 class="text-8xl font-black text-white tracking-tighter">${data.totalHours}<span class="text-2xl text-zinc-600 ml-2">HRS</span></h2></div>`;
        } else if (slide === 2) {
            html = `<div class="slide-enter space-y-8 w-full"><p class="text-zinc-500 uppercase text-xs font-bold tracking-widest">Top Artists</p><div class="space-y-6">
                <h3 class="text-4xl font-black text-white">${data.topArtists[0]}</h3>
                <h3 class="text-2xl font-bold text-zinc-400">${data.topArtists[1] || ''}</h3>
                <h3 class="text-xl font-bold text-zinc-600">${data.topArtists[2] || ''}</h3>
            </div></div>`;
        } else if (slide === 3) {
             html = `<div class="slide-enter space-y-6"><h1 class="text-4xl font-black text-white">The End.</h1><p class="text-zinc-500 font-mono text-xs uppercase">Keep Listening.</p></div>`;
             const btn = document.getElementById('wrapped-next-btn');
             if(btn) {
                 btn.innerText = "Close";
                 btn.onclick = () => {
                     const m = document.getElementById('wrapped-modal');
                     if(m) m.classList.add('hidden');
                 }
             }
        }
        container.innerHTML = html;
        const btn = document.getElementById('wrapped-next-btn');
        if(btn) btn.classList.remove('hidden');
    },
    nextSlide() {
        if(State.wrapped.slide < 3) {
            State.wrapped.slide++;
            this.renderSlide();
        }
    }
};

const UI = {
    viewStack: ['home'],
    touchStartY: 0,

    async init() {
        await Database.init();
        
        const loggedIn = await Onboarding.check();
        if(!loggedIn) {
            const splash = document.getElementById('splash-screen');
            if(splash) splash.style.display = 'none';
            return;
        }

        // --- SWIPE DOWN LOGIC ---
        const player = document.getElementById('full-player');
        const queueView = document.getElementById('view-queue');
        const localView = document.getElementById('view-local');
        
        const handleSwipeDown = (e) => {
            this.touchStartY = e.touches[0].clientY;
            this.touchStartX = e.touches[0].clientX;
        };
        const handleSwipeMove = (e) => {
            const touchY = e.touches[0].clientY;
            const diff = touchY - this.touchStartY;
            if (diff > 150) { 
                if (player && !player.classList.contains('hidden')) {
                    UI.togglePlayer(false);
                } else if (queueView && !queueView.classList.contains('hidden')) {
                    UI.toggleQueue(false);
                    UI.switchView('home');
                } else if (localView && !localView.classList.contains('hidden')) {
                    UI.switchView('home');
                }
                this.touchStartY = 0;
            }
        };

        if(player) {
            player.addEventListener('touchstart', handleSwipeDown);
            player.addEventListener('touchmove', handleSwipeMove);
        }
        if(queueView) {
            queueView.addEventListener('touchstart', handleSwipeDown);
            queueView.addEventListener('touchmove', handleSwipeMove);
        }
        if(localView) {
            localView.addEventListener('touchstart', handleSwipeDown);
            localView.addEventListener('touchmove', handleSwipeMove);
        }

        // --- SWIPE RIGHT (Mini Player) -> SKIP ---
        const miniPlayer = document.getElementById('mini-player');
        if(miniPlayer) {
            const handleMiniSwipeMove = (e) => {
                const touchX = e.touches[0].clientX;
                const diff = touchX - this.touchStartX;
                if (diff > 150) { // Swipe Right
                    Queue.next();
                    // Visual feedback
                    miniPlayer.classList.add('translate-x-full'); 
                    setTimeout(() => miniPlayer.classList.remove('translate-x-full'), 300);
                    this.touchStartX = 0;
                }
            };
            miniPlayer.addEventListener('touchstart', handleSwipeDown);
            miniPlayer.addEventListener('touchmove', handleMiniSwipeMove);
            // Reset on touchend
            miniPlayer.addEventListener('touchend', () => { this.touchStartX = 0; });
        }

        await this.initData();
        LocalFiles.init();
        
        setInterval(() => {
            const now = new Date();
            const timeEl = document.getElementById('system-time');
            if(timeEl) timeEl.innerText = now.getHours() + ":" + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
        }, 1000);

        const searchInput = document.getElementById('main-search');
        if(searchInput) {
            searchInput.addEventListener('input', debounce(async (e) => {
                if (e.target.value.length < 2) return;
                const results = await API.search(e.target.value);
                this.renderSearchResults(results);
            }, 500));
            searchInput.addEventListener('focus', () => {
                if(State.preferences.historyEnabled && State.searchHistory.length > 0) {
                    const panel = document.getElementById('search-history-panel');
                    if(panel) panel.classList.remove('hidden');
                }
            });
        }
        this.checkAnnouncements();
    },

    checkAnnouncements() {
        const lastSeen = localStorage.getItem('sniplit_announcement_seen');
        if (!lastSeen || lastSeen !== 'v1') {
            const bar = document.getElementById('announcement-bar');
            if(bar) bar.classList.remove('hidden');
        } else {
            const bar = document.getElementById('announcement-bar');
            if(bar) bar.remove();
        }
    },

    async initData() {
        const stats = await Database.getAnalytics();
        if(stats) {
            State.analytics = stats;
            State.analytics.appOpens++;
            Database.saveAnalytics(State.analytics);
        }

        const savedPrefs = await Database.get('preferences');
        if(savedPrefs) { 
            State.preferences = { ...State.preferences, ...savedPrefs };
            this.applySettingsUI();
        }
        if(State.preferences.lightMode) document.body.classList.add('light-mode');

        State.user = await Database.get('user_name');
        const greetingEl = document.getElementById('greeting');
        if(greetingEl) greetingEl.innerText = `Welcome, ${State.user}`;

        const history = await Database.get('history');
        if(history) State.history = history;

        const sh = await Database.get('search_history');
        if(sh) State.searchHistory = sh;
        this.renderSearchHistory();

        const genres = await Database.get('genres');
        if(genres) State.genres = new Set(genres);

        State.playlists = await Database.getPlaylists();
        const favs = await Database.get('favorites');
        if(favs) State.favorites = favs;

        const followed = await Database.getFollowed();
        if(followed) State.followedArtists = followed;
        
        const localFiles = await Database.getLocalFiles();
        if(localFiles) State.localFiles = localFiles;

        AudioEngine.init();
        this.initVisualizer();
        if(window.lucide) lucide.createIcons();
        
        // Load Home Data at launch (Smart Discovery)
        this.loadHomeData();

        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 800);
        }
    },

    updateMiniPlayerState() {
        const iconContainer = document.getElementById('mini-play-icon');
        if(!iconContainer || !iconContainer.parentElement) return;
        
        let icon = 'play';
        let html = '';

        if (State.isLoading) {
            html = `<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;
        } else if (State.isPlaying) {
            icon = 'pause';
            html = `<i data-lucide="${icon}" class="w-4 h-4 fill-white"></i>`;
        } else {
            icon = 'play';
            html = `<i data-lucide="${icon}" class="w-4 h-4 fill-white"></i>`;
        }

        if (iconContainer.innerHTML !== html) {
            iconContainer.innerHTML = html;
            if(window.lucide) lucide.createIcons();
        }
    },

    switchView(id) {
        const views = ['home', 'search', 'library', 'artist', 'playlist', 'liked-songs', 'following', 'queue', 'local'];
        
        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if(el) {
                el.classList.add('hidden');
                if(v !== 'queue') {
                     const q = document.getElementById('view-queue');
                     if(q) q.classList.add('hidden');
                }
            }
        });

        requestAnimationFrame(() => {
            const el = document.getElementById(`view-${id}`);
            if(el) {
                el.classList.remove('hidden');
            }
        });
        
        if(id === 'home') this.loadHomeData();
        if(id === 'library') this.renderLibrary();
    },

    toggleView(id) {
        const top = this.viewStack[this.viewStack.length - 1];
        if (top !== id) {
            this.viewStack.push(id);
        }

        this.switchView(id);
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        if(['home', 'search', 'library'].includes(id)) {
            const btn = document.querySelector(`.nav-btn[data-view="${id}"]`);
            if(btn) btn.classList.add('active');
        }
        
        const queueView = document.getElementById('view-queue');
        if(id !== 'queue' && queueView) {
            queueView.classList.add('hidden');
        }
    },

    back() {
        if (this.viewStack.length > 1) {
            this.viewStack.pop();
            const prev = this.viewStack.pop();
            this.switchView(prev);
        } else {
            this.switchView('home');
        }
    },

    togglePlayer(show) {
        const el = document.getElementById('full-player');
        if (show) {
            if(el) el.classList.remove('hidden');
            requestAnimationFrame(() => {
                if(el) el.classList.remove('translate-y-full');
            });
        } else {
            if(el) {
                el.classList.add('translate-y-full');
                setTimeout(() => el.classList.add('hidden'), 500);
            }
        }
    },

    toggleLyrics() { 
        const p = document.getElementById('lyrics-panel');
        if(p) p.classList.toggle('hidden'); 
    },
    openSettings() { 
        const m = document.getElementById('modal-settings');
        if(m) {
            m.classList.remove('hidden');
            m.style.zIndex = "60";
        }
        else UI.toast("Settings UI not found");
    },
    closeSettings() { 
        const m = document.getElementById('modal-settings');
        if(m) {
            m.classList.add('hidden');
        }
    },

    async loadHomeData() {
        const recentsGrid = document.getElementById('recents-grid');
        if(!recentsGrid) return;
        recentsGrid.innerHTML = '';
        const uniqueHistory = Array.from(new Set(State.history.map(a => a.trackId)))
            .map(id => State.history.find(a => a.trackId === id))
            .slice(0, 4);
        
        uniqueHistory.forEach(t => {
            recentsGrid.innerHTML += `
                <div class="flex items-center gap-3 bg-zinc-900/50 p-2.5 rounded-xl border border-white/5 hover:bg-white/10 transition cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                    <img src="${t.artworkUrl100}" class="w-10 h-10 rounded-lg object-cover shadow-sm">
                    <div class="min-w-0 flex-1">
                        <p class="text-[11px] font-bold text-white">${Security.safeText(t.trackName)}</p>
                        <p class="text-[9px] text-zinc-500 font-bold uppercase">${Security.safeText(t.artistName)}</p>
                    </div>
                </div>`;
        });
        if(uniqueHistory.length === 0) recentsGrid.innerHTML = '<div class="col-span-2 py-4 text-center text-zinc-700 text-[10px] font-mono border border-dashed border-zinc-800 rounded-xl">Start listening to build history</div>';

        // "For You" Grid Logic
        const forYouGrid = document.getElementById('for-you-grid');
        if(forYouGrid) {
            if (forYouGrid.children.length === 0) {
                forYouGrid.innerHTML = '<div class="w-full flex justify-center py-10"><div class="skeleton w-32 h-32 rounded-xl"></div></div>';
            }
        }
        
        // Initial Load: Use User's Favorite Genre, else Trending
        const genre = State.preferences.favoriteGenre || 'Trending';
        this.discoverGenre(genre);
    },
    
    discoverGenre(genre) {
        // Update Tabs UI
        const tabs = document.getElementById('discovery-tabs');
        if(tabs) {
            const buttons = tabs.querySelectorAll('button');
            buttons.forEach(b => {
                if (b.innerText === genre) {
                    b.className = "px-3 py-1 bg-white text-black text-[10px] font-bold uppercase rounded-lg transition";
                } else {
                    b.className = "px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase rounded-lg transition hover:bg-white/10 hover:text-white";
                }
            });
        }

        const forYouGrid = document.getElementById('for-you-grid');
        if(!forYouGrid) return;

        let searchTerm = "";
        if(genre === 'Trending') searchTerm = "Pop 2024"; // Better fallback
        else searchTerm = `${genre} Hits 2024`;

        API.search(searchTerm).then(suggestions => {
            if(!suggestions || suggestions.length === 0) {
                 forYouGrid.innerHTML = '<div class="w-full text-center text-zinc-600 text-xs py-4">No results found</div>';
                 return;
            }
            forYouGrid.innerHTML = '';
            suggestions.slice(0,6).forEach(t => {
                forYouGrid.innerHTML += `
                    <div class="flex-shrink-0 w-32 space-y-2 cursor-pointer group" onclick="Queue.set([${this.esc(t)}])">
                        <div class="relative overflow-hidden rounded-xl">
                            <img src="${t.artworkUrl100.replace('100x100', '400x400')}" class="w-32 h-32 object-cover bg-zinc-900 border border-white/5 group-hover:scale-105 transition duration-500">
                        </div>
                        <div class="px-1">
                            <p class="text-[11px] font-bold text-white">${Security.safeText(t.trackName)}</p>
                            <p class="text-[9px] text-zinc-500 font-bold uppercase">${Security.safeText(t.artistName)}</p>
                        </div>
                    </div>`;
            });
            if(window.lucide) lucide.createIcons();
        }).catch(e => {
             forYouGrid.innerHTML = '<div class="w-full text-center text-red-500 text-xs py-4">Connection Error</div>';
        });
    },

    renderSearchResults(results) {
        const panel = document.getElementById('search-history-panel');
        if(panel) panel.classList.add('hidden');
        const container = document.getElementById('search-results');
        if(!container) return;
        container.classList.remove('hidden');
        container.innerHTML = '';
        const input = document.getElementById('main-search');
        const term = input ? input.value : '';
        if(term && State.preferences.historyEnabled) {
             if(!State.searchHistory.includes(term)) {
                 State.searchHistory.unshift(term);
                 if(State.searchHistory.length > 10) State.searchHistory.pop();
                 Database.save('search_history', State.searchHistory);
                 this.renderSearchHistory();
             }
        }
        
        // --- FIX: Dedupe Results ---
        const uniqueIds = [];
        const uniqueResults = [];
        if(results) {
             results.forEach(t => {
                 if(!uniqueIds.includes(t.trackId)) {
                     uniqueResults.push(t);
                     uniqueIds.push(t.trackId);
                 }
             });
        }

        if(uniqueResults.length === 0) {
            container.innerHTML = '<p class="text-center text-zinc-600 text-xs py-10">No results found</p>';
            return;
        }

        uniqueResults.forEach(t => {
            container.innerHTML += `
                <div class="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition cursor-pointer group border border-transparent hover:border-white/5" onclick="Queue.set([${this.esc(t)}])">
                    <div class="relative w-12 h-12 flex-shrink-0">
                        <img src="${t.artworkUrl100}" class="w-full h-full rounded-lg object-cover shadow-lg">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5">
                            <h4 class="text-sm font-bold text-white">${Security.safeText(t.trackName)}</h4>
                            ${t.trackExplicitness === 'explicit' ? '<span class="bg-zinc-800 text-zinc-500 text-[8px] font-bold px-1 rounded flex-shrink-0 border border-zinc-700">E</span>' : ''}
                        </div>
                        <p class="text-xs text-zinc-500 font-bold uppercase tracking-wide hover:text-white transition" onclick="event.stopPropagation(); UI.openArtistProfile(${this.esc(t)})">${Security.safeText(t.artistName)}</p>
                    </div>
                    <button class="p-2 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded-full transition" onclick="event.stopPropagation(); Queue.add(${this.esc(t)})"><i data-lucide="plus" class="w-4 h-4"></i></button>
                </div>`;
        });
        if(window.lucide) lucide.createIcons();
    },

    renderSearchHistory() {
        const container = document.getElementById('search-history-chips');
        if(!container) return;
        container.innerHTML = State.searchHistory.map(term => 
            `<span class="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-400 uppercase cursor-pointer hover:border-white/20 hover:text-white transition" onclick="document.getElementById('main-search').value='${Security.escapeHtml(term)}'; document.getElementById('main-search').dispatchEvent(new Event('input'));">${Security.escapeHtml(term)}</span>`
        ).join('');
    },

    async openArtistProfile(trackObj) {
        this.switchView('artist');
        
        const name = trackObj.artistName;
        const id = trackObj.artistId;
        const isFollowed = State.followedArtists.some(a => a.name === name);
        const hero = document.getElementById('artist-hero');
        if(hero) {
            hero.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <h1 class="text-4xl font-black tracking-tighter text-white leading-none">${Security.escapeHtml(name)}</h1>
                </div>
                <div class="flex items-center gap-3">
                     <button id="follow-btn" onclick="UI.toggleFollow('${id}', '${name.replace(/'/g, "\\'")}')" class="px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition ${isFollowed ? 'bg-white text-black' : 'bg-zinc-800 text-white border border-zinc-700'}">
                        ${isFollowed ? 'Following' : 'Follow'}
                    </button>
                    <p class="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">${trackObj.primaryGenreName || 'Artist'}</p>
                </div>
            `;
        }
        const topTracksDiv = document.getElementById('artist-top-tracks');
        if(topTracksDiv) topTracksDiv.innerHTML = '<div class="space-y-2"><div class="skeleton h-12 w-full"></div><div class="skeleton h-12 w-full"></div></div>';
        const topTracks = await API.search(name);
        if(topTracksDiv) {
            topTracksDiv.innerHTML = `<h3 class="text-sm font-bold text-zinc-500 uppercase mb-2">Top Songs</h3>`;
            if(!topTracks || topTracks.length === 0) {
                topTracksDiv.innerHTML += '<p class="text-zinc-600 text-xs">No tracks found</p>';
            } else {
                // --- FIX: Dedupe results ---
                const uniqueIds = [];
                const uniqueResults = [];
                topTracks.forEach(t => {
                     if(!uniqueIds.includes(t.trackId)) {
                         uniqueResults.push(t);
                         uniqueIds.push(t.trackId);
                     }
                });
                
                uniqueResults.slice(0, 5).forEach((t, i) => {
                    topTracksDiv.innerHTML += `
                        <div class="flex items-center gap-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 -mx-4 px-4 transition" onclick="Queue.set([${this.esc(t)}])">
                            <span class="text-xs font-mono text-zinc-700 w-4">${i+1}</span>
                            <div class="flex-1 text-sm font-bold text-zinc-300 group-hover:text-white">${Security.safeText(t.trackName)}</div>
                        </div>`;
                });
            }
        }
        if(id) {
            const albums = await API.getArtistDiscography(id);
            const albumGrid = document.getElementById('artist-albums');
            if(albumGrid) {
                albumGrid.innerHTML = '';
                if(albums && albums.length > 1) {
                    albums.slice(1).forEach(a => {
                        albumGrid.innerHTML += `
                            <div class="space-y-2 group cursor-pointer" onclick="UI.openAlbum('${a.collectionId}', '${a.collectionName.replace(/'/g, "\\'")}', '${a.artworkUrl100}')">
                                <img src="${a.artworkUrl100.replace('100x100','400x400')}" class="w-full aspect-square rounded-xl object-cover border border-white/5 group-hover:border-white/20 transition">
                                <p class="text-[10px] font-bold text-zinc-400 group-hover:text-white">${Security.escapeHtml(a.collectionName)}</p>
                            </div>`;
                    });
                }
            }
        }
        if(window.lucide) lucide.createIcons();    },

    async openAlbum(id, name, art) {
        this.switchView('playlist');
        const hero = document.getElementById('playlist-hero');
        if(hero) hero.innerHTML = `<div class="skeleton w-full h-40"></div>`; 
        const tracks = await API.getAlbumTracks(id);
        if(hero) {
            hero.innerHTML = `
                <div class="flex items-end gap-5">
                    <img src="${art.replace('100x100','300x300')}" class="w-28 h-28 rounded-xl shadow-2xl border border-white/10">
                    <div>
                        <h1 class="text-2xl font-black leading-tight mb-1 line-clamp-2">${Security.escapeHtml(name)}</h1>
                        <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3">${tracks.length} Songs</p>
                         <button onclick="Queue.set(${this.esc(tracks)})" class="px-5 py-2 bg-white text-black rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:scale-105 transition">Play Album</button>
                    </div>
                </div>`;
        }
        const list = document.getElementById('playlist-tracks');
        if(list) {
            list.innerHTML = '';
            tracks.forEach((t, i) => {
                list.innerHTML += `
                    <div class="flex items-center gap-4 py-3.5 border-b border-white/5 group hover:bg-white/5 -mx-2 px-2 transition rounded-lg cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                        <span class="text-xs font-mono text-zinc-600 w-4">${i+1}</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-zinc-200 group-hover:text-white">${Security.safeText(t.trackName)}</p>
                        </div>
                        <span class="text-[10px] font-mono text-zinc-600">${AudioEngine.formatTime(t.trackTimeMillis/1000)}</span>
                    </div>`;
            });
        }
    },

    renderLikedSongs() {
        this.switchView('liked-songs');
        const hero = document.getElementById('playlist-hero');
        if(hero) {
            hero.innerHTML = `
                <div class="flex items-end gap-5">
                    <div class="w-28 h-28 bg-gradient-to-tr from-indigo-900 to-black rounded-xl flex items-center justify-center border border-white/10 shadow-xl">
                        <i data-lucide="heart" class="w-10 h-10 fill-indigo-400 text-indigo-400"></i>
                    </div>
                    <div>
                        <h1 class="text-3xl font-black leading-none mb-2">Liked Songs</h1>
                        <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-4">${State.favorites.length} Songs</p>
                        <div class="flex gap-3">
                            <button onclick="Queue.set(State.favorites)" class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition"><i data-lucide="play" class="w-4 h-4 fill-black text-black ml-0.5"></i></button>
                            <button onclick="UI.back()" class="w-10 h-10 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 active:scale-95 transition"><i data-lucide="arrow-left" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                </div>`;
        }
        const list = document.getElementById('playlist-tracks');
        if(list) {
            list.innerHTML = '';
            if(State.favorites.length === 0) {
                list.innerHTML = '<p class="text-center text-zinc-600 text-xs py-10 font-mono">No Liked Songs Yet</p>';
            } else {
                State.favorites.forEach((t, i) => {
                    list.innerHTML += `
                        <div class="flex items-center gap-4 py-3 border-b border-white/5 group hover:bg-white/5 -mx-2 px-2 transition rounded-lg">
                            <span class="text-xs font-mono text-zinc-700 w-4">${i+1}</span>
                            <div class="flex-1 min-w-0 cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                                <p class="text-sm font-bold text-zinc-200">${Security.safeText(t.trackName)}</p>
                                <p class="text-[10px] text-zinc-500 uppercase font-bold">${Security.safeText(t.artistName)}</p>
                            </div>
                            <button onclick="Library.toggleLike(); UI.renderLikedSongs()" class="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:text-red-600 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>`;
                });
            }
            if(window.lucide) lucide.createIcons();
        }
    },

    renderFollowing() {
        this.switchView('following');
        const hero = document.getElementById('playlist-hero');
        if(hero) {
            hero.innerHTML = `
                <div class="flex items-end gap-5">
                    <div class="w-28 h-28 bg-gradient-to-tr from-gray-900 to-white rounded-xl flex items-center justify-center border border-white/10 shadow-xl">
                        <i data-lucide="mic-2" class="w-10 h-10 fill-black text-black"></i>
                    </div>
                    <div>
                        <h1 class="text-3xl font-black leading-none mb-2">Following</h1>
                        <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-4">${State.followedArtists.length} Artists</p>
                        <button onclick="UI.back()" class="w-10 h-10 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 active:scale-95 transition"><i data-lucide="arrow-left" class="w-4 h-4"></i></button>
                    </div>
                </div>`;
        }
        const list = document.getElementById('playlist-tracks');
        if(list) {
            list.innerHTML = '';
            if(State.followedArtists.length === 0) {
                list.innerHTML = '<p class="text-center text-zinc-600 text-xs py-10 font-mono">You are not following anyone yet.</p>';
            } else {
                list.className = "grid grid-cols-2 gap-4 pb-32 overflow-y-auto";
                State.followedArtists.forEach(a => {
                    list.innerHTML += `
                        <div class="bg-zinc-900/30 p-4 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-900 transition group" onclick="UI.openArtistProfile({artistName: '${Security.escapeHtml(a.name).replace(/'/g, "\\'")}', artistId: '${a.id}'})">
                            <div class="w-12 h-12 mb-3 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
                                <i data-lucide="mic-2" class="w-6 h-6 text-zinc-500"></i>
                            </div>
                            <p class="text-center text-sm font-bold text-white">${Security.safeText(a.name)}</p>
                            <p class="text-center text-[9px] text-zinc-500 uppercase font-bold">Artist</p>
                        </div>`;
                });
            }
            if(window.lucide) lucide.createIcons();
        }
    },

    renderPlaylistView(playlist) {
        const list = document.getElementById('playlist-tracks');
        if(list) list.className = ""; 

        this.switchView('playlist');
        const hero = document.getElementById('playlist-hero');
        if(hero) {
            hero.innerHTML = `
                <div class="flex items-end gap-5">
                    <div class="w-28 h-28 bg-gradient-to-tr from-zinc-800 to-zinc-900 rounded-xl flex items-center justify-center border border-white/10 shadow-xl">
                        <i data-lucide="music" class="w-10 h-10 text-zinc-500"></i>
                    </div>
                    <div>
                        <h1 class="text-3xl font-black leading-none mb-2">${Security.escapeHtml(playlist.name)}</h1>
                        <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-4">${playlist.tracks.length} Songs</p>
                        <div class="flex gap-3">
                            <button onclick="Queue.set(${this.esc(playlist.tracks)})" class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition"><i data-lucide="play" class="w-4 h-4 fill-black text-black ml-0.5"></i></button>
                            <button onclick="Library.deletePlaylist('${playlist.id}')" class="w-10 h-10 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 active:scale-95 transition hover:bg-red-900/20 hover:text-red-500 hover:border-red-500/50"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                </div>`;
        }
        if(list) {
            list.innerHTML = '';
            if(playlist.tracks.length === 0) {
                list.innerHTML = '<p class="text-center text-zinc-600 text-xs py-10 font-mono">Empty Playlist</p>';
            } else {
                playlist.tracks.forEach((t, i) => {
                    list.innerHTML += `
                        <div class="flex items-center gap-4 py-3 border-b border-white/5 group hover:bg-white/5 -mx-2 px-2 transition rounded-lg cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                            <span class="text-xs font-mono text-zinc-600 w-4">${i+1}</span>
                            <div class="flex-1 min-w-0 cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                                <p class="text-sm font-bold text-zinc-200">${Security.escapeHtml(t.trackName)}</p>
                                <p class="text-[10px] text-zinc-500 uppercase font-bold">${Security.escapeHtml(t.artistName)}</p>
                            </div>
                            <button onclick="Library.removeFromPlaylist('${playlist.id}', '${t.trackId}')" class="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-500 transition"><i data-lucide="x" class="w-4 h-4"></i></button>
                        </div>`;
                });
            }
            if(window.lucide) lucide.createIcons();
        }
    },

    showQueue() {
        this.toggleQueue(true);
    },

    renderQueuePage() {
        const hero = document.getElementById('queue-now-playing');
        if(hero && State.currentTrack) {
            hero.innerHTML = `
                <img src="${State.currentTrack.artworkUrl100.replace('100x100', '400x400')}" class="w-24 h-24 rounded-2xl shadow-2xl border border-white/10">
                <div>
                    <h2 class="text-2xl font-black text-white">${Security.safeText(State.currentTrack.trackName)}</h2>
                    <p class="text-zinc-400 text-sm font-bold uppercase">${Security.safeText(State.currentTrack.artistName)}</p>
                </div>
            `;
        }
        const list = document.getElementById('queue-up-next-list');
        if(list) {
            list.innerHTML = '';
            if(State.queue.length <= 1) {
                list.innerHTML = '<p class="text-zinc-600 text-xs text-center italic">Queue is empty</p>';
            } else {
                State.queue.slice(Queue.index + 1).forEach((t, i) => {
                     list.innerHTML += `
                        <div class="flex items-center gap-4 p-4 bg-zinc-900 rounded-xl border border-white/5 cursor-pointer hover:bg-zinc-800 transition" onclick="Queue.set(State.queue, ${Queue.index + 1 + i})">
                             <img src="${t.artworkUrl100}" class="w-10 h-10 rounded-lg">
                             <div>
                                 <p class="text-xs font-bold text-white">${Security.safeText(t.trackName)}</p>
                                 <p class="text-[10px] text-zinc-500 uppercase font-bold">${Security.safeText(t.artistName)}</p>
                             </div>
                        </div>
                     `;
                });
            }
        }
        if(window.lucide) lucide.createIcons();
    },

    renderLocalLibrary() {
        this.switchView('local');
        const list = document.getElementById('local-list');
        if(list) {
            list.innerHTML = '';
            if(State.localFiles.length === 0) {
                list.innerHTML = '<p class="text-center text-zinc-600 text-xs py-10 font-mono">No Local Files Imported</p>';
            } else {
                State.localFiles.forEach((t, i) => {
                    list.innerHTML += `
                        <div class="flex items-center gap-4 p-3 bg-zinc-900 rounded-xl border border-white/5 cursor-pointer hover:bg-zinc-800 transition" onclick="Queue.set([${this.esc(t)}])">
                            <div class="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center">
                                <i data-lucide="music" class="w-5 h-5 text-zinc-500"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-white">${Security.safeText(t.trackName)}</p>
                                <p class="text-[10px] text-zinc-500 uppercase font-bold">Local File</p>
                            </div>
                        </div>`;
                });
            }
        }
        if(window.lucide) lucide.createIcons();
    },

    async renderLibrary() {
        const list = document.getElementById('library-list');
        if(!list) return;
        
        // --- FIX: Render content even if empty ---
        let html = '';
        
        html += `
            <div class="flex items-center justify-between p-4 bg-zinc-900/30 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-900 transition group mb-3" onclick="UI.renderLikedSongs()">
                 <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-900 to-black flex items-center justify-center border border-indigo-500/20 shadow-lg group-hover:scale-105 transition">
                        <i data-lucide="heart" class="w-5 h-5 fill-indigo-400 text-indigo-400"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-white">Liked Songs</p>
                        <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">${State.favorites.length} Tracks</p>
                    </div>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700"></i>
            </div>
        `;

        html += `
            <div class="flex items-center justify-between p-4 bg-zinc-900/30 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-900 transition group mb-3" onclick="UI.renderFollowing()">
                 <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-900 to-white flex items-center justify-center border border-indigo-500/20 shadow-lg group-hover:scale-105 transition">
                        <i data-lucide="mic-2" class="w-5 h-5 fill-black-400 text-black-400"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-white">Following</p>
                        <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">${State.followedArtists.length} Artists</p>
                    </div>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700"></i>
            </div>
        `;

        html += `
            <div class="flex items-center justify-between p-4 bg-zinc-900/30 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-900 transition group mb-3" onclick="UI.renderLocalLibrary()">
                 <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 to-black flex items-center justify-center border border-blue-500/20 shadow-lg group-hover:scale-105 transition">
                        <i data-lucide="hard-drive" class="w-5 h-5 fill-blue-400 text-blue-400"></i>
                    </div>
                    <div>
                        <p class="text-sm font-bold text-white">Local Files</p>
                        <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">${State.localFiles.length} Files</p>
                    </div>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700"></i>
            </div>
        `;

        State.playlists.forEach(pl => {
            html += `
                <div class="flex items-center justify-between p-4 bg-zinc-900/30 rounded-2xl border border-white/5 mb-2 cursor-pointer hover:bg-zinc-900 transition group" onclick="UI.renderPlaylistView(State.playlists.find(p => p.id === '${pl.id}'))">
                     <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-black flex items-center justify-center border border-white/5 shadow-lg group-hover:scale-105 transition">
                            <i data-lucide="music-2" class="w-5 h-5 text-zinc-400"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-white">${Security.escapeHtml(pl.name)}</p>
                            <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">${pl.tracks.length} Tracks</p>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700"></i>
                </div>`;
        });
        list.innerHTML = html;
        if(window.lucide) lucide.createIcons();
    },

    updatePlayerUI() {
        const t = State.currentTrack;
        if(!t) return;
        // Update Mini Player
        const miniPlayer = document.getElementById('mini-player');
        if(miniPlayer) {
            miniPlayer.classList.remove('hidden');
            miniPlayer.classList.add('-translate-y-2');
            setTimeout(() => miniPlayer.classList.remove('-translate-y-2'), 200);
            const miniTitle = document.getElementById('mini-title');
            const miniArtist = document.getElementById('mini-artist');
            const miniArt = document.getElementById('mini-art');
            if(miniTitle) miniTitle.innerText = Security.safeText(t.trackName);
            if(miniArtist) miniArtist.innerText = Security.safeText(t.artistName);
            if(miniArt) miniArt.src = t.artworkUrl100;
        }
        // Update Full Player
        const playerTitle = document.getElementById('player-title');
        const playerArtist = document.getElementById('player-artist');
        const playerArt = document.getElementById('player-art');
        if(playerTitle) playerTitle.innerText = Security.safeText(t.trackName);
        if(playerArtist) playerArtist.innerText = Security.safeText(t.artistName);
        if(playerArt) playerArt.src = t.artworkUrl100.replace('100x100', '600x600');
        const likeBtn = document.getElementById('like-btn');
        if(likeBtn) {
            const isFav = State.favorites.some(f => f.trackId === t.trackId);
            likeBtn.innerHTML = `<i data-lucide="heart" class="w-5 h-5 ${isFav ? 'fill-red-500 text-red-500' : 'text-zinc-500'}"></i>`;
        }
        if(window.lucide) lucide.createIcons();
    },

    updatePlaybackState() {
        const icon = State.isPlaying ? 'pause' : 'play';
        const miniIcon = document.getElementById('mini-play-icon');
        if(miniIcon && miniIcon.parentElement) {
            miniIcon.parentElement.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 fill-white"></i>`;
        }
        const mainBtn = document.getElementById('main-play-btn');
        if(mainBtn) {
            mainBtn.innerHTML = `<i data-lucide="${icon}" class="w-8 h-8 fill-black ${icon === 'play' ? 'ml-1' : ''}"></i>`;
        }
        if(window.lucide) lucide.createIcons();
    },

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
                ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`; 
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

    toggleTheme() {
        State.preferences.lightMode = !State.preferences.lightMode;
        document.body.classList.toggle('light-mode');
        Database.save('preferences', State.preferences);
        UI.toast(State.preferences.lightMode ? "Light Mode On" : "Dark Mode On");
    },

    toggleFollow(id, name) {
        const idx = State.followedArtists.findIndex(a => a.name === name);
        const btn = document.getElementById('follow-btn');
        if(idx > -1) {
            State.followedArtists.splice(idx, 1);
            if(btn) {
                btn.innerText = "Follow";
                btn.className = "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition bg-zinc-800 text-white border border-zinc-700";
            }
            UI.toast(`Unfollowed ${name}`);
        } else {
            State.followedArtists.push({ id, name });
            if(btn) {
                btn.innerText = "Following";
                btn.className = "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition bg-white text-black";
            }
            UI.toast(`Following ${name}`);
        }
        Database.saveFollowed(State.followedArtists);
        this.renderLibrary();
    },

    showWrapped() {
        if(Wrapped.calculate()) {
            State.wrapped.slide = 0;
            Wrapped.renderSlide();
            const modal = document.getElementById('wrapped-modal');
            if(modal) modal.classList.remove('hidden');
            const btn = document.getElementById('wrapped-next-btn');
            if(btn) {
                btn.innerText = "Next";
                btn.onclick = () => Wrapped.nextSlide();
            }
        }
    },
    openAddToPlaylist() {
        if(!State.currentTrack) return;
        const list = document.getElementById('playlist-select-list');
        if(!list) return;
        list.innerHTML = '';
        if(State.playlists.length === 0) {
            list.innerHTML = '<p class="text-xs text-zinc-500 text-center mt-10 font-bold uppercase">No Playlists</p><button onclick="UI.showCreatePlaylist()" class="w-full mt-4 py-3 bg-white text-black text-xs font-bold uppercase rounded-lg">Create One</button>';
        } else {
            State.playlists.forEach(pl => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left p-4 bg-zinc-900 rounded-xl flex items-center justify-between border border-white/5 mb-2 hover:bg-zinc-800 transition';
                btn.innerHTML = `<span class="font-bold text-sm text-white">${Security.escapeHtml(pl.name)}</span> <span class="text-[10px] text-zinc-500 font-bold">${pl.tracks.length} Songs</span>`;
                btn.onclick = () => Library.addToPlaylist(pl.id);
                list.appendChild(btn);
            });
        }
        const modal = document.getElementById('modal-add-playlist');
        if(modal) modal.classList.add('active');
    },
    showCreatePlaylist() { 
          UI.triggerPrompt('Create Playlist', 'Enter playlist name', (name) => Library.createPlaylist(name));
     },
    toggleSetting(key, el) {
        State.preferences[key] = !State.preferences[key];
        Database.save('preferences', State.preferences);
        const knob = el.querySelector('div');
        if(State.preferences[key]) {
            el.classList.remove('bg-zinc-700'); el.classList.add('bg-blue-600');
            knob.classList.add('translate-x-5'); knob.classList.remove('bg-white'); knob.classList.add('bg-white');
        } else {
            el.classList.add('bg-zinc-700'); el.classList.remove('bg-blue-600');
            knob.classList.remove('translate-x-5'); knob.classList.add('bg-white'); knob.classList.remove('bg-white');
        }
    },
    applySettingsUI() {
        // Handle Viz Opacity Slider
        const vizOpacityEl = document.getElementById('toggle-vizOpacity');
        if(vizOpacityEl) {
             vizOpacityEl.value = State.preferences.vizOpacity;
             vizOpacityEl.oninput = (e) => {
                 State.preferences.vizOpacity = e.target.value;
                 Database.save('preferences', State.preferences);
             };
        }

        ['quality', 'viz', 'haptics', 'historyEnabled'].forEach(k => {
            const el = document.getElementById(`toggle-${k}`);
            if(!el) return;
            const knob = el.querySelector('div');
            if(State.preferences[k]) {
                el.classList.add('bg-blue-600'); el.classList.remove('bg-zinc-700');
                knob.classList.add('translate-x-5'); knob.classList.remove('bg-white'); knob.classList.add('bg-white');
            } else {
                el.classList.add('bg-zinc-700'); el.classList.remove('bg-blue-600');
                knob.classList.remove('translate-x-5'); knob.classList.add('bg-white'); knob.classList.remove('bg-white');
            }
        });
    },
    logout() {
         UI.triggerConfirm("Log out", "Are you sure?", async () => {
            location.reload();
         });
    },
    exportData() {
        const data = {
            user: State.user,
            favorites: State.favorites,
            followedArtists: State.followedArtists,
            playlists: State.playlists,
            history: State.history,
            analytics: State.analytics,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sniplit-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.toast("Library Exported");
    },
    triggerAlert(title, msg) {
        const t = document.getElementById('alert-title');
        const m = document.getElementById('alert-msg');
        const a = document.getElementById('ui-alert');
        if(t) t.innerText = title;
        if(m) m.innerText = msg;
        if(a) a.classList.add('active');
    },
    closeAlert() { 
        const a = document.getElementById('ui-alert');
        if(a) a.classList.remove('active'); 
    },
    triggerConfirm(title, msg, onYes) {
        const t = document.getElementById('confirm-title');
        const m = document.getElementById('confirm-msg');
        const btn = document.getElementById('confirm-yes-btn');
        const c = document.getElementById('ui-confirm');
        if(t) t.innerText = title;
        if(m) m.innerText = msg;
        if(btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => { onYes(); UI.closeConfirm(); });
        }
        if(c) c.classList.add('active');
    },
    closeConfirm() { 
        const c = document.getElementById('ui-confirm');
        if(c) c.classList.remove('active'); 
    },
    triggerPrompt(title, placeholder, onSubmit) {
        const t = document.getElementById('prompt-title');
        const i = document.getElementById('prompt-input');
        const btn = document.getElementById('prompt-yes-btn');
        const p = document.getElementById('ui-prompt');
        if(t) t.innerText = title;
        if(i) {
            i.value = '';
            i.placeholder = placeholder;
        }
        if(btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => { onSubmit(i.value); UI.closePrompt(); });
        }
        if(p) {
            p.classList.add('active');
            setTimeout(() => i.focus(), 100);
        }
    },
    closePrompt() { 
        const p = document.getElementById('ui-prompt');
        if(p) p.classList.remove('active'); 
    },
    toast(msg) {
        const t = document.getElementById('toast');
        if(t) {
            t.innerText = msg;
            t.style.opacity = '1';
            setTimeout(() => t.style.opacity = '0', 2000);
        }
    },
    esc(obj) { return JSON.stringify(obj).replace(/"/g, '&quot;'); }
};

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

window.onload = UI.init.bind(UI);

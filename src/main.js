// --- GLOBAL CONSTANTS & CONFIG ---
const CONFIG = {
    VERSION: '2.6.0-Pro',
    BUILD: '2026-Beta',
    ANIMATION_SPEED: 300,
    SWIPE_THRESHOLD: 120, 
    DEBOUNCE_RATE: 350,
    SCROLL_MEMORY: true
};

// --- AD SHIELD & LAUNCHER SIMULATION ---
// --- COMPREHENSIVE AD SHIELD & LAUNCHER SIMULATION ---
const AdShield = {
    config: {
        enabled: true,
        launcherMode: false, // Immersive mode
        freezeThreshold: 4, // Seconds to consider frozen
        maxRetries: 2
    },
    
    state: {
        lastTime: 0,
        isAdDetected: false,
        retryCount: 0,
        monitorInterval: null,
        observer: null,
        sessionKey: ''
    },

    // --- 1. INITIALIZATION ---
    init() {
        if(!this.config.enabled) return;
        
        this.state.sessionKey = `sniplit_s_${Math.floor(Math.random() * 1000000)}`;
        this.bindEvents();
        this.setupObserver();
        this.startMonitoring();
        
        Log.info('AdShield', `Initialized with Session Key: ${this.state.sessionKey}`);
    },

    // --- 2. EVENT BINDING ---
    bindEvents() {
        // Hijack Global YouTube API Ready to inject our config
        if (window.onYouTubeIframeAPIReady) {
            const originalReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = (API) => {
                // Monkey-patch the player config function
                if (API && API.Config) {
                    const originalCreate = API.Config;
                    API.Config = (elementId, config) => {
                        const finalConfig = {
                            ...config,
                            playsinline: 1,
                            controls: 0,
                            disablekb: 1,
                            fs: 0, // Disable fullscreen API (stops ads requesting fullscreen)
                            modestbranding: 1,
                            rel: 0 // Prevent related info fetching (reduces ad tracking)
                        };
                        
                        // Apply Launcher Mode settings if active
                        if(this.config.launcherMode) {
                            finalConfig.width = '100%';
                            finalConfig.height = '100%';
                        }

                        return originalCreate(elementId, finalConfig);
                    };
                }
                originalReady(API);
            };
        }

        // Hook into AudioEngine to monitor state changes
        if (AudioEngine.el) {
            AudioEngine.el.addEventListener('timeupdate', () => this.onPlaybackProgress());
            AudioEngine.el.addEventListener('waiting', () => this.triggerBypass('Buffering (Ad Freeze)'));
        }
    },

    // --- 3. OBSERVER (DOM OVERLAY DETECTION) ---
    setupObserver() {
        // MutationObserver to detect specific ad elements being injected into DOM
        // Note: This only works if the Ad scripts inject DOM into the current tab.
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    // Check for known Ad overlay classes
                    if (node.nodeType === 1) { // Element
                        if (node.classList && (
                            node.classList.contains('ytp-ad-persistent-overlay') ||
                            node.classList.contains('ytp-ad-overlay') ||
                            node.classList.contains('ytp-ad-persistent-overlay-text') ||
                            node.classList.contains('ytp-paid-content-overlay') ||
                            node.classList.contains('ytp-error-overlay')
                        )) {
                            this.triggerBypass('DOM Overlay Detected');
                        }
                        
                        // Check for "More" button ad
                        if (node.id && node.id.includes('top-menu')) {
                            this.triggerBypass('Ad Menu Detected');
                        }
                    }
                });
            });
        });

        // Observe body for changes
        this.state.observer = observer;
        document.body && observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    // --- 4. MONITORING (FREEZE DETECTION) ---
    startMonitoring() {
        if (this.state.monitorInterval) clearInterval(this.state.monitorInterval);

        this.state.monitorInterval = setInterval(() => {
            this.checkTimeFreeze();
        }, 1000);
    },

    onPlaybackProgress() {
        const currentTime = AudioEngine.isYouTubeMode && YouTubeEngine.player 
            ? YouTubeEngine.player.getCurrentTime() 
            : AudioEngine.el.currentTime;

        if (currentTime && currentTime > 5) {
            // Reset frozen counter if time is moving normally
            this.state.lastTime = currentTime; 
            this.state.isAdDetected = false;
        }
    },

    checkTimeFreeze() {
        const currentTime = AudioEngine.isYouTubeMode && YouTubeEngine.player 
            ? YouTubeEngine.player.getCurrentTime() 
            : AudioEngine.el.currentTime;
            
        // If playing but time hasn't moved in X seconds
        if (State.isPlaying && Math.abs(currentTime - this.state.lastTime) < 0.1 && currentTime > 5) {
            this.state.retryCount++;
            Log.warn('AdShield', `Playback Frozen (${this.state.retryCount})`);
            
            // If stuck multiple times, force bypass
            if (this.state.retryCount >= 2) {
                this.triggerBypass('Extended Ad Detected');
            }
        } else {
            if(currentTime) this.state.lastTime = currentTime; // Time moved, reset
            this.state.retryCount = 0;
        }
    },

    // --- 5. BYPASS & RESET LOGIC ---
    triggerBypass(reason) {
        Log.info('AdShield', `Triggering Bypass: ${reason}`);
        this.state.isAdDetected = true;
        
        // Visual feedback
        UI.toast("Optimizing Video Stream...");
        
        // 1. Force Reset (The "Switch")
        setTimeout(() => {
            this.resetPlayer();
        }, 100);
    },

    resetPlayer() {
        const yt = YouTubeEngine;
        if (!yt.player) return;

        Log.warn('AdShield', 'Resetting Player Instance');

        try {
            // 1. Pause video
            yt.player.pause();
            yt.player.stopVideo();

            // 2. Clear HTML (Important!)
            // If we destroy and recreate, it's the cleanest "Switch"
            const container = document.getElementById('yt-audio-container');
            if (container) {
                container.innerHTML = ''; // Wipe DOM
            }

            // 3. Force reload via hacky API methods
            // Sometimes simply loadVideoById doesn't reset the ad manifest.
            // We try to trick the player into a new load sequence.
            
            // Trick: Reset internal pointer of player if we can access it (via iframe api)
            // Since we can't access contentWindow, we rely on the YT Player's own internal state reset.
            
            setTimeout(() => {
                // 4. Re-Load track with anti-ad params
                const currentTrack = State.currentTrack;
                if (currentTrack) {
                    const key = AudioEngine.normalizeKey(`${currentTrack.artistName} ${currentTrack.trackName}`);
                    const data = YOUTUBE_DB[key];

                    if (data) {
                        // Anti-Ad URL params
                        // &end=screen : Tries to trick player into thinking video ended on load.
                        // &autoplay=1 : Force play.
                        // &cc_load_policy=1 : Load captions (can interfere with overlays).
                        const videoId = `${data.v}?end=screen&autoplay=1&cc_load_policy=1&sniplit_sess=${this.state.sessionKey}`;
                        
                        yt.player.loadVideoById(videoId);
                        
                        // 5. Set Volume (sometimes resets audio context)
                        yt.player.setVolume(100);
                        yt.player.unMute();
                        
                        // 6. Force Seek (skips pre-roll)
                        setTimeout(() => {
                            yt.player.seekTo(0);
                            yt.player.playVideo();
                        }, 200);
                    }
                }
            }, 300); // Wait for DOM clear to propagate

        } catch (e) {
            Log.err('AdShield', `Reset Failed: ${e.message}`);
            // Fallback: Reload entire page (The "Nuclear" option)
            // We only do this if multiple resets failed to avoid infinite loops
            this.state.retryCount++;
            if(this.state.retryCount > 5) {
                 window.location.reload();
            }
        }
    },

    // --- 6. LAUNCHER MODE (IMMERSIVE CSS) ---
    toggleLauncher() {
        this.config.launcherMode = !this.config.launcherMode;
        const overlay = document.getElementById('launcher-overlay');
        const playerContainer = document.getElementById('yt-audio-container');
        const miniPlayer = document.getElementById('mini-player');
        const fullPlayer = document.getElementById('full-player');

        if (!overlay || !playerContainer) {
            console.warn("AdShield: Launcher HTML elements missing");
            return;
        }

        if (this.config.launcherMode) {
            // --- TURN ON (VPN SIMULATION) ---
            Log.info('AdShield', 'Enabling Launcher Mode');
            
            // 1. Visuals
            if (overlay) overlay.classList.remove('hidden');
            
            // 2. Player Styling (Full Screen)
            // Make the player look like a separate app
            if (playerContainer) {
                playerContainer.classList.remove('hidden'); // Ensure visible
                playerContainer.classList.add('fixed', 'inset-0', 'z-50', 'w-full', 'h-full', 'bg-black');
                playerContainer.style.width = '100%';
                playerContainer.style.height = '100vh';
            }

            // 3. Hide other UI
            document.body.classList.add('overflow-hidden'); // Prevent scrolling body
            
            // 4. Hide Full Player UI (if separate) and just show iframe
            if (fullPlayer) fullPlayer.classList.add('hidden');
            if (miniPlayer) miniPlayer.classList.add('hidden');

            UI.toast("Launcher Mode: ACTIVE");

        } else {
            // --- TURN OFF ---
            Log.info('AdShield', 'Disabling Launcher Mode');
            
            // 1. Visuals
            if (overlay) overlay.classList.add('hidden');
            
            // 2. Reset Player Styling
            if (playerContainer) {
                playerContainer.classList.remove('fixed', 'inset-0', 'z-50', 'w-full', 'h-full', 'bg-black');
                // Revert to standard fixed/hidden logic if needed, 
                // but here we just ensure it's visible.
                // (Your existing UI code likely handles showing/hiding it)
            }
            
            // 3. Restore UI
            document.body.classList.remove('overflow-hidden');
            
            // 4. Restore Player UI
            if (fullPlayer) fullPlayer.classList.remove('hidden');
            if (miniPlayer) miniPlayer.classList.remove('hidden');

            UI.toast("Launcher Mode: INACTIVE");
        }
    },

    // --- 7. UTILS ---
    forceUrlRefresh() {
        // Appends a random timestamp to the current URL to force browser to treat as new load
        const url = new URL(window.location.href);
        url.searchParams.set('timestamp', Date.now());
        window.history.replaceState({}, '', url);
    }
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
    async findYoutubeIds(artistName, trackName) {
        // Clean the name for searching
        const query = encodeURIComponent(`${artistName} ${trackName} audio`);
        
        try {
            // We use an Invidious instance (public YouTube API proxy)
            const response = await fetch(`https://inv.tux.pizza/api/v1/search?q=${query}`);
            const data = await response.json();
            
            if (data && data.length > 0) {
                // Return the top result's ID
                console.log(`%cFound ID for ${trackName}:`, 'color: #10b981; font-weight: bold;', data[0].videoId);
                console.log(`%cPaste this into LINK_DB:`, 'color: #3b82f6', `"${AudioEngine.normalizeKey(artistName + ' ' + trackName)}": "${data[0].videoId}",`);
                return data[0].videoId;
            } else {
                console.warn(`No results found for ${artistName} - ${trackName}`);
                return null;
            }
        } catch (e) {
            console.error("Search failed", e);
            return null;
        }
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
                    width: 80px; height: 80px; border: 2px solid #cabfbfff; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; margin-bottom: 2rem;
                    box-shadow: 0 0 30px rgba(239, 68, 68, 0.4); animation: pulse 2s infinite;
                ">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cabfbfff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <h1 style="font-size: 2rem; font-weight: 900; letter-spacing: -1px; margin-bottom: 0.5rem; color: #cabfbfff;">SYSTEM LOCKOUT</h1>
                <p style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; color: #52525b; margin-bottom: 3rem;">Security Violation Detected</p>
                
                <div style="background: #18181b; padding: 1.5rem; border-radius: 12px; border: 1px solid #27272a; max-width: 400px; width: 100%;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.75rem; color: #a1a1aa;">
                        <span>ERROR CODE</span>
                        <span style="font-family: monospace; color: #cabfbfff;">0xSEC_INSPECT</span>
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
    lastTabSwitch: Date.now(),
    fullscreenLauncher: false
};


const LINK_DB = {
    "wheres your dad at bill": "vn1XjjwYvtw",
"comehelpglo wheres your dad at bill": "gy53-Trs6DA",
"comehelpglo dont go": "8kAGUQg9odI",
"comehelpglo lean stained nikes": "GYm68G9V8zo",
"comehelpglo calm down it gets worse": "itJjEVzUn4c",
"comehelpglo let it show": "yGEJMQWXlS0",
"comehelpglo has all this been a dream": "XKfvUZI8FrM",
"can we all be alone": "1I6CRW8ObAE",
"miss213": "Z5faY6KN3sI",
"whats that noise": "nyqZHCg-K5k",
"whateverheres my list of regrets": "ZHpJ_gGOgW0",
"rotten rose and a coke stuffed nose": "sEan95qdPy4",
"comehelpglo when my time comes tell me will i stand up": "_UPe55dG3tQ",
"heartshapeddrugs": "slJMzs681tc",
"in the end will you remember me": "-wYt1_8Omp0",
"neverhadtoleavebeforeyouwreckedeverything": "2EFbwxZN2mc",
"comehelpglo angels in the sky": "1RRIQEpH4WI",
"icecoldviens": "EeIRHCcqIRk",
"i cant believe you did this": "TpaT0aWr2e4",
"comehelpglo everyone left when i went to rehab official music video": "FLjEi9XMxXo",
"comehelpglo dreams of who i once was feat shlumpy": "v9ew1y3Eyds",
"comehelpglo god im sad as shit 432hz": "EIh1TeSbHGU",
"i feel the rain comehelpglo": "_rYf-3Dnguk",
"stay broke": "tvyAFkmwY9Y",
"comehelpglo god im sad as sht 432hz": "U3qhjRwqcuk",
"imisshome": "WehmUEO0ByY",
"comehelpglo thunder storm": "77ROcAteRx0",
"comehelpglo miss213": "hSLAyQGzXGg",
"comehelpglo whateverheres my list of regrets official music video": "7YOlD4nFN3g",
"comehelpglo ihavenothingbuteverything": "MadibNimpFg",
"dead prodigy": "rPFkgv1A48g",
"vvs feat pobear": "G7kOZT57l7k",
"skintoskin": "XPeciM2LR6Y",
"comehelpglo i blame myself for things i couldnt control": "2oIz0w26Xyg",
"ashes feat comehelpmae": "vNOG1k0VVTs",
"angels in the sky comehelpglo": "vlpI2FDgrvw",
"comehelpglo i would rather go to sleep then think of you": "R953LdAU1oY",
"ghost of ytei comehelpglo god im sad as sht lyrics video": "CumRJ6uKW5E",
"dime bags at corna stores": "rweyn2N1SWQ",
"everyone left when i went to rehab": "mfeBtNuPf_w",
"kinda cold in here": "yioGoZ3BC5w",
"comehelpglo x shlumpy pale white dope sack": "e7E29cFo99o",
"dreams of who i once was comehelpglo": "4DDPDKMIo-A",
"comehelpglo god im sad as sht official music video": "usJnsoh5xS4",
"comehelpglo in the end will you remember me official music video": "IAUqFxNR-yY",
"comehelpglo neverhadtoleavebeforeyouwreckedeverything": "zNO3AwDIMew",
"comehelpglo can we all be alone": "nMv9QkobZwc",
"comehelpglo angels in the sky official music video": "yO_s9vkiAN8",
"comehelpglo whateverheres my list of regrets": "4p7J0l8RzuI",
"comehelpglo cobwebs instrumental only high quality": "zwF-tYFdhik",
"comehelpglo thunder storm warframe edit": "HqrxKsE3P-M",
"comehelpglo god im sad as sht slowed and reverb": "20X6WX_b_lA",
"comehelpglo god im sad as shit": "bY-m1HSxyHs",
"yall changed my life bandlab indierock tiktokviral thxsomch newmusic": "4PKQASde_M8",
"guess the song guitar": "Iuxwu31L_XM",
"1123pm feat comehelpglo": "OBbLq0o_PTQ",
"comehelpglo dreams of who i once was feat shlumpy instrumental only": "0bIAh5bJxQI",
"honestav id rather overdose ft z i cant let you go official music video": "cq43FrpXGQs",
"honestav id rather overdose feat z": "gTYXvLkc-dE",
"this rapper sounds like peep x uicideboy comehelpglo reaction": "rJe7Ud92arg",
"free comehelpglo x sample type beat call me": "HUcH8Z1keYA",
"free comehelpglo type beat dazed": "bMqhlkUqFpk",
"duke dennis reacts to glorilla asking him out": "IOk8N-VImQk",
"kid from all these niggas video started crying when he got a von shirt rip king von": "MQJFmIw-aTI",
"he had no idea i could rap": "sBD_DiPdkPs",
"how to get professional sound layering vocals on bandlab bandlab bandlabpresets presetsquad": "hHtmGJCayT4",
"smokedope2016 2016lyfe official music video": "PXHm-sQCzko",
"youtube shorts guitar tutorials be like": "iPcYWJYLqL8",
"make your own beats in bandlab": "CKEBVjk4JeI",
"how to make a hit song in less than 30 seconds": "ZIri_M43M3Q",
"cobwebs": "dnhy-swgjRs",
"rick rubin shares his secrets for creativity": "36L9cYkHyZM",
"wait til the end": "ccMrTOoay64",
"matt maeson never had to leave": "iiUgz-EkSgE",
"41998769592": "xvv6NwvNsGc",
"what is a free for profit type beat": "ijVR2IPpg4U",
"they paid 500hr for studio time": "KixrH1GTn7o",
"glorilla glos prayer": "NS9mrSIL7Rs",
"real boston richey help me": "Y3Ih1ReN9xA",
"big boogie mental healing boxedinliveperformance boxedin_ wikidfilms": "yt7rJzhuN1c",
"what angels really look like angels fyp xyzbca": "5FTOHBR8FCI",
"how to get that choir effect": "IKXqnZhZ_8Y",
"ishowspeed made a hit ishowspeed ishowspeedshorts producer escape plan prodby its wayv": "AZV2-kDyzu8",
"layering vocal hooks bandlab": "7vEV1CtuhbQ",
"tears of broken heart sad emotional video animation reelsindia love storytelling": "R0TDhvXbfHc",
"i regret everythingprodjaxxee": "ncef04MP0F8",
"how is this artist still underground comehelpglo reaction shorts comehelpglo suicideboys": "yjmE-lHtTSQ",
"melodic vocals on autotune bandlab bandlab howto kidd1bluck": "4zPGiiPeEZM",
"how to break garage band": "XNT18Dobdn4",
"comehelpglo angels in the sky sped up nightcore": "F0S2yGuif4M",
"how to find your style as an artist finding your sound": "yAQGQ2Ok6W0",
"im trying to move on": "5NbQ7TbrHMs",
"slow motion": "wPIH3IOzEIc",
"bandlab rappers be like": "av4fPx-Hapw",
"how to get clear vocals on bandlab shorts bandlab vocalpreset": "io9DBy8JMkQ",
"how to record a song with your phone on bandlab": "fwV6M8acpsI",
"one preset for clear vocals bandlab": "lTsVF_HFSaI",
"lil peep save that shit": "WvV5TbJc9tQ",
"come help glow type beat": "kJwdMLtufpQ",
"fairfield fade away smokedope2016 old soundcloud": "4Yrcqc0Q3M0",
"gelo can you please feat glorilla": "UkDgPY9ApXY",
"how to mix your vocals in bandlab": "5ie5hVc8dnE",
"how to start a music career 50cent music rap": "Jwxp0boHAcE",
"chief keef bankroll fresh glo type beat spot pieruun": "W-Ca2qoscdQ",
"free acoustic guitar type beat regrets": "eRsgoVQimJs",
"how to make a song in 30 seconds boywithuke": "QmzvMMpQf-I",
"uicideboy drugshoesmoneyetc lyric video": "LXN7eq9f9_w",
"ski mask the slump god catch me outside 2": "-YyOcJUI82Q",
"ski mask the slump god nuketown ft juice wrld": "kF7_yxSK9Uc",
"ski mask the slump god foot fungus": "7tOqUtSTF2w",
"ski mask the slump god shibuya": "KbxLSjvHvAo",
"ski mask the slump god faucet failure": "DL8tIU_CfOE",
"ski mask the slump god fire hazard": "Q-Rd-Z-gj34",
"ski mask the slump god the matrix": "3C5MYzQs7Jg",
"ski mask the slump god so high": "x_UhvKWG7zQ",
"ski mask the slump god carbonated water explicit": "rcrmTLJ_XWc",
"ski mask the slump god unbothered": "2f_WdJeBEDg",
"ski mask the slump god dr suess": "wDQm0t_Xjfo",
"bass santana xxxtentacion ski mask the slump god make eem run": "Hlu8eaSKQbo",
"ski mask the slump god wake up feat juice wrld": "5YPz4UzJUp8",
"ski mask the slump god reborn to rebel": "LXAvbmNHWdQ",
"ski mask the slump god adults swim": "ajtRtR4X-S0",
"ski mask the slump god la la": "et2kTT9DTh4",
"ski mask the slump god catch me outside official music video": "JpIlnaAmiCg",
"ski mask the slump god earwax official visualizer": "J7WUlP6X2YQ",
"ski mask the slump god earwax": "3PDp5sPYSzk",
"ski mask the slump god ooga booga": "IWnAm2wJS-E",
"ski mask the slump god cat piss ft lil yachty": "4VljYPS0d6g",
"ski mask the slump god merlins staff": "6c7KXHz4GeE",
"trippie redd xxxtentacion ghost busters ft quavo ski mask the slump god": "zbqn7N5hPgI",
"xxxtentacion off the wall feat ski mask the slump god": "prGcQcvKHjA",
"trippie redd toilet water feat ski mask the slump god": "bzFX1LagHhg",
"ski mask the slump god u and i": "sVSLjD4ty5A",
"off the wall": "wpkRjCBLa6U",
"xxxtentacion ski mask the slump god freddy vs jason prod willie g official lyrics": "5ZCGUeBjddo",
"xxxtentacion what in xxxtarnation feat ski mask the slump god": "7DjmTTshzMc",
"smokepurpp ski mask official music video": "-sp_VuUUfDY",
"life is short": "CvVAvuhqJ1o",
"take a step back": "PbiWPUxGygs",
"freddy vs jason": "41mZHTAwtzs",
"xxxtentacion ski mask freddy vs jason instrumental prod willie g": "zQqFeR4BE3k",
"eer ft ski mask the slump god danny towers lil yachty": "KpkHydjPgZg",
"dj scheme ski mask the slump god eer lyric video feat danny towers lil yachty": "orMcH7yi3vc",
"ski mask the slump god nuketown ft juice wrld official music video": "LjkDor2LenI",
"ski mask the slump god burn the hoods official music video": "9AGAeGsBCvc",
"smokepurpp ski mask official music video shot by _colebennett_": "3jCtsxrXJPg",
"ski mask the slump god catch me outside 2 official music video": "7lQBp-pqiUs",
"future ski": "Kad2gkMFnHE",
"ski mask the slump god get geeked": "5UBfGQhQPIU",
"ski mask the slump god hulk": "GCz9dZE6uoU",
"ski mask the slump godcatch me outside": "8o5GumBtzP8",
"ski mask the slump god from yard feat skillibeng": "QC_NH5p_lC8",
"ski mask the slump god he diddy": "H8N5pGUEwZw",
"denzel curry hit the floor ft ski mask the slump god": "m_FjDkd2sQ4",
"xxxtentacion rip roach feat ki mask the slump god": "aFOxVm3Z9x8",
"ski mask the slump god part the sea": "iS7eT994E9g",
"ski mask the slump god lost in time": "FiMLkBoa_rY",
"ski mask the slump god catch me outside 2": "vMtQdl5jmzY",
"ski mask the slump god alien sex official music video": "4A43WD8Yt8k",
"ski mask the slump god doihavethesause official music video": "_THBex8DItY",
"how xxxtentacion ski recorded their first songs": "rXI2cwHwxgs",
"xxxtentacion fuxk feat ski mask the slump god": "Wkbx8qYjU8Q",
"ski mask the slump god him jung un": "ki_tqVbsZU4",
"ski mask the slump god frozen one": "EONMguszVek",
"ski mask the slump god ya": "YqaaRWgw6tU",
"ski mask the slump god gone interlude": "wGd7NKsAmu4",
"dreamville costa rica ft bas jid and more": "Zn8ohtUY44g",
"ski mask the slump god life is short audio": "UjeeU8miw1o",
"ski mask the slump god admit it": "dxK3ZO4Qd0w",
"ski mask the slump god mental magneto": "MTzWt1m6HiU",
"xxxtentacion ft ski mask the slump god freddy vs jason": "uXovwbxhuxU",
"ski mask the slump god let it breathe": "VPsVrWGOwnA",
"xxxtentacion performing rip roach with ski mask the slump god at rolling loud may 6th 2018": "xAg26rIci60",
"ski mask the slump godcatch me outside": "opPFp0v4YgI",
"ski mask the slump god tuk tuk": "bg9KJbkI9Oo",
"ski mask the slump god full moon": "0JFlh06NGaE",
"ski mask the slump god by myself": "MQbwYJgsHA4",
"ski mask the slump god reflects on xxxtentacion": "QYAT6JN8vvk",
"ski mask the slump god dragontooth": "lGVSvsXwCWE",
"nationwide": "AzqxQuOB6bY",
"ski mask way": "g5tTHbqV74Y",
"keith ape x ski mask the slump god achoo": "iRcFzfkYVEU",
"ski masks honest opinion on xxxtentacion and juice wrlds the way xxxtentacion": "IRIfvMC6vqU",
"ski mask the slump god far gone ft lil baby": "_Oo-HjS3kD0",
"ski mask holds on to their handshake because letting go hurts more xxxtentacion llj skimask": "kypoKm02C98",
"ski mask the slump god go feat corbin": "f11yDAuu43k",
"the pain of losing everyone ski mask left alone xxxtentacion juicewrld lilpeep sad rip": "W7iYaK1-ICs",
"ski mask the slump god shibuya official visualizer": "bCk72-ccQvU",
"ski mask the slump god wdym": "yd92urZTbOs",
"xxxtentacion yung bratz": "1TFZl8oz6Es",
"psycho": "flZnNG_NUcE",
"lil gnar new bugatti ft ski mask the slump god chief keef dj scheme": "xC3dnTLTRe8",
"ski mask the slump god killstreak": "_Yy_cUFYFlk",
"ski mask the slump god nuketown ft juice wrld": "zUqXBYhZ-ds",
"quicksand ski mask the slump god snippet": "HzAkankk4Ko",
"jid and ski mask the slump gods 2018 xxl freshman cypher": "Ww_YlWm_SHM",
"danielle bregoli is bhad bhabie these heaux": "pPuuhOiIOMM",
"bhad bhabie feat lil yachty gucci flip flops": "P3BMmJtbZUs",
"bhad bhabie hi bich": "m2PZoUPkxMU",
"danielle bregoli is bhad bhabie these heaux official music video": "-ioilEr3Apw",
"bhad bhabie feat lil yachty gucci flip flops official music video danielle bregoli": "tsp7IOr7Q9A",
"bhad bhabie lotta dem": "z3EGH-D8pVU",
"lil candypaint bhad bhabie 22 remix": "N8SNV9TfwhE",
"lil candy paint 22 ft bhad bhabie blowing up his phone i know im tripping for no reason": "3lqxLADKD_U",
"bhad bhabie ykniece yams": "Uwx7a2Ju73o",
"bhad bhabie ms whitman official music video": "yo7_px4vXYQ",
"bhad bhabie famous danielle bregoli": "ifRsHv8kd-g",
"whachu know": "D0rsq5WOVLY",
"danielle bregoli is bhad bhabie hi bich whachu know official music video": "1NyMSWqIJDQ",
"bhad bhabie og crashout official music video": "1TXbcOju0Zc",
"bhad bhabie feat tory lanez babyface savage official music video danielle bregoli": "s8hW4bzMx8E",
"bhad bhabie no more love danielle bregoli": "UQlk85QZEqM",
"bhad bhabie hi bich remix feat rich the kid asian doll madeintyo wshh exclusive": "MEYmQlWBeAE",
"these heaux bhad bhabie": "1oYB4Koj3-M",
"bhad bhabie ft yk niece yams official music video": "tyD_QnTlICc",
"bhad bhabie mama dont worry still aint dirty official music video danielle bregoli": "Ku-WC1EaPXI",
"over cooked": "fK-eXPMOR1E",
"karlae boondocks feat bhad bhabie": "BC8-Hkh8aN0",
"bhad bhabie shhh danielle bregoli": "fWeSwEEKLb4",
"bhad bhabie feat kodak black bestie official music video danielle bregoli": "bfmLYKxJ0UA",
"bhad bhabie ft kodak black bestie": "cIoz7Ao066Q",
"bhad bhabie i got it official music video danielle bregoli": "WlZu4RmD_oU",
"bhad bhabie geekd feat lil baby official music video danielle bregoli": "66h5dGoQ1IU",
"bhad bhabie feat lil yachty gucci flip flops lyrics": "v3b5Rugw_v0",
"bhad bhabie feat yg juice official music video danielle bregoli": "EmNwaoaTkiY",
"bhad bhabie ms whitman": "QMtC80ToN3c",
"bhad bhabie trust me feat ty dolla ign official music video danielle bregoli": "459G-8RtOa4",
"bhad bhabie ms whitman": "m4X9UkjTLOM",
"bhad bhabie bout that danielle bregoli": "e_7UxNmyLyM",
"bhad bhabie over cooked": "pTNLPnSu2NM",
"bhad bhabie feat asian doll affiliated danielle bregoli": "wWdXzcm2Ccc",
"honest": "WlQKhBq_Fm4",
"ms whitman": "ta3VIaPMWYk",
"bhad bhabie thats what i said": "R4t7L-gDFDs",
"bhad bhabie mommy mode": "lcgL04fWn7U",
"bhad bhabie x lil gotit": "TryruUHfcFU",
"bhad bhabie feat yg juice danielle bregoli": "PnAChIDUu6M",
"bhad bhabie ybn nahmir spaz": "_f8Vn0ZklgM",
"bhad bhabie 15 intro danielle bregoli": "4JPZL1g5vac",
"bhad bhabie intro 15 mixtape drops sept 18 danielle bregoli": "yN5Gmwrly5o",
"bhad bhabie spaz": "fW0I0jb-jH4",
"bhad bhabie yung and bhad feat city girls danielle bregoli": "uzWbo-F09RE",
"bhad bhabie og crashout": "SLJ5zb78Kmo",
"bhad bhabie feat lil baby geekd danielle bregoli": "efbneH0pZ0k",
"bhad bhabie explains why she wont stop dissing alabama barker": "1CbUZba--OY",
"there was always original first go away copies bhadbhabie": "rcwwFJMKOgE",
"top 10 bhad bhabie moments catch me outside more shorts": "4KruR6BT-yw",
"bestie feat megan thee stallion": "Lw2zmbSbuFI",
"bhad bhabie gucci flip flops clean feat lil yachty": "ctsh748SkDo",
"bhad bhabie og crashout": "yRK-Jj0U9rQ",
"bhad bhabie miss understood": "-CIPIbQtZTY",
"bhadbhabie or alabamabarker whitman trend beef audio trending trend shirts cars": "kzPeMRVaSdc",
"bhad bhabie hirak count it danielle bregoli": "YlMwHITt6H0",
"babyface savage bhad bhabie feat tony lanez audios for edits": "3AYgNAp_Ecs",
"lil candy paint bhad bhabie 22 remix": "dZFvi-Q0daA",
"bhad bhabie mama dont worry still aint dirty danielle bregoli": "ySB5MuPuNhI",
"bhad bhabie geekd up feat lil baby 8d audio": "bC3PSuNIOjU",
"bhad bhabie i got it": "Sa2NXh3_lGE",
"bhad bhabie get active remix extended": "l4AeGyE0qHY",
"rap lyrics music audio remix bhadbhabie": "FrRksWoKkI0",
"benjamin elgar bhad bhabie hoe official music video": "E632eAd2F5Q",
"bhad bhabie bestie feat megan thee stallion danielle bregoli": "xjr8GwzcZoo",
"22 remix 2": "drFMPrDo208",
"bhad bhabie ms whitman bass boosted": "-KpgYOMHaUc",
"bhad bhabie thats what i said official music video": "ZW4YGJRUgc4",
"bhad bhabie miss understood clip": "TefQGpx_sLk",
"bhad bhabie ft kodak black bestie": "5fpV6V-eCaw",
"lil durk dog walk feat bhad bhabie": "obsxFxKL00I",
"bhad bhabie miss understood official music video danielle bregoli": "moNFBVqMlpw",
"bhad bhabie yams ft ykniece clean": "bNHxmVZHP8E",
"bhad bhabie do it like me official music video": "zwpoH1xJfZY",
"bhad bhabie gucci gang": "UqlMYBbwGb8",
"bhad bhabie lil durk thats enough said": "sRtowRxGLS0",
"peysoh bhad bhabie fwm": "9XE9b2J-iQI",
"bhad bhabie do it like me": "jYPR4bQScxU",
"bhad bhabie honest": "TlUG8K2Izc8",
"bhad bhabie og crashout": "mslm9UY5OGo",
"22 remix speed up": "bgIcTIThqCM",
"bhad bhabie disses kylie jenner": "BMnTPNJzh00",
"lil candy paint 22 feat bhad bhabie remix": "GJ-eqegiOEs",
"you wish bhad bhabie unreleased audio": "05EqH0fUgCo",
"bhad bhabie shut up feat trippie redd": "hzUcem1XWho",
"bhad bhabie lotta dem": "5OZWt_VBF34",
"bhad bhabie geekd 8d audio feat lil baby": "F8OJ0faYdDE",
"bhadbhabie rapper audio music": "ubwk8L2kQCI",
"do it like me bhad bhabie longer versionbass boost remix bhadbhabie doitlikeme remix": "4QzxybzWVs4",
"bhad bhabie lil durk thats enough said unreleased lyrics video": "lC8rxP2c0aM",
"bhad bhabie x lil durk dogwalk doggywalk": "W-tSIKJDtBg",
"first video ms whitmanbhad bhabie fypviral cleansound": "Vju7jheXc9E",
"black": "wCtEj-7F-7s",
"the law of recognition kyslingo": "dsYFCGWfeT8",
"the law of recognition spedup": "vi5pA24-oDA",
"let me out": "RryKh9pwwb8",
"what do i know": "L0BxkVwUDoU",
"curser feat u4l scoovy u4l judo": "HdNOHtNuAxc",
"glory": "OaEf9VKRbHc",
"the love i started ii": "m3pCsiwE0wY",
"when nobody had me": "g8Z15u2n8Sg",
"kys lingo limbo prod nolanberollin directed by will samuels": "PlQ8RoNk2Ag",
"lingo i know my love is crack prod kyslingosomebody freestyle prod will samuels dir kiiru": "l95CcT0uhdo",
"im alive": "2p_lyFXD4F8",
"somebody freestyle": "GNvmQGsCKdQ",
"terrorist": "1GQkS8HlpE4",
"protect mine": "NCxXnQ58ixY",
"bald eagle": "Dp80rY2vF2A",
"kyslingo the law of recognition": "yEyyKST2MXA",
"the law of recognition": "9aOELPLkcnY",
"im alive ii": "65yyOmqiqnI",
"kyslingo burnheart prod flexafendiofficial music video directed by kevin polo": "qPiS90ofYM8",
"lava girl": "0BFP9kxJse8",
"pain": "Httspvc8cQc",
"ill whip ya head boy feat osyris israel": "HAv5cWvaarE",
"kyslingo glory drama queen freestyle official music videodirected by kevin polo": "oJkgBoMIXtc",
"blue 3": "j2dcA0cP6L8",
"love losing hype": "6Zis-rogtUk",
"lies 2": "-3jumdgWZNA",
"kyslingo limbo": "3C94XsYv0zA",
"kyslingo limbo produced by nolanberollin": "pKjhENPVT6k",
"do me wrong": "tbo-_P4oIXA",
"grey": "dGLOVZrWBl0",
"never worry feat kyslingo": "1b3M1ckmROI",
"kyslingoi know my love is crackslowreverb": "lgBw4cKsZRE",
"do you know": "yZFsqLuxNqQ",
"kyslingo sad nights prod sadbalmain": "59vD8eFZrlQ",
"double cut": "4CuQq9rt-tw",
"6 feet below": "7zWDrSptkZk",
"kyslingo reaper prod stoopidxool": "vAuZBda-q8I",
"kyslingo get 2 it prod robrossdaboss kyslingoofficial music videodirected by kevin polo": "cKD1mOU5A4o",
"kyslingo the law of recognition tiktok song free quan": "8dSm39HyEE0",
"kyslingo sad nights": "m5Z0O_eF8Jg",
"kyslingo earth is not a heaven cloudrap": "2b-2eFcJbKI",
"kyslingo stop it": "p44p_TDbb1M",
"limbo by kyslingo sorry about the delaymusic freedom happy free limbo": "cnA1TNbExn4",
"law of recognitionlyricvideo lyrics": "1Rtf3aP7_oU",
"kyslingo energy best sound quality": "SbIm3GSLwoQ",
"kyslingo thelawofrecognition": "buPHf22NFZk",
"kyslingo earth is not a heaven slowed reverb": "DDSjTDlJ0ek",
"kys lingo i know this helps prod kyslingo shotedit by sleemlu": "F6N6uVb1SbE",
"the law of recognition kyslingo": "pwotI6fNddg",
"demon slayer kyslingo burnheart amv edit": "zbD2UgJ2YlA",
"kyslingo lingo the law of recognition prod sadbalmain": "7mP5yy2U1ks",
"glorykyslingo": "grTDQT_KpBo",
"kyslingo the law of recognition slowed reverb": "4v3DkneVYg4",
"kyslingo i know my love is crack prod kyslingo": "se2L4YIflRI",
"": "3uHxZ3agptw",
"kyslingo lingo not a sneaker head prod kyslingo": "9YuKYp-ugkM",
"kyslingo dip remix shot by kevin polo": "hKFQpK6WxuQ",
"which version of the viral song the law of recognition are you messing with more": "2izKaKKsm38",
"the law of recognition ishowspeed velocity edit": "3FsJWA5V7Ns",
"ja morant edit the law of recognition sped up": "jp4gsO9838k",
"kyslingo glory prod 6silky bbasedtj": "ERFR28sAD2o",
"how to sound like osamason troops for free on bandlab freepresets freepreset osamason bandlab": "CkJ7WZGvXh4",
"kyslingo x lil xelly rova": "cY2iTZ1wsBA",
"earth is not a heaven": "v6QVNQl8bO4",
"kyslingo glory edit": "IggFoLYvE3c",
"why would you lie kyslingo stafa shot by bobby lee palmer": "Jq58rN2WDHA",
"kyslingo glory slowed": "hhKoz0qRvzA",
"kyslingo i know my love is crack legendado": "JPXlXRiS4RM",
"": "xP_99nhChFE",
"company ii": "XEaFuE1hvDQ",
"the law of recognitionedit shorts": "75-v7_s-gKs",
"the law of recognition by kyslingo": "K55KPfaRB6E",
"kyslingo im up bitch prod dj young kash": "wcqyMbl05TY",
"kyslingo law of recognition sped up bb": "s_LxglwIz2w",
"kyslingo type beat prod otz": "mDVwIBkchto",
"kyslingo the law of recognition 852hz harmony with universe self": "Bpm8YlSFAWU",
"kyslingo limbo": "80bffnvvkos",
"the haunting": "DzY2132buC4",
"tokyo ghoul the law of recognition": "WqNAUYfsIMs",
"kyslingo already know vilencia": "vs7XngIMHVY",
"kyslingo the law of recognition sped up": "X_ODlNT0D6E",
"kyslingo the law of recognition sped up": "l_sEW_e8_O4",
"kyslingo rockstar sped up": "qKRGT_OuYYs",
"7 minutes of kyslingo songs that i like but there replaced with liminal spaces": "wn0770hCttk",
"kyslingo the law of recognition": "_o3jDx3jR3o",
"kyslingo glory": "vbB6kX9Qkj4",
"could you rap over this hard trap x freestyle type beat freestyle rap training 335": "k4MmOsdT-Do",
"kyslingo demons cry too": "OSOR3jYmqVo",
"kyslingo dip speed up": "zpuhSno52E0",
"the law of recognition": "2TN_vLEbGic",
"demonslayer flow edit kyslingo": "m-CiABl87mw",
"might feel too sick": "b-alNl-WuuU",
"saitama the law of recognition kyslingo editamv": "QbN6WPuXhHg",
"kurapika edit the law of recognition": "fnvxmSCuSnE",
"kyslingo limbo reflexion": "MCWO03h6fpU",
"bass booted kyslingo the law of recognitionsped up": "d-NRiIZ2fkY",
"the law of recognition kyslingo slowed reverb": "I-np4e2TACg",
"lie to myself": "82fFTyLlIWg",
"mikey recognitioneditamv": "OZeaJvdZ8jQ",
"that feeling by kyslingo firsttimehearing reaction": "nGMEOazVv5w",
"the law of recognitionjujutsu kaisen amvedit 1080p": "JXPbwlLkaEg",
"kyslingo growing pains save you": "tkzxZgJQh3Q",
"kyslingo burnheart killua amv edit": "T8pgpLHOfkc",
"kyslingo lingo for what its worth produced by evilgiane harrison shotedit by willsam": "nWoPIk5OaSo",
"that feeling": "z4R_7YidyUA",
"kys lingo limbo slowed sped up": "DrmIf_dHv_o",
"the law of recognition": "cBVytAqNtJ4",
"the law of recognitionkyslingo": "g32XWhuAoEA",
"kyslingo lingo the law of recognition": "VebIrqgsMbY",
"roadblock feat evilgiane eli propper": "7ymEm20e9Rg",
"and if this takes forever": "3KIO96rVWgM",
"kyslingo limbo slowed reverb": "6ZokibYOdG8",
"anime shorts the law of recognition amv": "-F-Y7wNZvOI",
"youre so cool cupid feat kyslingo": "93RXQOA99Fg",
"the law of recognition": "oNGIMXgO_Lc",
"law of recognitionkyslingo not clean": "uk2yrz29_Mc",
"kyslingo fake": "zgCryVNWPAA",
"jenna ortega": "txvCX87EUm4",
"thank god for every breath diggadtv edits sorts diggad": "4HK3UL--Hj4",
"chris travis diamonds pt1": "Isfkiie3YRM",
"chris travis h20 official music video": "9_rB39KfZM4",
"her lullaby": "c1h0n80DHRo",
"chris travis crunch time": "fmq39rSBi6g",
"chris travis diamonds prod by eric dingus": "Lv9iwvUiFpk",
"purple thoughts": "da-feNlIs8g",
"fijifalls": "F6yV7qRKTxE",
"chris travis by myself": "VjBWjj1yoZ4",
"nobody knows": "A4ZqknjqAIU",
"chris travis stayin true": "5vTuF9u4mi4",
"bones xavier wulf chris travis wedontbelieveyou": "D8AGKWyyrJ8",
"hold me up": "g5d5Rf_P2PI",
"xavier wulf chaos castle feat eddy baker chris travis bones": "PHLMICMNzPM",
"swerve slow": "4K8q4VHtPBk",
"chris travis when you feeling numb": "XrTG58whLzc",
"chris travis kill switch": "mBYKBFjynHM",
"chris travis the reason": "ZjC5W6oolAo",
"chris travis do my own stunts": "8DHXe38HcoM",
"80 dime bagz boomin like alicia keys feat black kray ethelwulf": "Yvdu4Mf98EY",
"chris travis filthy rich": "3vs41NqBhTY",
"chris travis off the lot": "1z5UXAOjcMU",
"chris travis another day": "F_wROVPcv9Q",
"how it is": "DS0bZPJowFQ",
"chris travis diamonds": "veYPg5up-Ek",
"ill whip ya head boy feat osyris israel": "HAv5cWvaarE",
"kyslingo glory drama queen freestyle official music videodirected by kevin polo": "oJkgBoMIXtc",
"chris travis wavy world music video": "-Zg8Sy43_sM",
"chris travis memphis to la official music video": "vRXtD7a6PN0",
"over and over": "mgwvI2cwiww",
"actavis": "Uz4r9bf03Yg",
"smoke": "BN_66dEBJxc",
"275 be the team feat chris travis": "Lt8Qpzri2mw",
"castleflutes feat chris travis": "Qjv2eE7PIOs",
"hate and love": "EX6O36HPyKk",
"chris travis bring it back prod by tay on the track": "x2w3fHf8HGM",
"you know you know": "v2ePn2GiQO4",
"morning dew": "QsVX3OjGp58",
"drugshoesmoneyetc": "ElKAextmUoo",
"psychedelic funk": "XwhPDCEbvOw",
"miss me when im gone": "QRTNLDRHOTI",
"space men feat chris travis": "mAdEbJYqje8",
"aap rocky i smoked away my brain im god x demons mashup ft imogen heap clams casino": "AT9JoIv2kss",
"chris travis the reefer official music video": "yrKq8L2PVRA",
"chris travis no signal official music video": "djeAdwiGWaQ",
"let down": "zCZvA97fahU",
"chris travis bruno": "dBB58pKM004",
"chris travis too much": "siQmXNw3Hno",
"chris travis manic": "eXF82S49F3E",
"chris travis playa": "DsFVACikSSo",
"chris travis eternal pits": "qsASWBBjeVY",
"chris travis top of the hill": "eqBeYCm6USM",
"chris travis groovin": "iXDOQXXDXZg",
"chris travis coming through official music video": "eRjOWEWLKc8",
"chris travis 432hz mix": "upbqT-chJgM",
"chris travis perchin official music video": "b-4LHVYP-kY",
"chris travis g80": "62tBNH7mrfg",
"chris travis ph 15": "wOfNjjyF9DY",
"chief 1997": "nO0GYHHZmMs",
"chris travis trust no one": "BvtcUe-FlFo",
"chris travis fwts": "h2Fec_hukyI",
"chris travis reflections intro official music video": "MTYrLMykok0",
"christravis her lullaby": "zpXyx8kcDh8",
"xavier wulf x chris travis shinjitsu": "z6zM699bg20",
"chris travis your makeup": "HuTtgF8Dm3s",
"chris travis green red official music video": "ESko5SPNSS4",
"chris travis tonight": "86yxrQJkIx4",
"chris travis kim possible": "BaR6bi-xuBk",
"chris travis cant play with me": "TPma1ev9Cr8",
"chris travis its on you official music video": "7cwjrVpTWrI",
"": "6z-FZXmPV3A",
"nothing but you": "kY-XI5f9wZA",
"chris travis oakland": "fZl_AyPm0zI",
"chris travis maybach truck": "yn43y_V07a4",
"chris travis gold": "xTaxfkjoS9s",
"chris travis crazy official music video": "nJXk5b9PeVk",
"chris travis lord infamous flow": "KVPyE1QaX2k",
"chris travis drank talk": "XC1yhvWx4GM",
"chris travis antidepressants": "dqp_rkOuZSI",
"chris travis antidepressants music video": "smdlQLrUwSs",
"chris travis green red": "V4K5Dbf4I8k",
"where my money": "jWXLjeIhM5A",
"chris travis chit chat": "fNBJkXuYhfg",
"chris travis why so serious official music video": "1IG0npiljFg",
"juice wrld stay high": "Z9yaG27quz0",
"juice wrld lean wit me": "e6YYRLfUZ5M",
"juice wrld cuffed": "74FlSfgOueo",
"juice wrld hear me calling": "SlSNHEfnqn8",
"juice wrld moonlight": "3JBKp0YbSEc",
"juice wrld legends": "dIzgiclddlM",
"juice wrld robbery": "6pFKpy9HmRw",
"juice wrld candles": "u0BSO8jNs04",
"juice wrld empty": "9LSyWM2CL-U",
"juice wrld blood on my jeans": "3Klj_pjjqUM",
"juice wrld wishing well": "Q3zpwgQK8Yg",
"juice wrld already dead": "EAfckg0ORS4",
"juice wrld from my window": "K6UMLJGElGc",
"juice wrld flaws and sins": "RG9xHEF1vyk",
"juice wrld lucid dreams forget me": "onbC6N-QGPc",
"juice wrld let me know i wonder why freestyle": "swDam6Hrsm8",
"juice wrld ft marshmello come go": "5Di20x6vVVU",
"juice wrld ft young thug bad boy": "sP9t8WGDwfg",
"juice wrld conversations": "1VSZtyenNlA",
"juice wrld misfit": "1HgLQP6xkIY",
"juice wrld make believe": "nHyE_nm4d3o",
"juice wrld party by myself": "35F29uYoqo4",
"juice wrld 67 unreleased": "cmTZjw4HFYo",
"juice wrld used to": "Pxhds98iubg",
"juice wrld cheese and dope freestyle": "0_7XPkBAxpo",
"juice wrld remind me of the summer music video": "D-mtpCBOwm4",
"juice wrld kkk": "n8nbFKB_btI",
"juice wrld go hard": "KRiab3PNgC4",
"juice wrld scars unreleased": "GZyj2wU0NPU",
"juice wrld burn official music video": "HA1srD2DwaI",
"juice wrld autograph on my line": "rULyu_wFWGU",
"38 special go go juice wrld": "ESMt9kofND4",
"benny blanco juice wrld graduation official music video": "M3N06KyK3s0",
"juice wrld the way feat xxxtentacion official music video": "tHDMJB2xZdc",
"juice wrld cuffed official music video": "_MUSrN3ACV4",
"juice wrld autograph on my line music video": "JRAdnd3ORXM",
"juice wrld bustin savages music video": "tlsuUoWD9Mg",
"juice wrld ap tik tok full song 2019 my year": "qRr0ZEvlEGo",
"juice wrld in my head": "DqZhP-Vuxgs",
"set me free": "RlF5x-NgD2M",
"juice wrld sometimes og": "v_q6bJHgJe0",
"juice wrld party by myself official music video": "Ys3zAdSI1eI",
"its 4am": "NNqgmlV4dWk",
"lil peep california world feat craig xen": "piuovGiAFvo",
"juice wrld bad boy ft young thug official music video": "ghzdwjWrWcc",
"my flaws burn through my skin like demonic flames from hell": "S0KAAsanVms",
"k like a russian": "ua47Omdl76s",
"xxxtentacion ayala outro added background vocals extended": "gFstUq3QQyE",
"juice wrld 734 og": "KrgsHVxqElc",
"juice wrld off the rip gamble": "05xCoE_0l4A",
"juice wrld im still": "Hivf9Z_E3qU",
"lil peep ghost girl": "pcFK4HzAlsU",
"lil peep ghost boy": "NiWFVHbB_Eo",
"lil peep right here feat horse head": "m-44PIocS_4",
"lil peep nuts feat rainy bear": "osPq9Yb8xm8",
"ken carson fighting my demons official music video": "YKkMR2l05Rs",
"fck love xxxtentacionxxx ft trippie redd": "wXuFG8uQpZ8",
"forever ever feat young thug reese laflare": "XYb1mdGu5aQ",
"misery in waking hours": "Y45kvrHBx2s",
"king von armed dangerous": "tBKYI3-3lMg",
"xxxtentacion sad": "pgN-vvVVxMA",
"lil peep walk away as the door slams feat lil tracy": "ovvZ2f6ipXw",
"juice wrld all girls are the same official music video": "h3EJICKwITw",
"travis scott playboi carti future where was you": "um-uRGkT8GU",
"lil peep lil tracy castles": "As1bpICMhzs",
"aap rocky i smoked away my brain im god x demons mashup ft imogen heap clams casino": "AT9JoIv2kss",
"lil peep star shopping": "m8QQR-wQA0I",
"ken carson ss": "TMzs6GvsZXU",
"juice wrld condone it": "Jwm18NSC2L0",
"juice wrld fighting demons": "rJZynxvJnlI",
"g herbo ptsd ft juice wrld chance the rapper lil uzi vert": "k3-fAXbCa44",
"godzilla feat juice wrld": "9XvXF1LrWgA",
"juice wrld black white": "aQDhBNHBQUs",
"juice wrld fast": "BO18LZkhiEc",
"ynw melly feat juice wrld suicidal remix": "j18d-hLdTD8",
"juice wrld not enough": "BU3RzEbSiW4",
"juice wrld sometimes official visualizer": "ym9MpAz5PNI",
"juice wrld justin bieber wandered to la": "ioxhcuNSxZk",
"juice wrld man of the year": "_YwppMLPoPg",
"juice wrld bad energy": "EfP3Ya5-JoU",
"juice wrld ill be fine": "0_6RDuiUyFk",
"lucid dreams": "VTG-ForqDk4",
"halsey without me ft juice wrld": "sPPsOmQh76A",
"polo g flex ft juice wrld": "7aS7KStPgNA",
"juice wrld rental unreleased og version lyrics": "Tq5YHgxwGGk",
"juice wrld scared of love with instrumental by ghost loft": "uSVW0aJdn9o",
"juice wrld the party never ends": "FebG5YUV1d8",
"juice wrld burn": "UQ8Jc7b42Fg",
"juice wrld rich and blind": "DRN2jnlXewE",
"juice wrld burn official lyric video": "L5ge0v0FTiE",
"lil tecca feat juice wrld ransom": "-thh5_bpGGY",
"juice wrld no good": "hvzI_z65Xfs",
"ski mask the slump god nuketown ft juice wrld": "kF7_yxSK9Uc",
"juice wrld glod up": "jCtQ0FYVVs8",
"juice wrld barbarian": "GzmbBLfIKcw",
"dj khaled juice wrld did ft juice wrld": "LU3y5QpwXJc",
"juice wrld wishing well official music video": "C5i-UnuUKUI",
"marshmello juice wrld bye bye official lyric video": "ZnQMqj-Sbec",
"juice wrld adore you": "4Kl_wNRoAUc",
"juice wrld cavalier": "BGiuQ77BnMY",
"juice wrld wasted feat lil uzi vert": "pqiO8wV4-wc",
"juice wrld youdontloveme": "hSA5RVSMyaA",
"juice wrld end of the road": "jt7wa2j1Nzc",
"juice wrld empty out your pockets official fortnite video": "hgYhws0AHcg",
"juice wrld desire": "Krw9ZLN0aqE",
"juice wrld ring ring feat clever": "Rp0asR_2Ono",
"juice wrld feeling": "9gHwgVRRCWg",
"juice wrld the weeknd smile": "2avPJ9TZNmU",
    "kendrick lamar squabble up": "NYH6Oa4PXlY",
    "kendrick lamar squabble up": "NYH6Oa4PXlY",
"kendrick lamar luther": "HfWLgELllZs",
"kendrick lamar count me out": "6nTcdw7bVdc",
"kendrick lamar tv off": "U8F5G5wR1mk",
"kendrick lamar peekaboo": "cbHkzwa0QmM",
"euphoria": "NPqDIwWMtxg",
"kendrick lamar n95": "XEV4x7xEprw",
"future metro boomin kendrick lamar like that": "N9bKBAA22Go",
"alright": "JocAXINz-YE",
"kendrick lamar rich spirit": "hl3-ZPg-JAA",
"poetic justice": "XWQJdnmpnhc",
"kendrick lamar wacced out murals": "YwUQ_5iV9pY",
"not like us": "T6eK-2OQtew",
"dna kendrick lamar": "uX6uBHPGfSs",
"kendrick lamar rich spirit": "toBTPGfurLc",
"kendrick lamar adhd": "QjlFqgRbICY",
"kendrick lamar adhd": "VOL0-EE3ieY",
"the recipe ft dr dre bonus track kendrick lamar good kid maad city deluxe": "4Poddz658pM",
"kendrick lamar cartoons cereal feat gunplay": "xy_UAmjMQXo",
"kendrick lamar poetic justice explicit ft drake": "yyr2gEouEMM",
"kendrick lamar poetic justice feat drake": "oYx4LKK9LhU",
"the weeknd sidewalks ft kendrick lamar": "sK-T-cmznY8",
"kendrick lamar i": "jltN3fLFmTQ",
"kendrick lamar heart pt 6": "m-PO1_fzxVM",
"dj mixbestmixkendrick lamar best mix greatest hits 2023 kendricklamar djmix": "xfZ0QeibtKM",
"kendrick lamar bitch dont kill my vibe": "LiaVWUI44Og",
"kendrick lamar not like us": "H58vbez_m4E",
"kendrick lamar count me out x zeldas lullaby kendrick did you hear that kendrick tiktok version": "bekr08CBWCE",
"kendrick lamar untitled 05 lovibe remix audio only": "BfU5hszDP2o",
"kendrick lamar god is gangsta": "4wZytWFm7x0",
"we cry together a short film": "wUGyZM9rcnY",
"kendrick lamar prayer unreleased trke eviri": "8I0zfDPh6MA",
"bodies kendrick lamar mastered extended gnx trailer": "P89jcfTmWGM",
"schoolboy q collard greensft kendrick lamar": "OGp4RvqlSPM",
"lil peep downtown": "39Abw0bVM2M",
"swimming pools kendrick lamar edit audio": "uTofxeMRwtQ",
"kendrick lamar watch the party die best quality on yt": "efsqlBF3_nE",
"kendrick lamar count me out": "5GhhVHpPR_M",
"wesleys theory": "l9fN-8NjrvI",
"kendrick lamar body for body full song": "Qfd9S6IKw6Q",
"money trees": "HJNa9Ih3haA",
"kendrick lamar untitled 05 lovibe remix": "VCI46yZptEU",
"maad city": "AuikIJZpt_8",
"playboi carti evil j0rdan official visualizer": "VcRc2DHHhoM",
"forever ever feat young thug reese laflare": "XYb1mdGu5aQ",
"playboi carti the weeknd rather lie": "fYD7YsSRHOY",
"playboi carti hba": "QTLqujvTGrg",
"aap rocky i smoked away my brain im god x demons mashup ft imogen heap clams casino": "AT9JoIv2kss",
"daniel caesar superpowers": "rScwLoES2bM",
"duckworth": "Dm-foWGDBF0",
"kendrick lamar alright official music video": "Z-48u_uWMHY",
"playboi carti toxic with skepta": "U6jeOBSGI6Q",
"playboi carti olympian": "mj4yh7YrwfE",
"ken carson ss": "TMzs6GvsZXU",
"kendrick lamar die hard ft blxst amanda reifer": "Lx3MGrafykU",
"all the stars": "ju4KQT0wL0I",
"kendrick lamar hey now": "9PumlOWjXMM",
"kendrick lamar sza all the stars": "JQbjS0_ZfJ0",
"kendrick lamar money trees feat jay rock": "smqhSl0u_sI",
"miguel how many drinks ft kendrick lamar": "CvBufVFuERM",
"future mask off remix ft kendrick lamar": "nrjPzPc1JiY",
"kendrick lamar the recipe lyric video ft dr dre": "YpugK0RpEaU",
"kendrick lamar backseat freestyle explicit": "EZW7et3tPuQ",
"kendrick lamar father time ft sampha": "toEW7_-pvOY",
"sia the greatest ft kendrick lamar": "sG6aWhZnbfw",
"loyalty ft rihanna kendrick lamar damn": "2-IF9HXUlk0",
"baby keem kendrick lamar family ties": "v6HBZC9pZHQ",
"kendrick lamar loyalty ft rihanna": "Dlh-dzB2U4Y",
"kendrick lamar dodger blue": "c7y2ziOBA1s",
"kendrick lamar adhd": "mKBRNn-D2Sk",
"travis scott goosebumps ft kendrick lamar": "Dst9gZkq1a8",
"kendrick lamar sza luther": "sNY_2TEmzho",
"kendrick lamar mother i sober ft beth gibbons of portishead": "Vo89NfFYKKI",
"kendrick lamar man at the garden": "wiALRpD0Ztg",
"chris brown autumn leaves explicit ft kendrick lamar": "undkbBJLa-Y",
"kendrick lamar rigamortis": "yh6QxtRpSH8",
"love iab sounds edit kendrick lamar ft zacari": "GdSabJXr59A",
"sza 30 for 30 feat kendrick lamar": "NEnephbahLA",
"pray for me": "T0pYq_Saf7g",
"lil wayne mona lisa ft kendrick lamar": "ybfgomoY8Xs",
"kendrick lamar love ft zacari": "SyYUdbaddQU",
"all the stars kendrick lamar feat sza clean version": "YxCUbt0wtFo",
"schoolboy q collard greens explicit official music video ft kendrick lamar": "_L2vJEb6lVE",
"humble": "ov4WobPqoSA",
"kendrick lamar tv off": "U8F5G5wR1mk",
"kendrick lamar luther": "HfWLgELllZs",
"kendrick lamar count me out": "6nTcdw7bVdc",
"not like us": "T6eK-2OQtew",
"future metro boomin kendrick lamar like that": "N9bKBAA22Go",
"kendrick lamar peekaboo": "cbHkzwa0QmM",
"dna kendrick lamar": "uX6uBHPGfSs",
"kendrick lamar wacced out murals": "YwUQ_5iV9pY",
"poetic justice": "XWQJdnmpnhc",
"kendrick lamar cartoons cereal feat gunplay": "xy_UAmjMQXo",
"euphoria": "NPqDIwWMtxg",
"kendrick lamar adhd": "QjlFqgRbICY",
"kendrick lamar adhd": "VOL0-EE3ieY",
"kendrick lamar not like us": "H58vbez_m4E",
"swimming pools drank": "X0sVhnP15z8",
"kendrick lamar rich spirit": "hl3-ZPg-JAA",
"kendrick lamar n95": "XEV4x7xEprw",
"kendrick lamar i": "jltN3fLFmTQ",
"alright": "JocAXINz-YE",
"kendrick lamar bitch dont kill my vibe explicit": "GF8aaTu2kg0",
"kendrick lamar bitch dont kill my vibe": "LiaVWUI44Og",
"kendrick lamar untitled 05 lovibe remix audio only": "BfU5hszDP2o",
"kendrick lamar rich spirit": "toBTPGfurLc",
"kendrick lamar hey now": "9PumlOWjXMM",
"money trees": "HJNa9Ih3haA",
"kendrick lamar prayer unreleased trke eviri": "8I0zfDPh6MA",
"dj mixbestmixkendrick lamar best mix greatest hits 2023 kendricklamar djmix": "xfZ0QeibtKM",
"kendrick lamar poetic justice explicit ft drake": "yyr2gEouEMM",
"kendrick lamar money trees feat jay rock": "smqhSl0u_sI",
"schoolboy q collard greensft kendrick lamar": "OGp4RvqlSPM",
"kendrick lamar alright official music video": "Z-48u_uWMHY",
"kendrick lamar count me out": "5GhhVHpPR_M",
"lil peep downtown": "39Abw0bVM2M",
"kendrick lamar swimming pools drank": "B5YNiCfWC3A",
"kendrick lamar heart pt 6": "m-PO1_fzxVM",
"pride": "pRGmFiEyr0A",
"pride": "J87pJrxvJ5E",
"kendrick lamar untitled 05 lovibe remix": "VCI46yZptEU",
"aap rocky i smoked away my brain im god x demons mashup ft imogen heap clams casino": "AT9JoIv2kss",
"daniel caesar superpowers": "rScwLoES2bM",
"playboi carti evil j0rdan": "zTKheLpo4nQ",
"forever ever feat young thug reese laflare": "XYb1mdGu5aQ",
"playboi carti evil j0rdan official visualizer": "VcRc2DHHhoM",
"ken carson ss": "TMzs6GvsZXU",
"playboi carti the weeknd rather lie": "fYD7YsSRHOY",
"playboi carti olympian": "mj4yh7YrwfE",
"playboi carti toxic with skepta": "U6jeOBSGI6Q",
"playboi carti hba": "QTLqujvTGrg",
"kendrick lamar sza all the stars": "JQbjS0_ZfJ0",
"kendrick lamar poetic justice feat drake": "oYx4LKK9LhU",
"the recipe ft dr dre bonus track kendrick lamar good kid maad city deluxe": "4Poddz658pM",
"miguel how many drinks ft kendrick lamar": "CvBufVFuERM",
"all the stars": "ju4KQT0wL0I",
"the weeknd sidewalks ft kendrick lamar": "sK-T-cmznY8",
"future mask off remix ft kendrick lamar": "nrjPzPc1JiY",
"baby keem kendrick lamar family ties": "v6HBZC9pZHQ",
"sia the greatest ft kendrick lamar": "sG6aWhZnbfw",
"kendrick lamar die hard ft blxst amanda reifer": "Lx3MGrafykU",
"kendrick lamar not like us drake diss": "3wkNLqetX0M",
"kendrick lamar loyalty ft rihanna": "Dlh-dzB2U4Y",
"kendrick lamar backseat freestyle explicit": "EZW7et3tPuQ",
"kendrick lamar sza luther": "sNY_2TEmzho",
"loyalty ft rihanna kendrick lamar damn": "2-IF9HXUlk0",
"kendrick lamar father time ft sampha": "toEW7_-pvOY",
"travis scott goosebumps ft kendrick lamar": "Dst9gZkq1a8",
"chris brown autumn leaves explicit ft kendrick lamar": "undkbBJLa-Y",
"love iab sounds edit kendrick lamar ft zacari": "GdSabJXr59A",
"humble": "ov4WobPqoSA",
"sza 30 for 30 feat kendrick lamar": "NEnephbahLA",
"travis scott goosebumps ft kendrick lamar": "_9XaXHD3680",
"kendrick lamar not like us": "2WAN6crr3HQ",
"kendrick lamar dodger blue": "c7y2ziOBA1s",
"lil wayne mona lisa ft kendrick lamar": "ybfgomoY8Xs",
"all the stars kendrick lamar feat sza clean version": "YxCUbt0wtFo",
"kendrick lamar sza luther": "l0wJqJT3gh8",
"kendrick lamar count me out x zeldas lullaby kendrick did you hear that kendrick tiktok version": "bekr08CBWCE",
"pray for me": "T0pYq_Saf7g",
"sza 30 for 30 ft kendrick lamar": "ye-tjwqotEA",
"kendrick lamar love ft zacari": "SyYUdbaddQU",
"kendrick lamar peekaboo": "OlrqrcKRuEQ",
"kendrick lamar money trees": "_xCVvUVPV7c",
"schoolboy q collard greens explicit official music video ft kendrick lamar": "_L2vJEb6lVE",
"kendrick lamar man at the garden": "wiALRpD0Ztg",
"kendrick lamar rigamortis": "yh6QxtRpSH8",
"kendrick lamars apple music super bowl halftime show": "KDorKy-13ak",
"jhen aiko stay ready what a life ft kendrick lamar": "QbskDhzKWk8",
"kendrick lamar reincarnated": "Ek7UvQPCQnE",
"kendrick lamar savior ft baby keem sam dew": "HTAQxUXq674",
"kendrick lamar sza all the stars": "yvOh7vVqlaE",
"kendrick lamar gnx": "8sfLudpdZPU",
"kendrick lamar performs not like us at super bowl lix": "TvqpiUlMsB4",
"jay rock kendrick lamar future james blake kings dead": "VwAnsAUYnw4",
"clipse kendrick lamar pusha t malice chains whips": "qyrr02a4vwY",
"kendrick lamar gloria": "G5YwhjCywvw",
"kendrick lamar humble": "tvTRZJ-4EyI",
"taylor swift bad blood ft kendrick lamar": "QcIy9NiNbmo",
"kendrick lamar humble": "jBvrQmtn4aQ",
"kendrick lamar united in grief": "tvNSXS4x9nc",
"kendrick lamar j cole trench stories music video": "GGZMXuwrHic",
"kendrick lamar rich interlude": "ll6S032PHNs",
"love": "w6NxHj3L_XY",
"kendrick lamar mother i sober ft beth gibbons of portishead": "Vo89NfFYKKI",
"kendrick lamar humble skrillex remix": "gh72dXr4fTM",
"alicia keys its on again ft kendrick lamar": "T9B3z-8P_7s",
"kendrick lamar playlist": "9EzAjlyyQA8",
"kendrick lamar adhd": "mKBRNn-D2Sk",
"kendrick lamar savior interlude": "ROUFkWceDRM",
"dedication feat kendrick lamar nipsey hussle victory lap": "RXmfYM6dSFg",
"kendrick lamar not like us clean": "Yar-WWUnDlw",
"kendrick lamar mirror": "OqR71_BYS-c",
"kendrick lamar king kunta": "hRK7PVJFbS8",
"kendrick lamar tv off": "8_e4lHJaBvg",
"kendrick lamar silent hill ft kodak black": "00QQWJIFxDA",
"kendrick lamar not like us clean lyrics": "d6WiBXd3xfI",
"kendrick lamar crown": "eL1L287YbkQ",
"kendrick lamar sza luther": "ITQUzVJvhU0",
"kendrick lamar watch the party die": "zISYJ-bT7DQ",
"playboi carti kendrick lamar good credit": "58JU9solXFw",
"kendrick lamar humble": "wL_xmuij6lA",
"squabble up": "7QyDL3zQ-2I",
"rich the kid new freezer ft kendrick lamar": "HLKYz1r23Lo",
"kendrick lamar n95": "zI383uEwA6Q",
"game the city ft kendrick lamar": "TsMMuXZZUm8",
"kendrick lamar sza all the stars": "GfCqMv--ncA",
"kendrick lamar swimming pools": "sDgPvbt5nQ0",
"beyonce freedom feat kendrick lamar": "ZDyqv5AJChk",
"luther kendrick lamar sza clean": "9Vnbsuny2LI",
"love ft zacari kendrick lamar damn": "3SaVOpgSa6M",
"kendrick lamar performs not like us at super bowl": "b2Zq5KM2b24",
"kendrick lamar purple hearts ft summer walker ghostface killah": "0kS-MtxPr9I",
"kendrick lamar tv off clean": "qtrYfIxHU7A",
"kendrick lamar mr morale ft tanna leone": "SdwEIPD1bEw",
"the weeknd kendrick lamar pray for me": "K5xERXE7pxI",
"maroon 5 dont wanna know ft kendrick lamar": "OxPv8mSTv9U",
"baby keem kendrick lamar range brothers": "IkuBYRUwWdg",
"kendrick lamar not like us official music video": "c82oYGeWTx4",
"swimming pools drank extended version": "UEJTaReI1ls",
"squabble up": "fuV4yQWdn_4",
"drake vs kendrick lamars outfit": "1dNH4VJcB2I",
"jid top 5 rappers jid dreamville jcole jidtypebeat kendricklamar": "p38iVlbzjtM",
"god": "bBTeAg5CFRA",
"the heart part 4 kendrick lamar iv": "lbYIUnV8u7E",
"kendrick lamar worldwide steppers": "AxNXkI94tbY",
"kendrick lamar money trees feat jay rock explicit": "tVyw9H2Iuyw",
"untitled 05 remix is carrying 2025 creed edit kendricklamar audio best rap songs": "zzw4-rEXxA0",
"kendrick lamar auntie diaries": "-vrhf1P9zwc",
"kendrick lamar we cry together ft taylour paige": "C_s9JJnqQqM",
"mac miller god is fair sexy nasty feat kendrick lamar": "YbbaJIpkGMs",
"element kendrick lamar damn": "bqqUvduHONk",
"hero in all of us spiderman edit kendrick lamar sza all the stars": "8iFANNbAiew",
"everyone at super bowl screamed a minor during kendrick lamars not like us kendricklamar nfl": "JzHJ6L3dbY8",
"kendrick lamar superbowl halftime show audio version": "2slJAoSMc7Q",
"sza 30 for 30 clean lyrics feat kendrick lamar": "w-nDeRqPNos",
"gnx": "D7liwdjvhWc",
"loyalty": "sN8H2ypmzlA",
"kendrick lamar not like us drake diss": "VJdHSaWd-EU",
"kendrick lamar truly served with his not like us performance on super bowl halftime": "aShh57wRkaA",
"kendrick lamar sza all the stars newmusic lyrics aesthetic fypp music": "XxDwkra7MQk",
"playboi carti backd00r feat kendrick lamar jhene aiko": "4LgZZVGvEyE",
"kendrick lamar dna lyrics": "GM1ryY_KAH0",
"kendrick lamar 616 in la": "T42TkZW6pc8",
"kendrick lamar untitled 05 lovibe remix extended beat intro song": "dWq2ggIR_wE",
"aap rocky fkin problems ft drake 2 chainz kendrick lamar": "liZm1im2erU",
"eminem praises kendrick lamar": "9AjvndD2_mA",
"kendrick lamar sza luther spiderverse": "FZ9wv1unnRg",
"kendrick lamar love ft zacari 8d audio": "TomyxNFr8BI",
"kendrick lamar euphoria drake diss": "_sJ79aDQTeQ",
"pusha t nosetalgia ft kendrick lamar music video": "UgGZJxI-fFA",
"luther kendrick lamar ft sza 8d audio": "yxR-DwNd580",
"falsehood kendrick lamar un": "QQ1HtSeZvLI",
"kendrick lamar swimming pools pool full of liquor and i dive in it lyrics swimmingpools shorts": "h1fhfFWl99g",
"pusha t f kendrick lamar nosetalgia audio explicit version": "Qaxly5O9vNI",
"future kendrick lamar like that drake j cole diss": "02dpdLmpu3Q",
"kendrick lamar rich spirit n95 live from saturday night live": "SZcupt0Yqaw",
"dna lyrics kendrick lamar": "ecUlXz6aQwY",
"the best superman superman edit kendrick lamar and sza all the stars": "xAAYQo3LwSw",
"united in grief kendrick lamar shorts lyrics fyp viral lipsync songs4u_": "Xd0P1Cf56lM",
"drake vs kendrick the beef that changed everything": "yIrQhtNVYAc",
"sza snooze": "Sv5yCzPCkv8",
"mustardddddmustard kendricklamar mustarddd invincible style edit": "PlNYZ4pCZ6U",
"swimming pools kendrick lamar lyrical edit swimmingpools kendricklamar": "tNCdEm_dKWA",
"j cole vs kendrick lamar hits best 1hour hiphop mix best of j cole and kendrick dj santana": "zQAWmDynHxA",
"kendrick is listening 67 kid scp 067 edit analog horror funk super slowed": "npdv2HtcwG4",
"kendrick lamar pride slowed": "IHGAX4IYREw",
"travis scott on kendrick lamars goosebumps feature": "13gsWbb5JNc",
"peekaboo kendrick lamar": "Ux_Rk8rRdH8",
"son of king tchalla black panther edit kendrick lamar all the stars ft sza slowed": "32nzdU3AXIg",
"jidenna classic man remix ft kendrick lamar": "SMeo6CykNrg",
"the symbol of hope superman edit kendrick lamar sza all the stars slowed": "o3QiZWQyJHs",
"kendrick lamar alright": "1J7gDCD5vHg",
"not like us kendrick lamar": "eWg6c6Gwdn8",
   "kanye west runaway video version ft pusha t": "Bm5iA4Zupek",
"kanye west cant tell me nothing": "E58qLXBfLrs",
"kanye west flashing lights ft dwele": "ila-hAUXR5U",
"flashing lights": "ZAz3rnLGthg",
"mrs officer": "buyMOuKDG74",
"lil wayne surf swag": "eRRKlXbIqHY",
"a milli": "NdgpcwqBSPg",
"lil wayne she will visualizer ft drake": "Fw3H8R5hHEY",
"let it all work out": "TKJJiF8QJRc",
"lil wayne im single": "GQxWtv_UnU4",
"lil wayne fireman": "tkScazS1Og8",
"lil wayne mona lisa ft kendrick lamar": "ybfgomoY8Xs",
"lil wayne love me explicit versionclosed captioned ft drake future": "KY44zvhWhp4",
"lil wayne uproar visualizer ft swizz beatz": "vGtfSaGYJQA",
"lil wayne mr carter visualizer ft jayz": "MZwRhVvz768",
"a milli": "xX-N3B8ulnI",
"lil wayne a milli": "4jQFIiFF9mc",
"nicki minaj truffle butter ft drake lil wayne": "EvlQOjK0MPk",
"nicki minaj drake lil wayne seeing green": "_Q7rcUm0Dro",
"lil wayne krazy carterv": "mzCm9CXwBTA",
"lil wayne kant nobody ft dmx": "zRegqIGwfbE",
"ariana grande let me love you ft lil wayne": "xbiv2QHcGYU",
"dababy featuring lil wayne lonely": "VHt-dENViA4",
"lil wayne mona lisa featuring kendrick lamar": "faOKi80p1BE",
"lil wayne how to love official music video": "y8Gf4-eT3w0",
"eminem no love explicit version ft lil wayne": "KV2ssT8lzj8",
"you": "gfoD2ILKEYk",
"lloyd ft lil wayne you": "FV__1ZNjjR0",
"lollipop": "xmj2QSbRZLE",
"dej loaf me u hennessy ft lil wayne": "hjHXY-s-9-8",
"lil wayne dont cry ft xxxtentacion": "t61T0Wu7slg",
"6 foot 7 foot": "FcRBUd_gJBg",
"love me": "X_uoq5xCaFc",
"lil wayne blunt blowin visualizer": "aFF4nZdmKXM",
"lil wayne bigxthaplug hiphop visualizer ft jay jones": "uWmbR8W-Kzw",
"forever ever feat young thug reese laflare": "XYb1mdGu5aQ",
"lil peep nuts feat rainy bear": "osPq9Yb8xm8",
"lil wayne something different official music video": "W2WRE5pxZ7A",
"drake kanye west lil wayne eminem forever explicit version official music video": "eDuRoPIOBjE",
"lil wayne 6 foot 7 foot ft cory gunz explicit official music video": "c7tOAGY59uQ",
"lil wayne a milli": "1Vf4mMCpNY0",
"lil peep the brightside": "xAMgQQMZ9Lk",
"lil peep lederrick teen romance": "qQX-pHfnFsc",
"lil wayne john ft rick ross explicit official music video ft rick ross": "3fumBcKC6RE",
"lil wayne run this town": "9YWsOoOhwLM",
"lil peep nuts": "_xRN3dTg9s0",
"playboi carti evil j0rdan": "zTKheLpo4nQ",
"lil wayne she will ft drake": "_7nYuyfkjCk",
"juice wrld let me know i wonder why freestyle": "swDam6Hrsm8",
"lil peep xxxtentacion falling down": "-jRKsiAOAA8",
"lil peep walk away as the door slams feat lil tracy": "ovvZ2f6ipXw",
"playboi carti the weeknd rather lie": "fYD7YsSRHOY",
"lil peep lil tracy castles": "As1bpICMhzs",
"playboi carti evil j0rdan official visualizer": "VcRc2DHHhoM",
"lil wayne i feel like dying": "cykGnl1KvcM",
"playboi carti like weezy official visualizer": "C217vygclrk",
"playboi carti olympian": "mj4yh7YrwfE",
"lil baby playboi carti skooly lets do it official music video": "Av4AsFPeQ9E",
"the game my life ft lil wayne": "udxZ9zkDzpo",
"chris brown loyal ft lil wayne tyga": "JXRN_LkCa_o",
"lil wayne right above it visualizer ft drake": "b0wbCtrGjXA",
"dj khaled im on one explicit version ft drake rick ross lil wayne": "Z09lYqdxqzo",
"dj khaled god did ft rick ross lil wayne jayz john legend fridayy": "QugLZCp74GE",
"chris brown loyal ft lil wayne tyga": "RCtMT8vlM6o",
"lil wayne love me ft drake future": "ebhdNQUGjiM",
"lil wayne got money ft tpain official music video ft tpain": "1ohYsK5Y8Dc",
"lil wayne got money feat tpain explicit version": "ZURis3A6FYM",
"lil wayne she will ft drake": "QMPQa7_lXOE",
"lil wayne feat bruno mars mirror": "97xukmZfiGU",
"lil wayne mahogany": "6uIsw1pM9bE",
"mario lil wayne main one official music video ft tyga": "lxgzbRXQELQ",
"love": "w6NxHj3L_XY",
"kendrick lamar mother i sober ft beth gibbons of portishead": "Vo89NfFYKKI",
"lil wayne mirror ft bruno mars official music video ft bruno mars": "OZLUa8JUR18",
"chris brown possessive ft lil wayne bleu": "IEk-BaFsVUk",
"mario lil wayne main one ft tyga": "iPpj4lNxe6g",
"lil wayne love me audio ft drake future": "PTAGB-N84Yo",
"lil wayne bring it back feat mannie fresh": "6Lg5wG0TwkQ",
"youngboy never broke again my window feat lil wayne": "vnG2aQUJFwI",
"2 chainz lil wayne usher transparency": "FJcJmiHJ-pU",
"lil wayne for nothing dedication 6 reloaded d6 reloaded": "gWuDKtHXGh0",
"chris brown gimme that remix official hd video ft lil wayne": "3yl-5FOZcr0",
"rick ross thug cry feat lil wayne": "Sy_45F8VfI0",
"lil wayne nightmares of the bottom visualizer": "w7NHVRDQ-As",
"drake miss me ft lil wayne": "fuqIsXLSeAM",
"lil wayne v8 no ceilings 3": "7ze5xTiaRuQ",
"lil wayne how to love": "wkQxgDv4q3I",
"jay sean down ft lil wayne": "DirKD1ecaw4",
"juicy j bandz a make her dance ft lil wayne 2 chainz": "1Ad5hKerKsE",
"lil wayne lollipop official music video ft static": "2IH8tNQAzSs",
"akon im so paid official music video ft lil wayne young jeezy": "tnAbKuGss4Y",
"dj khaled im the one ft justin bieber chance the rapper lil wayne lyrics lyric video": "158plNHX4vw",
"the question mac miller ft lil wayne": "UyHk9yRQV7E",
"kendrick lamar tv off clean": "qtrYfIxHU7A",
"kendrick lamar mr morale ft tanna leone": "SdwEIPD1bEw",
"the weeknd kendrick lamar pray for me": "K5xERXE7pxI",
"maroon 5 dont wanna know ft kendrick lamar": "OxPv8mSTv9U",
"jennifer lopez im into you ft lil wayne": "IgLcQmlN2Xg",
"kodak black codeine dreaming feat lil wayne": "g7_uKDsv7HM",
"destinys child feat ti lil wayne soldier": "13fO4pukMQY",
"lil wayne vizine wshh exclusive": "m-WXZWslgUI",
"rich gang tapout ft lil wayne birdman mack maine nicki minaj future": "OGtlq-cvIS4",
"tyler the creator sticky feat glorilla sexyy red lil wayne letralegendado": "mKzg_ZdDSRc",
"lloyd you ft lil wayne": "GmJqTraI9oQ",
"dj khaled im on one feat lil wayne drake rick ross": "b6ByREoAE8I",
"jay sean down feat lil wayne": "UQ9e6XyQWr4",
"lil wayne bank account dedication 6": "sesUrzFWlQ0",
"that mexican ot lil wayne baby mad at me": "ezg9TfKDY_I",
"lil wayne yeezy sneakers dedication 6": "EpAP1niP0Uo",
"lil wayne 6 foot 7 foot ft cory gunz official hd the carter 4": "W0psZfzGgQo",
"lil wayne shoes": "2JqHU-NXNuY",
"nicki minaj drake lil wayne no frauds": "VkXjvHfP3MM",
"lil wayne sorry 4 the wait": "e_fZbUpGplA",
"morgan wallen miami feat lil wayne and rick ross": "UR3lYl9xcLk",
"my nigga ft lil wayne rich homie quan meek mill nicki minaj remix": "6l7J1i1OkKs",
"im into you jennifer lopez feat lil wayne": "KQqU2w_TWi8",
"pop bottles birdman ft lil wayne": "ayAHQ310t68",
"lil wayne way of life official music video ft big tymers tq": "h9k7O1FigE0",
"kendrick lamar auntie diaries": "-vrhf1P9zwc",
"pusha t nosetalgia ft kendrick lamar music video": "UgGZJxI-fFA",
"luther kendrick lamar ft sza 8d audio": "yxR-DwNd580",
"falsehood kendrick lamar un": "QQ1HtSeZvLI",
"lil wayne lollipop visualizer": "dobDE8ThwXI",
"lloyd you ft lil wayne": "pDkHiQhhROo",
"lil wayne big bad wolf d6 reloaded": "lYATz3STgew",
"blunt blowin": "XQCXqvLRn28",
"lil wayne drop the world ft eminem official music video ft eminem": "ErCAOMi5EGM",
"lil wayne wiz khalifa imagine dragons w logic ty dolla ign ft x ambassadors sucker for pain": "-59jGD4WrmE",
"sucker for pain imagine dragons lil wayne wiz khalifa": "IO2aTF7ygPE",
"lil wayne sick dedication 6 reloaded d6 reloaded": "Dd0cAePq_p0",
"dj khaled jealous ft chris brown lil wayne big sean": "4UoOOBKY8lY",
"cassie ft lil wayne official girl": "9aCVfWJ76gQ",
"lil wayne 6 foot 7 foot ft cory gunz": "p2L6WGpZM5A",
"the game celebration ft chris brown tyga lil wayne wiz khalifa": "0zFebU-kFNk",
"lil wayne piano trap": "-ZOjfbqjLdE",
"lil wayne twist made me": "BvYebQ93nl0",
"lil wayne one big room": "er95xeiwmuo",
"lil wayne life is good no ceilings 3": "KTdRPXYaMkY",
"kelly rowland ice ft lil wayne": "YCF6X84PUao",
"chance the rapper lil wayne smino tree": "2_oIlRNTYfI",
"lil wayne glory": "Hs9eTu81dVE",
"lil wayne sum 2 prove no ceilings 3 b side": "38VllwfZyAQ",
"moneybagg yo lil wayne ashanti wockesha remix": "z6uCSmRw1is",
"lil wayne president carter visualizer": "xTxB3BqPoAM",
"2 chainz lil wayne crown snatcher": "ZqpGoXaYZzk",
"lil wayne ft rick ross drake she will remix hdcdq": "--iVH019SvI",
"jid kenny mason feat lil wayne just in time ft lil wayne": "gXerx0erltc",
"cassie feat lil wayne official girl official music video": "NXrLrg7U_6Y",
"lil wayne throw it in": "VSFSbQ6N8EY",
"all falls down": "W0VnPiyXSRQ",
"kanye west good life ft tpain": "FEKEjpTzB0Q",
"kanye west flashing lights directors cut ft dwele": "GG5cE14G2Gg",
"kanye west all falls down ft syleena johnson": "8kyWDhB_QeI",
"i wonder": "MxEjnYdfLXU",
"eminem cleanin out my closet": "Ful8uFk6-Og",
"eminem the monster ft rihanna": "ZDXXi19_7iE",
"eminem berzerk": "359na4NeaVA",
"eminem guilty conscience 2": "5yeGhfL0zCU",
"till i collapse": "Obim8BYGnOE",
"eminem without me": "pyb13N80DZQ",
"the way i am": "82lB-gI-uuQ",
"eminem fuel feat jid": "xVuYQCa9saw",
"eminem habits feat white gold": "BgqD-Bn5Quk",
"beautiful": "4HuTdB0MqoE",
"houdini": "soNLLPokjC4",
"godzilla feat juice wrld": "9XvXF1LrWgA",
"eminem rap god": "S7cQ3b0iqLo",
"lucky you feat joyner lucas": "1arz9Q9qBas",
"logic homicide feat eminem": "mfqsEpjEtrw",
"love the way you lie": "acMtKzTbAAU",
"eminem guts over fear ft sia": "iH0WwlQd5-I",
"when im gone": "HnEwvZYdAlE",
"eminem evil": "AuQ36zwFA3s",
"eminem space bound": "JByDbPn6A1o",
"the real slim shady": "1-M4JrFcrNY",
"eminem somebody save me feat jelly roll": "p5QWoWZXu14",
"eminem godzilla ft juice wrld official music video": "r_0JjYUe5jo",
"3 am explicit by eminem eminem": "TwAJO7uDwJg",
"we made you by eminem eminem": "EWMLMc3ES3I",
"darkness": "skn7T_XPQnY",
"eminem my name is official music video": "sNPnbI1arSE",
"eminem tobey feat big sean babytron official music video": "CanCZktm0TQ",
"akon smack that featuring eminem": "J6t_BU2IjXE",
"8 mile eminem final rap battle hd": "X9-hxfcklGs",
"eminem mockingbird official music video": "S9bCLPwzSC0",
"eminem snoop dogg from the d 2 the lbc official music video": "RjrA-slMoZ4",
"eminem lose yourself hd": "_Yhyp-_hX2s",
"eminem role model": "ubEublECnMU",
"eminem without me": "-8xhmV3JoG4",
"the ringer": "ACNgFW50EbU",
"eminem stan long version ft dido": "gOMhN-hfMtY",
"eminem smack you suge knight ja rule diss lyrics": "Vf9MoP-zCuY",
"lil peep right here feat horse head": "m-44PIocS_4",
"eminem just lose it official music video": "9dcVOmEQzKA",
"eminem beautiful official music video": "lgT1AidzRWM",
"deja vu": "NxkSEJ6Mv3M",
"lil peep nuts feat rainy bear": "osPq9Yb8xm8",
"go to sleep": "r2GEb4MrkvU",
"king von armed dangerous": "tBKYI3-3lMg",
"eminem without me official music video": "YVkUvmDQ3HY",
"eminem you dont know official music video ft 50 cent cashis lloyd banks": "ngH0fkiNo-g",
"killshot": "FxQTY-W6GIo",
"lil peep star shopping": "m8QQR-wQA0I",
"juice wrld let me know i wonder why freestyle": "swDam6Hrsm8",
"eminem venom": "8CdcCD5V-d8",
"eminem venom": "qtLXOKC1SHE",
"eminem my name is explicit": "0mNUa1m3RUI",
"dr drei need a doctor ft eminem skylar grey": "rXc_XMKkt7Y",
"business": "P05bTId-92A",
"lose yourself": "zlJ0Aj9y67c",
"dr dre forgot about dre feat eminem": "Ajbz0x11w-Q",
"stan": "7u1Jj6aRIec",
"mockingbird": "FjVjHkezTIM",
"eminem dr dre forgot about dre explicit official music video ft hittman": "QFcv5Ma8u8k",
"eminem superman clean version ft dina rae": "8kYkciD9VjU",
"eminem phenomenal audio only": "Ex55lbcS4wc",
"eminem love the way you lie ft rihanna": "uelHwf8o7_U",
"smack that": "5HZ7QBnMX34",
"eminem lose yourself": "tR1ECf4sEpw",
"eminem houdini official music video": "22tVWwmTie8",
"fall": "jsur8561_1A",
"not afraid": "NMj0NnKVMwo",
"eminem ft 50 cent is this love 09": "qaba5mffrcw",
"eminems hardest song to rap": "TzKVRsbvZaQ",
"marsh": "0WkIZwM5_vc",
"eminem tobey feat big sean babytron": "9xn0OHEZZ8Q",
"eminem darkness": "RHQC4fAhcbU",
"lose yourself from 8 mile soundtrack": "Wj7lL6eDOqc",
"eminem killer remix ft jack harlow cordae": "FVeZcM6tBQU",
"eminem fall official music video": "MfTbHITdhEI",
"juice wrld eminem benny blanco lace it": "T4CY4wVqhPU",
"eminem ft rihanna the monster explicit": "EHkozMIXZ8w",
"eminem river ft ed sheeran": "3BXDsVD6O10",
"eminem not afraid": "j5-yKhDd64s",
"the weeknd ft eminem the hills remix": "E5ENO6ftxg4",
"the real slim shady by eminem eminem": "Y8ZI1uc6iBM",
"eminem stan short version ft dido": "aSLZFdqwh7E",
"bump heads": "25aDpUpoj4k",
"eminem headlights ft nate ruess": "N8zuC0_9jXY",
"eminem love the way you lie ft rihanna": "mD57Bbv53Yw",
"eminem the real slim shady": "rkqMbsmLrtA",
"superman": "lPlePBCS6Ic",
"eminem everybodys looking at me": "IKU-yswi8HU",
"eminem superman dirty version": "bJQhFYJvtx4",
"till i collapse": "Pi3_Zs-oRUo",
"survival audio only": "o1Af8RrmLPY",
"eminems the monster was an accident": "twDyXcFWVoI",
"hailies song": "tD5oQQ-CQ4E",
"ll cool j murdergram deux ft eminem": "50Tl8E0Vvms",
"eminem sing for the moment official music video": "D4hAVemuQXY",
"eminem sing for the moment hq audio": "ExcQV4u4BGY",
"jessie reyez coffin ft eminem": "TfBaVaubcyw",
"eminem guts over fear ft sia": "-0zo3vbqJOE",
"eminem reveals the truth behind stan": "Tw0uCnG58Is",
"skylar grey polo g mozzy eminem last one standing lyric video": "4haurn3S8z8",
"eminem godzilla lyric video ft juice wrld": "3qFvCPmee8U",
"discombobulated": "kzxnrgelES8",
"little engine": "trmoIfUVctQ",
"eminem ice cube snoop dogg dr dre smoke 2025": "BT_E7AiO5G8",
"eminem lose yourself": "3CZTuqxwiCk",
"eminem lucifer feat sly pyper": "rkdLQ7HLLuU",
"eminem not afraid": "anUz77ElBK4",
"why eminem raps so fast": "ikLRFjJTlwI",
"eminem temporary feat skylar grey": "drJ508gTslE",
"akon smack that ft eminem": "J_UUmO7zcpU",
"marshall mathers": "XGSrs0QIUAc",
"eminem houdini": "fTMEMPA7eeA",
"rosemary": "fZcAQ0kuw1s",
"deftones change in the house of flies": "oSDNIINcK08",
"deftones change in the house of flies official music video": "WPpDyIJdasg",
"digital bath": "OeKgU13FHug",
"deftones risk official visualizer": "ifN91YvHj7g",
"deftones sextape official music video": "f0pdwd0miqs",
"deftones cherry waves": "SGj-ORoxD8U",
"deftones be quiet and drive far away hd remaster": "KvknOXGPzCQ",
"deftones be quiet and drive far away": "dAW8CoH_lN0",
"risk": "-1mH96_bVM0",
"entombed": "gEXbHKAuHSg",
"deftones private music full album": "PyNj9xxiA20",
"mascara": "l1uXgWu-EiE",
"deftones my own summer shove it lyrics": "VAHqzS5PcaU",
"deftones my own summer official music video hd remaster": "XOzs1FehYOA",
"passenger": "hPf97ci57bc",
"deftones diamond eyes official lyric video": "gRlHBTYKyVg",
"deftones ohms": "5XF7jcq1cB4",
"dai the flu": "s1d9kGge47U",
"deftones passenger official visualizer": "IjainiB8mk4",
"deftones be quiet and drive far away": "j1ppqX3pEkU",
"deftones my mind is a mountain": "cgh_jEm5twE",
"diamond eyes": "eS8FBesGg9o",
"deftones lmirl intro loop": "emYy14t_2UA",
"sextape": "YrdWy3rl3Sk",
"l mirl deftones slowed best part looped": "jsG52Gl6rU8",
"deftones 7 words official music video": "cqZaWj6haOg",
"rare deftones be quiet and drive far away acoustic video very rare": "Oi8V4G6FSlQ",
"deftones change audio edit": "GZWaitS1gZI",
"deftones change slowed down": "iGx2JmbDLQA",
"deftones cherry waves": "C2hvf7aHwuY",
"deftones change slowed and reverbed": "dUW89H95Ufg",
"deftones slowed muffled playlist": "Hsn4rgL9SR0",
"beware deftones": "aYbFEE0UtX0",
"engine no 9": "OC8x9_App2I",
"deftones hole in the earth official music video": "LnI_QIXU058",
"deftones my own summer shove it": "YHRYsJX-02Y",
"deftones around the fur full album": "T0Ojq_jGXTI",
"root": "344xGZeoGhI",
"deftones beware": "qhC58O1N-2E",
"beauty school": "PAquwZoOT-U",
"deftones milk of the madonna": "KDnKIryNPgQ",
"deftones digital bath official music video": "O_IIAYZL1R4",
"deftoneschange": "ZL4MGwlZuAc",
"deftones entombed": "67oBykAKUuk",
"deftones mascara": "mfBRKxQZ4Ng",
"deftones hole in the earth 432hz": "13NfdLvKg5U",
"deftones infinite source": "U_uVVO7eGic",
"deftones infinite source": "2AHpJDqHuiM",
"deftones genesis": "g81V6Uas5aw",
"one weak": "T-De_zAKxwU",
"deftones 976evil official visualizer": "y8Fy2HcuVcU",
"headup": "vKznyaTWOVA",
"deftones minerva official music video hd remaster": "mLa0-sQg1YM",
"deftones heartswires": "NJbvSmRuV_w",
"deftones i think about you all the time visualizer": "b09HHmPvliw",
"deftones minerva": "TYTt0-LpLbE",
"deftones risk": "sRmevF0zmcA",
"deftones rx queen official visualizer": "XxWildqgiKk",
"lucky you": "Ija2-DQz38g",
"deftones bored": "wF8Y-DPZJU4",
"deftones swerve city official music video 4k": "gvyHNyWfQRQ",
"deftones ceremony official visualizer": "6DXqXPYj3-Y",
"deftones tempest": "GIgNBxNvAJg",
"deftones mein official music video": "WhstBxChY18",
"deftones mascara": "kmTAmILKbN4",
"deftones tempest official lyric video": "YImIvmtuHAE",
"simple man 2005 remaster": "fXGp4wC6Ha0",
"deftones playlist for hot girls": "KwbUbLBBfO0",
"deftones phantom bride featuring jerry cantrell": "xSycaeY7qi4",
"deftones beauty school official music video": "2bK4aeahcXc",
"deftones beauty school": "uJcFlQajrMI",
"deftones rocket skates official music video": "woR6ohiFeYE",
"deftones back to school mini maggit official music video": "1gxZIL4zpIQ",
"deftones feiticeira official visualizer": "C_0O2r8qU18",
"deftones souvenir visualizer": "EujSHehKyfo",
"deftones prayerstriangles": "JAmt6zN9vOk",
"deftones change": "dj1AMcx-Izs",
"deftones back to school mini maggit official music video live video warner vault": "lMPtIhAPnn4",
"deftones ecdysis visualizer": "B8qbrHS3yTQ",
"deftones ohms official music video": "KUDbj0oeAj0",
"deftones smile remastered": "WwiHhifZIe8",
"deftones urantia official visualizer": "QwkT3sL23Pk",
"deftones smile lyric video from the unreleased deftones album eros": "rETGJHkZyhs",
"deftones rosemary": "6Ii8E21rbvQ",
"deftones xerces lyrics": "bDUJM5xxTqc",
"deftones cxz visualizer": "QZQ34I553gY",
"the chauffeur 2005 remaster": "EON3DnBbflQ",
"deftones bored official music video": "EHGhjOEtpnc",
"deftones genesis official music video": "fbp0bET06wc",
"battleaxe": "Bc6HBENsXNE",
"moana": "nmyW284Az7M",
"minus blindfold": "fdfXcNCQjf4",
"deftones 7 words": "tCl737BX_9I",
"youve seen the butcher": "tfqU-XQmBSE",
"what happened to you": "jPd3OUd2sw0",
"deftones my mind is a mountain official music video": "eVqZrI9JE6Q",
"deftones locked club visualizer": "HVmeLQN6qHo",
"deftones sextape": "Yhp3QgdD6JM",
"deftones doomed user": "IxE6kaNuNB8",
"deftones metal dream visualizer": "nsGOxKEDJjc",
"deftones my own summer": "vLjOwAPzt4o",
"deftones hexagram official music video hd remaster": "yP4dFHSd-iw",
"deftones sextape lyrics": "UmMaWLKGrpM",
"flashing lights": "ZAz3rnLGthg",
"all falls down": "W0VnPiyXSRQ",
"cant tell me nothing": "Vcljvd4Ef_o",
"jay z kanye west otis ft otis redding": "BoEKWtgJQAU",
"jayz kanye west otis ft otis redding": "TWxXXcVQevI",
"kanye west praise god": "9sJZOGxRxwM",
"jesus walks": "f9wJBdFy6sQ",
"bound 2": "5gjKuISTMRE",
"kanye west bound 2": "wVRF3SqLUi0",
"i wonder": "MxEjnYdfLXU",
"kanye west jail": "IviYsgJXG5k",
"kanye west heartless": "xk9EuEwMKcM",
"kanye west heartless": "Co0tTeuUVhU",
"stronger": "3mwiO5st-us",
"kanye west pure souls": "i1nindf1meE",
"kanye west hurricane": "bPjZmQAvk_8",
"god is": "G8u3P7Xqlvo",
"kanye west flashing lights ft dwele": "4AnnbOPCiQQ",
"kanye west power": "SUtf9Ajlno4",
"kanye west moon": "fMjasXiIhiQ",
"heartless kanye west": "xheuZhFEuDA",
"amazing": "KaumK4b6DqQ",
"kanye west amazing": "1qOqSTw2l9c",
"touch the sky": "B95OUKk7alM",
"kanye west blkkk skkkn head explicit": "q604eed4ad0",
"kanye west follow god official lyric video": "PH3KD2bb_yc",
"kanye west love lockdown": "HZwMX6T5Jhk",
"kanye west love lockdown": "w8s8_TLp3Mc",
"kanye west all of the lights ft rihanna kid cudi": "HAfFfqiYLp0",
"kanye west ghost town but it will make you ascend to the fourth dimension": "dQAsaY0pKhI",
"i miss the old kanye edit": "ymD03NnH2QM",
"violent crimes but itll make you think for a while": "DQH0g3nKkU4",
"ye like that remix": "WO28_jXYao0",
"kanye west diamonds from sierra leone": "92FCRmggNqQ",
"playboi carti iloveuihateu": "pZ6oeHV28b0",
"2024 prod ojivolta earlonthebeat and kanye west": "YG3EhWlBaoI",
"kanye west flashing lights alternate intro": "O0Cw1SLdxxE",
"kanye west good morning": "6CHs4x2uqcQ",
"the old kanye": "l_T7KZEv6L0",
"kanye west jesus walks version 2": "MYF7H_fpc-g",
"lift yourself": "8fbyfDbi-MI",
"everybody feat kanye west ty dolla ign charlie wilson": "dTeF8Yp33hI",
"kanye west never see me again high quality vocals orchestral intro": "ICEzGr7x3t4",
"kanye west i wonder extended intro": "xyfoyugCB8Y",
"ken carson margiela official music video": "Ve5jWpIu6Ic",
"aap rocky i smoked away my brain im god x demons mashup ft imogen heap clams casino": "AT9JoIv2kss",
"ken carson overseas official music video": "80M6sAU9DY4",
"playboi carti like weezy official visualizer": "C217vygclrk",
"ken carson ss": "TMzs6GvsZXU",
"playboi carti evil j0rdan official visualizer": "VcRc2DHHhoM",
"lil peep star shopping": "m8QQR-wQA0I",
"playboi carti olympian": "mj4yh7YrwfE",
"travis scott playboi carti future where was you": "um-uRGkT8GU",
"playboi carti evil j0rdan": "zTKheLpo4nQ",
"playboi carti the weeknd rather lie": "fYD7YsSRHOY",
"playboi carti hba": "QTLqujvTGrg",
"kanye west stronger": "Y7p1D3MAY9c",
"through the wire": "AE8y25CcE6s",
"kanye west amazing ft young jeezy": "PH4JPgVD2SM",
"ghost town": "qAsHVwl-MU4",
"keri hilson knock you down official music video ft kanye west neyo": "p_RqWocthcc",
"kanye west famous 2016 audio with lyrics": "1wYXSxCvN68",
"nias in paris": "gTDCMd-O2Yk",
"jayz kanye west niggas in paris watch the throne": "fbFnF-86eYs",
"big sean blessings ft drake kanye west": "M6t47RI4bns",
"kanye west gold digger ft jamie foxx": "6vwNcNOTVzY",
"kanye west heartless hd": "p42ZPTgmrnY",
"young jeezy put on featuring kanye west": "DXq2z9H_GLA",
"good life": "U-N8gJ4HdYc",
"kanye west feat jayz big sean clique hq": "DZyQHIlNa8M",
"kanye west mercy explicit ft big sean pusha t 2 chainz": "7Dqgr0wNyPo",
"kanye west fade explicit": "IxGvm6btP1A",
"paranoid": "CiY8-LYkCEk",
"jayz run this town ft rihanna kanye west": "ztygmWtWCjQ",
"mercy kanye west ft big sean pusha t two chainz explicit": "EjihBZYt32c",
"kanye west good life ft tpain": "FEKEjpTzB0Q",
"kanye west closed on sunday": "MKM90u7pf3U",
"kanye west closed on sunday 432hz": "REi0fr_9ZeA",
"kanye west clique ft big sean jayz explicit": "Oxr9XWogBQA",
"kanye west runaway ft pusha t": "4TVT7IOqH1Y",
"kanye west 24": "o9GXiQBUK4Y",
"xxxtentacion ye true love": "k7H2C5L8X7I",
"kanye west flashing lights": "3JhLIL9InyY",
"kanye west jail pt 2 ft dababy donda album": "eTwOIJvfF8k",
"kanye west black skinhead yeezus explicit version": "R4xrLKb6oFI",
"jayz kanye west nias in paris explicit": "gG_dA32oH44",
"kanye fans wildingshorts kanyewest kendricklamar fyp": "_hPpRW4z1Z4",
"kanye west runaway full version explicit": "dLMFlph54-g",
"kanye west mercy hd": "_p2IA0x4QG8",
"on sight": "uU9Fe-WXew4",
"field trip": "hmrU19LBRkM",
"cant tell me nothing": "hqvcww4ydh8",
"ynw melly mixed personalities ft kanye west": "ZhRPzx2GhiM",
"kanye west lord i need you": "U1JLaEBl7ik",
"runaway": "VhEoCOWUtcU",
"kanye west jesus lord": "Fmz2IjrQiWM",
"jayz kanye west no church in the wild ft frank ocean thedream": "FJt7gNi3Nr4",
"the game kanye west eazy official music video": "qy7sci2az88",
"champion": "jKT4ArZCkso",
"kanye west runaway 8d immersive audio": "ldkKmk6Haow",
"jayz run this town ft rihanna kanye west": "AYO-17BDVCw",
"gold digger kanye west feat jamie foxx": "UFdvCyKemAw",
"kanye west no child left behind": "sDJBhQv85K0",
"kanye west black skinhead": "YINzn01CQvY",
"2 chainz birthday song ft kanye west official music video explicit version": "Y34jC4I1m70",
"katy perry et ft kanye west": "fMkrHU98JlY",
"wolves kanye west feat frank ocean vic mensa sia": "6yWyvDKIi74",
"xxxtentacion one minute feat kanye west": "fufJp37goJ0",
"kanye west donda": "ofIluxP1nEU",
"kanye west runaway": "EoQk7aYZadk",
"rihanna kanye west paul mccartney fourfiveseconds": "kt0g4dWxEBo",
"kanye west flashing lights ft dwele": "ila-hAUXR5U",
"sunday service choir revelations 191": "GM0KKjXB1Bc",
"kanye west heaven and hell ft travis scott goat version": "tyoxTAuOiUk",
"kanye west off the grid": "EbDMNjT-QpI",
"kanye west follow god": "ivCY3Ec4iaU",
"ye ty dolla ign carnival ft playboi carti rich the kid": "pEskP0ulPlA",
"kanye west heaven and hell": "Xlvk8K0Wbpo",
"schoolboy q that part ft kanye west explicit": "zrHzfrXBk_k",
"hold my liquor": "bvBfiRWLj_0",
"best transition oat wicked x god is wickedkanyewest mixtranisitiongodsong": "xFeWFbJ4WD0",
"kanye west violent crimes lyric video": "DSY7u8Jg9c0",
"kanye west jail pt 2": "UArRcQEgxp8",
"all day": "mc-ccZXsIm4",
"kanye west god is music video": "1UDj265fAqo",
"kanye west god breathed": "aIhdYj4tfFo",
"kanye west jay z ft frank ocean no church in the wild": "M37VucWh06Y",
"send this to a person you cant put on speaker phone jess hilarious on kanye west": "P9CC0EXVNGo",
"sunday service choir father stretch": "97tvJs5fQwM",
"kanye west greatest hits best of mix ye yeezy best of mix dj lj": "AsEDtiQs7ZY",
"kanye west good morning": "aVPoWv0ntwk",
"4k kanye west niggas in paris": "IBPuPVdz7oU",
"keri hilson knock you down ft kanye west neyo": "ZNWnOoUvSMA",
"never let me down": "p4NvOKy7GOU",
"god is kanye west godblessyou jesuslovesyou shorts lipsyncs lyrics fyp audio": "vLCpTjYecwU",
"kanye west all falls down ft syleena johnson": "8kyWDhB_QeI",
"kanye west remote control": "0Rtek05tOKU",
"roses": "Qxlnb1lEdEs",
"on sight is such a good song kanye lyrics": "sgqyFYntoZY",
"kanye west floating trend": "16eLfIWGuJI",
"kanye west ok ok pt 2": "RVPEzbhSjFw",
"kanye west stronger": "PsO6ZnUZI0g",
"future i won ft kanye west": "uoOjhTXXQ4c",
"fivio foreign kanye west alicia keys city of gods": "c850yN8OKyk",
"kanye west jonah": "txion5seTBA",
"blood on the leaves": "KEA0btSNkpw",
"kanye west runaway extended video version ft pusha t": "L7_jYl8A73g",
"kanye west all mine lyric video": "TrQ7w1bdNvY",
"kanye west keep my spirit alive": "V5VYKkx7N-g",
"kanye west jesus lord pt 2": "HWzLbfkoztE",
"gotta have itkanye west and jayz": "s8S5PN1FnFk",
"kanye west heard em say ft adam levine": "elVF7oG0pQs",
"kanye west ty dolla ign good dont die audio visualiser": "8RekdDwmvJs",
"pop smoke tell the vision official ft kanye west pusha t": "o7jsf2PeYB8",
"sunday service choir rain": "OhBcFDu78dU",
"kanye west king": "xEJufkoM718",
"kanye west ye hallelujah lyricsthaisub": "-wUZsWBKPLg",
"kanye west power": "L53gjP-TtGE",
"kanye west stronger": "pSCjVNTos8U",
"2 chainz feel a way ft kanye west brent faiyaz": "f6vg4ZVyUW8",
"eminem disses kanye west": "XN0-IvYsN9U",
"dj khaled use this gospel remix ft kanye west eminem": "Nh6DuYynq7c",
"all day live at the 2015 brit awards explicit": "_ABk7TmjnVk",
"kanye west hurricane": "VRJiK-kdDb4",
"kanye west see me now feat beyonce charlie wilson and big sean": "-5pIEDvec0g",
"who was in paris skit funny kanye": "VrykxHaj9L8",
"kanye west junya": "uZET6hpfV-4",
"kanye west hell of a life v9": "Ck7ibM-GVYA",
"robocop": "kVl__NgDAdw",
"jayz kanye west murder to excellence": "54OtJlwazGo",
"kanye west amazing ft young jeezy": "ZYbxS0Z_jPc",
"welcome to heartbreak kanye west": "kqjLhDnbPf4",
"mastering kanyestyle sampling on maschine mk3 kanyewest sampling drummachines maschinemk3": "pCyHDIAfvc8",
"kanye west i wonderslowed reverb": "tNOlyqLqmdE",
"songs that kanye ruined unforgivable": "pbHl-YEfxVg",
"the real slim shady by eminem shorts": "0CS3hyCbhjk",
"kanye west greatest hits best of mix ye yeezy best of mix dj lj": "AsEDtiQs7ZY",
"kanye west violent crimes lyric video": "DSY7u8Jg9c0",
"kanye west all of the lights ft rihanna kid cudi": "HAfFfqiYLp0",
"ghost town": "qAsHVwl-MU4",
"kanye west mercy explicit ft big sean pusha t 2 chainz": "7Dqgr0wNyPo",
"kanye west gold digger ft jamie foxx": "6vwNcNOTVzY",
"i wonder": "UYXa2yBF5ms",
"kanye west heartless": "Co0tTeuUVhU",
"kanye west all of the lights revised ft rihanna": "cAX0xgHoB6k",
"kanye west runaway extended video version ft pusha t": "L7_jYl8A73g",
"kanye west good morning": "6CHs4x2uqcQ",
"jayz kanye west no church in the wild ft frank ocean thedream": "FJt7gNi3Nr4",
"kanye west lil pump i love it feat adele givens official music video": "cwQgjq0mCdE",
"kanye west stronger": "PsO6ZnUZI0g",
"through the wire": "GLTQPR8PoZU",
"jay z kanye west otis ft otis redding": "BoEKWtgJQAU",
"kanye west blkkk skkkn head explicit": "q604eed4ad0",
"rick ross devil in a new dress": "50GVPFj66CY",
"kanye father stretch my hands pt1 but its a beautiful morning": "rxJtOm68TMk",
"aap rocky i smoked away my brain im god x demons mashup ft imogen heap clams casino": "AT9JoIv2kss",
"2024 prod ojivolta earlonthebeat and kanye west": "YG3EhWlBaoI",
"power": "chPDTUjnWgA",
"kanye west power": "L53gjP-TtGE",
"dark fantasy": "UTH1VNHLjng",
"ken caron yale": "kpuy4BEU644",
"playboi carti magnolia": "oCveByMXd_0",
"runaway": "EMnQwBTJnMM",
"ski mask the slump god shibuya": "t4xfQDvrfqQ",
"kanye west never see me again high quality vocals orchestral intro": "ICEzGr7x3t4",
"playboi carti iloveuihateu": "pZ6oeHV28b0",
"kanye west ghost town but it will make you ascend to the fourth dimension": "dQAsaY0pKhI",
"estelle american boy feat kanye west": "Ic5vxw3eijY",
"playboi carti like weezy official visualizer": "C217vygclrk",
"mr rager": "XEolg577-DA",
"playboi carti evil j0rdan": "zTKheLpo4nQ",
"playboi carti sky": "KnumAWWWgUE",
"ken carson margiela official music video": "Ve5jWpIu6Ic",
"future metro boomin travis scott playboi carti type shit": "I0fgkcTbBoI",
"everybody feat kanye west ty dolla ign charlie wilson": "dTeF8Yp33hI",
"playboi carti all red official visualizer": "F6iYcXynA4s",
"lift yourself": "8fbyfDbi-MI",
"kanye west flashing lights alternate intro": "O0Cw1SLdxxE",
"travis scott playboi carti future where was you": "um-uRGkT8GU",
"monster": "pS6HRKZQLFA",
"playboi carti evil j0rdan official visualizer": "VcRc2DHHhoM",
"playboi carti the weeknd rather lie": "fYD7YsSRHOY",
"playboi carti olympian": "mj4yh7YrwfE",
"lil baby playboi carti skooly lets do it official music video": "Av4AsFPeQ9E",
"homecoming": "EzU0ofo3jOs",
"kanye west jesus walks version 2": "MYF7H_fpc-g",
"keri hilson knock you down official music video ft kanye west neyo": "p_RqWocthcc",
"good morning": "wqCz3-v3PHA",
"kanye west through the wire": "uvb-1wjAtk4",
"cant tell me nothing": "hqvcww4ydh8",
"kanye west runaway full version explicit": "dLMFlph54-g",
"addiction": "YuCwP-NbY0s",
"ghost town": "5S6az6odzPI",
"kanye west homecoming": "LQ488QrqGE4",
"kanye west runaway ft pusha t": "4TVT7IOqH1Y",
"kanye 530the cars missing extended intro sample in desc": "AUHDbzCVK1E",
"goofy ahh piano kanye west runaway": "i3GunP9bytg",
"kanye west power": "U1AwcePoqpk",
"kanye west god is": "CYYbejNI_Cw",
"kanye west greatest hits mix full playlist hip hop mix 2025": "vO8f7EEq86E",
"kanye west amazing ft young jeezy": "PH4JPgVD2SM",
"roses": "Qxlnb1lEdEs",
"kanye west diamonds from sierra leone": "92FCRmggNqQ",
"kanye west follow god": "ivCY3Ec4iaU",
"kanye west fade explicit": "IxGvm6btP1A",
"kanye west love lockdown": "HZwMX6T5Jhk",
"did you know the origin of this song ye ty dolla ign talking ft north west shorts ye": "jVkTtzdcP68",
"kanye west god got me leak": "iFCeIwCPaBI",
"kanye west heartless": "xk9EuEwMKcM",
"kanye west brothers best version": "2BWgmYHAxs4",
"kanye west blood on the leaves later archive 2013": "KXUqSfeekz0",
"kanye misses the old kanye": "MQJApuIAIQM",
"kanye west come to life": "yblfMrUeiP4",
"heard em say": "2B9KlQatQps",
"kanye west closed on sunday": "MKM90u7pf3U",
"stronger": "3mwiO5st-us",
"heartless": "s40BTpfAELs",
"amazing": "KaumK4b6DqQ",
"praise god": "fc8-lG6Wnus",
"wolves": "OZHjWc0Ssvk",
"good life": "U-N8gJ4HdYc",
"use this gospel": "8yQVcGkbpAc",
"say you will": "d9BMPmfxaoM",
"all of the lights": "w2Yh9sxfTd8",
"closed on sunday": "Lp0q1wWe6XI",
"street lights": "TUfuDKKGQxU",
"love lockdown": "ek_T6atbfe0",
"juice wrld robbery official music video": "iI34LYmJ1Fs",
"juice wrld lucid dreams official music video": "mzB1VGEGcSU",
"juice wrld empty out your pockets official fortnite video": "hgYhws0AHcg",
"juice wrld wishing well official music video": "C5i-UnuUKUI",
"juice wrld top songs 2022 juice wrld greatest hits full album 2022": "9UzJEaTVAC0",
"juice wrld armed dangerous official music video": "cr82wSBZeeQ",
"juice wrld righteous": "ZengOKCUBHo",
"juice wrld all girls are the same official music video": "h3EJICKwITw",
"juice wrld lean wit me official music video": "5SejM_hBvMM",
"juice wrld burn official music video": "HA1srD2DwaI",
"juice wrld empty": "9LSyWM2CL-U",
"juice wrld let me know i wonder why freestyle": "swDam6Hrsm8",
"juice wrld conversations official music video": "OcQ71ubUXAE",
"juice wrld stay high": "Z9yaG27quz0",
"juice wrld already dead official music video": "f74GYIVMk3I",
"juice wrld in my head": "DqZhP-Vuxgs",
"juice wrld lean wit me": "e6YYRLfUZ5M",
"juice wrld wishing well": "Q3zpwgQK8Yg",
"juice wrld the weeknd smile": "2avPJ9TZNmU",
"juice wrld fast": "lzQpS1rH3zI",
"juice wrld conversations": "1VSZtyenNlA",
"38 special go go juice wrld": "ESMt9kofND4",
"juice wrld bandit ft nba youngboy official music video": "Sw5fNI400E4",
"juice wrld off the rip gamble": "05xCoE_0l4A",
"lil pump ft 6ix9ine shut up ft xxxtentacion scarlxrd music video": "562-s96CdZU",
"xxxtentacion 3 am freestyle prod xxx clams casino leaked by rydude vise": "sG7YcwqmNs4",
"lil skies red roses ft landon cube official music video": "WlosjSe5B8c",
"dragon ball super amv xxxtentacion x rich chigga x keith ape gospel reupload": "xY_qcxDZxn0",
"juice wrld bad boy ft young thug official music video": "ghzdwjWrWcc",
"juice wrld rental freestyle": "lIQfVQ0bZGE",
"juice wrld remind me of the summer music video": "D-mtpCBOwm4",
"juice wrld party by myself official music video": "Ys3zAdSI1eI",
"juice wrld scars full songsession unreleased": "ILIgP7ikkWU",
"juice wrld cheese and dope freestyle": "0_7XPkBAxpo",
"juice wrld shes not there music video": "xTQfRFfV_8g",
"juice wrld bloody blade": "dMoMgtElYjI",
"juice wrld all these drugs music video": "iZoLpLB7qEA",
"juice wrld blood on my jeans": "3Klj_pjjqUM",
"rich the kid plug walk": "ToY6sjSV8h8",
"ken carson fighting my demons official music video": "YKkMR2l05Rs",
"mac miller self care": "SsKT0s5J8ko",
"juice wrld scars unreleased": "GZyj2wU0NPU",
"juice wrld autograph on my line music video": "JRAdnd3ORXM",
"juice wrld cant be replaced prod reaper amv": "bZb_ElMj8-o",
"lil peep 16 lines": "DxNt7xV5aII",
"sleepy hallow 2055": "y1xZ_kAhjMc",
"juice wrld both ways": "IjZuDJi80JI",
"diplo wish feat trippie redd official music video": "efxiDBygvdg",
"lil peep benz truck prod smokeasac": "3rkJ3L5Ce80",
"king von armed dangerous": "tBKYI3-3lMg",
"trippie redd travis scott dark knight dummo ft travis scott": "wrvN87l3s08",
"trippie redd til the end of time visualizer": "xqvEWirb2ag",
"juice wrld stay high official lyric video": "SKQ5r3AoXKs",
"uicideboy not even ghosts are this empty": "sxkmlZkp6ag",
"ken carson off the meter ftplayboi carti destroy lonely": "SWGjZrR3B8Y",
"morning dew": "QsVX3OjGp58",
"lil peep runaway": "zMCVp6INpnw",
"my flaws burn through my skin like demonic flames from hell": "S0KAAsanVms",
"uicideboy avalon official lyric video": "wFmAafUTJn0",
"lil peep lil jeep": "zUPPrimH7Ow",
"fck love xxxtentacionxxx ft trippie redd": "wXuFG8uQpZ8",
"ski mask the slump god shibuya": "t4xfQDvrfqQ",
"juice wrld flaws and sins": "RG9xHEF1vyk",
"juice wrld robbery": "6pFKpy9HmRw",
"juice wrld cuffed official music video": "_MUSrN3ACV4",
"juice wrld legends": "dIzgiclddlM",
"juice wrld cigarettes official visualizer": "Sis_JJZoAfQ",
"juice wrld black white": "RRl_C73vFtQ",
"juice wrld sometimes official visualizer": "ym9MpAz5PNI",
"juice wrld ft lil uzi vert wasted official visualizer": "6n4wt6gj7pA",
"juice wrld wishing well og version": "0zMrkkuk8Fw",
"juice wrld already dead": "EAfckg0ORS4",
"juice wrld all girls are the same": "BfBfDoBNjQo",
"juice wrld ill be fine": "0_6RDuiUyFk",
"juice wrld cigarettes official music video": "8FCaPKoHR3k",
"lil tecca feat juice wrld ransom": "BHJ-1g1-kn4",
"juice wrld cordae doomsday official music video": "JdXubSf5YUc",
"juice wrld the way feat xxxtentacion official music video": "tHDMJB2xZdc",
"juice wrld black white": "aQDhBNHBQUs",
"ellie goulding juice wrld hate me": "UZwi9SHgzGY",
"juice wrld in my head": "g16NKy9zDPo",
"juice wrld burn official lyric video": "L5ge0v0FTiE",
"hide": "uYHNdTPV7pM",
"juice wrld company music video": "Q1RZxYl3Nm4",
"juice wrld ill be fine official visualizer": "tbpiBw-GkaY",
"juice wrld wishing well clean lyrics": "Jh38-gBZ370",
"lucid dreams clean juice wrld": "jF3z3CZp1gk",
"juice wrld marshmello come go official music video": "Dxm3cHrKcbA",
"juice wrld xxxtentacions new song": "uwCEJo39uyQ",
"juice wrld wishing well": "4opO3KxoUnI",
"juice wrld empty": "84Xpdw92KFo",
"juice wrld all girls are the same": "JcJKlRUnppc",
"juice wrld desire": "Krw9ZLN0aqE",
"juice wrld the party never ends official music video": "YEYu4cD5KAU",
"lil peep xxxtentacion juice wrld": "v_Zhl8nUM9s",
"juice wrld ft marshmello polo g kid laroi hate the other side": "rp2e4-Sh0Hc",
"juice wrld wasted feat lil uzi vert": "pqiO8wV4-wc",
"juice wrld go hard 20 official music video": "76-3t3g_Mig",
"juice wrld with filters back subscribe music juicewrld juice rip ytshorts": "CtMQXemuZnY",
"juice wrld feeling": "9gHwgVRRCWg",
"marshmello juice wrld bye bye official lyric video": "ZnQMqj-Sbec",
"juice wrld legends": "_o2pZbw05Dk",
"when you realise this about juice wrld": "oWNVVY1eVQs",
"juice wrld lean wit me": "WsrVxz4pjGs",
"tame impala let it happen": "-ed6UeDp1ek",
"tame impala the less i know the better": "2SUwOgmvzK4",
"tame impala borderline": "2g5xkLqIElU",
"tame impala new person same old mistakes": "_9bw_VtMUGA",
"tame impala dracula": "xnP7qKxwzjg",
"tame impala dracula": "jwVMgGs50vE",
"tame impala one more hour": "Y0U6u2D8cMU",
"tame impala eventually": "GHe8kKO8uds",
"tame impala breathe deeper": "gs-MtItyOFc",
"tame impala nangs": "c3yEjD_oijw",
"tame impala is it true": "qLGwIHjhboA",
"tame impala cause im a man": "EyEB2AEqHxc",
"tame impala lost in yesterday": "C7VlC0QjdHU",
"tame impala posthumous forgiveness": "44lWO3qhQMk",
"tame impala it is not meant to be": "VpLXxFhy7s4",
"tame impala the moment": "3Qpf9pAkUeI",
"tame impala disciples": "NTfYYRGTB3g",
"tame impala loveparanoia": "eI2c-Nrgsko",
"tame impala the less i know the better": "sBzrzS1Ag_g",
"gorillaz new gold ft tame impala bootie brown official visualiser": "qJa-VFwPpYA",
"tame impala mind mischief": "BQKKDNCpVbo",
"tame impala loser": "WvZnX0P04Q0",
"tame impala let it happen": "pFptt7Cargc",
"tame impala loser": "s3a4OQR-10M",
"tame impala my old ways": "pyUOSaQZmxw",
"tame impala let it happen 8d audio": "vvBaEhoMiOA",
"tame impala lil yachty breathe deeper lil yachty remix": "I-dvJGbVQQ4",
"the less i let it happen the better i know": "-sJU-n-aTxA",
"tame impala on track": "XlmpIRFeI8I",
"tame impala let it happen": "YqlLjeM0l_4",
"tame impala borderline ultimate version single album mix": "1_R-L6oxHvU",
"tame impala no reply": "FtZuN44Jg0U",
"tame impala feels like we only go backwards": "TZ-W40TEXNc",
"justice neverender starring tame impala": "E7FU_mqhFGk",
"justice x tame impala neverender": "911ahyRrjZ8",
"tame impala elephant": "z7q9W2PNhJ4",
"justice neverender starring tame impala official lyric video": "47YNsf-7Y7c",
"tame impala end of summer": "ulkdUfItyxI",
"tame impala end of summer": "lGXOUdqU6nI",
"tame impala tiny desk concert": "xSDfCwDmJNo",
"tame impala oblivion": "ZTyPjR9a8vw",
"tame impala apocalypse dreams": "DmmvZrBnQ4M",
"tame impala end of summer": "lEl1y4uSdDs",
"tame impala yes im changing": "D_cMCvudZBs",
"chase atlantic into it": "lZp96uELegI",
"slow down": "4kbSC3HXfJw",
"chase atlantic consume feat goon des garcons": "oCdXuomafSU",
"paradise": "4tijiFGhBN8",
"meddle about": "MXp3lZQgwes",
"chase atlantic the walls": "FnvUMFmxP70",
"chase atlantic friends official lyric video": "nT8O_mP2x6Y",
"moonlight": "vUNK5rIssww",
"dancer in the dark": "pdAGwKJoIEM",
"chase atlantic right here": "Z4kzes_3FJY",
"chase atlantic triggered": "9vYXWvQhQIs",
"chase atlantic drugs money": "quF_LwIeVv8",
"chase atlantic heaven and back": "uIS6H-JxOXE",
"chase atlantic die for me official lyric video": "k_F-b8tLvng",
"chase atlantic swim": "eto-4V82YtU",
"chase atlantic tidal wave official lyric video": "0Tgn8hR7Jpo",
"falling": "f59S9Aid4B0",
"you too": "pvDMoyz_uRQ",
"chase atlantic swim lyric video": "R4rFZDH60N4",
"chase atlantic swim official music video": "mC9v5FaLt84",
"chase atlantic call me back official visualizer": "SNZfK06U68g",
"chase atlantic why stop now": "UEIRbiOWZRc",
"chase atlantic you official lyric video": "A8vCSJwdq7c",
"vietsub into it chase atlantic lyrics video": "TlgNKN1VXUU",
"chase atlantic slow down": "aa3k806uonM",
"chase atlantic friends slowed down": "cWbWbOCJOzc",
"chase atlantic swim tiktok remixspeed up lyrics luckily luckily luckily chase atlantic": "ztC_hIVraYk",
"friends chase atlantic tiktok version": "TduGGR2mE04",
"fcked up chase atlantic": "k09azzrv4_k",
"travis scott goosebumps feat chase atlantic remix lyrics": "DsWQ38n0VeA",
"chase atlantic into it official live music video": "TkBi4hZlV8U",
"chase atlantic august": "c1vTxJouUyE",
"chase atlantic slow down": "u7lzhf_O-50",
"chase atlantic friends": "xKtkpHsK7jI",
"chase atlantic remind me official lyric video": "0HRRTLGUiws",
"chase atlantic ozone": "QAe-x8bfdug",
"chase atlantic her official music video": "wNliit0-u7c",
"chase atlantic cassie": "6Hs0RHO2Hl8",
"chase atlantic triggered official music video": "JcOCAmj3fDs",
"chase atlantic warcry official visualizer": "w03hq-Ok1DE",
"chase atlantic disconnected official visualizer": "kgmHg7GvgHo",
"chase atlantic friends 8d audio": "nwwuTpkTs8Y",
"chase atlantic playlist": "rxLMuc8sJjg",
"greengreengreen": "JSOwafXzJiQ",
"chase atlantic swim": "7yW_uJOpxww",
"chase atlantic church lyrics": "Jerb5y8-Y2k",
"chase atlantic demon time official visualizer": "RMLg9sZMPUs",
"chase atlantic disconnected official music video": "0yFy32q_jR0",
"chase atlantic swim": "Z6lqFHwDt10",
"chase atlantic victory lap feat dewayne official visualizer": "CsMFKou4s5o",
"chase atlantic uncomfortable": "mXjUcE6ZevE",
"chase atlantic what u call that official lyric video": "L_1Iu6UBiLw",
"chase atlantic meddle about": "tykNAh1anU0",
"sub thai swim chase atlantic": "Prlk4SXeqTk",
"chase atlantic ohmami with maggie lindemann official visualizer": "5kXWaOd95Ug",
"chase atlantic okay official music video": "IIVm_2Ep1dk",
"chase atlantic friends so what the hell are we tell me we werent just friends": "aVjMuNW4r1w",
"chase atlantic paradise": "E_zXy3ZOMTM",
"chase atlantic 23": "k7_KaCgC5oQ",
"chase atlantic i think im lost again official visualizer": "M5jfPAp--qM",
"devilish": "DdzF7AT8Lds",
"chase atlantic paranoid official visualizer": "zpK1ICt5Tms",
"chase atlantic angels": "5YcvYeColJY",
"chase atlantic facedown official lyric video": "FBE_BANaR4w",
"chase atlantic the playlist": "zBlWh2Gcjo8",
"chase atlantic okay": "G-V_1VdrmBQ",
"chase atlantic aleyuh official visualizer": "JKlkgmN_j3U",
"chase atlantic heaven and back": "_lpFyGTrxfc",
"chase atlantic playlist": "IaZv0ALqr1k",
"chase atlantic out the roof": "Z3BXTHZGOZc",
"chase atlantic ricochet official music video": "E47KhT81CL8",
"chase atlantic slide official music video": "tOVIeLZtxDc",
"chase atlantic slide lyrics": "2O7FQ4iYxFU",
"chase atlantic the walls": "UYD3EZ-QOXQ",
"chase atlantic facedown official music video": "WM28EGDUSj0",
"chase atlantic numb to the feeling official music video": "j-_vl5AXsj0",
"chase atlantic doubt it official lyric video": "Qg5OefST_9g",
"roxanne": "bCW15UFuocE",
"chase atlantic mamacita official music video": "gdCAFwCZKxo",
"": "C6nFRQMaBVM",
"friends chase atlantic sub espaol": "_Il3sSsuqyA",
"talk slow": "hU96pNN2Ysw",
"chase atlantic mess me up official visualizer": "dUwd4SP3atc",
"": "W_Ua_bNxdiI",
"post malone white iverson": "XhmGfZ1SeuY",
"post malone wow": "NA4uIFbVCPM",
"post malone circles": "pQV0WEdT_OE",
"post malone take what you want ft ozzy osbourne travis scott": "LYa_ReqRlcs",
"post malone i like you a happier song ft doja cat": "_a0T5qwxANg",
"post malone rockstar ft 21 savage": "4GFAZBKZVJY",
"post malone hollywoods bleeding": "w5GrxfjuTTI",
"candy paint": "qtgf-sidZrU",
"i fall apart": "nqfVoTMEosw",
"post malone the weeknd one right now": "OCogbzIvYg0",
"stay": "4Ukh9aQBzWc",
"post malone chemical": "D2HMHH6sRBY",
"congratulations": "R8vpQdZErbw",
"post malone goodbyes ft young thug rated pg": "S4asq3SicN0",
"post malone goodbyes ft young thug official lyric video": "Wisthc226SU",
"post malone feat ty dolla ign psycho": "MGYJuETPQEg",
"post malone a thousand bad times": "ul-9U681Y2c",
"post malone go flex": "vC2owoWdIUs",
"post malone rockstar official music video ft 21 savage": "UceaB4D0jpo",
"post malone rockstar ft 21 savage explicit hq": "jONxrPmIUVY",
"post malone on the road ft meek mill lil baby": "yw_ShLNyHTk",
"motley crew": "VYjxeXsM9gw",
"post malone losers lyric video ft jelly roll": "uKiF-UMnB9A",
"post malone cooped up ft roddy ricch": "LUBUchYczsA",
"post malone circles slowed reverb": "hbMsnRhr1UI",
"post malone i fall apart": "P4s6DX0WoXc",
"enemies": "qT_y5Yc8jSA",
"post malone why dont you love me before he was famous": "XWr2VZiov_A",
"post malone motley crew": "lCiV4wACZ8w",
"post malone goodbyes ft young thug rated r": "ba7mB8oueCY",
"post malone psycho official music video ft ty dolla ign": "au2n7VVGv_c",
"post malone ft blake shelton pour me a drink ft blake shelton": "RoeXmaSE7Lo",
"post malone mourning official music video": "DAOZJPquY_w",
"post malone ft sia addicted to you lyrics videoai music": "mD3IKNS8qcU",
"92 explorer": "OhqyRJtv3K0",
"mood": "KfuukDHC0d8",
"post malone chemical official music video": "IzPQ_jA00bk",
"lil peep star shopping": "m8QQR-wQA0I",
"post malone better now": "UYwF-jdcVjY",
"post malone better now beerbongs bentleys": "Oggrsg4jZPM",
"post malone die for me ft future halsey": "I_QpDE-Uco0",
"post malone greatest hits full album top songs full album top 10 hits of all time": "aDd9wZe4Taw",
"post malone overdrive official live performance vevo": "hggjZ-FGGkw",
"big sean wolves ft post malone": "Zx_DBvChpvM",
"post malone sainttropez": "VEsKftAplus",
"tyla yaweh tommy lee ft post malone": "4Do9gZpLnfg",
"post malone psycho ft ty dolla ign beerbongs bentleys": "thMKwS-7kB4",
"post malone overdrive extended": "4Y1riYO_JAk",
"post malone pour me a drink lyric video ft blake shelton": "QL4-aYxCVAI",
"post malone wow remix feat roddy ricch tyga": "Em1uK7KKc6o",
"post malone congratulations official music video ft quavo": "SC4xMk98Pdc",
"post malone congratulations ft quavo": "m_DG4shGECI",
"post malone mourning official visualizer": "U2Ww0iPEet4",
"post malone goodbyes ft young thug": "s-gr6k95iaM",
"post malone mark morrison sickick cooped up return of the mack": "TR5rpEtK_4k",
"post malone yours lyric video": "hrAeuPqYnRQ",
"post malone circles": "WnLIGgTaBM0",
"post malone circles": "wXhTHyIgQ_U",
"post malone better now": "xewNTTHY_go",
"post malone myself": "gqthPT8vK7o",
"post malone psycho ft ty dolla ign": "uhx8NjSsdY0",
"post malone circles clean lyrics": "9gkRJONZPSA",
"post malone sunflower ft swae lee": "Dghmoi7XZmc",
"post malone goodbyes clean lyrics ft young thug": "EA9HaXLAt9M",
"post malone i had some help lyric video ft morgan wallen": "11T6kF66dKY",
"post malone circles live from the studio": "DX6jfQG2YdY",
"post malone swae lee sunflower": "cKMQz1Rf2ow",
"post malone allergic": "JdttvuGdlvs",
"post malone goodbyes ft young thug": "O5amIdSD8eI",
"post malone i had some help feat morgan wallen": "4QIZE708gJ4",
"post malone morgan wallen i had some help": "KqVIjvBzGR0",
"post malone im gonna be": "s1XbPXdgEEA",
"taylor swift fortnight feat post malone": "b7kmP1fsGg8",
"post malone internet": "weXNuvoyEr0",
"post malone wrapped around your finger official lyric video": "JXxAnZaZrG0",
"post malone i know": "k7fiZ_if2Bg",
"post malone swae lee sunflower live from the studio": "Lk0sZwXTwnc",
"post malone waiting for never official visualizer": "2SH6516eyL8",
"over now": "vFPoHUIRpvg",
"post malone over now beerbongs bentleys": "r6FtPaX8URI",
"post malone circles 8d audio": "ZfCJhLq2CSE",
"post malone cooped up official music video ft roddy ricch": "WABOrIYhR94",
"post malone what dont belong to me lyric video": "qvfssW5U_Ig",
"post malone when im alone": "pqg2mD7o_nU",
"post malone circles": "TqXPtEU9MJs",
"sugar wraith": "auRnvLHCMtg",
"post malone overdrive": "S1koeM672XM",
"post malone angus stone big jet plane live cover": "WEIuAB7FTtk",
"post malone wrong ones lyric video ft tim mcgraw": "72jIu39ZRz4",
"future honest": "aOCpGOVB0AY",
"future march madness": "pJ-c5NsKjXo",
"future wicked purple reign": "4wrn4Tg6_4g",
"future solo": "X2DTROC4JCI",
"future lil uzi vert drankin n smokin": "-QiovlGJi_U",
"future hardly": "3ToQHDcyuSs",
"gunna future pushin p feat young thug": "9g08kucPQtE",
"future too comfortable": "wPhs_tPENDQ",
"zaytoven mo reala ft future": "CXAqYldb01A",
"future 56 nights": "UZQFg5IfhQs",
"future married to the game project et esco terrestrial": "NUyf8SMPUAI",
"future oath": "mkR22IvUZO8",
"future low life ft the weeknd": "T8e5YMKVQXU",
"future wait for u ft drake tems": "Y2QpQP8wPG8",
"future accepting my flaws": "pCIKkdIUaJI",
"hotboii future nobody special": "2jVJMfrL3jI",
"future fck up some commas": "z0G04bgZHwc",
"young thug sup mate ft future": "CV7OQerBcBs",
"future codeine crazy": "O7eVICpL8FY",
"21 savage metro boomin x ft future": "szKxAdvlCCM",
"future love you better": "rC8B3JfV_jE",
"turn on the lights": "4rnkNwFXSNw",
"future lay up": "xc3lse938xA",
"28 minutes of future hardest songs seamless transitions": "wgkkvRwUAgk",
"future plutoski": "GHEx6uCO80w",
"future lil demon": "ayWwfGtGpBQ",
"don toliver fwu official music video": "70E1B_5bimY",
"playboi carti toxic with skepta": "U6jeOBSGI6Q",
"future honest official music video": "FAeAp9MzPtk",
"future puffin on zootiez": "8c6jIwNpG00",
"lil yachty pardon me ft future mike will madeit": "W7VK4DUHvKU",
"future hard to choose one": "SfKo0EWzeh8",
"future low life official music video ft the weeknd": "K_9tX4eHztY",
"mask off orchestra version future prod metro boominedit audio": "5W0X-zxueVY",
"future solo hndrxx": "xC0pF72qmIw",
"future life is good official music video ft drake": "l0U7SxXHkPY",
"playboi carti evil j0rdan": "zTKheLpo4nQ",
"future puffin on zootiez official music video": "H8E0WIy_vFc",
"playboi carti hba": "QTLqujvTGrg",
"young thug money on money feat future": "W4aE8of2znM",
"i hate what happened charge me future metro boomin full cdq leak": "H7QwVlXsM4A",
"travis scott playboi carti future where was you": "um-uRGkT8GU",
"future perkys calling purple reign": "isU7n-XNSbA",
"future metro boomin gta": "A8bE-MPs0K0",
"future march madness": "nyAHO0U-KQg",
"married to the game": "zLZrytzKRLs",
"gunna just say dat": "8gy-Y9tWK6M",
"playboi carti evil j0rdan official visualizer": "VcRc2DHHhoM",
"ken carson yes": "KMoHAuvwN3Y",
"playboi carti the weeknd rather lie": "fYD7YsSRHOY",
"future metro boomin travis scott playboi carti type shit": "I0fgkcTbBoI",
"lil baby playboi carti skooly lets do it official music video": "Av4AsFPeQ9E",
"young thug future money on money": "Oruj2QwwMsM",
"future south of france": "XDaOOV2jubk",
"future lookin exotic hndrxx": "zLuY1bgWxrI",
"future extra": "6vvsY60dgOI",
"lil durk they want to be you ft future": "BFEtZWz6tPI",
"future throw away": "LY8H6vccN5M",
"future last breath from creed original motion picture soundtrack": "mKeqZ_AcL_A",
"gunna street sweeper feat future": "xMgE736TC4A",
"mask off": "aWb8z-KhZdo",
"future shotgun": "yPcgqztrSyQ",
"travis scott telekinesis ft sza future": "xl5LunV-OkU",
"future metro boomin fried she a vibe": "0Z8eMHVwFDw",
"future metro boomin kendrick lamar like that": "N9bKBAA22Go",
"post malone die for me ft future halsey": "I_QpDE-Uco0",
"future life is good ft drake": "ZBOoVj6IW3s",
"drake n 2 deep ft future": "Oh-Al70frOc",
"future monster": "PnYeNKtY5UQ",
"married to the game": "5oauNlfODxw",
"future never stop": "jAI9Jdmv7J8",
"future lil uzi vert patek": "GiqoknOr4z4",
"future 712pm": "mPdlRs6Bf_8",
"future hate the real me": "mS0bX6Hch0w",
"future draco future": "9y64nUw1wwc",
"future hallucinating hndrxx": "IxBEfXFDo1M",
"my collection": "Ck9CVPn9F20",
"future metro boomin travis scott playboi carti type shit": "XcK8JdVlcXY",
"drake desires ft future": "nGXCuAHEjYI",
"future never gon lose": "9UIOC3wCZZ8",
"future news or somethin": "Slhfx6ChFic",
"future where ya at ft drake": "fPTJLHjzyEo",
"fly shit only": "IMMrprklAPc",
"future ski": "Kad2gkMFnHE",
"future too fast": "Y3kPf8jaoso",
"future charge me": "Y-_txV6e01Y",
"the weeknd future enjoy the show": "b9jHP7XhMDg",
"future 31 days": "rcTIq5mtRRM",
"playboi carti trim with future": "7HCSPePbjNQ",
"shot for me": "wc7JPaRV5uU",
"drake pipe down": "ZIu-V_xEehs",
"drake 21 savage hours in silence": "6hfbHSItskQ",
"practice": "JUrDOWj9RUw",
"drake 21 savage spin bout u": "jALeORvCJG8",
"drake virginia beach": "k20wnICXpps",
"drake tsu": "fhEqtynX_xc",
"drake when to say when": "qTNFIQyWe8M",
"drake members only ft partynextdoor": "9YN6_jvHheo",
"hold on were going home": "KnkDL9lkbX8",
"drake 21 savage treacherous twins": "jCtsnNpCDo0",
"drake hotline bling": "zt6aRKpf9T4",
"drake slime you out ft sza": "2_gLD1jarfU",
"drake girls want girls ft lil baby": "b8M6N0FTpNc",
"headlines": "Sn3SUnL44w4",
"marvins room": "JDb3ZZD4bA0",
"partynextdoor come and see me ft drake": "lG4HICGeQoo",
"drake fair trade ft travis scott": "THVbtGqEO1o",
"shut it down": "wWcaNu10POQ",
"drake 21 savage privileged rappers": "lF3K70KR5Xk",
"gods plan": "m1a_GqJf02M",
"drake time flies": "OjgBxXNP3gw",
"drake war": "VcxPv4I-xZg",
"drake not you too ft chris brown": "ZX_mvoY_Hg0",
"forever ever feat young thug reese laflare": "XYb1mdGu5aQ",
"drake rich baby daddy ft sexyy red sza": "F7o0upORtCw",
"frank ocean novacane": "BPvDlF0raWI",
"aap rocky i smoked away my brain im god x demons mashup ft imogen heap clams casino": "AT9JoIv2kss",
"drake kanye west lil wayne eminem forever explicit version official music video": "eDuRoPIOBjE",
"drake nokia official music video": "8ekJMC8OtGU",
"4 raws": "gt_Oe2yGE4o",
"meek mill going bad feat drake": "S1gp0m4B5p8",
"ken carson blakk rokkstar": "29ToiaUotCE",
"ken carson i need u": "XDocuspdgVk",
"daniel caesar superpowers": "rScwLoES2bM",
"partynextdoor belong to the city remix ft drake": "Xwo_9di-gpw",
"playboi carti tundrah00dbyair official music video": "KwBObpqldm8",
"playboi carti iloveuihateu": "pZ6oeHV28b0",
"drake idgaf ft yeat": "fCRCLsJQWUQ",
"long time intro": "tkPoOvVnbRk",
"playboi carti like weezy official visualizer": "C217vygclrk",
"drake 9 slowed to perfection 432hz": "1CyEuQnfDGo",
"lucki randomly": "KeHKJCt4qJA",
"lucki rip official visualizer": "rSO1cBfPVQg",
"lucki leave her": "egMEvoCWc3k",
"lucki no bap": "jbrarMb6fpw",
"lucki white house feat babyface ray": "7GQUuYQPzx0",
"lucki geeked": "98yxlTtvHsY",
"lucki me myself i": "T445kuJzg4M",
"lucki paidnfull": "O2zPPwCfmYo",
"lucki coincidence": "FOTc7KqGuZY",
"lucki made my day": "99EezaGpru4",
"lucki go away": "1utwLavnFL8",
"lucki heavy on my heart": "IgBLFQBCCuU",
"lucki on point": "9dQIZOcmAI8",
"lucki send me on my way": "HVxwnNFz3jU",
"lucki y not": "mJiwlgvGTSI",
"lucki tbt": "31qu0xIt7m0",
"lucki rip act": "HRNfd9ckHt4",
"lucki how tf": "iyigJD1npOA",
"lucki archive celine": "biqC6Ncq5Zg",
"lucki 4 the betta": "3Bg_HmJ6bs4",
"lucki faith": "prtZiX14Png",
"lucki future kapitol denim": "8O7QSebmOaM",
"alternative outro": "D0meVJwBUl0",
"do you want": "WnxYoYBhyWA",
"lucki lil yachty i dont care": "x9pVY4rBv8Q",
"lucki diamond stitching": "rgCbZFPnx80",
"lucki droughtski": "1aL5v2cZSzg",
"lucki more than ever official music video": "7-QK_1oHoiQ",
"slow down": "NPgG9n_HpGc",
"sunset": "4-pdlpEwMao",
"lucki 4 the betta": "7vyGnES3KlY",
"lucki foggy days prod captaincrunch dj eway": "ZyDzGqXRndU",
"lucki switchlanes dir lonewolf": "Y-66OdLOxyk",
"cocaine woman": "FMw_EXe18Qg",
"lucki super urus": "fIrSkilUvHw",
"sessions feat lucki": "VyB0xHOiXAg",
"at night": "hoV6qv9R_gg",
"lucki y not": "ugou23mYCmE",
"lucki new drank dir lonewolf": "vXvqB2AiAio",
"playboi carti iloveuihateu": "pZ6oeHV28b0",
"playboi carti like weezy official visualizer": "C217vygclrk",
"lil baby playboi carti skooly lets do it official music video": "Av4AsFPeQ9E",
"veeze get lucki": "Pu1fEn0GvC4",
"lucki gemini love official visualizer": "D-VYY3VbPBQ",
"lucki courtesy of official visualizer": "EOLnVu3uXnw",
"lucki f1lthy ugk official visualizer": "ZP_4XEAd6Fk",
"lucki heavy on my heart official visualizer": "wTa4Kee3zA8",
"lucki goodfellas": "6uuL43i-JQY",
"lucki f1lthy 2019 official visualizer": "rJHwVNmZdnA",
"lucki goodfellas": "EDfEuWeu1WY",
"lucki new york official visualizer": "q1f7xtNQcJU",
"lucki on they way official visualizer": "BeAluF9HjC8",
"lucki noticed ya": "mHK_Ux2QViw",
"lucki red key": "Z3oJGN36tFg",
"lucki 2021 vibes official visualizer": "z4zC_puw87M",
"lucki dna": "n6OcP_SrL8k",
"veeze get lucki official music video": "GnKdDGoxtko",
"lucki rylo rodriguez veeze gerskiway": "yK96Yl2AYgc",
"lucki 16yrold way 2 rare": "xEcNPupL7Oc",
"chuckyy hotseat feat lucki official music video": "GmmU95R74b8",
"lucki 13": "HmcTGHR5oHU",
"lucki bad influence freestyle": "6fE-pmQG0Ks",
"lucki tune scotty": "sz0RG2cLbdw",
"lucki left 4 dead": "K7ySSoGPyzY",
"lucki beverly hills to 35th": "swb-oOTDtww",
"lucki geeked n blessed": "y1g-WdCfMDE",
"lucki been a minute": "AdCQXqunKhI",
"lucki brazy weekend": "ayYmdMX0TYo",
"lucki kylie official visualizer": "VtIjS2CqjnY",
"lucki gemini love": "Vg0JgB2sN98",
"lucki pure love hate visualizer": "x8537eyytrU",
"lucki paidnfull colorful drugs": "sKu8Zg7Hplc",
"lucki 4 the betta": "TSqbGm7FDdY",
"lucki hollywood dreamer": "Do0e14t0FDw",
"lucki widebody": "kEhX06Doi3s",
"new drank": "Dn9A3Ri5DAs",
"lucki chosen one": "ms3MuKubGKQ",
"lucki my way codeine cowboy": "A3BIdYbZP0Y",
"lucki meet me there": "O_hMolhadQ8",
"lucki your dreams produced with flavor": "RB6jEZpL9Wg",
"daemoney gta feat veeze lucki": "NNYGSeZAHmM",
"lucki free mr banks": "yoKU-adT3kg",
"lucki free mr banks": "rbNfckqe4oM",
"lucki runnin with visualizer": "LlALDHVnmK4",
"lucki lil yachty greed": "2gvu85RlHfc",
"lucki exotic official visualizer": "-F0Ajlzs_2o",
"lucki its bool visualizer": "ErEOIpkarEI",
"lucki nigo visualizer": "FdWvKBd_l7M",
"1 hour lucki mix of songs you have never heard 2025": "sZ-KWMtlKi0",
"lucki overthnking": "Ed3_NqN7pls",
"lucki lifestylebrazy": "VxznyEuHFlk",
"lucki all love official visualizer": "1W5QovGqi9s",
"lucki tarantino visualizer": "ozUOQyYG0DU",
"lucki pop star official visualizer": "Kb_4OSbRJ8s",
"lucki 10 pm in lndn": "Opq_3l0DFp0",
"lucki at least i think its real visualizer": "OWP7LEvB-JM",
"lucki super urus": "Z55v5JkpVvc",
"lucki chrome denim official visualizer": "_SXICPYHZsY",
"lucki lil yachty biggavel official visualizer": "6GjZMFUfxOw",
"lucki last time mentioning good riddance": "e30ApA0cWRg",
"lucki almighty tune official visualizer": "MBasbdPvL1M",
"lucki mubu": "QodLIb2ZKxo",
"lucki diamond stitching": "5heFq2UIhSM",
"lucki pick a flaw visualizer": "vh__vqQB6gI",
"lucki life mocks art": "X_q1xQZN4YU",
"3d outro": "H2t9aZQ3YKI",
"lucki x6": "KKAYk5TG09s",
"lucki 13": "Yq_qdfajtNI",
"lucki bby pluto official visualizer": "m8wyNHFuOQM",
"lucki bby pluto extended intro prod jono": "EEH1IVcnT5Q",
"lucki f1lthy cry out official visualizer": "iwyhv5Pskxs",
"lucki mubu official visualizer": "cck9JTirJaw",
"lucki ouch omen visualizer": "Dz3FgtxLq8c",
"lucki not so virgo of you official music video": "ueqTQ-CMSDw",
"lucki outro official visualizer": "kMqbjE5EhRw",
"drake yebbas heartbreak": "9rlW2rUzyn0",
"youngboy never broke again nevada": "JfGnwcf5Lt0",
"ken carson fighting my demons official music video": "YKkMR2l05Rs",
"drake energy": "7LnBvuzjpr4",
"drake ft jay z pound cake instrumental": "TOdwMx9jHFs",
"ken carson me n my kup": "K_y1aG9hnH8",
"rihanna feat drake whats my name": "e2gaIYs8Pf8",
"drake we made it ft soulja boy": "jhenogvNrno",
"ken carson loading": "0QydmrTTXog",
"mr rager": "XEolg577-DA",
"juice wrld let me know i wonder why freestyle": "swDam6Hrsm8",
"yeat com n go official music video": "QqzXvvdk3bQ",
"playboi carti olympian": "mj4yh7YrwfE",
"2024 prod ojivolta earlonthebeat and kanye west": "YG3EhWlBaoI",
"playboi carti the weeknd rather lie": "fYD7YsSRHOY",
"xxxtentacion sad": "pgN-vvVVxMA",
"i might be sued": "kKKsX8UzJzI",
"drake toosie slide official explicit audio": "dGYxT1QReQs",
"drake im upset": "wS4ESheuHDY",
"nokia": "RDH71p3LgWM",
"drake laugh now cry later official music video ft lil durk": "JFm7YDVlqnI",
"over": "KPS9kBybDfI",
"drake family matters": "ZkXG3ZrXlbc",
"one dance feat wizkid kyla drake": "FOqKN-ouAUE",
"ken carson ss": "TMzs6GvsZXU",
"drake 21 savage rich flex": "I4DjHHVHWAE",
"fancy": "mUZrMNhM7fE",
"drake passionfruit": "fHR1CZ9x61E",
"drake nice for what": "U9BwWKXjVaI",
"drake 9": "q50SwIodCwg",
"dj khaled ft drake greece": "NCHFUHRe604",
"drake champagne poetry": "IxVuT8cgccM",
"nice for what": "1Jx4Dv269uE",
"nicki minaj drake lil wayne seeing green": "_Q7rcUm0Dro",
"lil wayne love me explicit versionclosed captioned ft drake future": "KY44zvhWhp4",
"drake trust issues": "vMGpBAOD2CI",
"roy woods drama feat drake roywoods": "XP0fdtXn49s",
"metro boomin no complaints feat offset drake": "WSHhp-VXTZs",
"drake giveon chicago freestyle": "p9pf5EyOgcs",
"romeo santos odio feat drake lyric video": "W8r-eIhp4j0",
"passionfruit": "EgfsXTOn_pI",
"migos walk it talk it ft drake": "A_xWDAbnBSU",
"drake polar opposites": "jfuzmCOcQSs",
"drake race my mind": "bpXztWUPPFQ",
"drake jumbotron shit poppin": "IkpgHYDGQlo",
"drake gods plan lyric video": "pPKx-fon1nY",
"up all night": "2BD9XuEz9bY",
"drake get along better ft ty dolla ign": "84y-jaEiFZU",
"dj khaled ft drake popstar": "-iNWEwLfkv8",
"drake what did i miss": "weU76DGHKU0",
"drake headlines explicit": "cimoNqiulUE",
"partynextdoor drake nokia": "UWyFj-TD9-M",
"ceces interlude": "uBB_-wEeQ0Q",
"camila cabello uuugly feat drake official visualizer": "Qmj4iFeuEQ0",
"jungle": "AfRdRXCo3IU",
"teenage fever": "e8HtwsnuTIw",
"drake flights booked": "hb24kZ0fiEA",
"chris brown no guidance ft drake": "oOni4BMeMp0",
"drake a keeper": "RaskP_FC9VA",
"nicki minaj moment 4 life ft drake": "xlt1lBDglGE",
"nicki minaj only official lyric video ft drake lil wayne chris brown": "BU769XX_dIQ",
"young thug bubbly with drake travis scott": "uCDE-S1AjuQ",
"rick ross diced pineapples explicit ft wale drake": "jb6HZa151s8",
"drake fountains ft tems": "pwtWYFUwenE",
"sound in drakes house": "Jie6dT7a0wI",
"brent faiyaz ft drake wasting time": "KJViHi-dSxY",
"drake red button": "leWap1vgE8U",
"drake losses": "V7iHOPpKRJc",
"partynextdoor loyal feat drake": "FL7icWyial0",
"meek mill rico feat drake": "EgRrxFsX538",
"yg why you always hatin ft drake kamaiyah": "n1CLmap_CVU",
"justin bieber right here ft drake ft drake": "v5UvS_Lc5Aw",
"drake toosie slide official music video": "xWggTb45brM",
"drake hold on were going home": "QKYkZnxZ3ZA",
"drake texts go green": "kFXHPfI2JoI",
"drake money in the grave ft rick ross": "R0ykLlhg0AQ",
"drake what did i miss clean": "2RNsuIlXYyk",
"drake love all ft jayz": "Pnz4wbCblmM",
"nicki minaj drake lil wayne no frauds": "VkXjvHfP3MM",
"drake massive": "ay1l_u6vltY",
"drake away from home": "DYh6CJWdSHY",
"drake papis home": "RJDZBozre1g",
"21 savage a lot": "VbrEsOLu75c",
"21 savage redrum": "ukbiRcyzrpc",
"21 savage x metro boomin runnin": "jbdROU6eJVg",
"21 savage bank account": "sV2t3tW_JTQ",
"21 savage metro boomin no heart": "DbGc9OFMRp4",
"21 savage red opps": "uMUW5t2MJiI",
"21 savage metro boomin x ft future": "szKxAdvlCCM",
"21 savage summer walker prove it": "oa8kjoT-MrM",
"21 savage x metro boomin glock in my lap": "IShUzOqBqOk",
"drake 21 savage rich flex": "I4DjHHVHWAE",
"21 savage offset metro boomin mad stalkers": "ETPBnOlNeOw",
"21 savage numb": "txqS0QHOrzQ",
"young nudy peaches eggplants feat 21 savage": "2D17Pat5wWw",
"metro boomin 10 freaky girls with 21 savage": "48LvZVrlY9A",
"drake 21 savage hours in silence": "6hfbHSItskQ",
"21 savage offset metro boomin ghostface killers ft travis scott": "bmc890o0yYY",
"21 savage 7 min freestyle": "gBGe6GIm52A",
"drake sneakin ft 21 savage": "KZPgZmOTgCs",
"21 savage x metro boomin slidin": "9lVt20ogzoY",
"21 savage all of me": "UpYb4C2--UY",
"offset metro boomin ric flair drip": "OwbI9IY9Roo",
"21 savage offset metro boomin ric flair drip official music video": "LPTlvQ1Zet0",
"drake jimmy cooks ft 21 savage": "V7UgPHjN9qE",
"21 savage metro boomin no heart official music video": "6wtwpUwxQik",
"jid surround sound feat 21 savage baby tate official music video": "Y19q-7VN2WI",
"21 savage x metro boomin rip luv": "-lo5np2zHD0",
"tayk the race freetayk": "OYhXJaEbw7c",
"21 savage metro boomin glock in my lap official music video": "acYUqMd9k2I",
"adin ross she make it clap freestyle ft tory lanez": "H91Ggw9XrRQ",
"21 savage offset metro boomin rap saved me ft quavo": "LK9rgGmrH7I",
"kodak black 21 savage lil uzi vert lil yachty denzel curry 2016 xxl freshman cypher": "U_IbIMUbh-k",
"redrum 21 savage edit audio": "alhquuuNVzE",
"21 savage red opps shot by azaeproduction": "mWISiHcGoNg",
"ea feat 21 savage": "piAAJqPbrBU",
"21 savage a lot ft j cole": "DmWWqogr_r8",
"future solo": "X2DTROC4JCI",
"aap rocky i smoked away my brain im god x demons mashup ft imogen heap clams casino": "AT9JoIv2kss",
"playboi carti evil j0rdan": "zTKheLpo4nQ",
"travis scott playboi carti future where was you": "um-uRGkT8GU",
"playboi carti toxic with skepta": "U6jeOBSGI6Q",
"playboi carti the weeknd rather lie": "fYD7YsSRHOY",
"lil baby playboi carti skooly lets do it official music video": "Av4AsFPeQ9E",
"young nudy iced tea ft 21 savage project pat coupe": "mbQc3fFYDu0",
"post malone rockstar official music video ft 21 savage": "UceaB4D0jpo",
"travis scott til further notice ft james blake 21 savage": "zptRsa1pqsk",
"21 savage pad lock": "WUUePkaVxIQ",
"drake 21 savage spin bout u": "jALeORvCJG8",
"j cole m y l i f e feat 21 savage morray": "wLQ8u3xRZd8",
"central cee 21 savage gbp official music video": "_Cu9Df_9Zvg",
"drake 21 savage circo loco": "jxILuhLm6hs",
"21 savage immortal": "cUtDb-blEMQ",
"21 savage air it out": "-yVJ3x8T1jg",
"lil baby outfit feat 21 savage official visualizer": "C_CzwJ1Cfy4",
"post malone rockstar ft 21 savage": "4GFAZBKZVJY",
"drake 21 savage treacherous twins": "jCtsnNpCDo0",
"drake knife talk ft 21 savage project pat": "3HFY0xuHybk",
"usher summer walker 21 savage good good official music video": "7jA-tE-4BYI",
"21 savage money convo": "vwU2NSGHVa4",
"dj khaled let it go ft justin bieber 21 savage": "kX-dwOlOjc4",
"21 savage metro boomin gang over everything": "dE3PcZ6S-d4",
"pharrell williams cash in cash out ft 21 savage tyler the creator": "o9vvbvcc3wo",
"21 savage drake mr recoup": "kWLTdcWBejU",
"21 savage travis scott metro boomin nenah": "hSitXYlIqKI",
"hunxho if only feat 21 savage official visualizer": "rc1NqvpvTIU",
"rod wave turks caicos ft 21 savage": "ltxOOGKZLs0",
"rick ross outlawz ft jazmine sullivan 21 savage": "imfiuRkn6WQ",
"burna boy sittin on top of the world feat 21 savage": "g82-PC0PnXc",
"21 savage mariah the scientist dark days": "CiFxS8JaUfM",
"21 savage lil baby atlanta tears": "uaNd7wflN-k",
"drake money in the grave ft rick ross": "R0ykLlhg0AQ",
"drake what did i miss clean": "2RNsuIlXYyk",
"drake love all ft jayz": "Pnz4wbCblmM",
"nicki minaj drake lil wayne no frauds": "VkXjvHfP3MM",
"young nudy peaches eggplants ft 21 savage": "MYrU3i9nQtE",
"rick ross outlawz official music video ft jazmine sullivan 21 savage": "n6OtGSTbPh0",
"drake sneakin ft 21 savage": "WNW1xRqbt94",
"jid surround sound feat 21 savage baby tate": "-ybR1bo0a_I",
"21 savage cup full": "31D23obmXA0",
"metro boomin the weeknd 21 savage creepin": "-UcFeTfm1oM",
"drake 21 savage privileged rappers": "lF3K70KR5Xk",
"21 savage offset metro boomin disrespectful": "WunhSG04ww8",
"21 savage sneaky": "XlhYUaLVQXc",
"21 savage jawan harris i wish": "BFDKrMRLE6I",
"drake 21 savage broke boys": "cE0iNes-bMQ",
"21 savage cant leave without it": "l5M64JuiZAE",
"travis scott topia twins ft rob49 21 savage": "J4nvbKBuEBU",
"yfn lucci pieces on my neck feat 21 savage": "2WHDjhy1gtk",
"21 savage ball wo you": "G68rIXiy0Bo",
"21 savage redrum official music video": "U4mADkt6o-M",
"21 savage brent faiyaz shouldve wore a bonnet": "G4EylYjwHzA",
"bazzi focus feat 21 savage": "o0IUZKmMxis",
"tisto both feat 21 savage bia": "zR5GPNpE6hU",
"21 savage tommy newport mikky ekko red sky": "5_-sIkbYd_M",
"post malone rockstar ft 21 savage explicit hq": "jONxrPmIUVY",
"mariah the scientist 77 degrees ft 21 savage": "mZrE2OXeCys",
"21 savage dead people": "Z_OAGfLKJb4",
"drake 21 savage on bs": "PNFZHl1H8zY",
"21 savage metro boomin ocean drive": "ZkRJ59tB1D8",
"21 savage cold heart feat travis scott": "HslKb9YgpDs",
"post malone rockstar ft 21 savage": "LLKbtcwS6Ys",
"21 savage x metro boomin ft young thug rich nigga shit": "zlNCU09gzwc",
"21 savage doja cat nhie": "xDmb610okx0",
"21 savage x metro boomin ft drake mr right now": "f4RmrWhQxrM",
"21 savage at": "zYE7Y0xNgLc",
"21 savage thug life": "kGqEoXQjHEk",
"21 savage betrayed": "yqr5m5-E8Ps",
"21 savage lil durk metro boomin dangerous": "Gy6urUcig5A",
"drake knife talk ft 21 savage project pat": "XqpQpt_cmhE",
"21 savage spiral": "g59R3fMnUuc",
"dababy sticked up ft 21 savage": "4WdQslaS3d8",
"drake 21 savage major distribution": "LfPYX03_4rA",
"jid surround sound ft 21 savage baby tate": "ammmaaurdxI",
"travis scott nc17": "K2taklQnVzY",
"21 savage offset metro boomin darth vader": "bWv-bR_X-VM",
"drake 21 savage more ms": "KyDdFcIDVJw",
"lil durk die slow feat 21 savage": "5dVTGWbsvyY",
"jid surround sound ft 21 savage baby tate": "Gc3zeSVI9pM",
"rockstar live ft 21 savage": "LjXy714j3bY",
"21 savage x metro boomin my dawg": "mVIHEE-nxl0",
"dj khaled let it go official music video ft justin bieber 21 savage": "QRZJNqoJQFY",
"21 savage all the smoke": "nYeZKi5pBpM",
"21 savage facetime": "8QbYtqrrB4M",
"21 savage nothin new": "FSDkCp5S_qU",
"sweater weather": "Ao81ziiXHhs",
"the neighbourhood reflections": "x47TgeRJtH0",
"the neighbourhood daddy issues": "vnLAa6_hB9A",
"the neighbourhood softcore": "ggG9ySCChYw",
"the neighbourhood afraid": "O83tqQpa9xk",
"the neighbourhood the beach": "DujKJ1OaLQE",
"the neighbourhood wdywfm": "Oq-xMg1xbic",
"fallen star": "54kTO17-j_0",
"the neighbourhood a little death": "bRfMwoIizTQ",
"the neighbourhood stargazing": "zZM_a-MzlmM",
"the neighbourhood scary love": "4n-AbC6GK1Y",
"the neighbourhood leaving tonight": "sLXx1WUJRIA",
"prey": "2IE3T9mcqyM",
"the neighbourhood you get me so high": "jCSvOtUaI8s",
"the neighbourhood nervous": "XTDH7gSqwiQ",
"sweater weather": "UBUXDUtZZnI",
"the neighbourhood icanteven ft french montana": "o-y0OInjJFg",
"the neighbourhood wires": "BExvUjzeXPw",
"the neighbourhood 247": "pEue3Tchdvc",
"the neighbourhood compass": "j56dEcq7ryo",
"the neighbourhood private": "fz7Ox8pkC5o",
"the neighbourhood softcore im too consumed with my own life": "ZPyyVdK-HeI",
"the neighbourhood sweater weather": "GCdwKhTtNNw",
"the neighbourhood flawless visualette": "Cs9M0a5qYko",
"the neighbourhood daddy issues": "jKIK__j1Nno",
"the neighbourhood sweater weather": "08WiUcJmnZc",
"the neighbourhood you get me so high": "wD1wouWYrEI",
"the neighbourhood softcore": "QkSROKFtIhw",
"the neighbourhood cry baby": "wW6MsPkAJUs",
"i wanna be yours": "nyuo9-OjNNg",
"the neighbourhood wiped out": "Z3UCVQIjAJ8",
"the neighbourhood paradise": "BzbRHsyjIzk",
"the neighbourhood over the influence": "seYAyHctExQ",
"the neighbourhood void": "agdObcVqqMU",
"warm": "QBV-YCA-CkA",
"the neighbourhood everybodys watching me uh oh": "dMfWmyx1VLU",
"the neighbourhood stuck with me": "UWBC2bv5O7U",
"the neighbourhood how": "L0OORjXAtxg",
"the neighbourhood lovebomb": "XkU2ViQ8gr0",
"foo fighters the sky is a neighborhood official music video": "TRqiFPpw2fY",
"foo fighters the sky is a neighborhood": "F3crJmEPs1I",
"the neighbourhood daddy issues": "gzA53VsWCr8",
"the neighbourhood float": "Bd2yNVan0sc",
"unfair": "Cr6dyKPOyTw",
"ting": "Zt4EYmXCy4I",
"the neighbourhood blue": "FtzhMu95LxY",
"the neighbourhood omg": "rNvNVEaQbZo",
"ui": "l6x_WDOHQVc",
"the neighbourhood daddy issues remix": "aoydhMb72QY",
"the neighbourhood cherry flavoured": "8Be-7rsQv9c",
"the neighbourhood too serious": "gmzq0Zx3ae8",
"the neighbourhood a little death": "LVqGRJLEj28",
"the neighbourhood syd daddy issues remix": "eL78gCGgXWo",
"the neighbourhood the shining": "1GG0YSzGmd4",
"the neighbourhood reflections": "w8HRWG0hkbQ",
"the neighbourhood honest official lyric video": "qqXjt5WFPgc",
"the neighbourhood reflections": "GJNdR_MKuDM",
"daddy issues remixthe neighbourhood songs": "fYgqX4cKIjI",
"the neighbourhood alleyways visualette": "qVwckL8Q3_Y",
"the neighbourhood daddy issues remix": "6EF9s3xnS6U",
"reflections the neighbourhood follow for more lyricsreflections theneighbourhood lyrics music": "izJkFwCOBds",
"lil rob neighborhood music": "dD5UgD7DrFo",
"the neighbourhood yellow box": "9NZPvybqJfY",
"wdywfm the neighbourhood lyrics read desc": "ExfmVW-aDGI",
"the neighbourhood sadderdaze": "ALwoKots_sg",
"the neighbourhood pressure": "iEOTnULIqTM",
"the neighbourhood mama drama": "nP0V0p5y5FI",
"the neighbourhood baby came home 2 valentines": "WkNE5WGyz0k",
"lil durk neighborhood hero": "CM2mBn2PT-0",
"the neighbourhood softcore sub espaol e ingls": "egxx7xf1dlY",
"the neighbourhood fallen star extended": "JXzoZhPVjHc",
"the neighbourhood the beach demo": "asgAFnELvsE",
   "xavier wulf cyber city": "gCwUQzk5L2k",
   "xavier wulf nightshift": "HHEYzrcy2xU",
   "xavier wulf jack wulf sparrow": "WM6g8pjiEqQ",
   "xavier wulf still will": "FHg6piikvas",
   "xavier wulf first light": "ySKW0t-QUiY",
   "xavier wulf cars coffee": "dDDLDhCZzWw",
   "xavier wulf hoonigan": "XoYaJZAVnK0",
   "xavier wulf pressure gauge": "wLOBUrG6Rx4",
   "xavier wulf silver fang wulf": "UUaIuRxNB6Q",
   "xavier wulf damn well": "thjq_A3b_js",
   "xavier wulf read em and weep": "-Zz2iCungLc",
   "xavier wulf idontknowjeffery undefeated": "COunHyJuNg8",
   "xavier wulf a days routine interlude": "UUeHk-6CzLw",
   "xavier wulf space punks": "5spJPaUl89Q",
   "xavier wulf whiplashd": "rSM5blVPBJo",
   "xavier wulf tis season": "LPL1GL2F2SQ",
   "xavier wulf match hunters": "tSt5UYBHkb8",
   "xavier wulf check it out": "Gvk2fJq1xhQ",
   "xavier wulf last jewel": "NsGImvIjMzg",
   "xavier wulf akina speed star": "D8GmcCGmziU",
   "xavier wulf psycho pass": "cZJK2OVoCeo",
   "xavier wulf thunder man": "A2Owmy71Yb8",
   "xavier wulf who fuck is you": "z-mV7rGfzc4",
   "black smurf xavier wulf just know": "chP2wIc7KB0",
   "xavier wulf wulfwood": "XCyOIEitHS8",
   "xavier wulf walking wulf": "ASfpC0E28PQ",
   "xavier wulf get low unfrozen": "EXxgsT7blYM",
   "xavier wulf kurokumo": "mZzECmptD6E",
   "xavier wulf ice box": "9L_qq0ezyN8",
   "xavier wulf smoke": "6Z9Sdgb8vD8",
   "xavier wulf street chasing": "9WKpdtWjIEY",
   "hollow squad be thy squad": "nkCc8tzY9nQ",
   "xavier wulf morning dew": "QsVX3OjGp58",
   "xavier wulf the last jewel": "tB8FXjMc6fs",
   "xavier wulf mobile suit woe": "onu-LukVqZ8",
   "xavier wulf akina speed star": "kAwqjuKZt6Y",
   "bones xavier wulf chris travis": "D8AGKWyyrJ8",
   "xavier wulf bones weatherman": "-n25Jvp0zK8",
   "xavier wulf i say high and bye": "b5OAd8DoXsM",
   "xavier wulf black cloud": "hS8Ph7hTJio",
   "xavier wulf hollow squad": "y75-q6_wQ34",
   "xavier wulf fort woe": "7HrHnQxNWI0",
   "juicy j feat xavier wulf no man": "U9oZKpDMrb0",
   "xavier wulf you cant cut me": "EXtB7_f24yc",
   "nirvana smells like teen spirit": "hTWKbfoikeg",
   "nirvana come as you are": "vabnZ9-ex7o",
   "nirvana man who sold the world": "fregObNcHC8",
   "nirvana heart shaped box": "n6P0SitRwy8",
   "nirvana about a girl": "AhcttcXcRYY",
   "nirvana in bloom": "PbgKEjNBHqM",
   "nirvana something in the way": "rg-yYi8saZY",
   "nirvana all apologies": "aWmkuH1k7uA",
   "nirvana lithium": "pkcJEvMcnEg",
   "nirvana you know youre right": "qv96yJYhk3M",
   "nirvana sliver": "QECJ9pCyhns",
   "nirvana sappy": "5BE1KRj5iiM",
   "nirvana love buzz": "tz1pv3g4YFQ",
   "nirvana aneurysm": "PvwqSMRtoSI",
   "nirvana dumb": "peclQi67KS8",
   "nirvana drain you": "rvEL4pbR6S8",
   "nirvana school": "Fa30bdEXNeM",
   "nirvana plateau": "TrpiM2oKTLI",
   "nirvana stay away": "3YtH2rjrfaI",
   "nirvana territorial pissings": "_fdYjlAviT8",
   "nirvana polly": "IPSYplu_3fA",
   "nirvana milk it": "ikGco5URbNc",
   "nirvana been a son": "YLrfVAdYuTY",
   "nirvana negative creep": "C-r9tuPrZK4",
   "nirvana mr moustache": "YnmjGc3kXm0",
   "nirvana do re mi": "VuFf2Gp-lGk",
   "nirvana if you must": "lhPAkjqNHIY",
   "nirvana big cheese": "0AJjE53Ura0",
   "nirvana sifting": "qiG6VWui0ow",
   "nirvana spank thru": "lxNYAe85L20",
   "nirvana even in his youth": "GFO-GYlg9VE",
   "nirvana money will roll right in": "1J3uj2wqPPA",
   "nirvana oh me": "zgDKHG4K7g0",
   "nirvana d7": "w7OX2EhpXqE",
   "nirvana radio friendly unit shifter": "gc4G0eP84iE",
   "nirvana marigold": "G0L5umsGiMg",
   "nirvana swap meet": "0lhUHekYdn8",
   "nirvana mollys lips": "eXbbdif1Vy4",
   "nirvana aero zeppelin": "xdWG2JfZYzE",
   "nirvana hairspray queen": "hWNjQD7FNXQ",
   "nirvana blew": "97KwmvleRok",
   "nirvana very ape": "f4p1I7o0nY4",
   "nirvana son of a gun": "3OlxKVa7BHA",
   "nirvana come on death": "a-GICoOxKpc",
   "nirvana big long now": "Mzz64S8BxiA",
   "nirvana buffys pregnant": "6N_80u7mxV4",
   "nirvana here she comes now": "pUOdoTa4crc",
   "nirvana moist vagina": "TKwvCN4BmgI",
   "nirvana they hung him on a cross": "AXbBU1-GZfg",
   "nirvana grey goose": "867rI5BPEJQ",
   "nirvana curmudgeon": "nci-QgUAUnM",
   "nirvana clean up before she comes": "3x8UaTkmpNg",
   "nirvana scentless apprentice": "GgcUyGTq0so",
   "nirvana oh the guilt": "eqZ7RMie_-A",
   "nirvana pen cap chew": "6hUIxBvAeig",
   "nirvana beeswax": "f0IC1uQjHMY",
   "nirvana mrs butterworth": "TKiUGjitmec",
   "nirvana opinion": "FSunLRu9T8Q",
   "nirvana downer": "mDUG9-3hSgY",
   "nirvana tourettes": "wlVdPl-oEmg",
   "nirvana vendetta": "103p7DgAl2w",
   "nirvana help me im hungry": "vwzRhweNF1Y",
   "nirvana turnaround": "rUrHTYyr8TQ",
   "nirvana token eastern song": "N6dPPTZ0q9E",
   "crystal castles char": "CnqzIYZR1GA",
   "crystal castles concrete": "M7zxAI3GW2o",
   "crystal castles sadist amnesty": "4UXMhJKc-dk",
   "crystal castles not in love": "32udqal_lyQ",
   "crystal castles untrust us": "tZu3EUVJ8-4",
   "crystal castles vanished": "56E8yYgLNHE",
   "crystal castles vietnam": "o1GnvlwE3g0",
   "crystal castles fleece": "GfB4BQQcoKM",
   "crystal castles empathy": "NLi2v-Gq-5A",
   "crystal castles kerosene": "qR2QIJdtgiU",
   "crystal castles baptism": "vStjmYxetY0",
   "crystal castles air war": "2dK3Tzf8KwA",
   "crystal castles telepath": "05F8PJMqalw",
   "crystal castles leni": "WhpT7Klunl0",
   "crystal castles lovers who uncover": "rXzi93yJz1I",
   "crystal castles transgender": "EgKdyHcZJcs",
   "crystal castles plague": "72aDQ5o1Ax0",
   "crystal castles suffocation": "Z0NGdLr4img",
   "crystal castles pap smear": "VPnuxyxk0AY",
   "crystal castles wrath of god": "o6ugOBCZAVk",
   "crystal castles intimate": "mPAOCKQPwBk",
   "crystal castles year of silence": "F2as7j0mK9I",
   "crystal castles doe deer": "0ruvmkCq4es",
   "crystal castles alice practice": "F29fGbm0a24",
   "crystal castles magic spells": "zSsvcT9cDZ0",
   "crystal castles affection": "-RqqXT44veI",
   "crystal castles knights": "8fCbu0dctvw",
   "bones airplanemode": "iJQJZsOp5nU",
   "bones dirt": "0IYght7FGdg",
   "bones restinpeace": "ewZZNeYDiLo",
   "bones molotov": "ht1A3-I3GoE",
   "bones branches": "mDIqaGjdE-4",
   "bones sodium": "-4fIUSvXtUM",
   "bones wherethetreesmeetthefreeway": "6Qp6Cf2J1nk",
   "bones whiteboyrick": "I4jh4ojwSoM",
   "bentley": "VUF4BzsxI9U",
   "bones rocks": "85Wfb2JyEaA",
   "bones keepsellingyourselfthat": "dV0bn4Rtcsc",
   "bones mustbearealdragwakingupandbeingyou": "N0rKX3stmP4",
   "bones spidersilkrobes": "5H4mlCfYMik",
   "bones iridescentarmor": "4WAOrgpJaRs",
   "bones myheartithurts": "R9ru9HkSlao",
   "bones gohardhuh": "GJRLZ22JdB4",
   "bones monstermash": "4qJ97lRm1as",
   "castleflutes": "Qjv2eE7PIOs",
   "bones cousineddie": "H3SfKZR138s",
   "bones baja": "442LSADU86M",
   "bones youmadeyourbednowlieinit": "IL5F8Q_eiRs",
   "bones thepleasureisallmine": "tv8maTPR-eI",
   "bones 7thgenerationblunts": "Fo9HGb3ZjWA",
   "bones deathcalls": "TXjDWYOlktc",
   "bones celebritydeathmatch": "HeX6SFVjduM",
   "bones hellinacell": "TJsGdDaa_h0",
   "bones voicesbehindthewall": "wt1f5O7nItU",
   "bones lowerthedrawbridge": "ytJai8BJU_c",
   "bones seiko": "UbMAlPIxBJU",
   "bones ribs": "BnrAmSO45Mo",
   "bones ravenloft": "rSyU_Zl4dm8",
   "bones fortyeighthours": "T80M_nYojDQ",
   "bones skeletonraps": "2V_xXhRd2Ns",
   "bones romanticcomedy": "lpwLv4Pfrrk",
   "bones ashes": "L3JWN4XLSe4",
   "bones tru2dagame": "ZXyYPqzvVNo",
   "bones graveyardfm": "DIklpu0y2lU",
   "ctrlaltdelete": "kM8LC3Nj7-s",
   "bones hdmi": "0kla2FEgeME",
   "bones canal st": "zqEyXViAvUs",
   "bones eddy baker loosescrew": "wfWSkOiDZR4",
   "uicideboy now and at the hour of our death": "CcGgwIpl-cY",
   "bones kill yourself part iii": "g5sukHe4A3A",
   "bones demolitionfreestylept3": "Z38nlx7FLkM",
   "uicideboy magazine": "SnUp7j212vc",
   "uicideboy i want to believe": "SajA7pQAz_4",
   "uicideboy exodus": "FsXBktSRY8M",
   "uicideboy the evil that men do": "cgt_56l5GIk",
   "uicideboy paris": "JBjhpmCTvog",
   "uicideboy antarctica": "7tLGGiNjp_U",
   "uicideboy are you going to see rose in vase or dust on table": "LbJlabcFmBM",
   "uicideboy and to those i love thanks for sticking around": "PCXaynu8wM0",
   "uicideboy airplanemode": "iJQJZsOp5nU",
   "uicideboy tru2dagame": "ZXyYPqzvVNo",
   "uicideboy selfinflicted": "GSMqdc_XjFg",
   "uicideboy harvest moon": "4vvcLdMrmTg",
   "uicideboy new chains same shackles": "lVUmb77rEhc",
   "uicideboy chain breaker": "1VG4rN6B-js",
   "uicideboy drugshoesmoneyetc": "ElKAextmUoo",
   "uicideboy oh what a wretched man i am": "wkGD2rjkR2Q",
   "uicideboy lone wolf hysteria": "j-Z0V0BraDM",
   "uicideboy misery in waking hours": "Y45kvrHBx2s",
   "uicideboy greygreygrey": "l6uILoYfXC8",
   "uicideboy champagne face": "Hk4gJFLT-5s",
   "uicideboy my swisher sweet but my sig sauer": "4vzjamqRzuw",
   "uicideboy champion of death": "lHEORabepeo",
   "uicideboy memoirs of a gorilla": "B9eH5-g2JhU",
   "uicideboy avalon": "F0X4OOv3i5Y",
   "uicideboy napoleon": "7r16zOMQXek",
   "uicideboy the thin grey line": "S_7JNkwqKGI",
   "uicideboy 2nd hand": "Xn2QKurBsPU",
   "uicideboy monochromatic": "bDu25t78JLI",
   "uicideboy x pouya runnin thru the 7th with my woadies": "C0-8dwIjP9I",
   "uicideboy not even ghosts are this empty": "AqgCV1NAbKM",
   "uicideboy full of grace i refuse to tend my own grave": "sGFf4Fhjvxk",
   "uicideboy 1000 blunts": "81uYuA1N4Qo",
   "uicideboy carried away": "Zy5W9p2BGoM",
   "uicideboy sarcophagus iii": "HnEjex8K2EE",
   "uicideboy all that glitters is not gold but its still damn beautiful": "5UhE05vLm6o",
   "mac miller afternoon grooves": "5mj2mXIL-D0",
   "mac miller best of mac miller": "nUyGNRJCEek",
   "mac miller mix for sad homies": "LBACe8U6EKU",
   "mac miller good news": "aIHF7u9Wwiw",
   "mac miller late night drive": "9gVgqeFjEUc",
   "mac miller hand me downs": "fYEXdCCpfVQ",
   "mac miller weekend": "N29-54dhVHg",
   "mac miller stay": "5WU7oGiwiao",
   "mac miller knock knock": "6bMmhKz6KXg",
   "mac miller self care": "SsKT0s5J8ko",
   "mac miller my favorite part": "J_8xCOSekog",
   "mac miller dang": "LR3GQfryp9M",
   "mac miller nikes on my feet": "a-rqu-hjobc",
   "mac miller kool aid": "UnAbszcy3bs",
   "mac miller surf": "blYo4WheVgA",
   "mac miller 2009": "6B3YwcjQ_bU",
   "mac miller ladders": "0gzmFo8UiJQ",
   "mac miller congratulations": "JoFkQ7iAQcw",
   "mac miller woods": "g8sX6wZHhD0",
   "mac miller whats the use": "qI-t1I_ppL8",
   "mac miller come back to earth": "W4ocPPhtglU",
   "mac miller circles": "V4BFGSZ_1ls",
   "mac miller programs": "Wvm5GuDfAas",
   "mac miller of soul": "C9RdmVDxl4I",
   "mac miller blue world": "_GC2wFTCAGY",
   "88keys feat mac miller sia thats life": "4oviKWgwzE4",
   "mac miller jet fuel": "FrfNEoNnCt4",
   "mac miller everybody": "_-Ig0aeJ6jc",
   "mac miller right": "vx0i-iPOlQk",
   "mac miller wings": "_O1qD95xnao",
   "mac miller watching movies": "wdaI7F3Jv5M",
   "mac miller complicated": "Q-NUaixkovQ",
   "mac miller colors and shapes": "K22_5LBuB9Y",
   "mac miller i can see": "rGxOUnlHpGI",
   "mac miller love lost": "9ZozITxuNKo",
   "mac miller once a day": "pFFPIST6Fuo",
   "mac miller thats on me": "Eg7vEV5woSk",
   "mac miller blue slide park": "7Sya2lGMuYE",
   "mac miller sds": "jj4csT4eviU",
   "mac miller small worlds": "v2E3ATcEGM4",
   "mac miller floating": "PUPYXQmQ8m8",
   "free nationals mac miller kali uchis time": "fFns8chkyq8",
   "mac miller keep floatin": "zSveMtZbbE8",
   "mac miller one last thing": "QBk8fXaFSMs",
   "mac miller hands": "IHJWYamH5SA",
   "mac miller hurt feelings": "8f2SPsLxPzQ",
   "mac miller someone like you": "HCrGUZmdvU4",
   "mac miller funny papers": "IMUNeQ3W2ew",
   "mac miller 5 dollar pony rides": "90QSE0QLryI",
   "poppy black diamond": "FvMBIZ8f4tg",
   "ayye": "E8IthdSyP-U",
   "back in day": "bW3AS06eRh8",
   "matches ft absoul mac miller": "kgJ007RuqQw",
   "thinkin bout you": "6JHu3b-pbh8",
   "pyramids": "dMV31MWIjLE",
   "forrest gump": "BqSro-8_gpU",
   "frank ocean chanel ft asap rocky": "MRyNOYrt6Wc",
   "pretty sweet": "dOTUAmNNeio",
   "crack rock": "IVzzw7Vkiyg",
   "good guy": "t1ap-J3Kzr4",
   "self control": "RKD8sVVTEAA",
   "bad religion": "JMpypbtrcCg",
   "close to you": "ROgX9pXKPOg",
   "ivy": "x6QJPJO2w40",
   "pink white": "9cHbvRUALrc",
   "nights": "Fx3b85eDQvw",
   "frank ocean lens v2": "HE6hpNS2i6Y",
   "super rich kids": "0XCQNpjWmRE",
   "sierra leone": "kgplNxRbbaM",
   "solo": "OkZTH88B3A8",
   "lost": "J3DWAJGaf7o",
   "novacane": "hgOu8eRJZ3Q",
   "monks": "HFVlEft9uEs",
   "frank ocean futura free": "Sezp6H1cGr8",
   "sweet life": "y14F2RQW7h4",
   "pink matter": "uaLV003llhY",
   "swim good": "ic1nhvWBvIo",
   "pilot jones": "azgDZ-TBCzk",
   "seigfried": "p_oL2OIGo04",
   "beyonce superpower ft frank ocean": "OQBMQ_2x8Pc",
   "frank ocean moon river": "mXiFHDfvn4A",
   "yearning": "t4KlGqsxvTU",
   "dead batteries": "5Hq_dSYQb-A",
   "coma": "q0kYilO1AFI",
   "ken carson ss": "KavaUJxnNVU",
   "ken carson destroy lonely paranoid": "_nkK3GHbBwY",
   "ken carson overseas": "80M6sAU9DY4",
   "ken carson jennifers body": "CSMiPngo4uE",
   "ken carson rock n roll": "yxP4pvEQVos",
   "ken carson blakk rokkstar": "29ToiaUotCE",
   "ken carson fighting my demons": "YKkMR2l05Rs",
   "ken carson yale": "kpuy4BEU644",
   "ken carson i need u": "XDocuspdgVk",
   "ken carson mdma": "Gbqa9n1XOes",
   "ken carson the acronym": "s2cZAbja5qo",
   "ken carson lord of chaos": "vkhsaxlCSmc",
   "destroy lonely nostylist": "QTmRmPDS9tw",
   "ken carson green room": "AFTkc39TYiQ",
   "ken carson me n my kup": "K_y1aG9hnH8",
   "ken carson delusional": "gpbQ4A4tQuU",
   "ken carson run ran": "gfRn6IvHL0M",
   "playboi carti evil j0rdan": "VcRc2DHHhoM",
   "ken carson freestyle 2": "jao-W5tJkYo",
   "ken carson margiela": "Ve5jWpIu6Ic",
   "playboi carti tundrah00dbyair": "KwBObpqldm8",
   "ken carson thx": "CP_jnyzj_ek",
   "ken carson succubus": "sqj3_LwhA74",
   "ken carson mewtwo": "EZkZoVFC-eE",
   "ken carson trap jump": "gn5MDOd-6H4",
   "ken carson money spread": "bYIODnKGNdg",
   "ken carson loading": "0QydmrTTXog",
   "ken carson rockstar lifestyle": "yZTUSTHSSJU",
   "ken carson leather jacket": "GSs6HiEVdZ8",
   "ken carson new": "nA3TK5vzQ8k",
   "destroy lonely money sex": "6jPHchMiViQ",
   "ken carson catastrophe": "j2g-KI9mukI",
   "ken carson swag overload": "v3_vU-2RNGk",
   "ken carson off the meter": "CnpQvbxkqZ8",
   "ken carson yes": "KMoHAuvwN3Y",
   "ken carson kryptonite": "hHgKJNqZapM",
   "ken carson inferno": "6GUdUBR_1YQ",
   "ken carson dismantled": "BNRDNe8W_Vo",
   "travis scott sicko mode": "6ONRf7h3Mdk",
   "travis scott goosebumps": "Dst9gZkq1a8",
   "travis scott fen": "B9synWjqBn8",
   "travis scott kick out": "EBr7YTNBzoM",
   "travis scott butterfly effect": "_EyZUTDAH0U",
   "travis scott highest in the room": "tfSS1e3kYeo",
   "travis scott antidote": "KnZ8h3MRuYg",
   "travis scott i know": "fmdLsdmYzTo",
   "travis scott dumbo": "ZyhOlASz92s",
   "travis scott pbt": "6i8HmSvwgXY",
   "travis scott mia franchise": "_VRyoaNF9sk",
   "travis scott cant say": "2LegcNVM_nM",
   "travis scott shyne": "3N8HmSvwgXY",
   "travis scott astrothunder": "Pa67b28h0vY",
   "travis scott circus maximus": "-AmjlRjMKsY",
   "travis scott where was you": "um-uRGkT8GU",
   "travis scott skitzo": "Zk-4WvSPpac",
   "travis scott beep beep": "M5iHI0nsVZc",
   "sofaygo mm3": "6DHld8r1gf0",
   "travis scott 2000 excursion": "dwuYa2DcC-o",
   "sheck wes ilmb": "qG6pQYhjOBw",
   "travis scott the prayer": "u0JAk0gGkxE",
   "travis scott mamacita": "RH9kl6XZixo",
   "travis scott quintana pt 2": "v4DlNubreU4",
   "travis scott drugs you should try": "KPyUvjIsSZc",
   "travis scott dont play": "dY5F5EsQwqE",
   "travis scott skyfall": "J0Nd1lWcBeo",
   "travis scott topia twins": "BsHcPP9KQdU",
   "travis scott kpop": "_kS7F4VpJa0",
   "travis scott gods country": "E9VVEdw5Dng",
   "travis scott delresto echoes": "8WkzlNcU9sg",
   "travis scott sirens": "6gUiQ8CqLcY",
   "travis scott modern jam": "g8IvO7OwdaM",
   "travis scott stargazing": "V-Hw2PlyhFQ",
   "travis scott stop trying to be god": "YqvCptqhHfs",
   "travis scott wake up": "yChnkXhauwM",
   "travis scott yosemite": "PJWHAiDARMQ",
   "travis scott beibs in the trap": "zmFm9Yp80dE",
   "travis scott pick up the phone": "mZDinQ92OZQ",
   "travis scott through the late night": "zojCw8_AdRg",
   "travis scott the ends": "hF1sqWiqppE",
   "travis scott 90210": "BuNBLjJzRoo",
   "travis scott pornography": "NCUGupIhRvk",
   "travis scott oh my dis side": "_ZALrZUSshA",
   "travis scott 3500": "3qNaoLgHU94",
   "travis scott wasted": "0BGT0mgcj0o",
   "travis scott escape plan": "KPz33BLkvho",
   "the scotts": "8oaW16lGNxE",
   "jackboys gang gang": "RIuk23XHYj0",
   "xxxtentacion moonlight": "GX8Hg6kWQYI",
   "xxxtentacion fck love": "wXuFG8uQpZ8",
   "xxxtentacion hope": "KyAcMpQUY5s",
   "xxxtentacion infinity 888": "eEYO0rKL6vk",
   "xxxtentacion sauce": "478ewrAuCXI",
   "xxxtentacion sad": "pgN-vvVVxMA",
   "xxxtentacion bad": "gVqcUi9tpCw",
   "xxxtentacion whoa mind in awe": "GnF1S-WedwI",
   "pnb rock middle child": "ca0h9TnbTIo",
   "xxxtentacion attention": "oJVusCOV6No",
   "xxxtentacion revenge": "eE3U1TKgwoxE",
   "xxxtentacion a ghetto christmas carol": "YYZz8BXN7ag",
   "xxxtentacion ye true love": "k7H2C5L8X7I",
   "juice wrld let me know": "swDam6Hrsm8",
   "xxxtentacion bad vibes forever": "LIgg0hBBNPM",
   "xxxtentacion run it back": "E2VMllR4aIs",
   "xxxtentacion i dont let go": "0dSp35RO8nY",
   "xxxtentacion yung bratz": "1TFZl8oz6Es",
   "trippie redd love scars": "NUNYcwDkBPc",
   "lil uzi vert xo tour llif3": "WrsFXgQk5UI",
   "king von armed dangerous": "tBKYI3-3lMg",
   "ynw melly murder on my mind": "hqDinxaPUK4",
   "ynw melly going down": "1geviNXBT1M",
   "very rare forever freestyle": "DCkBXb0MYGM",
   "ski mask the slump god gone interlude": "M4wxPOiXa9c",
   "xxxtentacion jocelyn flores": "FAucVNRx_mU",
   "xxxtentacion vice city": "h3r9myZYADc",
   "xxxtentacion manikin": "QeZUmuirlqM",
   "xxxtentacion triumph": "oitBJxR9UUE",
   "xxxtentacion never": "O-37B_ZzCTg",
   "xxxtentacion ecstasy": "hv7SrkY0WC0",
   "xxxtentacion snow": "nKEv0f0NdYc",
   "xxxtentacion iluvmycliquelikekanyewest": "1skhhWnxZx4",
   "xxxtentacion im not human": "uc9MHQtJDAs",
   "xxxtentacion lets pretend were numb": "hyiku5iCJeU",
   "xxxtentacion look at me": "wJGcwEv7838",
   "xxxtentacion introduction": "pdPlHIz1YbY",
   "xxxtentacion guardian angel": "jrch8Pf_fJU",
   "xxxtentacion train food": "7LFm99guD2U",
   "xxxtentacion staring at the sky": "G6eTercINok",
   "trippie redd forever ever": "XYb1mdGu5aQ",
   "trippie redd dark knight dummo": "wrvN87l3s08",
   "trippie redd wish": "efxiDBygvdg",
   "trippie redd never ever land": "uc1_9kRn87g",
   "trippie redd the grinch": "dc_Ulob124c",
   "trippie redd 1400 999 freestyle": "Q1LfhLus_5g",
   "trippie redd taking a walk": "PvcHwwXtpu0",
   "trippie redd love me more": "kG545zy2eUs",
   "trippie redd romeo juliet": "5eixJgD0OLU",
   "trippie redd deeply scared": "qQ4hIs_apkA",
   "trippie redd weeeeee": "8TxW29wryYM",
   "trippie redd 6 kiss": "qp21I-QxM1s",
   "trippie redd matt hardy 999": "47JKU1sYFzw",
   "trippie redd i kill people": "0yyay2p4oGo",
   "trippie redd it takes time": "pN5PB3hc43Y",
   "trippie redd hate me": "yxI49azC4iU",
   "post malone white iverson": "SLsTskih7_I",
   "trippie redd topanga": "qE4Z0KfzpE8",
   "trippie redd everything boz": "g39IUxLQ5gk",
   "trippie redd love sick": "lw1FAHzBci4",
   "trippie redd miss the rage": "e9u0HmXLPmA",
   "trippie redd checklist": "ehKliwJhylc",
   "trippie redd sketchy": "S3edLt0E3Sk",
   "trippie redd woke up the face": "IG6igUGyqoI",
   "trippie redd stay the same": "tqFU4LrPGww",
   "trippie redd cant count me out": "Ot8gt5HIRw0",
   "trippie redd world boss": "1ykDy_S97lY",
   "trippie redd poles1469": "Abm2b07XFYM",
   "trippie redd danny phantom": "iocyX0UJSF0",
   "playboi carti fomdj": "N5dOy9FGtDg",
   "post malone congratulations": "SC4xMk98Pdc",
   "migos slippery": "Hm1YFszJWbQ",
   "playboi carti like weezy": "C217vygclrk",
   "playboi carti magnolia": "oCveByMXd_0",
   "playboi carti wokeuplikethis": "REmZhFKmOmo",
   "playboi carti iloveuihateu": "pZ6oeHV28b0",
   "2024": "YG3EhWlBaoI",
   "playboi carti sky": "KnumAWWWgUE",
   "the weeknd playboi carti timeless": "5EpyN_6dqyk",
   "playboi carti all red": "F6iYcXynA4s",
   "playboi carti long time intro": "tkPoOvVnbRk",
   "playboi carti location": "39XR4EXFz5Y",
   "backr00ms": "ftaXMKV3ffE",
   "latto blick sum": "3oA8kt8685I",
   "playboi carti toxic": "U6jeOBSGI6Q",
   "playboi carti olympian": "mj4yh7YrwfE",
   "lil baby playboi carti lets do it": "Av4AsFPeQ9E",
   "playboi carti shoota": "j3EwWAMWM6Q",
   "yeat com n go": "QqzXvvdk3bQ",
   "yeat on up 2 me": "b1Fu_nvUhXQ",
   "yeat out th way": "mbbq2gnOcQo",
   "yeat poppin": "bHDWrnlIqfQ",
   "yeat bell": "0nF3FUwhVOw",
   "yeat put it ong": "oDvMcJZqYrY",
   "yeat sorry bout that": "YLlB1RYrP3k",
   "yeat summrs go2work": "NEFEwfPcXRA",
   "yeat loose leaf": "bZnXa8WLr1o",
   "yeat on tha line": "QfKBrsRBncI",
   "yeat flytroop": "jMB38Jb3b0Q",
   "yeat systm": "Z2D24486pGY",
   "yeat mony twerk": "Udi5-qWw4Dw",
   "yeat nun id change": "Vq8EYreJaMs",
   "yeat fat bonus": "HrUJbVRcrE8",
   "yeat lyfe party": "J_QTMtuAvXo",
   "yeat god talkin shhh": "bfDYzjTMLQY",
   "yeat lyfestyle": "h8YqHjAxh9o",
   "yeat so what": "qLLsuSfuBpg",
   "yeat new high": "A2Zp9Se2WdQ",
   "yeat psycho ceo": "mJgpzJpodk8",
   "yeat power trip": "cVEa5o9W77U",
   "yeat breathe": "oXS8DxRYvbU",
   "yeat mor": "L4U1ByXfHGo",
   "yeat bought earth": "NuZoznmvo88",
   "yeat nothing chang": "8yTPJ15dSz4",
   "yeat no mor talk": "htcVW-nLV7E",
   "yeat shmunk": "thEYPo5v30k",
   "yeat bttr 0ff": "HOOKIChuC1k",
   "yeat rav3 p4rty": "CTwtH6fQ4bE",
   "yeat woa": "0pxFGDO6bVM",
   "yeat flawlss": "NzXGXMgdGOI",
   "yeat up off x": "yPun8Xwi5aQ",
   "yeat wat it feel lyk": "aIYAnvmly6I",
   "yeat got it all": "ZWk0WDbjcdg",
   "yeat cant stop it": "X8CVBKO9ySk",
   "yeat if we being ral": "1xcvWmN0Pe4",
   "yeat mony so big": "w1GBTgxIvcY",
   "don toliver no pole": "fCeiUX59_FM",
   "don toliver no idea": "_r-nPqWGG6c",
   "don toliver fwu": "70E1B_5bimY",
   "don toliver tiramisu": "KlhuSz0HbcE",
   "don toliver cardigan": "7WLt74z_TkI",
   "don toliver cannonball": "nc_rEBgw6E8",
   "don toliver new drop": "86kPjLvo86M",
   "don toliver 3am": "2ub5lOODSD4",
   "don toliver you": "XkQ1pltpQnw",
   "lil tecca 500lbs": "vIBFoBladhg",
   "don toliver after party": "4IahvCIqeOc",
   "don toliver tore up": "jQGqtCalg9Y",
   "don toliver way bigger": "Ulzdqoy57wc",
   "don toliver kryptonite": "jcYzPd9mej0",
   "don toliver private landing": "-k8fJcyBlC8",
   "don toliver deep in the water": "IgoxNaN2GlU",
   "don toliver drugs n hella melodies": "i_PYqIZoGvo",
   "partynextdoor dreamin": "QHx1-CM1nvk",
   "don toliver bandit": "FauDn2LkeQ4",
   "don toliver 5 to 10": "SIsHuBbo9mI",
   "don toliver no comments": "yu2WGTZUgBo",
   "don toliver what you need": "qFIJHaylMu4",
   "lil tecca dark thoughts": "Xtq_A2NnHKQ",
   "metro boomin too many nights": "NyTkaQHdySM",
   "don toliver lose my mind": "WWEs82u37Mw",
   "don toliver attitude": "A90X6-jIe1g",
   "don toliver brother stone": "L_BpiSsIBFM",
   "joji pixelated kisses": "dzIZOJBLGtM",
   "quavo yeat new trip": "NblHP2nEJCo",
   "yeat zukenee": "o4QKdr6-H7Q",
   "lil uzi vert what you saying": "s_TUESTU7_4",
   "lil uzi vert just wanna rock": "UhbixyxgsiU",
   "lil uzi vert regular": "YokvSdIrA_g",
   "lil uzi vert sanguine paradise": "INsVZ3ACwas",
   "lil uzi vert money longer": "1eoSanFCU-M",
   "lil uzi vert 20 min": "bnFa4Mq5PAM",
   "lil uzi vert 7am": "ixDvq80wZps",
   "lil uzi vert way life goes": "Vi2XaiKhgiU",
   "lil uzi vert you was right": "55iN4H6kRN4",
   "lil uzi vert relevant": "cp8WkT0kHQg",
   "lil uzi vert nfl": "H8ILRJHVXg0",
   "lil uzi vert do what i want": "zqflC-as2Qo",
   "lil uzi vert free uzi": "IVNSRolWnCA",
   "lil uzi vert chanel boy": "RKI_HbGSquU",
   "lil uzi vert ea2": "4yqwl3qScwo",
   "lil uzi vert uzi earthling": "k_6VDtFnUDA",
   "lil uzi vert we good": "DrSfBULAsek",
   "lil uzi vert light year": "_7nCyNDcxvQ",
   "lil uzi vert meteor man": "PdfDzwEhr5E",
   "lil uzi vert paars in the mars": "GBJsCG4ppc4",
   "lil uzi vert flooded the face": "_yBh_I5BLRM",
   "lil uzi vert suicide doors": "9Wd2Lphh78A",
   "lil uzi vert aye": "JrxY_GiciGM",
   "lil uzi vert crush em": "Sy7P_JXx7qw",
   "lil uzi vert amped": "jOn6qVrh7iE",
   "lil uzi vert x2": "ZrIUMxLmVAM",
   "lil uzi vert space cadet": "amozNvoQr-4",
   "lil uzi vert i know": "S4gg73Vu3XQ",
   "lil uzi vert flex up": "dK1EAUT9EtE",
   "lil uzi vert httin my shoulder": "mywzufE8D_c",
   "lil uzi vert for fun": "Iqha_7VQywE",
   "lil uzi vert issa hit": "-F30cUlJRm4",
   "future tic tac": "-LW9PxZP-wg",
   "future my legacy": "OF8UN8yyEz4",
   "future heart in pieces": "sQVSu6evv_U",
   "future because of you": "K2Iza0VA3bA",
   "future bust a move": "Or59f435X0o",
   "future baby sasuke": "n99LyREgulw",
   "future stripes like burberry": "udukDC0LFFQ",
   "future marni on me": "7n4qbmHUuoE",
   "future sleeping on the floor": "weJ-1gdOkds",
   "future real baby pluto": "1cKhixPQyLw",
   "future drankin n smokin": "-QiovlGJi_U",
   "future million dollar play": "E4_QFJF7DQ8",
   "lil uzi vert safe house": "5vtCXKs9-9Q",
   "lil uzi vert banned from tv": "3lulNu_txcg",
   "lil uzi vert super saiyan": "mYM3stew0k0",
   "lil uzi vert yamborghini dream": "oexUQpbbHS8",
   "lil uzi vert right now": "65QQwBrfznc",
   "lil uzi vert myron": "Bt-brUAx3Uo",
   "lil uzi vert lotus": "muXoCJqtwAc",
   "lil uzi vert bean kobe": "AvI9VajdE2s",
   "lil uzi vert yessirskiii": "4Hpkkqpwwkw",
   "lil uzi vert wassup": "GH8mCOLl8xc",
   "lil uzi vert strawberry peels": "mI5diUpURLI",
   "lil uzi vert baby pluto": "juoznBaQbJE",
   "lil uzi vert lo mein": "35enS3ApjIc",
   "lil uzi vert silly watch": "HsqXHg9vmjs",
   "lil uzi vert pop": "J7JXgKfBqzM",
   "lil uzi vert you better move": "OVJYrKkpb8I",
   "lil uzi vert homecoming": "7B9i2o2LJ-o",
   "destroy lonely jumanji": "NAY8rl3YL90",
   "ken carson overtime": "6x2RwzTKDsY",
   "destroy lonely how u feel": "zdfacEpzDIA",
   "destroy lonely syrup sippin": "RULeGSEu1Bc",
   "destroy lonely safety": "lGyrgOFSn1U",
   "destroy lonely screwed up": "hG64Cc9VkTw",
   "destroy lonely miley cyrus": "665mU_G0INE",
   "destroy lonely blitzallure": "Zifq9BWNFVE",
   "homixide gang uzi work": "HMsGAM_qBDU",
   "destroy lonely neverever": "ZyQ0TqQ47xY",
   "destroy lonely not the mayor": "6M1rd4n9e44",
   "destroy lonely party n get high": "ChUD-n3OklI",
   "destroy lonely leash": "MOOLaeh80bo",
   "destroy lonely see no evil": "un--UcuHhsY",
   "destroy lonely cadillac": "7HJDaqn9uks",
   "destroy lonely open it up": "uZa4LFgWh3E",
   "destroy lonely soooo high": "-QyTo_OtVp4",
   "destroy lonely catch a kill": "TTcrWFZFGFI",
   "destroy lonely whats it gon take": "cteaMVDbpig",
   "lil peep star shopping": "m8QQR-wQA0I",
   "lil peep walk away": "ovvZ2f6ipXw",
   "lil peep ghost girl": "pcFK4HzAlsU",
   "lil peep the way i see things": "C4gVlt46voo",
   "lil peep gym class": "heJNHYCSsIc",
   "lil peep witchblades": "r26LIrUlGdM",
   "lil peep castles": "As1bpICMhzs",
   "lil peep right here": "m-44PIocS_4",
   "lil peep life is beautiful": "2ORsrbQa94M",
   "lil peep save that shit": "WvV5TbJc9tQ",
   "lil peep crybaby": "inocgEraxo0",
   "lil peep no respect": "QbgaRbyWTW8",
   "lil peep awful things": "zOujzvtwZ6M",
   "lil peep benz truck": "3rkJ3L5Ce80",
   "lil peep runaway": "zMCVp6INpnw",
   "lil peep 16 lines": "DxNt7xV5aII",
   "lil peep nuts": "osPq9Yb8xm8",
   "lil peep angeldust": "Z3HnlNHmfg4",
   "lil peep haunt u": "dssT6k9iYnw",
   "lil peep 2008": "6fn9sHOJH5U",
   "lil peep white tee": "fudsUhWAG_o",
   "lil peep your favorite dress": "y5gxYeHSpfw",
   "lil peep spotlight": "7R1N-8SoqcM",
   "lil peep ive been waiting": "dQYPimscA20",
   "lil peep hellboy": "s9t1ZfMZfH4",
   "lil peep omfg": "KI1Qpuv_z_U",
   "lil peep worlds away": "rV0UwlwYTh0",
   "lil peep xxxtentacion falling down": "-jRKsiAOAA8",
   "lil peep lil jeep": "zUPPrimH7Ow",
   "lil peep nineteen": "PI6YVmL6U68",
   "lil peep beamer boy": "fePnUenEZPk",
   "lil peep absolute in doubt": "L3vjm1gybU4",
   "lil peep skyscrapers": "J51Lh5GcSA8",
   "lil peep driveway": "teMZk4bCgSw",
   "lil peep yesterday": "qI0pJAGgbvo",
   "lil peep veins": "OtggaIKDO0M",
   "lil peep praying to the sky": "Ljr9TmitF-8",
   "lil peep lil kennedy": "c_rMC5cC4Fk",
   "lil peep cobain": "HX3CtTLcwJk",
   "lil peep i crash u crash": "BI3Vb3RMVRA",
   "lil peep suck my blood": "NM-Tzbc3h_c",
   "lil peep when i lie": "eIDySR4SFZI",
   "arctic monkeys whyd you only call me when youre high": "tIKQqvt-sWM",
   "arctic monkeys knee socks": "lyO-Sveg6a8",
   "arctic monkeys r u mine": "ngzC_8zqInk",
   "arctic monkeys do i wanna know": "bpOSxM0rNPM",
   "arctic monkeys arabella": "Jn6-TItCazo",
   "arctic monkeys snap out of it": "1_O_T6Aq85E",
   "arctic monkeys fluorescent adolescent": "GPGdXrQID7c",
   "arctic monkeys one for the road": "YNwaEkDHYN4",
   "arctic monkeys crying lightning": "IaIc-7GPHlY",
   "arctic monkeys i bet you look good on the dancefloor": "CYpn8yUnX_c",
   "arctic monkeys no 1 party anthem": "mGUjVbsYG6E",
   "arctic monkeys stop the world i wanna get off with you": "3PyoxMSEHYI",
   "arctic monkeys choo choo": "F7IAjtznWSE",
   "arctic monkeys fireside": "8-LewaeKejM",
   "arctic monkeys from ritz to rubble": "H8bNHRVwzyA",
   "arctic monkeys i want it all": "aNNExOnxxWA"
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

    // 1. STOP EVERYTHING FIRST (The "Kill Switch")
    // This fixes the ghosting issue
    LINKEngine.stop(); 
    this.el.pause();
    this.el.removeAttribute('src'); 
    this.el.load();

    if (State.blockedArtists.includes(track.artistName)) {
        UI.toast("Skipping Blocked Artist");
        Queue.next();
        return;
    }

    // 2. Database Lookup
    const key = this.normalizeKey(`${track.artistName} ${track.trackName}`);
    const ytId = LINK_DB[key];

    // 3. Decision Logic
    const useYouTube = (State.preferences.streamSource === 'auto' || State.preferences.streamSource === 'yt') && ytId;

    if (useYouTube) {
        // --- PATH A: YOUTUBE ---
        State.isLINKMode = true;
        
        // Load the video
        LINKEngine.loadVideo(ytId);
        
        // FIX: Force State to Playing
        State.isPlaying = true; 
        
        // FIX: Explicitly tell UI to update immediately (don't wait for timer)
        UI.updatePlaybackState();
        
        if (!autoplay) LINKEngine.pause();

    } else {
        // --- PATH B: NATIVE ---
        State.isLINKMode = false;
        State.isPlaying = false; // Wait for native promise
        
        this.el.src = track.previewUrl || track.localUrl;
        if (autoplay) {
            const playPromise = this.el.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    State.isPlaying = true;
                    UI.updatePlaybackState();
                }).catch(e => {
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
                      if(e.data === YT.PlayerState.PLAYING) {
                        AdShield.isAdDetected = false; // Reset flag when playing normally
                        AdShield.monitorAdState(this.player); // Start monitoring
                    } else {
                        AdShield.isAdDetected = false; // Reset if paused
                        if(AdShield.detectionInterval) clearInterval(AdShield.detectionInterval);
                    }
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
        // Check if we are trying to load the SAME video (prevents restarts)
        // Note: getPlayerState() might fail if not ready, wrap in try/catch
        try {
            if (this.player && this.player.getPlayerState() === YT.PlayerState.PLAYING) {
                // Optional: Logic to handle if it's already playing this ID
            }
        } catch(e) {}

        if (this.isReady && this.player) {
            this.player.loadVideoById(id);
            return true;
        } else {
            this.pendingVideoId = id;
            return false;
        }
    },
     stop() {
        if (this.player && this.player.stopVideo) {
            this.player.stopVideo();
            this.player.clearVideo(); // Clears the buffer to prevent "ghost" audio
        }
        // Clear any pending loads
        this.pendingVideoId = null;
    },
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
                        <h1 class="text-6xl font-black tracking-tighter" style="color: var(--text-primary);">SNIPLIT<br>WRAPPED</h1>
                        <p class="text-xs font-mono uppercase tracking-widest" style="color: var(--text-tertiary);">Your Personal review.</p>
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

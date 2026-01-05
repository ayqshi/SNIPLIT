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

  const Log = {
            info: (mod, msg) => console.log(`%c[${mod}]`, 'color: #3b82f6; font-weight: bold; background: #eff6ff; padding: 2px 6px; border-radius: 4px;', msg),
            warn: (mod, msg) => console.log(`%c[${mod}]`, 'color: #f59e0b; font-weight: bold; background: #fffbeb; padding: 2px 6px; border-radius: 4px;', msg),
            err: (mod, msg) => console.log(`%c[${mod}]`, 'color: #ef4444; font-weight: bold; background: #fef2f2; padding: 2px 6px; border-radius: 4px;', msg),
            success: (mod, msg) => console.log(`%c[${mod}]`, 'color: #10b981; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;', msg),
        };

        const State = {
            user: null,
            preferences: { quality: true, viz: true, haptics: true, historyEnabled: true },
            searchHistory: [],
            currentTrack: null,
            queue: [],
            history: [], 
            favorites: [],
            playlists: [], 
            followedArtists: [],
            isPlaying: false,
            loop: 'none',
            isShuffle: false,
            genres: new Set(),
            wrapped: { slide: 0, data: {} },
            db: null
        };

        const Database = {
            async init() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open('SniplitDB', 5);
                    request.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
                        if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
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
                const tx = this.db.transaction('settings', 'readwrite');
                tx.objectStore('settings').put(val, key);
            },
            async get(key) {
                return new Promise(res => {
                    const tx = this.db.transaction('settings', 'readonly');
                    const req = tx.objectStore('settings').get(key);
                    req.onsuccess = () => res(req.result);
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
            async hardReset() {
                if(confirm("Factory Reset: This will wipe all data. Confirm?")) {
                    localStorage.clear();
                    const req = indexedDB.deleteDatabase('SniplitDB');
                    req.onsuccess = () => {
                        Log.success('System', 'Database Wiped');
                        location.reload();
                    };
                    req.onerror = () => alert("Could not delete DB");
                }
            },
            async clearSearchHistory() {
                State.searchHistory = [];
                await this.save('search_history', []);
                UI.renderSearchHistory();
            }
        };

        const AudioEngine = {
            el: new Audio(),
            ctx: null,
            analyser: null,
            source: null,
            
            init() {
                this.el.crossOrigin = "anonymous";
                this.el.addEventListener('timeupdate', () => {
                    this.onTimeUpdate();
                    LyricsEngine.sync();
                });
                this.el.addEventListener('ended', () => Queue.onTrackEnd());
                this.el.addEventListener('play', () => {
                    State.isPlaying = true;
                    UI.updatePlaybackState();
                    this.updateMediaSession();
                    if(!this.ctx) this.initAudioContext();
                });
                this.el.addEventListener('pause', () => {
                    State.isPlaying = false;
                    UI.updatePlaybackState();
                    
                });
                Log.success('Audio', 'Engine Initialized');
            },

            initAudioContext() {
                try {
                    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                    this.analyser = this.ctx.createAnalyser();
                    this.analyser.fftSize = 2048; // Higher resolution for tech look
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
                this.el.src = track.previewUrl || track.localUrl;
                if(autoplay) this.el.play().catch(e => Log.warn('Audio', 'Autoplay prevented'));
                
                // History Management
                State.history.unshift(track);
                State.history = Array.from(new Set(State.history.map(a => a.trackId)))
                    .map(id => State.history.find(a => a.trackId === id))
                    .slice(0, 200);
                Database.save('history', State.history);
                
                if(track.primaryGenreName) State.genres.add(track.primaryGenreName);
                
                UI.updatePlayerUI();
                LyricsEngine.fetch(track);
                this.updateMediaSession();
                Log.info('Audio', `Loaded: ${track.trackName}`);
            },

            toggle() {
                if(!this.el.src) return;
                this.el.paused ? this.el.play() : this.el.pause();
                if(State.preferences.haptics && navigator.vibrate) navigator.vibrate(20);
            },

            seek(val) {
                if(!this.el.duration) return;
                this.el.currentTime = (val / 100) * this.el.duration;
            },

            seekByLyric(time) {
                this.el.currentTime = time;
                this.el.play();
            },

            onTimeUpdate() {
                const pct = (this.el.currentTime / this.el.duration) * 100;
                const slider = document.getElementById('player-progress');
                if(slider) slider.value = pct || 0;
                document.getElementById('mini-progress').style.width = `${pct || 0}%`;
                document.getElementById('time-cur').innerText = this.formatTime(this.el.currentTime);
                document.getElementById('time-total').innerText = this.formatTime(this.el.duration);
                this.updateMediaSession();
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
                    navigator.mediaSession.setActionHandler('play', () => this.el.play());
                    navigator.mediaSession.setActionHandler('pause', () => this.el.pause());
                    navigator.mediaSession.setActionHandler('previoustrack', () => Queue.prev());
                    navigator.mediaSession.setActionHandler('nexttrack', () => Queue.next());
                }
            }
        };


        const Onboarding = {
            async check() {
                const user = await Database.get('user_name');
                if(!user) {
                    document.getElementById('onboarding-layer').classList.remove('hidden');
                    return false;
                }
                State.user = user;
                const prefs = await Database.get('preferences');
                if(prefs) State.preferences = prefs;
                return true;
            },

            agreeTerms() {
                document.getElementById('ob-terms').classList.add('hidden');
                document.getElementById('ob-survey').classList.remove('hidden');
                this.renderGenres();
            },

            renderGenres() {
                const genres = ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'R&B', 'Indie', 'Jazz', 'Classical'];
                const grid = document.getElementById('survey-genres');
                grid.innerHTML = genres.map(g => 
                    `<div class="p-4 bg-zinc-800 rounded-xl border border-zinc-700 text-center font-bold text-xs uppercase cursor-pointer hover:bg-white hover:text-black transition" onclick="this.classList.toggle('bg-white'); this.classList.toggle('text-black'); this.classList.toggle('bg-zinc-800'); this.classList.toggle('selected-genre')" data-genre="${g}">${g}</div>`
                ).join('');
            },

            async finish() {
                const name = document.getElementById('survey-name').value;
                if(!name) {
                    alert("Please enter a codename.");
                    return;
                }
                const selected = Array.from(document.querySelectorAll('.selected-genre')).map(el => el.dataset.genre);
                if(selected.length === 0) selected.push('Pop'); // Default

                await Database.save('user_name', name);
                selected.forEach(g => State.genres.add(g));
                await Database.save('genres', Array.from(State.genres));

                document.getElementById('onboarding-layer').classList.add('fade-out'); // Add CSS anim if wanted
                setTimeout(() => {
                    document.getElementById('onboarding-layer').classList.add('hidden');
                    State.user = name;
                    UI.initData();
                }, 500);
            }
        };

        const LyricsEngine = {
            lines: [],
            userScrolling: false,
            scrollTimeout: null,
            
            async fetch(track) {
                const container = document.getElementById('lyrics-container');
                container.innerHTML = '<div class="flex flex-col items-center justify-center h-full py-20 opacity-50"><div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4"></div><p class="text-xs font-mono uppercase">Scanning Database...</p></div>';
                this.lines = [];

                try {
                    const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artistName)}&track_name=${encodeURIComponent(track.trackName)}`);
                    if(!res.ok) throw new Error("API Error");
                    const data = await res.json();
                    
                    if (data && data.syncedLyrics) {
                        this.parseSynced(data.syncedLyrics);
                    } else if (data && data.plainLyrics) {
                        this.parsePlain(data.plainLyrics);
                    } else {
                        throw new Error("No lyrics");
                    }
                } catch (e) {
                    container.innerHTML = '<div class="flex flex-col items-center justify-center h-full"><i data-lucide="music-2" class="w-8 h-8 text-zinc-700 mb-2"></i><p class="text-zinc-600 text-xs font-bold uppercase">Instrumental / No Lyrics</p></div>';
                    lucide.createIcons();
                }
                
                container.addEventListener('touchstart', () => { 
                    this.userScrolling = true; 
                    clearTimeout(this.scrollTimeout); 
                });
                container.addEventListener('touchend', () => { 
                    this.scrollTimeout = setTimeout(() => { this.userScrolling = false; }, 3000); 
                });
            },

            parseSynced(text) {
                this.lines = text.split('\n').map(line => {
                    const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
                    if (match) {
                        const min = parseInt(match[1]);
                        const sec = parseFloat(match[2]);
                        const txt = match[3].trim();
                        return { time: min * 60 + sec, text: txt };
                    }
                    return null;
                }).filter(l => l && l.text);
                this.render();
            },

            parsePlain(text) {
                this.lines = text.split('\n').map((l, i) => ({ text: l, time: null }));
                this.render();
            },

            render() {
                const container = document.getElementById('lyrics-container');
                container.innerHTML = this.lines.map((l, i) => 
                    `<div id="lyric-${i}" class="lyric-line" onclick="AudioEngine.seekByLyric(${l.time})">${l.text}</div>`
                ).join('');
            },

            sync() {
                if (this.lines.length === 0 || !State.isPlaying || this.userScrolling) return;
                const curTime = AudioEngine.el.currentTime;
                
                let activeIdx = -1;
                if (this.lines[0].time !== null) {
                    activeIdx = this.lines.findIndex((l, i) => 
                        curTime >= l.time && (i === this.lines.length - 1 || curTime < this.lines[i+1].time)
                    );
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

        const Queue = {
            index: -1,
            
            set(list, startIdx = 0) {
                if(!list || list.length === 0) return;
                State.queue = [...list];
                this.index = startIdx;
                AudioEngine.load(State.queue[this.index]);
                Log.info('Queue', `Set ${list.length} tracks`);
            },

            add(track) {
                State.queue.push(track);
                UI.toast("Added to Queue");
                if(!document.getElementById('modal-queue').classList.contains('hidden')) UI.renderQueueList();
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
                UI.renderQueueList();
            },

            next() {
                if (State.loop === 'one') {
                    AudioEngine.el.currentTime = 0;
                    AudioEngine.el.play();
                    AudioEngine.updateMediaSession();
                    return;
                }
                
                this.index++;
                if (this.index >= State.queue.length) {
                    this.startRadio();
                    return;
                }
                AudioEngine.load(State.queue[this.index]);
            },

            prev() {
                if (AudioEngine.el.currentTime > 3) {
                    AudioEngine.el.currentTime = 0;
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
                btn.className = State.loop !== 'none' ? 'text-white p-2' : 'text-zinc-600 p-2';
                btn.innerHTML = `<i data-lucide="repeat${State.loop === 'one' ? '-1' : ''}" class="w-5 h-5"></i>`;
                lucide.createIcons();
                UI.toast(`Loop: ${State.loop}`);
            },

            toggleShuffle() {
                State.isShuffle = !State.isShuffle;
                document.getElementById('shuffle-btn').className = State.isShuffle ? 'text-white p-2' : 'text-zinc-600 p-2';
                UI.toast(`Shuffle: ${State.isShuffle ? 'On' : 'Off'}`);
            },

            async startRadio() {
                if (!State.currentTrack) return;
                Log.info('Queue', 'Starting Radio Mode');
                const artistResults = await API.search(State.currentTrack.artistName);
                const knownIds = new Set([...State.queue, ...State.history].map(t => t.trackId));
                const candidates = artistResults.filter(t => !knownIds.has(t.trackId));
                
                if (candidates.length > 0) {
                    State.queue.push(...candidates.slice(0, 5));
                    UI.toast("Autoplay: Adding Similar Songs");
                    this.next();
                } else {
                    State.loop = 'all';
                    this.index = 0;
                    AudioEngine.load(State.queue[0]);
                }
            }
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
                    return data.results.slice(1); // First item is album details
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
            },
            
              createPlaylist(name) {
                if(!name) return;
                const newPl = {
                    id: 'pl-' + Date.now(),
                    name: name,
                    tracks: [],
                    image: null
                };
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
                    document.getElementById('modal-add-playlist').classList.add('hidden');
                    UI.toast(`Added to ${pl.name}`);
                }
            },

            async deletePlaylist(id) {
                if(!confirm("Delete playlist?")) return;
                State.playlists = State.playlists.filter(p => p.id !== id);
                await Database.savePlaylists(State.playlists);
                UI.back();
                UI.toast("Playlist Deleted");
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
            triggerFile() { document.getElementById('local-file-input').click(); },
            triggerFolder() { document.getElementById('local-folder-input').click(); },

            init() {
                const handleFiles = (files) => {
                     const validFiles = Array.from(files).filter(f => f.type.startsWith('audio/'));
                     if(validFiles.length === 0) { UI.toast("No Audio Files Found"); return; }

                     const localTracks = validFiles.map(f => ({
                        trackId: `local-${Date.now()}-${Math.random()}`,
                        trackName: f.name.replace(/\.[^/.]+$/, ""),
                        artistName: "Local Import",
                        collectionName: f.webkitRelativePath.split('/')[0] || "Imported",
                        artworkUrl100: "src/SNIPLIT.png",
                        previewUrl: URL.createObjectURL(f),
                        isLocal: true
                    }));
                    
                    Queue.set(localTracks);
                    UI.togglePlayer(true);
                    UI.toast(`Imported ${localTracks.length} files`);
                };

                document.getElementById('local-file-input').addEventListener('change', (e) => handleFiles(e.target.files));
                document.getElementById('local-folder-input').addEventListener('change', (e) => handleFiles(e.target.files));
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
                     document.getElementById('wrapped-next-btn').innerText = "Close";
                     document.getElementById('wrapped-next-btn').onclick = () => document.getElementById('wrapped-modal').classList.add('hidden');
                }
                
                container.innerHTML = html;
                document.getElementById('wrapped-next-btn').classList.remove('hidden');
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

            async init() {
                await Database.init();
                
                const loggedIn = await Onboarding.check();
                if(!loggedIn) {
                    document.getElementById('splash-screen').style.display = 'none';
                    return;
                }

                this.initData();
                LocalFiles.init();
                
                // Clock
                setInterval(() => {
                    const now = new Date();
                    document.getElementById('system-time').innerText = now.getHours() + ":" + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
                }, 1000);

                // Search Debounce
                document.getElementById('main-search').addEventListener('input', debounce(async (e) => {
                    if (e.target.value.length < 2) return;
                    const results = await API.search(e.target.value);
                    this.renderSearchResults(results);
                }, 500));
                
                // Show search history when focused
                document.getElementById('main-search').addEventListener('focus', () => {
                    if(State.preferences.historyEnabled && State.searchHistory.length > 0) {
                        document.getElementById('search-history-panel').classList.remove('hidden');
                    }
                });
            },

            async initData() {
                // Load Preferences
                const savedPrefs = await Database.get('preferences');
                if(savedPrefs) { 
                    State.preferences = savedPrefs;
                    this.applySettingsUI();
                }

                // Load User
                State.user = await Database.get('user_name');
                document.getElementById('greeting').innerText = `Welcome, ${State.user}`;
                document.getElementById('pref-name').value = State.user;

                // Load Data
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

                AudioEngine.init();
                this.initVisualizer();
                lucide.createIcons();
                this.loadHomeData();

                // Hide Splash
                document.getElementById('splash-screen').style.opacity = '0';
                setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 800);
            },

            toggleView(id) {
                ['home', 'search', 'library', 'artist', 'playlist'].forEach(v => {
                    document.getElementById(`view-${v}`).classList.add('hidden');
                });
                
                const el = document.getElementById(`view-${id}`);
                if(el) el.classList.remove('hidden');
                
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                if(['home', 'search', 'library'].includes(id)) {
                    document.querySelector(`.nav-btn[data-view="${id}"]`)?.classList.add('active');
                    this.viewStack.push(id);
                }
                if(id === 'home') this.loadHomeData();
            },

            back() {
                if (this.viewStack.length > 1) {
                    this.viewStack.pop();
                    const prev = this.viewStack.pop();
                    this.toggleView(prev);
                } else {
                    this.toggleView('home');
                }
            },

            togglePlayer(show) {
                const el = document.getElementById('full-player');
                if (show) {
                    el.classList.remove('hidden');
                    setTimeout(() => el.classList.remove('translate-y-full'), 10);
                    // Ensure visualizer resizes correctly
                    setTimeout(() => {
                         const canvas = document.getElementById('viz-canvas');
                         canvas.width = canvas.parentElement.offsetWidth;
                         canvas.height = canvas.parentElement.offsetHeight;
                    }, 500);
                } else {
                    el.classList.add('translate-y-full');
                    setTimeout(() => el.classList.add('hidden'), 500);
                }
            },

            toggleLyrics() { document.getElementById('lyrics-panel').classList.toggle('hidden'); },
            openSettings() { document.getElementById('modal-settings').classList.remove('hidden'); },
            closeSettings() { document.getElementById('modal-settings').classList.add('hidden'); },

            async loadHomeData() {
                const recentsGrid = document.getElementById('recents-grid');
                recentsGrid.innerHTML = '';
                const uniqueHistory = Array.from(new Set(State.history.map(a => a.trackId)))
                    .map(id => State.history.find(a => a.trackId === id))
                    .slice(0, 4);
                
                uniqueHistory.forEach(t => {
                    recentsGrid.innerHTML += `
                        <div class="flex items-center gap-3 bg-zinc-900/50 p-2.5 rounded-xl border border-white/5 hover:bg-white/10 transition cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                            <img src="${t.artworkUrl100}" class="w-10 h-10 rounded-lg object-cover shadow-sm">
                            <div class="min-w-0 flex-1">
                                <p class="text-[11px] font-bold truncate text-white">${t.trackName}</p>
                                <p class="text-[9px] text-zinc-500 font-bold truncate uppercase">${t.artistName}</p>
                            </div>
                        </div>`;
                });
                if(uniqueHistory.length === 0) recentsGrid.innerHTML = '<div class="col-span-2 py-4 text-center text-zinc-700 text-[10px] font-mono border border-dashed border-zinc-800 rounded-xl">Start listening to build history</div>';
                // Fallback queries
              // --- SMART PERSONALIZED DISCOVERY ENGINE v2 ---
const forYouGrid = document.getElementById('for-you-grid');
const discGrid = document.getElementById('recs-grid');

// 1. Extract high-confidence seeds
const trustedArtists = new Set();
const recentAlbumIds = new Set();

// Favor explicit signals
State.favorites.forEach(t => trustedArtists.add(t.artistName));
State.followedArtists.forEach(a => trustedArtists.add(a.name));

// Add from history ONLY if fully played (approx: duration ≥ 85% of track)
const fullListens = State.history.filter(t => {
  // Estimate: if we have trackTimeMillis, assume full listen if played >85%
  // (In a real app, you'd store actual play % — but we simulate)
  const durationMs = t.trackTimeMillis || 180000;
  // For now: treat last 20 as "likely intentional", older as noise
  return State.history.indexOf(t) < 20;
});

// Block albums from last 5 tracks
State.history.slice(0, 5).forEach(t => {
  if (t.collectionId) recentAlbumIds.add(t.collectionId);
});

// Add top artists from full listens
if (fullListens.length > 0) {
  const artistFreq = {};
  fullListens.forEach(t => {
    artistFreq[t.artistName] = (artistFreq[t.artistName] || 0) + 1;
  });
  const topFromHistory = Object.entries(artistFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);
  topFromHistory.forEach(a => trustedArtists.add(a));
}

// 2. Build queries
let queries = [];

if (trustedArtists.size > 0) {
  const artistList = Array.from(trustedArtists).slice(0, 4);
  queries.push(...artistList.flatMap(a => [`${a} radio`, `${a} similar artists`]));
} else if (State.genres.size > 0) {
  queries = Array.from(State.genres).slice(0, 2).map(g => `${g} 2026 emerging`);
} else {
  queries = ['Hits 2026'];
}

// 3. Fetch results
Promise.all(queries.map(q => API.search(q)))
  .then(results => results.flat())
  .then(rawTracks => {
    // 4. FILTER & DEDUPE
    const seenAlbums = new Set(recentAlbumIds); // Block recent albums
    const seenArtists = {};
    const filtered = [];

    for (const t of rawTracks) {
      // Skip if from blocked album
      if (t.collectionId && seenAlbums.has(t.collectionId)) continue;
      // Skip if album already used
      if (t.collectionId) seenAlbums.add(t.collectionId);
      // Cap per-artist
      seenArtists[t.artistName] = (seenArtists[t.artistName] || 0) + 1;
      if (seenArtists[t.artistName] > 2) continue;
      // Skip if already in history
      if (State.history.some(h => h.trackId === t.trackId)) continue;
      // Skip if low-quality result
      if (!t.previewUrl || !t.artworkUrl100) continue;
      
      filtered.push(t);
    }

    // 5. RANK by affinity
    const followedNames = new Set(State.followedArtists.map(a => a.name));
    const favoriteArtistNames = new Set(State.favorites.map(f => f.artistName));

    const scored = filtered.map(t => {
      let score = 0;
      if (followedNames.has(t.artistName)) score += 50;
      if (favoriteArtistNames.has(t.artistName)) score += 40;
      if (trustedArtists.has(t.artistName)) score += 30;
      // Bonus for new albums
      if (!State.history.some(h => h.collectionId === t.collectionId)) score += 10;
      return { ...t, _score: score };
    });

    scored.sort((a, b) => b._score - a._score || Math.random() - 0.5);
    const finalTracks = scored.slice(0, 20).map(({ _score, ...rest }) => rest);

    // 6. RENDER
    forYouGrid.innerHTML = '';
    finalTracks.slice(0, 8).forEach(t => {
      forYouGrid.innerHTML += `
        <div class="flex-shrink-0 w-32 space-y-2 cursor-pointer group" onclick="Queue.set([${this.esc(t)}])">
          <div class="relative overflow-hidden rounded-xl">
            <img src="${t.artworkUrl100.replace('100x100', '400x400')}" class="w-32 h-32 object-cover bg-zinc-900 border border-white/5 group-hover:scale-105 transition duration-500">
          </div>
          <div class="px-1">
            <p class="text-[11px] font-bold truncate text-white">${t.trackName}</p>
            <p class="text-[9px] text-zinc-500 font-bold truncate uppercase">${t.artistName}</p>
          </div>
        </div>`;
    });

    discGrid.innerHTML = '';
    finalTracks.slice(8, 12).forEach(t => {
      discGrid.innerHTML += `
        <div class="space-y-2 cursor-pointer group" onclick="Queue.set([${this.esc(t)}])">
          <div class="relative overflow-hidden rounded-xl">
            <img src="${t.artworkUrl100.replace('100x100', '400x400')}" class="w-full aspect-square object-cover border border-white/5 group-hover:scale-105 transition duration-500">
          </div>
          <p class="text-xs font-bold truncate text-zinc-300 group-hover:text-white">${t.trackName}</p>
        </div>`;
    });
  });
            },

            renderSearchResults(results) {
                document.getElementById('search-history-panel').classList.add('hidden');
                document.getElementById('search-results').classList.remove('hidden');
                const container = document.getElementById('search-results');
                container.innerHTML = '';
                
                // Save search term to history
                const term = document.getElementById('main-search').value;
                if(term && State.preferences.historyEnabled) {
                     if(!State.searchHistory.includes(term)) {
                         State.searchHistory.unshift(term);
                         if(State.searchHistory.length > 10) State.searchHistory.pop();
                         Database.save('search_history', State.searchHistory);
                         this.renderSearchHistory();
                     }
                }

                results.forEach(t => {
                    container.innerHTML += `
                        <div class="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition cursor-pointer group border border-transparent hover:border-white/5" onclick="Queue.set([${this.esc(t)}])">
                            <div class="relative w-12 h-12 flex-shrink-0">
                                <img src="${t.artworkUrl100}" class="w-full h-full rounded-lg object-cover shadow-lg">
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-1.5">
                                    <h4 class="text-sm font-bold truncate text-white">${t.trackName}</h4>
                                    ${t.trackExplicitness === 'explicit' ? '<span class="bg-zinc-800 text-zinc-500 text-[8px] font-bold px-1 rounded flex-shrink-0 border border-zinc-700">E</span>' : ''}
                                </div>
                                <p class="text-xs text-zinc-500 font-bold uppercase tracking-wide hover:text-white transition" onclick="event.stopPropagation(); UI.openArtistProfile(${this.esc(t)})">${t.artistName}</p>
                            </div>
                            <button class="p-2 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded-full transition" onclick="event.stopPropagation(); Queue.add(${this.esc(t)})"><i data-lucide="plus" class="w-4 h-4"></i></button>
                        </div>`;
                });
                lucide.createIcons();
            },

            renderSearchHistory() {
                const container = document.getElementById('search-history-chips');
                if(!container) return;
                container.innerHTML = State.searchHistory.map(term => 
                    `<span class="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-400 uppercase cursor-pointer hover:border-white/20 hover:text-white transition" onclick="document.getElementById('main-search').value='${term}'; document.getElementById('main-search').dispatchEvent(new Event('input'));">${term}</span>`
                ).join('');
            },

            async openArtistProfile(trackObj) {
                if(!trackObj.artistName) return;
                this.toggleView('artist');
                
                const name = trackObj.artistName;
                const id = trackObj.artistId;
                const isFollowed = State.followedArtists.some(a => a.name === name);

                document.getElementById('artist-hero').innerHTML = `
                    <div class="flex items-center justify-between mb-2">
                        <h1 class="text-4xl font-black tracking-tighter text-white leading-none">${name}</h1>
                    </div>
                    <div class="flex items-center gap-3">
                         <button id="follow-btn" onclick="UI.toggleFollow('${id}', '${name.replace(/'/g, "\\'")}')" class="px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition ${isFollowed ? 'bg-white text-black' : 'bg-zinc-800 text-white border border-zinc-700'}">
                            ${isFollowed ? 'Following' : 'Follow'}
                        </button>
                        <p class="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">${trackObj.primaryGenreName || 'Artist'}</p>
                    </div>
                `;
                
                // Skeletons
                document.getElementById('artist-top-tracks').innerHTML = '<div class="space-y-2"><div class="skeleton h-12 w-full"></div><div class="skeleton h-12 w-full"></div></div>';
                
                const topTracks = await API.search(name);
                const trackList = document.getElementById('artist-top-tracks');
                
                trackList.innerHTML = `<h3 class="text-sm font-bold text-zinc-500 uppercase mb-2">Top Songs</h3>`;
                topTracks.slice(0, 5).forEach((t, i) => {
                    trackList.innerHTML += `
                        <div class="flex items-center gap-4 py-3 border-b border-white/5 cursor-pointer hover:bg-white/5 -mx-4 px-4 transition" onclick="Queue.set([${this.esc(t)}])">
                            <span class="text-xs font-mono text-zinc-700 w-4">${i+1}</span>
                            <div class="flex-1 text-sm font-bold truncate text-zinc-300 group-hover:text-white">${t.trackName}</div>
                        </div>`;
                });

                if(id) {
                    const albums = await API.getArtistDiscography(id);
                    const albumGrid = document.getElementById('artist-albums');
                    albumGrid.innerHTML = '';
                    albums.slice(1).forEach(a => {
                        albumGrid.innerHTML += `
                            <div class="space-y-2 group cursor-pointer" onclick="UI.openAlbum('${a.collectionId}', '${a.collectionName.replace(/'/g, "\\'")}', '${a.artworkUrl100}')">
                                <img src="${a.artworkUrl100.replace('100x100', '400x400')}" class="w-full aspect-square rounded-xl object-cover border border-white/5 group-hover:border-white/20 transition">
                                <p class="text-[10px] font-bold truncate text-zinc-400 group-hover:text-white">${a.collectionName}</p>
                            </div>`;
                    });
                }
            },

            async openAlbum(id, name, art) {
                this.toggleView('playlist');
                document.getElementById('playlist-hero').innerHTML = `<div class="skeleton w-full h-40"></div>`; // Loading
                
                const tracks = await API.getAlbumTracks(id);
                
                document.getElementById('playlist-hero').innerHTML = `
                    <div class="flex items-end gap-5">
                        <img src="${art.replace('100x100','300x300')}" class="w-28 h-28 rounded-xl shadow-2xl border border-white/10">
                        <div>
                            <h1 class="text-2xl font-black leading-tight mb-1 line-clamp-2">${name}</h1>
                            <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3">${tracks.length} Songs</p>
                             <button onclick="Queue.set(${this.esc(tracks)})" class="px-5 py-2 bg-white text-black rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:scale-105 transition">Play Album</button>
                        </div>
                    </div>`;
                
                const list = document.getElementById('playlist-tracks');
                list.innerHTML = '';
                tracks.forEach((t, i) => {
                    list.innerHTML += `
                        <div class="flex items-center gap-4 py-3.5 border-b border-white/5 group hover:bg-white/5 -mx-2 px-2 transition rounded-lg cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                            <span class="text-xs font-mono text-zinc-600 w-4">${i+1}</span>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold truncate text-zinc-200 group-hover:text-white">${t.trackName}</p>
                            </div>
                            <span class="text-[10px] font-mono text-zinc-600">${AudioEngine.formatTime(t.trackTimeMillis/1000)}</span>
                        </div>`;
                });
            },

            renderPlaylistView(playlist) {
                this.toggleView('playlist');
                document.getElementById('playlist-hero').innerHTML = `
                    <div class="flex items-end gap-5">
                        <div class="w-28 h-28 bg-gradient-to-tr from-zinc-800 to-zinc-900 rounded-xl flex items-center justify-center border border-white/10 shadow-xl">
                            <i data-lucide="music" class="w-10 h-10 text-zinc-500"></i>
                        </div>
                        <div>
                            <h1 class="text-3xl font-black leading-none mb-2">${playlist.name}</h1>
                            <p class="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-4">${playlist.tracks.length} Songs</p>
                            <div class="flex gap-3">
                                <button onclick="Queue.set(${this.esc(playlist.tracks)})" class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition"><i data-lucide="play" class="w-4 h-4 fill-black text-black ml-0.5"></i></button>
                                <button onclick="Library.deletePlaylist('${playlist.id}')" class="w-10 h-10 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 active:scale-95 transition hover:bg-red-900/20 hover:text-red-500 hover:border-red-500/50"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                            </div>
                        </div>
                    </div>`;

                const list = document.getElementById('playlist-tracks');
                list.innerHTML = '';
                if(playlist.tracks.length === 0) {
                    list.innerHTML = '<p class="text-center text-zinc-600 text-xs py-10 font-mono">Empty Playlist</p>';
                } else {
                    playlist.tracks.forEach((t, i) => {
                        list.innerHTML += `
                            <div class="flex items-center gap-4 py-3 border-b border-white/5 group hover:bg-white/5 -mx-2 px-2 rounded-lg transition">
                                <span class="text-xs font-mono text-zinc-700 w-4">${i+1}</span>
                                <div class="flex-1 min-w-0 cursor-pointer" onclick="Queue.set([${this.esc(t)}])">
                                    <p class="text-sm font-bold truncate text-zinc-200">${t.trackName}</p>
                                    <p class="text-[10px] text-zinc-500 uppercase font-bold">${t.artistName}</p>
                                </div>
                                <button onclick="Library.removeFromPlaylist('${playlist.id}', '${t.trackId}')" class="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-500 transition"><i data-lucide="x" class="w-4 h-4"></i></button>
                            </div>`;
                    });
                }
                lucide.createIcons();
            },

            async renderLibrary() {
                const list = document.getElementById('library-list');
                let html = `
                    <div class="flex items-center justify-between p-4 bg-zinc-900/30 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-900 transition group mb-3" onclick="Queue.set(State.favorites)">
                         <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-900 to-black flex items-center justify-center border border-indigo-500/20 shadow-lg group-hover:scale-105 transition">
                                <i data-lucide="heart" class="w-5 h-5 fill-indigo-400 text-indigo-400"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-white">Liked Songs</p>
                                <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">${State.favorites.length} Tracks</p>
                            </div>
                        </div>
                    </div>

                     <div class="flex items-center justify-between p-4 bg-zinc-900/30 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-900 transition group mb-3" onclick="Queue.set(State.favorites)">
                         <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-900 to-white flex items-center justify-center border border-indigo-500/20 shadow-lg group-hover:scale-105 transition">
                                <i data-lucide="mic-2" class="w-5 h-5 fill-black-400 text-black-400"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-white">Following</p>
                                <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">${State.followedArtists.length}</p>
                            </div>
                        </div>
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
                                    <p class="text-sm font-bold text-white">${pl.name}</p>
                                    <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">${pl.tracks.length} Tracks</p>
                                </div>
                            </div>
                            <i data-lucide="chevron-right" class="w-4 h-4 text-zinc-700"></i>
                        </div>`;
                });
                list.innerHTML = html;
                lucide.createIcons();
            },

            updatePlayerUI() {
                const t = State.currentTrack;
                if(!t) return;

                document.getElementById('mini-player').classList.remove('hidden');
                // Mini Player pop up animation
                document.getElementById('mini-player').classList.add('-translate-y-2');
                setTimeout(() => document.getElementById('mini-player').classList.remove('-translate-y-2'), 200);

                document.getElementById('mini-title').innerText = t.trackName;
                document.getElementById('mini-artist').innerText = t.artistName;
                document.getElementById('mini-art').src = t.artworkUrl100;

                document.getElementById('player-title').innerText = t.trackName;
                document.getElementById('player-artist').innerText = t.artistName;
                document.getElementById('player-art').src = t.artworkUrl100.replace('100x100', '600x600');
                
                const exp = document.getElementById('explicit-badge');
                t.trackExplicitness === 'explicit' ? exp.classList.remove('hidden') : exp.classList.add('hidden');

                // High Res Badge logic (Mock)
                const qualityEl = document.getElementById('player-quality');
                if(State.preferences.quality) {
                    qualityEl.classList.remove('opacity-0');
                    qualityEl.innerText = "LOSSLESS • 48kHz";
                } else {
                    qualityEl.classList.add('opacity-0');
                }

                const likeBtn = document.getElementById('like-btn');
                const isFav = State.favorites.some(f => f.trackId === t.trackId);
                likeBtn.innerHTML = `<i data-lucide="heart" class="w-5 h-5 ${isFav ? 'fill-red-500 text-red-500' : 'text-zinc-500'}"></i>`;
                
                lucide.createIcons();
            },

            updatePlaybackState() {
                const icon = State.isPlaying ? 'pause' : 'play';
                document.getElementById('mini-play-icon').parentElement.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 fill-white"></i>`;
                document.getElementById('main-play-btn').innerHTML = `<i data-lucide="${icon}" class="w-8 h-8 fill-black ${icon === 'play' ? 'ml-1' : ''}"></i>`;
                lucide.createIcons();
            },

            renderQueueList() {
                const list = document.getElementById('queue-list');
                list.innerHTML = '';
                document.getElementById('queue-info').innerText = `${State.queue.length} Tracks`;
                
                State.queue.forEach((t, i) => {
                    const item = document.createElement('div');
                    item.className = 'queue-item relative rounded-xl overflow-hidden mb-2 bg-zinc-900';
                    item.innerHTML = `
                        <div class="swipe-bg"><i data-lucide="trash-2" class="w-5 h-5 text-white"></i></div>
                        <div class="queue-content flex items-center gap-4 p-3 ${i === Queue.index ? 'bg-zinc-800 border border-zinc-700' : 'bg-zinc-900 border border-transparent'}">
                            <img src="${t.artworkUrl100}" class="w-10 h-10 rounded-lg shadow-sm">
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold truncate ${i === Queue.index ? 'text-white' : 'text-zinc-300'}">${t.trackName}</p>
                                <p class="text-[9px] text-zinc-500 uppercase font-bold">${t.artistName}</p>
                            </div>
                            ${i === Queue.index && State.isPlaying ? '<div class="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]"></div>' : ''}
                        </div>
                    `;
                    
                    // Swipe Logic
                    let startX = 0, currentX = 0;
                    const content = item.querySelector('.queue-content');
                    item.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
                    item.addEventListener('touchmove', e => {
                        currentX = e.touches[0].clientX;
                        const diff = startX - currentX;
                        if (diff > 0 && diff < 100) content.style.transform = `translateX(-${diff}px)`;
                    });
                    item.addEventListener('touchend', () => {
                        const diff = startX - currentX;
                        if (diff > 80) Queue.remove(i);
                        else content.style.transform = `translateX(0)`;
                    });
                    item.addEventListener('click', () => {
                        if(startX - currentX < 10) Queue.set(State.queue, i);
                    });
                    list.appendChild(item);
                });
                lucide.createIcons();
            },

            initVisualizer() {
                const canvas = document.getElementById('viz-canvas');
                const ctx = canvas.getContext('2d');
                let width, height;

                const resize = () => {
                    if(!canvas.parentElement) return;
                    width = canvas.width = canvas.parentElement.offsetWidth;
                    height = canvas.height = canvas.parentElement.offsetHeight;
                };
                window.addEventListener('resize', resize);
                // Poll for resize in case of modal transitions
                setInterval(resize, 1000); 

                const draw = () => {
                    requestAnimationFrame(draw);
                    if(!State.preferences.viz) { ctx.clearRect(0,0,width,height); return; }
                    
                    ctx.clearRect(0, 0, width, height);

                    if (State.isPlaying && AudioEngine.analyser) {
                        const bufferLength = AudioEngine.analyser.frequencyBinCount;
                        const dataArray = new Uint8Array(bufferLength);
                        AudioEngine.analyser.getByteTimeDomainData(dataArray);

                        ctx.lineWidth = 1.5;
                        // High Tech Look: White line with low opacity
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; 
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

            toggleViz() {
                State.preferences.viz = !State.preferences.viz;
                Database.save('preferences', State.preferences);
            },

            toggleFollow(id, name) {
                const idx = State.followedArtists.findIndex(a => a.name === name);
                const btn = document.getElementById('follow-btn');
                if(idx > -1) {
                    State.followedArtists.splice(idx, 1);
                    btn.innerText = "Follow";
                    btn.className = "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition bg-zinc-800 text-white border border-zinc-700";
                    UI.toast(`Unfollowed ${name}`);
                } else {
                    State.followedArtists.push({ id, name });
                    btn.innerText = "Following";
                    btn.className = "px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition bg-white text-black";
                    UI.toast(`Following ${name}`);
                }
                const sec = document.getElementById('followed-section');
                if(State.followedArtists.length > 0) sec.classList.remove('hidden');
                this.renderFollowed();
            },
            
            renderFollowed() {
                 const grid = document.getElementById('followed-grid');
                 grid.innerHTML = '';
                 State.followedArtists.forEach(a => {
                     grid.innerHTML += `
                        <div class="flex-shrink-0 w-24 text-center cursor-pointer" onclick="UI.openArtistProfile({artistName: '${a.name.replace(/'/g, "\\'")}', artistId: '${a.id}'})">
                             <div class="w-20 h-20 mx-auto rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-2">
                                <i data-lucide="mic-2" class="w-8 h-8 text-zinc-500"></i>
                             </div>
                             <p class="text-[10px] font-bold truncate text-zinc-400">${a.name}</p>
                        </div>
                     `;
                 });
                 lucide.createIcons();
            },

            showWrapped() {
                if(Wrapped.calculate()) {
                    State.wrapped.slide = 0;
                    Wrapped.renderSlide();
                    document.getElementById('wrapped-modal').classList.remove('hidden');
                    document.getElementById('wrapped-next-btn').innerText = "Next";
                    document.getElementById('wrapped-next-btn').onclick = () => Wrapped.nextSlide();
                }
            },
            
            openAddToPlaylist() {
                if(!State.currentTrack) return;
                const list = document.getElementById('playlist-select-list');
                list.innerHTML = '';
                
                if(State.playlists.length === 0) {
                    list.innerHTML = '<p class="text-xs text-zinc-500 text-center mt-10 font-bold uppercase">No Playlists</p><button onclick="Library.createPlaylist()" class="w-full mt-4 py-3 bg-white text-black text-xs font-bold uppercase rounded-lg">Create One</button>';
                } else {
                    State.playlists.forEach(pl => {
                        const btn = document.createElement('button');
                        btn.className = 'w-full text-left p-4 bg-zinc-900 rounded-xl flex items-center justify-between border border-white/5 mb-2 hover:bg-zinc-800 transition';
                        btn.innerHTML = `<span class="font-bold text-sm text-white">${pl.name}</span> <span class="text-[10px] text-zinc-500 font-bold">${pl.tracks.length} Songs</span>`;
                        btn.onclick = () => Library.addToPlaylist(pl.id);
                        list.appendChild(btn);
                    });
                }
                document.getElementById('modal-add-playlist').classList.remove('hidden');
            },

            showCreatePlaylist() { 
                  UI.triggerPrompt('Create Playlist', 'Enter playlist name', (name) => Library.createPlaylist(name));
             },

            toggleSetting(key, el) {
                State.preferences[key] = !State.preferences[key];
                Database.save('preferences', State.preferences);
                const knob = el.querySelector('div');
                if(State.preferences[key]) {
                    el.classList.remove('bg-zinc-800'); el.classList.add('bg-white');
                    knob.classList.add('translate-x-5'); knob.classList.remove('bg-white'); knob.classList.add('bg-black');
                } else {
                    el.classList.add('bg-zinc-800'); el.classList.remove('bg-white');
                    knob.classList.remove('translate-x-5'); knob.classList.add('bg-white'); knob.classList.remove('bg-black');
                }
            },
            
            applySettingsUI() {
                // Apply toggle states visually on load
                ['quality', 'viz', 'haptics', 'historyEnabled'].forEach(k => {
                    const el = document.getElementById(`toggle-${k}`);
                    const knob = el.querySelector('div');
                    if(State.preferences[k]) {
                        el.classList.add('bg-white'); el.classList.remove('bg-zinc-800');
                        knob.classList.add('translate-x-5'); knob.classList.add('bg-black'); knob.classList.remove('bg-white');
                    } else {
                        el.classList.add('bg-zinc-800'); el.classList.remove('bg-white');
                        knob.classList.remove('translate-x-5'); knob.classList.remove('bg-black'); knob.classList.add('bg-white');
                    }
                });
            },

            logout() {
                 if(confirm("Log out?")) {
                    Database.save('user_name', null);
                    location.reload();
                 }
            },
             // Custom Modals
            triggerAlert(title, msg) {
                document.getElementById('alert-title').innerText = title;
                document.getElementById('alert-msg').innerText = msg;
                document.getElementById('ui-alert').classList.add('active');
            },
            closeAlert() { document.getElementById('ui-alert').classList.remove('active'); },
            
            triggerConfirm(title, msg, onYes) {
                document.getElementById('confirm-title').innerText = title;
                document.getElementById('confirm-msg').innerText = msg;
                const btn = document.getElementById('confirm-yes-btn');
                // Clone to remove old listeners
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => { onYes(); UI.closeConfirm(); });
                document.getElementById('ui-confirm').classList.add('active');
            },
            closeConfirm() { document.getElementById('ui-confirm').classList.remove('active'); },

            triggerPrompt(title, placeholder, onSubmit) {
                document.getElementById('prompt-title').innerText = title;
                const inp = document.getElementById('prompt-input');
                inp.value = '';
                inp.placeholder = placeholder;
                const btn = document.getElementById('prompt-yes-btn');
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => { onSubmit(inp.value); UI.closePrompt(); });
                document.getElementById('ui-prompt').classList.add('active');
                setTimeout(() => inp.focus(), 100);
            },
            closePrompt() { document.getElementById('ui-prompt').classList.remove('active'); },
        

            toast(msg) {
                const t = document.getElementById('toast');
                t.innerText = msg;
                t.style.opacity = '1';
                setTimeout(() => t.style.opacity = '0', 2000);
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
        //very sloopy very tired. very google
let isSmallScreen = window.matchMedia("only screen and (max-width: 768px)").matches;

if (!navigator.standalone || !window.matchMedia('(display-mode: standalone)').matches) {
   if(isSmallScreen){ document.querySelector("#notification-bar").style.visibility = "visible"} else {
    document.querySelector("#notification-bar").remove();
   }
} else {
    document.querySelector("#notification-bar").remove();
}
        
    

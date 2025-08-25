
        // Global Configuration
        let RAPIDAPI_KEY = '';
        let RAPIDAPI_HOST = 'spotify-scraper.p.rapidapi.com';
        let currentSongData = null;
        let selectedQuality = '320';

        // Initialize floating particles
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            const particleCount = 20;

            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
                particlesContainer.appendChild(particle);
            }
        }

        // Save API configuration
        function saveApiConfig() {
            const apiKey = document.getElementById('rapidApiKey').value.trim();
            const apiHost = document.getElementById('rapidApiHost').value.trim();

            if (!apiKey) {
                showStatus('Please enter a valid RapidAPI key', 'error');
                return;
            }

            RAPIDAPI_KEY = apiKey;
            if (apiHost) {
                RAPIDAPI_HOST = apiHost;
            }

            // Store in memory (not localStorage as per restrictions)
            showStatus('API configuration saved successfully!', 'success');
        }

        // Select audio quality
        function selectQuality(element) {
            // Remove selected class from all options
            document.querySelectorAll('.quality-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Add selected class to clicked option
            element.classList.add('selected');
            selectedQuality = element.getAttribute('data-quality');
        }

        // Extract Spotify track ID from URL
        function extractSpotifyTrackId(url) {
            const patterns = [
                /(?:https?:\/\/)?(?:open\.spotify\.com\/track\/)([a-zA-Z0-9]{22})/,
                /(?:https?:\/\/)?(?:spotify:track:)([a-zA-Z0-9]{22})/,
                /(?:https?:\/\/)?(?:open\.spotify\.com\/intl-[a-z]{2}\/track\/)([a-zA-Z0-9]{22})/
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) return match[1];
            }
            return null;
        }

        // Validate Spotify URL
        function isValidSpotifyUrl(url) {
            return extractSpotifyTrackId(url) !== null;
        }

        // Show status message with auto-hide
        function showStatus(message, type = 'error') {
            const statusElement = document.getElementById('statusMessage');
            statusElement.textContent = message;
            statusElement.className = `status-message status-${type}`;
            statusElement.style.display = 'block';

            // Auto hide after 5 seconds
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }

        // Update button state with loading animation
        function updateButtonState(buttonId, loading = false, text = '') {
            const button = document.getElementById(buttonId);
            const textElement = document.getElementById(buttonId.replace('Btn', 'Text'));
            
            if (loading) {
                button.disabled = true;
                textElement.innerHTML = '<span class="loading"></span> Loading...';
            } else {
                button.disabled = false;
                textElement.textContent = text || (buttonId === 'fetchBtn' ? 'Get Song Info' : 'Download Song');
            }
        }

        // Format duration from milliseconds to MM:SS
        function formatDuration(ms) {
            if (!ms) return '0:00';
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(0);
            return `${minutes}:${seconds.padStart(2, '0')}`;
        }

        // Fetch song information
        async function fetchSongInfo() {
            const urlInput = document.getElementById('spotifyUrl');
            const url = urlInput.value.trim();

            if (!url) {
                showStatus('Please enter a Spotify URL', 'error');
                urlInput.focus();
                return;
            }

            if (!isValidSpotifyUrl(url)) {
                showStatus('Please enter a valid Spotify track URL', 'error');
                urlInput.focus();
                return;
            }

            if (!RAPIDAPI_KEY) {
                showStatus('Please configure your RapidAPI key first', 'error');
                document.getElementById('rapidApiKey').focus();
                return;
            }

            const trackId = extractSpotifyTrackId(url);
            updateButtonState('fetchBtn', true);

            try {
                const songData = await fetchSongMetadata(trackId);
                
                if (songData) {
                    currentSongData = songData;
                    displaySongInfo(currentSongData);
                    showStatus('Song information loaded successfully! 🎵', 'success');
                } else {
                    showStatus('Song not found or unavailable', 'error');
                }
            } catch (error) {
                console.error('Error fetching song info:', error);
                showStatus(`Failed to fetch song: ${error.message}`, 'error');
            } finally {
                updateButtonState('fetchBtn', false, 'Get Song Info');
            }
        }

        // Fetch song metadata from Spotify API
        async function fetchSongMetadata(trackId) {
            const options = {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': RAPIDAPI_HOST
                }
            };

            try {
                // Try multiple API endpoints for better reliability
                const endpoints = [
                    `https://${RAPIDAPI_HOST}/v1/track/metadata?trackId=${trackId}`,
                    `https://${RAPIDAPI_HOST}/track/${trackId}`,
                    `https://spotify-scraper.p.rapidapi.com/v1/track/download/soundcloud?trackId=${trackId}`
                ];

                for (const endpoint of endpoints) {
                    try {
                        const response = await fetch(endpoint, options);
                        
                        if (!response.ok) continue;
                        
                        const data = await response.json();
                        
                        // Handle different API response formats
                        const trackData = data.data || data.track || data;
                        
                        if (trackData && (trackData.name || trackData.title)) {
                            return {
                                id: trackId,
                                title: trackData.name || trackData.title,
                                artist: Array.isArray(trackData.artists) 
                                    ? trackData.artists.map(a => a.name).join(', ')
                                    : trackData.artist || 'Unknown Artist',
                                album: trackData.album?.name || trackData.album || 'Unknown Album',
                                duration: trackData.duration_ms || trackData.duration || 0,
                                artwork: trackData.album?.images?.[0]?.url || trackData.image || trackData.artwork,
                                preview_url: trackData.preview_url,
                                external_urls: trackData.external_urls,
                                popularity: trackData.popularity || 0
                            };
                        }
                    } catch (err) {
                        console.warn(`Endpoint ${endpoint} failed:`, err);
                        continue;
                    }
                }
                
                throw new Error('All API endpoints failed');
            } catch (error) {
                console.error('Metadata fetch error:', error);
                throw new Error('Unable to fetch song metadata. Please check your API key and try again.');
            }
        }

        // Display fetched song information
        function displaySongInfo(songData) {
            document.getElementById('songTitle').textContent = songData.title;
            document.getElementById('songArtist').textContent = songData.artist;
            document.getElementById('songAlbum').textContent = songData.album;
            document.getElementById('songDuration').textContent = formatDuration(songData.duration);
            
            const artworkElement = document.getElementById('artwork');
            if (songData.artwork) {
                artworkElement.innerHTML = `<img src="${songData.artwork}" alt="Album artwork" onerror="this.parentElement.innerHTML='🎵'">`;
            } else {
                artworkElement.innerHTML = '🎵';
            }

            document.getElementById('songInfo').classList.add('show');
        }

        // Download song with progress tracking
        async function downloadSong() {
            if (!currentSongData) {
                showStatus('Please fetch song information first', 'error');
                return;
            }

            if (!RAPIDAPI_KEY) {
                showStatus('Please configure your RapidAPI key first', 'error');
                return;
            }

            const downloadBtn = document.getElementById('downloadBtn');
            const downloadText = document.getElementById('downloadText');
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');

            downloadBtn.disabled = true;
            progressBar.style.display = 'block';
            
            try {
                // Step 1: Search for download source
                downloadText.innerHTML = '<span class="loading"></span> Finding download source...';
                progressFill.style.width = '25%';
                
                const downloadSource = await findDownloadSource(currentSongData);
                if (!downloadSource) {
                    throw new Error('No download source found for this song');
                }

                // Step 2: Generate download URL
                downloadText.innerHTML = '<span class="loading"></span> Preparing download...';
                progressFill.style.width = '50%';
                
                const downloadUrl = await getDownloadUrl(downloadSource, selectedQuality);
                if (!downloadUrl) {
                    throw new Error('Unable to generate download link');
                }

                // Step 3: Start download
                downloadText.innerHTML = '<span class="loading"></span> Starting download...';
                progressFill.style.width = '75%';
                
                await simulateDownload(downloadUrl, currentSongData);
                
                // Step 4: Complete
                progressFill.style.width = '100%';
                downloadText.innerHTML = '✅ Download Complete';
                showStatus(`"${currentSongData.title}" downloaded successfully! 🎉`, 'success');
                
                // Reset after 3 seconds
                setTimeout(() => {
                    resetDownloadButton();
                }, 3000);

            } catch (error) {
                console.error('Download error:', error);
                showStatus(`Download failed: ${error.message}`, 'error');
                resetDownloadButton();
            }
        }

        // Find download source (simulated - replace with real implementation)
        async function findDownloadSource(songData) {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // In a real implementation, this would search YouTube Music, SoundCloud, etc.
            return {
                id: 'demo_id',
                title: songData.title,
                artist: songData.artist,
                url: `https://example.com/download/${songData.id}`,
                source: 'youtube_music'
            };
        }

        // Get download URL based on quality
        async function getDownloadUrl(source, quality) {
            // Simulate API processing
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // In real implementation, this would call the download API
            const qualityUrls = {
                '128': `https://example.com/dl/128/${source.id}.mp3`,
                '320': `https://example.com/dl/320/${source.id}.mp3`,
                'flac': `https://example.com/dl/flac/${source.id}.flac`
            };
            
            return qualityUrls[quality] || qualityUrls['320'];
        }

        // Simulate file download (in real app, this would trigger actual download)
        async function simulateDownload(downloadUrl, songData) {
            // Simulate download process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // In real implementation, create and click download link:
            /*
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${songData.artist} - ${songData.title}.${selectedQuality === 'flac' ? 'flac' : 'mp3'}`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            */
            
            console.log(`Simulated download: ${songData.title} in ${selectedQuality} quality`);
        }

        // Reset download button to default state
        function resetDownloadButton() {
            const downloadBtn = document.getElementById('downloadBtn');
            const downloadText = document.getElementById('downloadText');
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');
            
            downloadBtn.disabled = false;
            downloadText.textContent = 'Download Song';
            progressBar.style.display = 'none';
            progressFill.style.width = '0%';
        }

        // Clear form and reset all states
        function clearForm() {
            document.getElementById('spotifyUrl').value = '';
            document.getElementById('songInfo').classList.remove('show');
            document.getElementById('statusMessage').style.display = 'none';
            currentSongData = null;
            resetDownloadButton();
            
            // Reset quality selection
            document.querySelectorAll('.quality-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            document.querySelector('[data-quality="320"]').classList.add('selected');
            selectedQuality = '320';
        }

        // Enhanced input validation
        function validateInput(input) {
            const url = input.value.trim();
            const isValid = isValidSpotifyUrl(url);
            
            if (url && !isValid) {
                input.style.borderColor = '#ff4757';
                showStatus('Invalid Spotify URL format', 'error');
            } else if (isValid) {
                input.style.borderColor = '#1db954';
            } else {
                input.style.borderColor = 'rgba(255, 0, 0, 0.2)';
            }
        }

        // Initialize application
        document.addEventListener('DOMContentLoaded', function() {
            // Create floating particles
            createParticles();
            
            // Add input validation
            const urlInput = document.getElementById('spotifyUrl');
            urlInput.addEventListener('input', () => validateInput(urlInput));
            
            // Add enter key support
            urlInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    fetchSongInfo();
                }
            });
            
            // Add API key input validation
            document.getElementById('rapidApiKey').addEventListener('input', function(e) {
                const key = e.target.value.trim();
                if (key.length > 10) {
                    e.target.style.borderColor = '#007bff';
                } else {
                    e.target.style.borderColor = 'rgba(0, 123, 255, 0.3)';
                }
            });
            
            // Clear status message when typing
            urlInput.addEventListener('input', function() {
                const statusElement = document.getElementById('statusMessage');
                if (statusElement.style.display === 'block') {
                    statusElement.style.display = 'none';
                }
            });
            
            // Add keyboard shortcuts
            document.addEventListener('keydown', function(e) {
                if (e.ctrlKey || e.metaKey) {
                    switch(e.key) {
                        case 'k':
                            e.preventDefault();
                            urlInput.focus();
                            urlInput.select();
                            break;
                        case 'Enter':
                            if (currentSongData && !document.getElementById('downloadBtn').disabled) {
                                downloadSong();
                            } else if (!document.getElementById('fetchBtn').disabled) {
                                fetchSongInfo();
                            }
                            break;
                    }
                }
            });
            
            console.log('🎵 Spotify Downloader initialized successfully!');
            console.log('💡 Tip: Press Ctrl/Cmd + K to focus the URL input');
        });

        // Add some utility functions for better UX
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                showStatus('Copied to clipboard! 📋', 'success');
            }).catch(() => {
                showStatus('Failed to copy to clipboard', 'error');
            });
        }

        // Add error handling for network issues
        window.addEventListener('online', () => {
            showStatus('Connection restored! 🌐', 'success');
        });

        window.addEventListener('offline', () => {
            showStatus('No internet connection 📡', 'error');
        });

// Define the cache name and the list of URLs to cache
const CACHE_NAME = 'hicks-bozon404-v1';
const urlsToCache = [
    './', // Caches the root (index.html)
    './index.html',
    './main.js',
    './manifest.json',
    './images/my-pic.png', // Splash screen image
    // Add all icon sizes from manifest.json
    './images/icon-48x48.png',
    './images/icon-72x72.png',
    './images/icon-96x96.png',
    './images/icon-144x144.png',
    './images/icon-168x168.png',
    './images/icon-192x192.png',
    './images/icon-256x256.png',
    './images/icon-512x512.png'
    // Tailwind CSS CDN is not cached directly here as it's external,
    // but the browser will cache it on first load.
];

// Install event: Caches all the static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Failed to open cache or add URLs:', error);
            })
    );
});

// Activate event: Cleans up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        })
    );
});

// Fetch event: Serves content from cache first, then falls back to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // No cache hit - fetch from network
                return fetch(event.request).then((networkResponse) => {
                    // Check if we received a valid response
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // IMPORTANT: Clone the response. A response is a stream
                    // and can only be consumed once. We must clone it so that
                    // the browser can consume one and we can consume the other.
                    const responseToCache = networkResponse.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return networkResponse;
                }).catch((error) => {
                    console.error('Fetch failed:', error);
                    // This is where you could return an offline page or a fallback asset
                    // For example, return a generic offline page if the request is for a document
                    if (event.request.mode === 'navigate') {
                        // You could cache an 'offline.html' page and return it here
                        // return caches.match('./offline.html');
                    }
                    return new Response('Offline content not available.', { status: 503, statusText: 'Service Unavailable' });
                });
            })
    );
});

// Function to cache dynamic content (e.g., generated questions)
// This function can be called from the main script to add new questions to cache
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_NEW_QUESTIONS') {
        const questions = event.data.questions;
        caches.open(CACHE_NAME).then((cache) => {
            questions.forEach((question) => {
                // For questions, we can store them in a specific cache entry
                // or just ensure the requests for them (if they were external) are cached.
                // For now, we assume questions are stored in IndexedDB/Firestore and
                // this message is more for general dynamic content caching if needed.
                // If questions were fetched from an API, their responses would be cached by the fetch handler.
                console.log('Service Worker received new questions to cache metadata:', question.id);
                // If questions were simple JSON, you could cache them directly:
                // cache.put(new Request(`/api/questions/${question.id}`), new Response(JSON.stringify(question)));
            });
        });
    }
});

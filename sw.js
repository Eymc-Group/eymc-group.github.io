// WorkStudy Service Worker — v3.21.83
// Offline-first: cache-then-network for all local assets, network-first for pages

const CACHE_NAME   = "workstudy-v3.21.83";
const OFFLINE_PAGE = "/offline.html";
const SCOPE        = "https://eymc-group.github.io/";

// Everything that must be cached at install time
const PRECACHE_URLS = [
    "/",
    "/index.html",
    "/offline.html",
    "/css/style.css",
    "/js/color.js",
    "/js/script.js",
    "/js/auth.js",
    "/js/online.js",
    "/js/gamelist.js",
    "/js/gamebuttons.js",
    "/js/cloudSave.js",
    "/js/github-oauth.js",
    "/js/version-check.js",
    "/js/customTab.js",
    "/js/searchbar.js",
    "/js/status.js",
    "/img/favicon.png",
    "/img/icon-72.png",
    "/img/icon-96.png",
    "/img/icon-192.png",
    "/img/icon-512.png",
    "/manifest.json",
    "/version.json",
    "/games/index.html",
    "/pages/leaderboard.html",
    "/pages/support.html",
    "/pages/updates.html",
    "/pages/mirrors.html",
    "/pages/website.html",
    "/pages/devtools.html",
    "/pages/movies.html",
    "/pages/music.html",
    "/pages/notepad.html",
    "/pages/emulator.html",
    "/pages/file-runner.html",
    "/pages/yt-emulator.html",
    "/pages/coloringboard.html",
    "/pages/shorts.html",
    "/pages/game.html",
    "/pages/leaderboard.html",
    "/pages/apps.html",
    "/pages/iframe.html",
    "/pages/soundboard.html",
    "/pages/proxy.html",
    "/pages/deviceinfo.html",
    "/pages/chat/index.html",
    "/widgets/data.json",

    // ── Locally-hosted games (offline playable) ───────────────────────────
    // Legacy games
    "/games/legacy-games/2040.html",
    "/games/legacy-games/badparenting.html",
    "/games/legacy-games/cookieclicker.html",
    "/games/legacy-games/fnae.html",
    "/games/legacy-games/gd.html",
    "/games/legacy-games/hollowknight.html",
    "/games/legacy-games/minecraft.html",
    "/games/legacy-games/retrobowl.html",
    "/games/legacy-games/run3.html",
    "/games/legacy-games/slope.html",

    // Bennett games
    "/games/bennett/BLOODMONEY!.html",
    "/games/bennett/Bendy-and-the-Ink-Machine.html",
    "/games/bennett/Bottle-Jump-3D.html",
    "/games/bennett/Bowmasters.html",
    "/games/bennett/Bridge-Race.html",
    "/games/bennett/CaseOh's-Basics-in-Eating-and-Fast-Food.html",
    "/games/bennett/Cool-Cars-Run-3D.html",
    "/games/bennett/Count-Masters-Stickman-Games.html",
    "/games/bennett/Crazy-Cars.html",
    "/games/bennett/Crossy-Road.html",
    "/games/bennett/Crush-Cars-3D.html",
    "/games/bennett/Drift-Boss.html",
    "/games/bennett/Drift-Hunters.html",
    "/games/bennett/Flappy-Bird.html",
    "/games/bennett/Layers-Roll.html",
    "/games/bennett/Madalin-Stunt-Cars-2.html",
    "/games/bennett/Make-a-SuperBoat.html",
    "/games/bennett/Makeover-Run.html",
    "/games/bennett/Sprunki.html",
    "/games/bennett/Steal-A-Brainrot.html",
    "/games/bennett/Steal-Brainrot-Online.html",
    "/games/bennett/Stone-Grass-Mowing-Simulator.html",
    "/games/bennett/Toy-Rider.html",
    "/games/bennett/Traffic-Racer.html",
    "/games/bennett/Twerk-Race-3D.html",
    "/games/bennett/WebFishing.html",

    // Imported games
    "/games/imported/Bad-Parenting-1.html",
    "/games/imported/Bad-Piggies.html",
    "/games/imported/geometrydash.html",
    "/games/imported/geo/index.html",
    "/games/imported/geo/sw.js",
];

// ── Install: precache everything ──────────────────────────────────────────
self.addEventListener("install", function (event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return Promise.allSettled(
                PRECACHE_URLS.map(function (url) {
                    return fetch(url, { cache: "reload" }).then(function (res) {
                        if (res.ok) return cache.put(url, res);
                    }).catch(function () {});
                })
            );
        })
    );
});

// ── Activate: delete old caches ───────────────────────────────────────────
self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) { return k !== CACHE_NAME; })
                    .map(function (k) { return caches.delete(k); })
            );
        }).then(function () { return self.clients.claim(); })
    );
});

// ── Fetch: smart strategy per request type ────────────────────────────────
self.addEventListener("fetch", function (event) {
    var req = event.request;
    var url = req.url;

    if (req.method !== "GET") return;

    // Skip API calls, gfiles game assets (too large to cache en-masse), external CDNs
    if (url.includes("workstudy-api.354271744.workers.dev")) return;
    if (url.includes("eymc-group.github.io/gfiles/")) return;
    if (url.includes("api.rawg.io")) return;
    if (url.includes("en.wikipedia.org/api")) return;

    // Only intercept same-origin WorkStudy assets
    if (!url.startsWith(SCOPE) && !url.startsWith("https://eymc-group.github.io")) return;

    var isHTML = req.headers.get("accept") && req.headers.get("accept").includes("text/html");

    if (isHTML) {
        // HTML pages: network-first, fall back to cache, then offline page
        event.respondWith(
            fetch(req).then(function (res) {
                if (res.ok) {
                    var clone = res.clone();
                    caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
                }
                return res;
            }).catch(function () {
                return caches.match(req).then(function (cached) {
                    return cached || caches.match(OFFLINE_PAGE);
                });
            })
        );
        return;
    }

    // JS/CSS/images/fonts: cache-first (fast), revalidate in background
    event.respondWith(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.match(req).then(function (cached) {
                var fetchPromise = fetch(req).then(function (res) {
                    if (res.ok) cache.put(req, res.clone());
                    return res;
                }).catch(function () { return cached || new Response("", { status: 503 }); });
                // Return cached immediately, update in background
                return cached || fetchPromise;
            });
        })
    );
});

// ── Background Sync ───────────────────────────────────────────────────────
self.addEventListener("sync", function (event) {
    if (event.tag === "sync-scores") {
        event.waitUntil(syncPendingScores());
    }
});

// ── Periodic Background Sync ──────────────────────────────────────────────
self.addEventListener("periodicsync", function (event) {
    if (event.tag === "refresh-leaderboard") event.waitUntil(refreshLeaderboardCache());
    if (event.tag === "check-updates")       event.waitUntil(checkForUpdates());
});

async function refreshLeaderboardCache() {
    try {
        const res = await fetch("https://workstudy-api.354271744.workers.dev/leaderboard", { cache: "no-store" });
        if (res.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("/pages/leaderboard.html",
                await fetch("/pages/leaderboard.html"));
        }
    } catch (e) {}
}

async function checkForUpdates() {
    try {
        const res  = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const cache  = await caches.open(CACHE_NAME);
        const cached = await cache.match("/version.json");
        if (cached) {
            const old = await cached.json();
            if (old.version !== data.version) await notifyClients({ type: "UPDATE_AVAILABLE", version: data.version });
        }
        await cache.put("/version.json",
            new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } }));
    } catch (e) {}
}

// ── Push Notifications ────────────────────────────────────────────────────
self.addEventListener("push", function (event) {
    let payload = { title: "WorkStudy", body: "Something new is waiting!", icon: "/img/icon-192.png", badge: "/img/icon-96.png", url: "/" };
    if (event.data) {
        try { Object.assign(payload, event.data.json()); } catch (e) { payload.body = event.data.text(); }
    }
    event.waitUntil(self.registration.showNotification(payload.title, {
        body: payload.body, icon: payload.icon, badge: payload.badge,
        tag: "workstudy-push", renotify: true,
        data: { url: payload.url },
        actions: [{ action: "open", title: "Open WorkStudy" }, { action: "dismiss", title: "Dismiss" }]
    }));
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    if (event.action === "dismiss") return;
    const target = (event.notification.data && event.notification.data.url) || "/";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
            for (const client of clients) {
                if (client.url.includes("/") && "focus" in client) {
                    client.navigate(target); return client.focus();
                }
            }
            return self.clients.openWindow(target);
        })
    );
});

// ── Widget Support ────────────────────────────────────────────────────────
self.addEventListener("widgetinstall", function (e) { e.waitUntil(updateWidget(e.widget)); });
self.addEventListener("widgetresume",  function (e) { e.waitUntil(updateWidget(e.widget)); });

async function updateWidget(widget) {
    try {
        const res  = await fetch("/widgets/data.json", { cache: "no-store" });
        const data = await res.json();
        await self.widgets.updateByTag(widget.definition.tag, { data: JSON.stringify(data) });
    } catch (e) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────
async function notifyClients(msg) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(function (c) { c.postMessage(msg); });
}

async function syncPendingScores() {
    try {
        const db    = await openSyncDB();
        const items = await getAllPending(db);
        await Promise.allSettled(items.map(function (item) {
            return fetch(item.url, { method: item.method, headers: item.headers, body: item.body })
                .then(function (res) { if (res.ok) return removePending(db, item.id); });
        }));
    } catch (e) {}
}

function openSyncDB() {
    return new Promise(function (resolve, reject) {
        const req = indexedDB.open("workstudy-sync", 1);
        req.onupgradeneeded = function (e) {
            e.target.result.createObjectStore("pending", { keyPath: "id", autoIncrement: true });
        };
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror   = reject;
    });
}
function getAllPending(db) {
    return new Promise(function (resolve, reject) {
        const req = db.transaction("pending", "readonly").objectStore("pending").getAll();
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror   = reject;
    });
}
function removePending(db, id) {
    return new Promise(function (resolve, reject) {
        const req = db.transaction("pending", "readwrite").objectStore("pending").delete(id);
        req.onsuccess = resolve; req.onerror = reject;
    });
}

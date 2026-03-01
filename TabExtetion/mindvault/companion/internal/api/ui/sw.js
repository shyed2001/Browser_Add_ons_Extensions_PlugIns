/**
 * @file sw.js — MindVault PWA Service Worker
 * @module ServiceWorker
 * ┌──────────────────────────────────────────────────────────┐
 * │ Section         │ Description                            │
 * ├──────────────────────────────────────────────────────────┤
 * │ Config          │ Cache name + asset list                │
 * │ install         │ Pre-cache all UI assets                │
 * │ activate        │ Purge old caches, claim clients        │
 * │ fetch           │ Cache-first (UI) / network-first (API) │
 * └──────────────────────────────────────────────────────────┘
 *
 * @why    Offline support + PWA installability requirement.
 * @what   Intercepts fetches; serves UI from cache when offline.
 * @how    Cache-first for /ui/* assets; network-first for REST API calls.
 * @where  Registered from /ui/index.html; scope = /ui/
 * @when   Registered on first load; updated when CACHE_NAME changes.
 *
 * Cache strategy:
 *   /ui/*  → Cache-first (static shell — rarely changes)
 *   API    → Network-first, stale-while-fallback (live data)
 *
 * Version bump → change CACHE_NAME → old cache auto-deleted on activate.
 *
 * Execution flow:
 *   1. Browser registers SW at /ui/sw.js
 *   2. 'install' fires  → open cache, addAll(PRECACHE_URLS), skipWaiting
 *   3. 'activate' fires → delete old caches, clients.claim()
 *   4. Each fetch fires → route by URL path → cache-first or network-first
 */

'use strict';

// ── Config ────────────────────────────────────────────────────────────────────

/** @const {string} Cache storage key. Bump version to invalidate all cached assets.
 *  v4 — bumped 2026-02-28 to bust stale v1 cache after v4.1/v4.2 UI rewrites. */
const CACHE_NAME = 'mv-ui-v4';

/**
 * @const {string[]} PRECACHE_URLS
 * UI shell assets pre-cached on install so the dashboard works fully offline.
 * Add new static assets here when they are created.
 */
const PRECACHE_URLS = [
  '/ui/',            // index.html (served as directory index)
  '/ui/style.css',   // dark-theme stylesheet
  '/ui/app.js',      // SPA logic (~500 lines)
  '/ui/manifest.json', // PWA manifest
  '/ui/icon.svg',    // App icon (SVG — Chrome 111+, Firefox, Edge)
];

// ── Install ───────────────────────────────────────────────────────────────────

/**
 * @event install
 * Fires once when the SW is first registered (or when CACHE_NAME changes).
 * Opens the cache and pre-fetches all UI shell assets.
 * skipWaiting() makes the new SW take over immediately without waiting for
 * all tabs using the old SW to close.
 *
 * @param {ExtendableEvent} e
 */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)          // Open (or create) our named cache
      .then((cache) => cache.addAll(PRECACHE_URLS))  // Fetch + cache all assets
      .then(() => self.skipWaiting()) // Activate immediately — don't wait
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

/**
 * @event activate
 * Fires after install, once the SW is in control.
 * Deletes any caches whose name != CACHE_NAME (i.e. old versions).
 * clients.claim() makes this SW control all open pages without reload.
 *
 * @param {ExtendableEvent} e
 */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME) // Keep only current cache
            .map((k) => caches.delete(k))    // Delete all others
        )
      )
      .then(() => self.clients.claim()) // Take control of all open clients
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * @event fetch
 * Intercepts every network request made by pages in this SW's scope (/ui/).
 *
 * Routing logic:
 *   - /ui/* path   → cache-first: return cached asset; fetch + cache if miss
 *   - API / other  → network-first: try network; fall back to stale cache
 *
 * @param {FetchEvent} e — contains e.request (the intercepted Request object)
 *
 * Data flow:
 *   Request → [SW] → cache hit? → return cached Response
 *                  → cache miss → fetch(network) → cache clone → return Response
 */
self.addEventListener('fetch', (e) => {
  // Only handle GET requests — pass through POST/DELETE (API mutations)
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/ui/')) {
    // ── Cache-first for UI shell assets ──────────────────────────────────────
    // Rationale: UI assets change only on companion rebuild; cache is warm.
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached; // Cache hit — return immediately (offline safe)

        // Cache miss — fetch from network, then cache the response
        return fetch(e.request).then((res) => {
          const clone = res.clone(); // Response body can only be consumed once
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          return res;
        });
      })
    );
  } else {
    // ── Network-first for REST API calls ─────────────────────────────────────
    // Rationale: API data is live; stale cache is only a fallback when offline.
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match(e.request)) // Offline fallback: stale API response
    );
  }
});

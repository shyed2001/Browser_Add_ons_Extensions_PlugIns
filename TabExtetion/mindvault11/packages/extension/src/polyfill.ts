/**
 * Browser API polyfill — Phase 2 Step 13
 *
 * Imports webextension-polyfill to make the `browser` namespace available and
 * promise-based on both Chrome (MV3) and Firefox (MV2).
 *
 * Import this file FIRST in every extension entry point:
 *   import './polyfill';   // background/index.ts, popup/index.ts, dashboard/index.ts
 *
 * Usage after importing:
 *   import browser from 'webextension-polyfill';
 *   const tabs = await browser.tabs.query({ active: true });  // works on Chrome + Firefox
 *
 * Existing chrome.* calls continue to work on Chrome. Over time they can be
 * migrated to browser.* for cross-browser compatibility.
 */
import 'webextension-polyfill';

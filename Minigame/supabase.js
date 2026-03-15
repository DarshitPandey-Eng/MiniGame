/**
 * ARCADE ZONE — Supabase Sync Layer
 * ─────────────────────────────────
 * • Local-first: reads always come from localStorage (instant)
 * • Every save() also syncs to Supabase in the background
 * • On first load, Supabase data is fetched and merged if newer
 * • One table, one row per anonymous user (UUID stored in localStorage)
 * • Works offline — Supabase errors are silently ignored
 *
 * TABLE SCHEMA (run this in Supabase SQL editor):
 * ─────────────────────────────────────────────
 *   create table player_data (
 *     user_id  text primary key,
 *     data     jsonb not null default '{}',
 *     updated_at timestamptz default now()
 *   );
 *
 *   -- Allow public anonymous access (no auth needed):
 *   alter table player_data enable row level security;
 *   create policy "anon read own" on player_data
 *     for select using (true);
 *   create policy "anon upsert own" on player_data
 *     for insert with check (true);
 *   create policy "anon update own" on player_data
 *     for update using (true);
 * ─────────────────────────────────────────────
 */

window.ArcadeDB = (function () {
  'use strict';

  /* ══════ CONFIG — fill these in ══════ */
  var SUPABASE_URL  = 'https://rcyxjalllqatqddeztvv.supabase.co';
  var SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjeXhqYWxsbHFhdHFkZGV6dHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NzE4MzMsImV4cCI6MjA4ODQ0NzgzM30.eY6Dck0unEBS8W4lSbojAtu5zNkOtYsaBBATe3hSV3Q';
  var TABLE         = 'player_data';

  /* Expose for mp.js multiplayer engine */
  window._AZ_SB_URL = SUPABASE_URL;
  window._AZ_SB_KEY = SUPABASE_KEY;
  /* ═════════════════════════════════════ */

  var configured = (
    SUPABASE_URL  !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_KEY  !== 'YOUR_SUPABASE_ANON_KEY'
  );

  /* ── Anonymous user ID (persisted in localStorage) ── */
  var UID_KEY = 'az_uid';
  function getUserId() {
    var uid = localStorage.getItem(UID_KEY);
    if (!uid) {
      uid = 'az_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      localStorage.setItem(UID_KEY, uid);
    }
    return uid;
  }

  /* ── REST helpers ── */
  var BASE = SUPABASE_URL + '/rest/v1/' + TABLE;
  var HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };

  function apiFetch(method, body) {
    if (!configured) return Promise.resolve(null);
    return fetch(BASE + '?user_id=eq.' + encodeURIComponent(getUserId()), {
      method: method,
      headers: HEADERS,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      /* Silently ignore 404/400 — table may not exist yet */
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok) return null;
      return r.text().then(function (t) {
        try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
      });
    }).catch(function () { return null; });
  }

  function apiUpsert(data) {
    if (!configured) return Promise.resolve(null);
    return fetch(SUPABASE_URL + '/rest/v1/' + TABLE, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ user_id: getUserId(), data: data, updated_at: new Date().toISOString() })
    }).then(function(r) { return null; }).catch(function () { return null; });
  }

  /* ── Sync debounce — batch rapid saves into one network call ── */
  var syncTimer = null;
  var SYNC_DELAY = 1200; // ms

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(pushToCloud, SYNC_DELAY);
  }

  function pushToCloud() {
    if (!configured) return;
    var snapshot = getAllLocal();
    apiUpsert(snapshot);
  }

  /* ── Read all localStorage keys that belong to the game ── */
  var GAME_KEYS = [
    'az_coins', 'az_stats', 'az_challenges', 'az_history',
    'az_xp', 'az_streak', 'az_quests', 'az_achieve',
    'az_powerup', 'az_spin', 'az_daily', 'az_theme', 'az_sound'
  ];

  function getAllLocal() {
    var out = {};
    GAME_KEYS.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v !== null) out[k] = v; // store as raw strings (JSON.stringify'd)
    });
    return out;
  }

  function applyCloudData(cloudData) {
    if (!cloudData || typeof cloudData !== 'object') return;
    GAME_KEYS.forEach(function (k) {
      if (cloudData[k] !== undefined && cloudData[k] !== null) {
        /* Only overwrite if cloud has data and local is missing */
        var local = localStorage.getItem(k);
        if (local === null) {
          localStorage.setItem(k, cloudData[k]);
        } else {
          /* For numeric balance, take the higher value */
          if (k === 'az_coins') {
            var cloudVal = parseInt(cloudData[k], 10);
            var localVal = parseInt(local, 10);
            if (!isNaN(cloudVal) && cloudVal > (isNaN(localVal) ? 0 : localVal)) {
              localStorage.setItem(k, cloudData[k]);
            }
          } else {
            /* For everything else: merge by taking cloud if local seems default/empty */
            try {
              var localParsed = JSON.parse(local);
              var cloudParsed = JSON.parse(cloudData[k]);
              /* If local is empty object {} or empty array [], prefer cloud */
              if (
                (Array.isArray(localParsed) && localParsed.length === 0 && Array.isArray(cloudParsed) && cloudParsed.length > 0) ||
                (!Array.isArray(localParsed) && typeof localParsed === 'object' && Object.keys(localParsed).length === 0 && typeof cloudParsed === 'object' && Object.keys(cloudParsed).length > 0)
              ) {
                localStorage.setItem(k, cloudData[k]);
              }
            } catch (e) { /* ignore parse errors */ }
          }
        }
      }
    });
  }

  /* ── Bootstrap: fetch cloud data on page load ── */
  function init() {
    if (!configured) {
      console.warn('[ArcadeDB] Supabase not configured. Running locally only.');
      return;
    }
    apiFetch('GET').then(function (rows) {
      if (!rows || !rows.length) return;
      var row = rows[0];
      if (row && row.data) {
        applyCloudData(row.data);
        /* Re-fire balance event so UI picks up the synced balance */
        var bal = parseInt(localStorage.getItem('az_coins'), 10);
        if (!isNaN(bal)) {
          try { document.dispatchEvent(new CustomEvent('az:balance', { detail: bal })); } catch (e) {}
        }
      }
    });
  }

  /* ── Public API ── */
  /* Call this whenever you want to trigger a cloud save */
  function sync() {
    scheduleSync();
  }

  /* Call this to immediately push (e.g. on game over) */
  function pushNow() {
    clearTimeout(syncTimer);
    pushToCloud();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    getUserId: getUserId,
    sync: sync,
    pushNow: pushNow,
    configured: function () { return configured; }
  };
})();

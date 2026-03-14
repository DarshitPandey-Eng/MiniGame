/**
 * AZMulti — Arcade Zone Multiplayer Engine
 * ══════════════════════════════════════════
 *
 * Features:
 *  · Seeded RNG — deterministic puzzles for challenge links
 *  · Challenge links — play same puzzle, compare scores
 *  · Rooms — create/join 4-char codes, REST poll every 1.5s
 *  · Leaderboard — global high scores via Supabase
 *
 * ── SUPABASE SETUP ──────────────────────────────────────────────
 * Run this SQL in your Supabase SQL editor:
 *
 *   create table az_rooms (
 *     code        text primary key,
 *     game        text not null,
 *     seed        text not null,
 *     difficulty  text default 'medium',
 *     status      text default 'waiting',
 *     p1_id       text, p1_name text,
 *     p1_score    int  default 0, p1_done bool default false,
 *     p2_id       text, p2_name text,
 *     p2_score    int  default 0, p2_done bool default false,
 *     created_at  timestamptz default now()
 *   );
 *
 *   create table az_scores (
 *     id          uuid primary key default gen_random_uuid(),
 *     game        text not null,
 *     player_id   text not null,
 *     player_name text not null,
 *     score       int  not null,
 *     meta        jsonb default '{}',
 *     created_at  timestamptz default now()
 *   );
 *
 *   -- Allow anonymous public access:
 *   alter table az_rooms  enable row level security;
 *   alter table az_scores enable row level security;
 *   create policy "az_rooms_all"  on az_rooms  for all using (true) with check (true);
 *   create policy "az_scores_all" on az_scores for all using (true) with check (true);
 *
 * ────────────────────────────────────────────────────────────────
 * Once you have your anon key, paste SUPABASE_URL and SUPABASE_KEY
 * into supabase.js — this file reads them automatically.
 */

window.AZMulti = (function () {
  'use strict';

  /* ══ Read config from ArcadeDB (supabase.js) ══════════════════ */
  var _cfg = (function () {
    // Extract from supabase.js source via a script scan trick
    var scripts = document.querySelectorAll('script[src*="supabase"]');
    // We expose URL/KEY via window globals set in supabase.js
    var url = window._AZ_SB_URL || '';
    var key = window._AZ_SB_KEY || '';
    return { url: url, key: key, ok: url.length > 10 && key.length > 10 };
  })();

  var BASE_ROOMS  = _cfg.url + '/rest/v1/az_rooms';
  var BASE_SCORES = _cfg.url + '/rest/v1/az_scores';
  var HEADERS = {
    'Content-Type': 'application/json',
    'apikey': _cfg.key,
    'Authorization': 'Bearer ' + _cfg.key
  };
  /* PostgREST Prefer headers — set per-request type */
  var HEADERS_INSERT = Object.assign({}, HEADERS, { 'Prefer': 'return=representation' });
  var HEADERS_PATCH  = Object.assign({}, HEADERS, { 'Prefer': 'return=minimal' });
  var HEADERS_GET    = HEADERS;

  function isConfigured() { return _cfg.ok; }

  /* ══ Anonymous player ID ══════════════════════════════════════ */
  var _PID_KEY = 'az_mp_pid';
  function getMyId() {
    var id = localStorage.getItem(_PID_KEY);
    if (!id) {
      id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      localStorage.setItem(_PID_KEY, id);
    }
    return id;
  }

  /* ══ Seeded RNG ══════════════════════════════════════════════════
     XorShift32 — fast, reproducible, passes basic randomness tests.
     seededRng(str) → function() that returns [0,1)
  ════════════════════════════════════════════════════════════════ */
  function strHash(s) {
    var h = 0x9e3779b9;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x9e3779b9);
      h = (h >>> 16) ^ h;
    }
    return h >>> 0 || 1;
  }

  function seededRng(seedStr) {
    var s = strHash(String(seedStr));
    return function () {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      s = s >>> 0;
      return s / 4294967296;
    };
  }

  /* Seeded shuffle using our RNG */
  function seededShuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Generate a random seed string (8 chars) */
  function makeSeed() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  /* ══ URL helpers ══════════════════════════════════════════════ */
  function parseParams() {
    var p = new URLSearchParams(window.location.search);
    return {
      seed:    p.get('seed')    || null,
      cscore:  p.get('cscore')  ? parseInt(p.get('cscore')) : null,
      cname:   p.get('cname')   || null,
      room:    p.get('room')    || null,
      pid:     p.get('pid')     ? parseInt(p.get('pid')) : null,
      pname:   p.get('pname')   || null,
      diff:    p.get('diff')    || null,
    };
  }

  function isChallengeMode()  { var p = parseParams(); return !!p.seed && !p.room; }
  function isBattleMode()     { var p = parseParams(); return !!p.room; }

  function buildChallengeLink(game, seed, score, name, diff) {
    var base = window.location.origin + '/' + game + '.html';
    var params = '?seed=' + encodeURIComponent(seed)
      + '&cscore=' + score
      + '&cname='  + encodeURIComponent(name || 'Challenger')
      + (diff ? '&diff=' + diff : '');
    return base + params;
  }

  /* ══ REST helpers ══════════════════════════════════════════════ */
  function rest(method, url, body) {
    if (!isConfigured()) return Promise.reject(new Error('not_configured'));
    var hdrs = method === 'POST'  ? HEADERS_INSERT
              : method === 'PATCH' ? HEADERS_PATCH
              : HEADERS_GET;
    return fetch(url, {
      method: method,
      headers: hdrs,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var parsed = null;
        try { parsed = t ? JSON.parse(t) : null; } catch (_) {}
        if (!r.ok) {
          var msg = (parsed && (parsed.message || parsed.hint || parsed.details))
                    || ('HTTP ' + r.status);
          return Promise.reject(new Error(msg));
        }
        return parsed;
      });
    });
  }

  /* ══ Rooms API ════════════════════════════════════════════════ */

  function createRoom(game, seed, diff, myName) {
    var code = (Math.random().toString(36).slice(2, 6)).toUpperCase();
    var myId = getMyId();
    var body = {
      code: code, game: game, seed: seed,
      difficulty: diff || 'medium', status: 'waiting',
      p1_id: myId, p1_name: myName || 'Player 1',
      p1_score: 0, p1_done: false,
      p2_score: 0, p2_done: false
    };
    return rest('POST', BASE_ROOMS, body).then(function (result) {
      /* Verify the row was actually inserted — result should be the new row */
      if (!result) return Promise.reject(new Error('insert_returned_empty'));
      return code;
    });
  }

  function joinRoom(code, myName) {
    var myId = getMyId();
    return getRoom(code).then(function (room) {
      if (!room) return Promise.reject(new Error('room_not_found'));
      if (room.status === 'playing') return Promise.reject(new Error('room_full'));
      return rest('PATCH', BASE_ROOMS + '?code=eq.' + code, {
        p2_id: myId, p2_name: myName || 'Player 2', status: 'playing'
      }).then(function () { return room; });
    });
  }

  function getRoom(code) {
    return rest('GET', BASE_ROOMS + '?code=eq.' + code + '&select=*', null)
      .then(function (rows) { return (rows && rows[0]) || null; });
  }

  function updateMyScore(code, pid, score, done) {
    var patch = {};
    if (pid === 1) { patch.p1_score = score; if (done) patch.p1_done = true; }
    else           { patch.p2_score = score; if (done) patch.p2_done = true; }
    return rest('PATCH', BASE_ROOMS + '?code=eq.' + code, patch);
  }

  /* Poll room every 1.5s, call cb(room) on every update */
  function pollRoom(code, cb) {
    var last = '';
    var handle = setInterval(function () {
      getRoom(code).then(function (room) {
        if (!room) return;
        var sig = JSON.stringify(room);
        if (sig !== last) { last = sig; cb(room); }
      }).catch(function () {});
    }, 1500);
    return function () { clearInterval(handle); };
  }

  /* ══ Leaderboard ══════════════════════════════════════════════ */

  function submitScore(game, score, name, meta) {
    if (!isConfigured()) {
      /* Store locally for offline leaderboard */
      try {
        var key = 'az_lb_' + game;
        var arr = JSON.parse(localStorage.getItem(key) || '[]');
        arr.push({ player_name: name || 'You', score: score, meta: meta || {}, created_at: new Date().toISOString() });
        arr.sort(function (a, b) { return b.score - a.score; });
        arr = arr.slice(0, 100);
        localStorage.setItem(key, JSON.stringify(arr));
      } catch (_) {}
      return Promise.resolve();
    }
    return rest('POST', BASE_SCORES, {
      game: game, player_id: getMyId(),
      player_name: name || 'Anonymous', score: score,
      meta: meta || {}
    });
  }

  function getLeaderboard(game, limit) {
    if (!isConfigured()) {
      /* Read locally */
      try {
        var arr = JSON.parse(localStorage.getItem('az_lb_' + game) || '[]');
        return Promise.resolve(arr.slice(0, limit || 20));
      } catch (_) { return Promise.resolve([]); }
    }
    var url = BASE_SCORES
      + '?game=eq.' + encodeURIComponent(game)
      + '&order=score.desc'
      + '&limit=' + (limit || 20)
      + '&select=player_name,score,meta,created_at';
    return rest('GET', url, null).then(function (rows) { return rows || []; });
  }

  /* Get all-games top scores for leaderboard.html */
  function getAllLeaderboard(limit) {
    if (!isConfigured()) {
      var games = ['tetris','flappy','speedmath','wordguess','sudoku','2048','minesweeper','memory','breakout','connect4','mole','reaction','simon','tictactoe'];
      var all = [];
      games.forEach(function (g) {
        try {
          var arr = JSON.parse(localStorage.getItem('az_lb_' + g) || '[]');
          arr.forEach(function (r) { all.push(Object.assign({game:g},r)); });
        } catch (_) {}
      });
      all.sort(function (a,b) { return b.score - a.score; });
      return Promise.resolve(all.slice(0, limit || 50));
    }
    var url = BASE_SCORES
      + '?order=score.desc&limit=' + (limit || 50)
      + '&select=game,player_name,score,meta,created_at';
    return rest('GET', url, null).then(function (rows) { return rows || []; });
  }

  /* ══ Public API ════════════════════════════════════════════════ */
  /* Test that the az_rooms table exists — call this on battle page load */
  function testConnection() {
    return rest('GET', BASE_ROOMS + '?limit=1&select=code', null)
      .then(function () { return { ok: true }; })
      .catch(function (err) { return { ok: false, error: err.message }; });
  }

  function setRoomStatus(code, status) {
    return rest('PATCH', BASE_ROOMS + '?code=eq.' + code, { status: status });
  }

  return {
    /* Config */
    isConfigured:   isConfigured,
    /* Player */
    getMyId:        getMyId,
    /* RNG */
    seededRng:      seededRng,
    seededShuffle:  seededShuffle,
    makeSeed:       makeSeed,
    /* URL params */
    parseParams:    parseParams,
    isChallengeMode: isChallengeMode,
    isBattleMode:   isBattleMode,
    buildChallengeLink: buildChallengeLink,
    /* Rooms */
    createRoom:     createRoom,
    joinRoom:       joinRoom,
    getRoom:        getRoom,
    updateMyScore:  updateMyScore,
    testConnection: testConnection,
    setRoomStatus:  setRoomStatus,
    pollRoom:       pollRoom,
    /* Leaderboard */
    submitScore:    submitScore,
    getLeaderboard: getLeaderboard,
    getAllLeaderboard: getAllLeaderboard,
  };
})();

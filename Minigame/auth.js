/**
 * AZAuth — Arcade Zone Authentication Engine
 * ═══════════════════════════════════════════
 * Uses Supabase Auth REST API directly (no SDK needed).
 * Supports: Email/Password signup+login, Google OAuth, Anonymous session.
 *
 * ── SUPABASE SETUP (one-time) ───────────────────────────────────
 * 1. Dashboard → Authentication → URL Configuration
 *    Site URL:         https://YOUR_VERCEL_URL.vercel.app
 *    Redirect URLs:    https://YOUR_VERCEL_URL.vercel.app/login.html
 *
 * 2. Dashboard → Authentication → Providers → Google
 *    Enable Google, paste your Google OAuth Client ID + Secret
 *    (Get these from console.cloud.google.com → APIs → Credentials)
 *
 * ── EVENTS ────────────────────────────────────────────────────────
 *  document fires 'az:auth'  when session changes → { detail: user|null }
 *  document fires 'az:logout' when signed out
 * ─────────────────────────────────────────────────────────────────
 */

window.AZAuth = (function () {
  'use strict';

  var SB_URL  = window._AZ_SB_URL || '';
  var ANON_KEY= window._AZ_SB_KEY || '';
  var SESSION_KEY = 'az_auth_session';

  /* ── Internal helpers ─────────────────────────────────────── */
  function fire(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (_) {}
  }

  function authFetch(path, method, body, token) {
    var hdrs = {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': 'Bearer ' + (token || ANON_KEY)
    };
    return fetch(SB_URL + '/auth/v1' + path, {
      method: method || 'GET',
      headers: hdrs,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var d = null;
        try { d = JSON.parse(t); } catch (_) {}
        if (!r.ok) {
          var msg = (d && (d.error_description || d.message || d.error)) || ('HTTP ' + r.status);
          return Promise.reject(new Error(msg));
        }
        return d;
      });
    });
  }

  /* ── Session storage ──────────────────────────────────────── */
  function saveSession(data) {
    try {
      if (!data || !data.access_token) { localStorage.removeItem(SESSION_KEY); return; }
      /* Normalise: Supabase returns user inside data.user or at root */
      var user = data.user || null;
      var session = {
        access_token:  data.access_token,
        refresh_token: data.refresh_token || null,
        expires_at:    data.expires_at || (Date.now()/1000 + (data.expires_in || 3600)),
        user:          user
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      /* Also persist player name for multiplayer */
      if (user && user.user_metadata && user.user_metadata.full_name) {
        localStorage.setItem('az_mp_name', user.user_metadata.full_name);
      } else if (user && user.email) {
        localStorage.setItem('az_mp_name', user.email.split('@')[0]);
      }
      /* Persist player ID for leaderboard "You" highlighting */
      if (user && user.id) {
        localStorage.setItem('az_mp_pid', user.id);
      }
    } catch (_) {}
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  /* ── Token refresh ─────────────────────────────────────────── */
  var _refreshTimer = null;
  function scheduleRefresh(session) {
    clearTimeout(_refreshTimer);
    if (!session || !session.refresh_token) return;
    var now = Date.now() / 1000;
    var expiresIn = (session.expires_at || now + 3600) - now;
    var refreshIn  = Math.max(30, expiresIn - 120); /* refresh 2 min before expiry */
    _refreshTimer = setTimeout(refreshSession, refreshIn * 1000);
  }

  function refreshSession() {
    var session = getSession();
    if (!session || !session.refresh_token) return Promise.resolve(null);
    return authFetch('/token?grant_type=refresh_token', 'POST', {
      refresh_token: session.refresh_token
    }).then(function (data) {
      saveSession(data);
      scheduleRefresh(getSession());
      return data;
    }).catch(function () {
      clearSession();
      fire('az:logout', null);
      return null;
    });
  }

  /* ── Public API ────────────────────────────────────────────── */

  function getUser() {
    var s = getSession();
    return s ? s.user : null;
  }

  function isLoggedIn() {
    var s = getSession();
    if (!s || !s.access_token) return false;
    var now = Date.now() / 1000;
    return (s.expires_at || 0) > now;
  }

  function getToken() {
    var s = getSession();
    return (s && s.access_token) ? s.access_token : ANON_KEY;
  }

  /* Auth headers — use user JWT when logged in, anon key otherwise */
  function getHeaders(extra) {
    return Object.assign({
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': 'Bearer ' + getToken()
    }, extra || {});
  }

  /* ── Email / Password ──────────────────────────────────────── */
  function signUp(email, password, displayName) {
    return authFetch('/signup', 'POST', {
      email: email,
      password: password,
      data: { full_name: displayName || email.split('@')[0] }
    }).then(function (data) {
      if (data.access_token) {
        saveSession(data);
        scheduleRefresh(getSession());
        fire('az:auth', data.user || null);
      }
      return data;
    });
  }

  function signIn(email, password) {
    return authFetch('/token?grant_type=password', 'POST', {
      email: email,
      password: password
    }).then(function (data) {
      saveSession(data);
      scheduleRefresh(getSession());
      fire('az:auth', data.user || null);
      return data;
    });
  }

  /* ── Magic Link ───────────────────────────────────────────── */
  function sendMagicLink(email) {
    var redirectTo = window.location.origin + '/login.html';
    return authFetch('/magiclink', 'POST', {
      email: email,
      options: { emailRedirectTo: redirectTo }
    });
  }

  /* ── Google OAuth ──────────────────────────────────────────── */
  function signInWithGoogle() {
    var redirectTo = window.location.origin + '/login.html';
    window.location.href = SB_URL + '/auth/v1/authorize'
      + '?provider=google'
      + '&redirect_to=' + encodeURIComponent(redirectTo);
  }

  function signInWithGithub() {
    var redirectTo = window.location.origin + '/login.html';
    window.location.href = SB_URL + '/auth/v1/authorize'
      + '?provider=github'
      + '&redirect_to=' + encodeURIComponent(redirectTo);
  }

  /* Call this on login.html load to handle OAuth redirect */
  function handleCallback() {
    /* Supabase returns tokens in URL hash: #access_token=...&refresh_token=... */
    var hash = window.location.hash;
    if (!hash) return false;
    var params = {};
    hash.slice(1).split('&').forEach(function (p) {
      var kv = p.split('=');
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    if (!params.access_token) return false;

    /* Build a session object from hash params */
    var fakeSession = {
      access_token:  params.access_token,
      refresh_token: params.refresh_token || null,
      expires_in:    parseInt(params.expires_in) || 3600,
      token_type:    params.token_type || 'bearer'
    };

    /* Fetch the full user object */
    return authFetch('/user', 'GET', null, params.access_token)
      .then(function (user) {
        fakeSession.user = user;
        fakeSession.expires_at = Date.now()/1000 + (parseInt(params.expires_in)||3600);
        saveSession(fakeSession);
        scheduleRefresh(getSession());
        fire('az:auth', user);
        /* Clean up the URL hash */
        history.replaceState(null, '', window.location.pathname + window.location.search);
        return user;
      }).catch(function () {
        /* If user fetch fails, store minimal session */
        fakeSession.expires_at = Date.now()/1000 + 3600;
        saveSession(fakeSession);
        fire('az:auth', null);
        history.replaceState(null, '', window.location.pathname);
        return null;
      });
  }

  /* ── Sign out ──────────────────────────────────────────────── */
  function signOut() {
    var session = getSession();
    clearTimeout(_refreshTimer);
    clearSession();
    fire('az:logout', null);
    /* Best-effort server-side invalidate */
    if (session && session.access_token) {
      authFetch('/logout', 'POST', null, session.access_token).catch(function () {});
    }
    return Promise.resolve();
  }

  /* ── Update profile ────────────────────────────────────────── */
  function updateProfile(updates) {
    var session = getSession();
    if (!session) return Promise.reject(new Error('not_logged_in'));
    return authFetch('/user', 'PUT', updates, session.access_token)
      .then(function (user) {
        /* Merge into stored session */
        session.user = user;
        saveSession(session);
        fire('az:auth', user);
        return user;
      });
  }

  /* ── Auto-init ────────────────────────────────────────────── */
  (function init() {
    var session = getSession();
    if (!session) return;
    var now = Date.now() / 1000;
    if (session.expires_at && session.expires_at < now) {
      /* Expired — try to refresh */
      refreshSession();
    } else {
      /* Valid — fire auth event and schedule refresh */
      scheduleRefresh(session);
      setTimeout(function () { fire('az:auth', session.user); }, 0);
    }
  })();

  return {
    isLoggedIn:      isLoggedIn,
    getUser:         getUser,
    getToken:        getToken,
    getHeaders:      getHeaders,
    signUp:          signUp,
    signIn:          signIn,
    sendMagicLink:   sendMagicLink,
    signInWithGoogle:signInWithGoogle,
    signInWithGithub:signInWithGithub,
    handleCallback:  handleCallback,
    signOut:         signOut,
    updateProfile:   updateProfile,
    refreshSession:  refreshSession,
  };
})();

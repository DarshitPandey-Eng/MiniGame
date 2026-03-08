/**
 * ARCADE ZONE — GameUI v5
 * Injects: bottom nav, XP bar, page transitions, sound button
 * Provides: showDifficultyModal(), showWinScreen(), launchConfetti()
 * KEY FIX: pageshow handler removes az-exit class on bfcache restore
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════════ */
  var _style = document.createElement('style');
  _style.textContent = [
    /* Page fade in — only on initial load, NOT on bfcache restore */
    'body:not(.az-bfcache){animation:azPageIn .22s ease-out both}',
    '@keyframes azPageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    /* Exit fade */
    'body.az-exit{animation:azPageOut .18s ease-in forwards!important}',
    '@keyframes azPageOut{to{opacity:0;transform:translateY(-4px)}}',

    /* Bottom nav */
    '.az-bnav{position:fixed;bottom:0;left:0;right:0;height:56px;',
    'background:var(--nav-bg,rgba(10,10,20,.92));backdrop-filter:blur(18px) saturate(160%);',
    'border-top:1px solid var(--line2);display:flex;align-items:stretch;',
    'z-index:300;transition:background .25s;}',
    '.az-bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;',
    'justify-content:center;gap:2px;text-decoration:none;color:var(--muted);',
    'font-family:var(--font-mono,monospace);font-size:.48rem;letter-spacing:.06em;',
    'transition:color .15s;cursor:pointer;border:none;background:none;padding:0;}',
    '.az-bnav-item .bni{font-size:1.15rem;line-height:1;}',
    '.az-bnav-item.active,.az-bnav-item:hover{color:var(--neon-a);}',
    '.az-bnav-item.active .bni{filter:drop-shadow(0 0 4px var(--neon-a));}',
    /* push page content up on mobile */
    '.page{padding-bottom:70px!important}',
    /* hide bottom nav on desktop */
    '@media(min-width:720px){.az-bnav{display:none}.page{padding-bottom:56px!important}}',

    /* XP bar strip */
    '.az-xp-strip{position:sticky;top:64px;z-index:190;height:3px;background:var(--bg2,#111);overflow:hidden;}',
    '.az-xp-bar{height:100%;background:linear-gradient(90deg,var(--neon-a),var(--neon-e));',
    'box-shadow:0 0 6px var(--neon-a);transition:width .5s ease;}',

    /* Pre-game modal */
    '.pgm-overlay{position:fixed;inset:0;background:rgba(7,7,15,.88);',
    'backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;',
    'z-index:800;padding:20px;}',
    '.pgm-card{background:var(--card-bg);border:1px solid var(--line2);border-radius:14px;',
    'padding:28px 24px;max-width:380px;width:100%;display:flex;flex-direction:column;',
    'gap:14px;text-align:center;animation:azPageIn .2s ease both;}',
    '.pgm-title{font-family:var(--font-display,serif);font-size:2rem;letter-spacing:.06em;color:var(--accent,var(--neon-a));}',
    '.pgm-diff-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}',
    '.pgm-diff-btn{font-family:var(--font-mono,monospace);font-size:.7rem;font-weight:700;',
    'padding:9px 16px;border-radius:7px;border:2px solid var(--line2);',
    'background:var(--bg2);color:var(--muted);cursor:pointer;transition:all .15s;}',
    '.pgm-diff-btn.on{border-color:var(--accent,var(--neon-a));',
    'color:var(--accent,var(--neon-a));background:color-mix(in srgb,var(--accent,var(--neon-a)) 10%,transparent);}',
    '.pgm-pu-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}',
    '.pgm-pu-btn{font-family:var(--font-mono,monospace);font-size:.65rem;font-weight:700;',
    'padding:7px 13px;border-radius:6px;border:1px solid var(--line2);',
    'background:var(--card-bg);color:var(--muted);cursor:pointer;transition:all .15s;',
    'display:flex;align-items:center;gap:5px;}',
    '.pgm-pu-btn.active{border-color:var(--neon-c);color:var(--neon-c);',
    'background:color-mix(in srgb,var(--neon-c) 10%,transparent);}',
    '.pgm-pu-btn.owned{border-color:var(--neon-d);color:var(--neon-d);}',

    /* Sound toggle */
    '.sound-btn{width:34px;height:34px;border-radius:8px;border:1px solid var(--line2);',
    'background:var(--bg2);display:flex;align-items:center;justify-content:center;',
    'font-size:.95rem;cursor:pointer;transition:all .15s;flex-shrink:0;}',
    '.sound-btn:hover{border-color:var(--neon-a);}',

    /* Device badge on game cards */
    '.device-badge{display:inline-flex;align-items:center;gap:3px;font-family:var(--font-mono,monospace);',
    'font-size:.42rem;font-weight:700;padding:2px 6px;border-radius:4px;',
    'background:color-mix(in srgb,var(--neon-a) 12%,transparent);',
    'border:1px solid color-mix(in srgb,var(--neon-a) 22%,transparent);color:var(--neon-a);}',
  ].join('');
  document.head.appendChild(_style);

  /* ══════════════════════════════════════════════
     BFCACHE FIX  ← THE MAIN BACK-BUTTON BUG FIX
     When browser restores a page from bfcache (pressing Back),
     `event.persisted` is true. We must remove az-exit so the
     page isn't invisible, and skip the fade-in animation.
  ══════════════════════════════════════════════ */
  window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
      /* Page restored from bfcache — make it immediately visible */
      document.body.classList.remove('az-exit');
      document.body.classList.add('az-bfcache');
      /* Remove az-bfcache after a tick so future navigations animate properly */
      setTimeout(function() { document.body.classList.remove('az-bfcache'); }, 100);
    }
  });

  /* ══════════════════════════════════════════════
     BOTTOM NAV
  ══════════════════════════════════════════════ */
  var NAV_ITEMS = [
    { href:'index.html',       icon:'🎮', label:'HUB'     },
    { href:'spin.html',        icon:'🎡', label:'SPIN'    },
    { href:'leaderboard.html', icon:'🏆', label:'SCORES'  },
    { href:'wallet.html',      icon:'🪙', label:'WALLET'  },
    { href:'profile.html',     icon:'👤', label:'PROFILE' },
  ];

  function _buildBottomNav() {
    var current = location.pathname.split('/').pop() || 'index.html';
    var nav = document.createElement('nav');
    nav.className = 'az-bnav';
    NAV_ITEMS.forEach(function(item) {
      var a = document.createElement('a');
      a.className = 'az-bnav-item' + (current === item.href ? ' active' : '');
      a.href = item.href;
      a.innerHTML = '<span class="bni">' + item.icon + '</span>' + item.label;
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
  }

  /* ══════════════════════════════════════════════
     XP BAR STRIP
  ══════════════════════════════════════════════ */
  function _buildXPStrip() {
    var navEl = document.getElementById('main-nav') || document.querySelector('.nav');
    if (!navEl) return;
    var strip = document.createElement('div');
    strip.className = 'az-xp-strip';
    strip.innerHTML = '<div class="az-xp-bar" style="width:0%"></div>';
    navEl.after(strip);
  }

  /* ══════════════════════════════════════════════
     SOUND BUTTON
  ══════════════════════════════════════════════ */
  function _buildSoundBtn() {
    var navEl = document.getElementById('main-nav') || document.querySelector('.nav');
    if (!navEl) return;
    var btn = document.createElement('button');
    btn.className = 'sound-btn';
    btn.title = 'Toggle sound';
    function syncIcon() { btn.textContent = CoinEngine.getSoundEnabled() ? '🔊' : '🔇'; }
    syncIcon();
    btn.addEventListener('click', function() {
      CoinEngine.toggleSound(); syncIcon();
      if (window.SoundEngine) SoundEngine.play('toggle');
    });
    navEl.appendChild(btn);
  }

  /* ══════════════════════════════════════════════
     DIFFICULTY MODAL
  ══════════════════════════════════════════════ */
  function showDifficultyModal(opts) {
    var selectedDiff = 1;
    var diffs = opts.diffs || [
      { label:'EASY',   mult:0.7, xpMult:0.8, icon:'😊' },
      { label:'NORMAL', mult:1.0, xpMult:1.0, icon:'😐' },
      { label:'HARD',   mult:1.5, xpMult:1.5, icon:'😤' },
      { label:'INSANE', mult:2.0, xpMult:2.0, icon:'💀' },
    ];

    var overlay = document.createElement('div');
    overlay.className = 'pgm-overlay';

    var diffBtns = diffs.map(function(d, i) {
      return '<button class="pgm-diff-btn' + (i === selectedDiff ? ' on' : '') + '" data-i="' + i + '">' +
        d.icon + ' ' + d.label + '<br><span style="font-size:.55rem;opacity:.7">' +
        (d.mult >= 1 ? '+' : '') + Math.round((d.mult - 1) * 100) + '% coins</span></button>';
    }).join('');

    var pus = CoinEngine.POWERUP_DEFS.map(function(p) {
      var owned = (CoinEngine.getPowerUps()[p.id] || 0) > 0;
      return '<button class="pgm-pu-btn' + (owned ? ' owned' : '') + '" data-pu="' + p.id + '">' +
        p.icon + ' ' + p.label + (owned ? ' ✓' : ' (' + p.cost + '🪙)') + '</button>';
    }).join('');

    var costLine = opts.cost > 0
      ? '<div style="font-family:var(--font-mono);font-size:.7rem;color:var(--muted)">Entry: <span style="color:var(--neon-c)">🪙 ' + opts.cost + '</span></div>'
      : '<div style="font-family:var(--font-mono);font-size:.7rem;color:var(--neon-d)">FREE TO PLAY</div>';

    overlay.innerHTML = '<div class="pgm-card">' +
      '<div class="pgm-title" style="color:' + (opts.accent || 'var(--neon-a)') + '">' + (opts.title || 'SELECT DIFFICULTY') + '</div>' +
      costLine +
      '<div style="font-family:var(--font-mono);font-size:.6rem;color:var(--muted);letter-spacing:.1em">DIFFICULTY</div>' +
      '<div class="pgm-diff-row">' + diffBtns + '</div>' +
      '<div style="font-family:var(--font-mono);font-size:.6rem;color:var(--muted);letter-spacing:.1em">POWER-UPS</div>' +
      '<div class="pgm-pu-row">' + pus + '</div>' +
      '<div class="btn-row" style="justify-content:center;margin-top:4px">' +
      '<button id="pgm-start" class="btn filled" style="--c:' + (opts.accent || 'var(--neon-a)') + ';font-size:.8rem">▶ START</button>' +
      '<button id="pgm-cancel" class="btn" style="--c:var(--muted);font-size:.8rem">CANCEL</button>' +
      '</div></div>';

    document.body.appendChild(overlay);

    overlay.querySelectorAll('.pgm-diff-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        selectedDiff = parseInt(btn.dataset.i);
        overlay.querySelectorAll('.pgm-diff-btn').forEach(function(b) { b.classList.remove('on'); });
        btn.classList.add('on');
        if (window.SoundEngine) SoundEngine.play('click');
      });
    });

    overlay.querySelectorAll('.pgm-pu-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.dataset.pu;
        if (btn.classList.contains('owned')) { btn.classList.toggle('active'); return; }
        if (CoinEngine.buyPowerUp(id)) {
          btn.classList.add('owned', 'active');
          btn.innerHTML = btn.innerHTML.replace(/\(.*\)/, '✓');
          if (window.SoundEngine) SoundEngine.play('coin');
        } else {
          CoinEngine.toast('Not enough coins!', 'warn');
        }
      });
    });

    overlay.querySelector('#pgm-start').addEventListener('click', function() {
      var diff = diffs[selectedDiff];
      var coinMult = CoinEngine.getMultiplier() * diff.mult;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (opts.onStart) opts.onStart(selectedDiff, coinMult, diff);
      if (window.SoundEngine) SoundEngine.play('start');
    });

    overlay.querySelector('#pgm-cancel').addEventListener('click', function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
  }

  /* ══════════════════════════════════════════════
     PAGE NAVIGATION WITH FADE
  ══════════════════════════════════════════════ */
  function navigate(href) {
    document.body.classList.add('az-exit');
    setTimeout(function() { location.href = href; }, 185);
  }

  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  function _init() {
    _buildBottomNav();
    _buildXPStrip();
    _buildSoundBtn();

    /* Intercept internal links for fade */
    document.addEventListener('click', function(e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
      var current = location.pathname.split('/').pop() || 'index.html';
      if (href === current) return;
      /* Don't intercept if already handled by a specific onclick */
      if (e.defaultPrevented) return;
      e.preventDefault();
      navigate(href);
    });

    /* Update XP bar */
    function _updateXP() {
      var xd = CoinEngine.getXPData ? CoinEngine.getXPData() : { xp:0, level:1 };
      var pct = ((xd.xp % 500) / 500 * 100).toFixed(1);
      document.querySelectorAll('.az-xp-bar').forEach(function(el) { el.style.width = pct + '%'; });
      document.querySelectorAll('.az-level').forEach(function(el) { el.textContent = 'Lv.' + xd.level; });
    }
    _updateXP();
    document.addEventListener('az:xp', _updateXP);
  }

  /* Coin pulse on earn */
  document.addEventListener('az:balance', function() {
    document.querySelectorAll('.coin-nav').forEach(function(el) {
      el.classList.remove('earning');
      void el.offsetWidth;
      el.classList.add('earning');
      setTimeout(function() { el.classList.remove('earning'); }, 600);
    });
  });

  /* Level up flash */
  document.addEventListener('az:xp', function(e) {
    if (!e.detail || !e.detail.levelUp) return;
    var flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;z-index:9000;pointer-events:none;' +
      'background:radial-gradient(ellipse at center,rgba(191,90,242,.22),transparent 70%);' +
      'animation:lvlFlash .7s ease both;';
    var st = document.createElement('style');
    st.textContent = '@keyframes lvlFlash{0%{opacity:0}30%{opacity:1}100%{opacity:0}}' +
      '@keyframes lvlBanner{from{opacity:0;transform:translateX(-50%) scale(.5)}' +
      '50%{opacity:1;transform:translateX(-50%) scale(1.05)}' +
      'to{opacity:0;transform:translateX(-50%) translateY(-30px) scale(.9)}}';
    document.head.appendChild(st);
    document.body.appendChild(flash);
    var banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);' +
      'z-index:9001;font-family:var(--font-display,sans-serif);font-size:clamp(1.6rem,6vw,2.8rem);' +
      'color:var(--neon-e);text-shadow:0 0 30px var(--neon-e);letter-spacing:.1em;' +
      'pointer-events:none;white-space:nowrap;animation:lvlBanner .9s cubic-bezier(.17,.67,.35,1.3) both;';
    banner.textContent = '⭐ LEVEL UP!';
    document.body.appendChild(banner);
    setTimeout(function() {
      if (flash.parentNode) flash.parentNode.removeChild(flash);
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 1000);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  window.GameUI = { showDifficultyModal: showDifficultyModal, navigate: navigate };
})();

/* ══════════════════════════════════════════════════════════════
   WIN SCREEN + CONFETTI
══════════════════════════════════════════════════════════════ */
(function(){
  var ws = document.createElement('style');
  ws.textContent = [
    '.az-win{position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;',
    'background:rgba(7,7,15,.82);backdrop-filter:blur(22px);padding:20px;}',
    '.az-win-card{background:var(--card-bg);border:2px solid var(--wc,var(--neon-c));border-radius:20px;',
    'padding:32px 28px;max-width:400px;width:100%;text-align:center;position:relative;overflow:hidden;',
    'animation:winCardIn .4s cubic-bezier(.17,.67,.35,1.3) both;}',
    '@keyframes winCardIn{from{opacity:0;transform:scale(.6) translateY(30px)}to{opacity:1;transform:none}}',
    '.az-win-card::before{content:"";position:absolute;inset:0;pointer-events:none;',
    'background:radial-gradient(ellipse 70% 50% at 50% 0%,color-mix(in srgb,var(--wc,var(--neon-c)) 18%,transparent),transparent 70%);}',
    '.az-win-icon{font-size:3.5rem;line-height:1;margin-bottom:10px;',
    'animation:winIconBounce .6s .3s cubic-bezier(.17,.67,.35,1.4) both;}',
    '@keyframes winIconBounce{from{transform:scale(0) rotate(-20deg)}to{transform:none}}',
    '.az-win-title{font-family:var(--font-display,sans-serif);font-size:clamp(1.8rem,7vw,3rem);',
    'color:var(--wc,var(--neon-c));letter-spacing:.06em;line-height:1.1;',
    'text-shadow:0 0 24px color-mix(in srgb,var(--wc,var(--neon-c)) 50%,transparent);}',
    '.az-win-score{font-family:var(--font-display,sans-serif);font-size:clamp(2.2rem,9vw,4rem);',
    'color:var(--text);letter-spacing:.04em;line-height:1;margin:8px 0 4px;}',
    '.az-win-coins{font-family:var(--font-mono,monospace);font-size:.88rem;font-weight:700;',
    'color:var(--neon-c,#ffe135);margin:6px 0 18px;}',
    '.az-win-sub{font-family:var(--font-mono,monospace);font-size:.64rem;color:var(--muted);margin-bottom:20px;line-height:1.7;}',
    '.az-win-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}',
    '.az-win-btn{font-family:var(--font-mono,monospace);font-size:.72rem;font-weight:700;',
    'padding:11px 22px;border-radius:10px;border:2px solid var(--wc,var(--neon-c));',
    'background:transparent;color:var(--wc,var(--neon-c));cursor:pointer;transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;}',
    '.az-win-btn:hover,.az-win-btn.primary{background:var(--wc,var(--neon-c));color:#000;}',
    '.az-cf{position:fixed;top:-10px;border-radius:2px;pointer-events:none;z-index:9999;',
    'animation:cfFall linear forwards;}',
    '@keyframes cfFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}',
  ].join('');
  document.head.appendChild(ws);

  function launchConfetti(count, accent) {
    count = count || 90;
    var colors = [accent||'#ffe135','#ff2d78','#00e5ff','#00e676','#bf5af2','#ff6b35','#fff'];
    for (var i = 0; i < count; i++) {
      (function(i) {
        setTimeout(function() {
          var el = document.createElement('div');
          el.className = 'az-cf';
          var size = 6 + Math.random() * 8;
          el.style.cssText = 'left:' + (5 + Math.random() * 90) + 'vw;' +
            'width:' + size + 'px;height:' + (size * .45) + 'px;' +
            'background:' + colors[Math.floor(Math.random() * colors.length)] + ';' +
            'animation-duration:' + (1.8 + Math.random() * 1.8) + 's;' +
            'animation-delay:' + (Math.random() * 0.4) + 's;';
          document.body.appendChild(el);
          setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 4000);
        }, i * 12);
      })(i);
    }
  }

  function showWinScreen(opts) {
    opts = opts || {};
    var accent = opts.accent || 'var(--neon-c)';
    var isWin = opts.win !== false;
    var old = document.getElementById('az-win-overlay');
    if (old) old.parentNode.removeChild(old);

    var overlay = document.createElement('div');
    overlay.className = 'az-win';
    overlay.id = 'az-win-overlay';

    var scoreHTML = (opts.score !== undefined)
      ? '<div class="az-win-score">' + (typeof opts.score === 'number' ? opts.score.toLocaleString() : opts.score) + '</div>' +
        '<div style="font-family:var(--font-mono);font-size:.52rem;color:var(--muted);letter-spacing:.12em;margin-bottom:2px">SCORE</div>'
      : '';

    overlay.innerHTML = '<div class="az-win-card" style="--wc:' + accent + '">' +
      '<div class="az-win-icon">' + (opts.icon || (isWin ? '🏆' : '💀')) + '</div>' +
      '<div class="az-win-title">' + (opts.title || (isWin ? 'YOU WIN!' : 'GAME OVER')) + '</div>' +
      scoreHTML +
      (opts.coins > 0 ? '<div class="az-win-coins">+' + opts.coins + ' 🪙 earned</div>' : '') +
      '<div class="az-win-sub">' + (opts.subtitle || '') + '</div>' +
      '<div class="az-win-btns">' +
      (opts.onReplay ? '<button class="az-win-btn primary" id="az-win-replay">▶ PLAY AGAIN</button>' : '') +
      '<a class="az-win-btn" href="index.html">🏠 Hub</a>' +
      '</div></div>';

    document.body.appendChild(overlay);

    if (opts.onReplay) {
      overlay.querySelector('#az-win-replay').addEventListener('click', function() {
        overlay.parentNode.removeChild(overlay);
        opts.onReplay();
      });
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });

    if (isWin) launchConfetti(100, accent);
  }

  window.GameUI = window.GameUI || {};
  window.GameUI.showWinScreen = showWinScreen;
  window.GameUI.launchConfetti = launchConfetti;
})();

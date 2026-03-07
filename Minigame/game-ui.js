/**
 * ARCADE ZONE — GameUI
 * Injects: bottom nav bar, XP bar strip, page transitions, sound button
 * Provides: showDifficultyModal(), showPowerUpModal()
 * Requires coins.js + sound.js loaded first.
 */
(function () {
  'use strict';

  /* ═══════════════════════════════
     PAGE FADE TRANSITION
  ═══════════════════════════════ */
  var _style = document.createElement('style');
  _style.textContent = [
    /* Page fade in */
    'body{animation:azPageIn .22s ease-out both}',
    '@keyframes azPageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
    /* Exit fade */
    'body.az-exit{animation:azPageOut .18s ease-in forwards!important}',
    '@keyframes azPageOut{to{opacity:0;transform:translateY(-4px)}}',

    /* Bottom nav */
    '.az-bnav{position:fixed;bottom:0;left:0;right:0;height:56px;',
    'background:var(--nav-bg);backdrop-filter:blur(18px) saturate(160%);',
    'border-top:1px solid var(--line2);display:flex;align-items:stretch;',
    'z-index:300;transition:background .25s;}',
    '.az-bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;',
    'justify-content:center;gap:2px;text-decoration:none;color:var(--muted);',
    'font-family:var(--font-mono,monospace);font-size:.5rem;letter-spacing:.06em;',
    'transition:color .15s;cursor:pointer;border:none;background:none;padding:0;}',
    '.az-bnav-item .bni{font-size:1.15rem;line-height:1;}',
    '.az-bnav-item.active,.az-bnav-item:hover{color:var(--neon-a);}',
    '.az-bnav-item.active .bni{filter:drop-shadow(0 0 4px var(--neon-a));}',
    /* push page content up */
    '.page{padding-bottom:70px!important}',
    /* hide bottom nav on desktop */
    '@media(min-width:720px){.az-bnav{display:none}.page{padding-bottom:56px!important}}',

    /* XP bar strip */
    '.az-xp-strip{position:sticky;top:64px;z-index:190;height:3px;',
    'background:var(--bg2);overflow:hidden;transition:background .25s;}',
    '.az-xp-bar{height:100%;background:linear-gradient(90deg,var(--neon-a),var(--neon-e));',
    'box-shadow:0 0 6px var(--neon-a);transition:width .5s ease;}',

    /* Pre-game modal */
    '.pgm-overlay{position:fixed;inset:0;background:rgba(7,7,15,.88);',
    'backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;',
    'z-index:800;padding:20px;animation:azPageIn .2s ease both;}',
    '.pgm-card{background:var(--card-bg);border:1px solid var(--line2);border-radius:14px;',
    'padding:28px 24px;max-width:380px;width:100%;display:flex;flex-direction:column;',
    'gap:16px;text-align:center;}',
    '.pgm-title{font-family:var(--font-display,serif);font-size:2rem;letter-spacing:.06em;',
    'color:var(--accent,var(--neon-a));}',
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

    /* Sound toggle in nav */
    '.sound-btn{width:34px;height:34px;border-radius:8px;border:1px solid var(--line2);',
    'background:var(--bg2);display:flex;align-items:center;justify-content:center;',
    'font-size:.95rem;cursor:pointer;transition:all .15s;flex-shrink:0;}',
    '.sound-btn:hover{border-color:var(--neon-a);}',
  ].join('');
  document.head.appendChild(_style);

  /* ═══════════════════════════════
     BOTTOM NAV
  ═══════════════════════════════ */
  var NAV_ITEMS = [
    { href:'index.html',      icon:'🎮', label:'HUB'       },
    { href:'spin.html',       icon:'🎡', label:'SPIN'      },
    { href:'casino.html',     icon:'🎰', label:'CASINO'    },
    { href:'quests.html',     icon:'📋', label:'QUESTS'    },
    { href:'wallet.html',     icon:'🪙', label:'WALLET'    },
    { href:'profile.html',    icon:'👤', label:'PROFILE'   },
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
      a.addEventListener('click', function(e) {
        if (a.href && !a.href.endsWith(current)) {
          e.preventDefault();
          document.body.classList.add('az-exit');
          setTimeout(function() { location.href = a.href; }, 180);
        }
      });
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
  }

  /* ═══════════════════════════════
     XP BAR STRIP (below main nav)
  ═══════════════════════════════ */
  function _buildXPStrip() {
    var nav = document.getElementById('main-nav') || document.querySelector('.nav');
    if (!nav) return;
    var strip = document.createElement('div');
    strip.className = 'az-xp-strip';
    strip.innerHTML = '<div class="az-xp-bar" style="width:0%"></div>';
    nav.after(strip);
  }

  /* ═══════════════════════════════
     SOUND TOGGLE BUTTON
  ═══════════════════════════════ */
  function _buildSoundBtn() {
    var nav = document.getElementById('main-nav') || document.querySelector('.nav');
    if (!nav) return;
    var btn = document.createElement('button');
    btn.className = 'sound-btn';
    btn.title = 'Toggle sound';
    function syncIcon() { btn.textContent = CoinEngine.getSoundEnabled() ? '🔊' : '🔇'; }
    syncIcon();
    btn.addEventListener('click', function() {
      CoinEngine.toggleSound(); syncIcon();
      SoundEngine.play('toggle');
    });
    nav.appendChild(btn);
  }

  /* ═══════════════════════════════
     DIFFICULTY MODAL
  ═══════════════════════════════ */
  /* opts: { title, accent, cost, diffs:[{label,mult,xpMult}], onStart(diffIdx,mult) } */
  function showDifficultyModal(opts) {
    var selectedDiff = 1; // default Normal
    var diffs = opts.diffs || [
      { label:'EASY',   mult:0.7, xpMult:0.8, icon:'😊' },
      { label:'NORMAL', mult:1.0, xpMult:1.0, icon:'😐' },
      { label:'HARD',   mult:1.5, xpMult:1.5, icon:'😤' },
      { label:'INSANE', mult:2.0, xpMult:2.0, icon:'💀' },
    ];

    var overlay = document.createElement('div');
    overlay.className = 'pgm-overlay';

    var hasMult2 = CoinEngine.hasActivePowerUp('pu_2x');
    var hasMult3 = CoinEngine.hasActivePowerUp('pu_3x');
    var hasShield = CoinEngine.hasActivePowerUp('pu_shield');
    var hasXP2   = CoinEngine.hasActivePowerUp('pu_xp2');

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

    /* Diff selection */
    overlay.querySelectorAll('.pgm-diff-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        selectedDiff = parseInt(btn.dataset.i);
        overlay.querySelectorAll('.pgm-diff-btn').forEach(function(b) { b.classList.remove('on'); });
        btn.classList.add('on');
        SoundEngine.play('click');
      });
    });

    /* Power-up toggle */
    overlay.querySelectorAll('.pgm-pu-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.dataset.pu;
        if (btn.classList.contains('owned')) { btn.classList.toggle('active'); return; }
        if (CoinEngine.buyPowerUp(id)) {
          btn.classList.add('owned','active');
          btn.innerHTML = btn.innerHTML.replace(/\(.*\)/, '✓');
          SoundEngine.play('coin');
        } else {
          CoinEngine.toast('Not enough coins!','warn');
        }
      });
    });

    /* Start */
    overlay.querySelector('#pgm-start').addEventListener('click', function() {
      var diff = diffs[selectedDiff];
      var coinMult = CoinEngine.getMultiplier() * diff.mult;
      overlay.classList.add('az-exit');
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (opts.onStart) opts.onStart(selectedDiff, coinMult, diff);
      }, 180);
      SoundEngine.play('start');
    });

    overlay.querySelector('#pgm-cancel').addEventListener('click', function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
  }

  /* ═══════════════════════════════
     PAGE NAVIGATION WITH FADE
  ═══════════════════════════════ */
  function navigate(href) {
    document.body.classList.add('az-exit');
    setTimeout(function() { location.href = href; }, 185);
  }

  /* ═══════════════════════════════
     INIT
  ═══════════════════════════════ */
  function _init() {
    _buildBottomNav();
    _buildXPStrip();
    _buildSoundBtn();

    /* Intercept all internal links for fade transition */
    document.addEventListener('click', function(e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
      var current = location.pathname.split('/').pop() || 'index.html';
      if (href === current) return;
      e.preventDefault();
      navigate(href);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  window.GameUI = { showDifficultyModal: showDifficultyModal, navigate: navigate };
})();

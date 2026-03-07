/**
 * ARCADE ZONE — SoundEngine v2
 * Original procedural music — no copyright.
 * Per-game BGM: playBGM('snake'|'tetris'|'breakout'|'2048'|'flappy'|'mole'|'memory'|'reaction'|'typing'|'simon'|'casino')
 * stopBGM() — stops current loop
 */
window.SoundEngine = (function () {
  'use strict';

  var _ac = null;
  var _bgmNodes = [];   /* currently playing BGM nodes */
  var _bgmLoop = null;  /* setInterval handle */
  var _bgmStep = 0;

  function _ctx() {
    if (!_ac) {
      try { _ac = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    if (_ac.state === 'suspended') { try { _ac.resume(); } catch(e){} }
    return _ac;
  }
  function _enabled() { return window.CoinEngine ? CoinEngine.getSoundEnabled() : true; }

  /* ── Low-level tone ── */
  function _tone(freq, type, vol, dur, delay, dest) {
    var ac = _ctx(); if (!ac) return null;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.connect(gain);
    gain.connect(dest || ac.destination);
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    var t0 = ac.currentTime + (delay || 0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.15, t0 + 0.01);
    var end = t0 + (dur || 0.15);
    gain.gain.setValueAtTime(vol || 0.15, end - 0.04);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.start(t0); osc.stop(end);
    return osc;
  }

  /* ── Reverb/delay bus for atmosphere ── */
  function _makeReverb(ac) {
    var len = ac.sampleRate * 1.2;
    var buf = ac.createBuffer(2, len, ac.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len,2);
    }
    var conv = ac.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  /* ══════════════════════════════════
     BGM ENGINE — step sequencer
  ══════════════════════════════════ */
  var BGM_DEFS = {

    /* SNAKE — eerie chromatic, slow build. Pentatonic minor */
    snake: {
      bpm: 110, vol: 0.06, type: 'square',
      seq: [
        [220,0.18],[0,0.18],[294,0.12],[0,0.06],
        [262,0.18],[220,0.12],[0,0.12],[196,0.24],
        [0,0.12],  [247,0.18],[0,0.12],[220,0.18],
        [196,0.12],[0,0.18],[165,0.24],[0,0.24],
      ],
    },

    /* TETRIS — upbeat, Korobeiniki-inspired but original (different melody) */
    tetris: {
      bpm: 160, vol: 0.07, type: 'square',
      seq: [
        [659,0.14],[494,0.07],[523,0.07],[587,0.14],[523,0.07],[494,0.07],
        [440,0.14],[440,0.07],[523,0.07],[659,0.14],[587,0.07],[523,0.07],
        [494,0.21],[523,0.07],[587,0.14],[659,0.14],
        [523,0.14],[440,0.14],[440,0.28],
        [587,0.21],[698,0.07],[880,0.14],[784,0.07],[698,0.07],
        [659,0.21],[523,0.07],[659,0.14],[587,0.07],[523,0.07],
        [494,0.14],[494,0.07],[523,0.07],[587,0.14],[659,0.14],
        [523,0.14],[440,0.14],[440,0.14],[0,0.14],
      ],
    },

    /* BREAKOUT — punchy action, major key */
    breakout: {
      bpm: 148, vol: 0.065, type: 'sawtooth',
      seq: [
        [392,0.12],[0,0.06],[523,0.12],[0,0.06],[659,0.12],[0,0.06],[784,0.18],
        [698,0.12],[0,0.06],[659,0.12],[0,0.06],[587,0.12],[523,0.12],
        [440,0.18],[0,0.06],[392,0.12],[0,0.06],[440,0.12],[392,0.12],
        [349,0.24],[0,0.24],
      ],
    },

    /* 2048 — ambient, calm, floating */
    '2048': {
      bpm: 72, vol: 0.045, type: 'sine',
      seq: [
        [261,0.5],[0,0.25],[329,0.5],[0,0.25],
        [391,0.5],[0,0.25],[329,0.5],[0,0.5],
        [261,0.5],[0,0.25],[220,0.5],[0,0.25],
        [196,0.75],[0,0.75],
      ],
    },

    /* FLAPPY — cheerful, 8-bit hop */
    flappy: {
      bpm: 132, vol: 0.06, type: 'square',
      seq: [
        [523,0.12],[659,0.12],[784,0.12],[1047,0.12],
        [784,0.12],[659,0.12],[523,0.24],
        [440,0.12],[523,0.12],[659,0.12],[880,0.12],
        [659,0.12],[523,0.12],[440,0.24],
        [392,0.12],[440,0.12],[523,0.12],[659,0.12],
        [523,0.12],[440,0.12],[392,0.24],
        [349,0.36],[0,0.12],
      ],
    },

    /* WHACK-A-MOLE — fast, bouncy, staccato */
    mole: {
      bpm: 170, vol: 0.065, type: 'square',
      seq: [
        [523,0.1],[0,0.05],[523,0.1],[659,0.1],[0,0.05],[659,0.1],
        [784,0.1],[0,0.05],[784,0.1],[0,0.05],[659,0.15],
        [587,0.1],[0,0.05],[523,0.1],[0,0.05],[440,0.1],[0,0.1],
        [392,0.15],[0,0.1],[349,0.15],[0,0.15],
      ],
    },

    /* MEMORY MATCH — soft, mysterious, slow arpeggios */
    memory: {
      bpm: 80, vol: 0.05, type: 'sine',
      seq: [
        [261,0.35],[329,0.35],[392,0.35],[523,0.7],
        [0,0.35],[392,0.35],[329,0.35],[261,0.7],
        [220,0.35],[277,0.35],[329,0.35],[440,0.7],
        [0,0.7],
      ],
    },

    /* REACTION TEST — tension builder, short pings */
    reaction: {
      bpm: 130, vol: 0.05, type: 'sine',
      seq: [
        [880,0.06],[0,0.2],[1100,0.06],[0,0.3],
        [990,0.06],[0,0.25],[1320,0.08],[0,0.4],
        [880,0.06],[0,0.15],[0,0.45],
      ],
    },

    /* TYPING — steady rhythmic, motivating */
    typing: {
      bpm: 120, vol: 0.045, type: 'triangle',
      seq: [
        [523,0.1],[587,0.1],[659,0.1],[587,0.1],
        [523,0.1],[494,0.1],[440,0.1],[0,0.1],
        [392,0.1],[440,0.1],[494,0.1],[523,0.1],
        [587,0.1],[659,0.2],[0,0.2],
      ],
    },

    /* SIMON SAYS — fanfare-like, colourful */
    simon: {
      bpm: 100, vol: 0.07, type: 'sine',
      seq: [
        [392,0.2],[0,0.1],[494,0.2],[0,0.1],[587,0.2],[0,0.1],[784,0.4],
        [0,0.2],[698,0.2],[0,0.1],[587,0.2],[0,0.1],[494,0.2],[0,0.3],
        [440,0.2],[0,0.1],[523,0.2],[659,0.2],[784,0.4],
        [0,0.4],
      ],
    },

    /* CASINO — jazzy, lounge-y */
    casino: {
      bpm: 112, vol: 0.055, type: 'triangle',
      seq: [
        [392,0.15],[0,0.07],[494,0.15],[0,0.07],[587,0.15],[0,0.07],[740,0.22],
        [0,0.15],[698,0.15],[587,0.15],[494,0.15],[0,0.15],
        [440,0.22],[0,0.07],[392,0.15],[330,0.15],[0,0.15],
        [294,0.22],[0,0.22],[330,0.15],[392,0.22],[0,0.22],
      ],
    },
  };

  var _currentGame = null;
  var _seqIndex = 0;
  var _seqTimer = null;

  function stopBGM() {
    if (_seqTimer) { clearTimeout(_seqTimer); _seqTimer = null; }
    _currentGame = null;
  }

  function playBGM(gameId) {
    if (!_enabled()) return;
    stopBGM();
    var def = BGM_DEFS[gameId];
    if (!def) return;
    _currentGame = gameId;
    _seqIndex = 0;
    _stepBGM(def);
  }

  function _stepBGM(def) {
    if (!_enabled() || _currentGame === null) return;
    var step = def.seq[_seqIndex % def.seq.length];
    var freq = step[0], dur = step[1];
    if (freq > 0) _tone(freq, def.type, def.vol, dur * 0.88);
    _seqIndex++;
    _seqTimer = setTimeout(function () { _stepBGM(def); }, dur * 1000);
  }

  /* ══════════════════════════════════
     SFX LIBRARY
  ══════════════════════════════════ */
  var SFX = {
    click:       function(){ _tone(880,'sine',0.08,0.05); },
    coin:        function(){ _tone(880,'sine',0.16,0.07); setTimeout(function(){ _tone(1100,'sine',0.12,0.09); },55); },
    start:       function(){ [392,523,659].forEach(function(f,i){ setTimeout(function(){ _tone(f,'square',0.09,0.11); },i*80); }); },
    gameover:    function(){ [330,262,196].forEach(function(f,i){ setTimeout(function(){ _tone(f,'sawtooth',0.11,0.2); },i*120); }); },
    success:     function(){ [523,659,784,1047].forEach(function(f,i){ setTimeout(function(){ _tone(f,'sine',0.12,0.13); },i*65); }); },
    levelup:     function(){ [392,494,587,784,988].forEach(function(f,i){ setTimeout(function(){ _tone(f,'sine',0.16,0.16); },i*75); }); },
    achievement: function(){ [523,659,784,1047,1319].forEach(function(f,i){ setTimeout(function(){ _tone(f,'sine',0.14,0.14,0); },i*65); }); },

    /* Snake */
    eat:   function(){ _tone(900,'sine',0.13,0.06); setTimeout(function(){ _tone(1200,'sine',0.1,0.07); },40); },
    die:   function(){ [300,220,150].forEach(function(f,i){ setTimeout(function(){ _tone(f,'sawtooth',0.13,0.22); },i*110); }); },

    /* Tetris */
    line:  function(){ _tone(659,'square',0.12,0.08); setTimeout(function(){ _tone(784,'square',0.12,0.1); },70); },
    drop:  function(){ _tone(180,'sine',0.09,0.05); },
    hold:  function(){ _tone(440,'triangle',0.08,0.06); },
    rotate:function(){ _tone(660,'sine',0.06,0.04); },

    /* Breakout */
    brick: function(){ _tone(660,'square',0.1,0.04); },
    paddle:function(){ _tone(330,'sine',0.08,0.04); },
    wall:  function(){ _tone(220,'square',0.07,0.04); },

    /* 2048 */
    merge: function(){ _tone(523,'sine',0.1,0.08); setTimeout(function(){ _tone(659,'sine',0.09,0.09); },60); },
    slide: function(){ _tone(300,'sine',0.06,0.05); },

    /* Flappy */
    flap:  function(){ _tone(440,'square',0.09,0.05); },
    score: function(){ _tone(880,'sine',0.12,0.06); setTimeout(function(){ _tone(1100,'sine',0.1,0.08); },50); },
    pipe:  function(){ [300,220,150].forEach(function(f,i){ setTimeout(function(){ _tone(f,'sawtooth',0.13,0.2); },i*100); }); },

    /* Mole */
    bonk:  function(){ _tone(660,'square',0.13,0.05); setTimeout(function(){ _tone(440,'square',0.1,0.06); },40); },
    miss:  function(){ _tone(220,'sine',0.07,0.08); },
    combo: function(){ _tone(880,'sine',0.15,0.05); setTimeout(function(){ _tone(1100,'sine',0.13,0.06); },45); setTimeout(function(){ _tone(1320,'sine',0.11,0.08); },90); },

    /* Memory */
    flip:  function(){ _tone(440,'sine',0.1,0.08); },
    match: function(){ _tone(523,'sine',0.11,0.07); setTimeout(function(){ _tone(659,'sine',0.1,0.09); },55); },
    wrong: function(){ _tone(200,'sawtooth',0.1,0.12); },

    /* Reaction */
    go:    function(){ _tone(880,'square',0.14,0.06); setTimeout(function(){ _tone(1108,'square',0.12,0.08); },50); },
    early: function(){ _tone(200,'sawtooth',0.15,0.25); },

    /* Typing */
    key:   function(){ _tone(200+Math.random()*60,'square',0.04,0.03); },
    error: function(){ _tone(160,'sawtooth',0.1,0.1); },

    /* Simon */
    simon: function(idx){ var f=[329,261,392,523]; _tone(f[idx]||440,'sine',0.28,0.2,0,undefined); },
    wrong_simon: function(){ _tone(90,'sawtooth',0.18,0.28); },

    /* Casino */
    deal:    function(){ _tone(440,'sine',0.1,0.07); setTimeout(function(){ _tone(550,'sine',0.09,0.08); },55); },
    jackpot: function(){ [523,659,784,1047,1319,1568].forEach(function(f,i){ setTimeout(function(){ _tone(f,'sine',0.18,0.18,0); },i*50); }); },
    win_small:function(){ _tone(659,'sine',0.12,0.07); setTimeout(function(){ _tone(784,'sine',0.1,0.09); },60); },
    roulette_spin:function(){
      var t=0;
      for(var i=0;i<24;i++){(function(d){ setTimeout(function(){ _tone(200+Math.random()*200,'sine',0.05,0.04); },d); })(t); t+=25+i*9;}
    },

    /* UI */
    toggle:  function(){ _tone(440,'sine',0.07,0.05); },
    buzz:    function(){ _tone(90,'sawtooth',0.18,0.28); },
    pop:     function(){ _tone(660,'sine',0.1,0.05); },
    unlock:  function(){ [523,659,784].forEach(function(f,i){ setTimeout(function(){ _tone(f,'sine',0.12,0.12); },i*60); }); },
  };

  function play(name, extra) {
    if (!_enabled()) return;
    if (SFX[name]) { try { SFX[name](extra); } catch(e){} }
  }

  /* Global button click sound */
  document.addEventListener('click', function(e) {
    if (!_enabled()) return;
    var t = e.target;
    if (t.tagName === 'BUTTON' || (t.closest && t.closest('button')) || t.classList.contains('btn')) {
      play('click');
    }
  }, true);

  return { play: play, playBGM: playBGM, stopBGM: stopBGM, ctx: _ctx };
})();

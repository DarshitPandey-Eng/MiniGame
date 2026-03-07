/**
 * ARCADE ZONE — SoundEngine
 * window.SoundEngine available after <script src="sound.js">
 * Requires coins.js loaded first.
 */
window.SoundEngine = (function () {
  'use strict';
  var _ac = null;
  function _ctx() {
    if (!_ac) {
      try { _ac = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    /* Resume if suspended (browser autoplay policy) */
    if (_ac.state === 'suspended') { try { _ac.resume(); } catch(e){} }
    return _ac;
  }

  function _enabled() {
    return window.CoinEngine ? CoinEngine.getSoundEnabled() : true;
  }

  /* ── Low-level tone player ── */
  function _tone(freq, type, vol, dur, fadeStart) {
    if (!_enabled()) return;
    var ac = _ctx(); if (!ac) return;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(vol || 0.25, ac.currentTime + 0.01);
    var end = ac.currentTime + (dur || 0.2);
    var fs  = fadeStart ? ac.currentTime + fadeStart : end - 0.04;
    gain.gain.setValueAtTime(vol || 0.25, fs);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.start(); osc.stop(end);
  }

  /* ── Sound library ── */
  var SOUNDS = {
    click: function() { _tone(880, 'sine', 0.1, 0.06); },
    hover: function() { _tone(660, 'sine', 0.05, 0.04); },

    coin: function() {
      _tone(880, 'sine', 0.18, 0.08);
      setTimeout(function(){ _tone(1100,'sine',0.14,0.1); }, 60);
    },

    start: function() {
      [392,523,659].forEach(function(f,i){
        setTimeout(function(){ _tone(f,'square',0.1,0.12); }, i*90);
      });
    },

    gameover: function() {
      [330,262,196].forEach(function(f,i){
        setTimeout(function(){ _tone(f,'sawtooth',0.12,0.22); }, i*130);
      });
    },

    success: function() {
      [523,659,784,1047].forEach(function(f,i){
        setTimeout(function(){ _tone(f,'sine',0.14,0.14); }, i*70);
      });
    },

    levelup: function() {
      var seq=[392,494,587,784,988];
      seq.forEach(function(f,i){
        setTimeout(function(){ _tone(f,'sine',0.18,0.18); }, i*80);
      });
    },

    achievement: function() {
      var seq=[523,659,784,1047,1319];
      seq.forEach(function(f,i){
        setTimeout(function(){ _tone(f,'sine',0.16,0.16,0.1); }, i*70);
      });
    },

    flip: function() { _tone(440,'sine',0.12,0.09); },
    pop:  function() { _tone(660,'sine',0.12,0.06); },
    buzz: function() { _tone(90,'sawtooth',0.2,0.3); },

    simon: function(idx) {
      var freqs=[329,261,392,523];
      _tone(freqs[idx]||440,'sine',0.3,0.22,0.18);
    },

    eat: function() {
      _tone(880,'sine',0.15,0.07);
      setTimeout(function(){ _tone(1100,'sine',0.1,0.07); }, 50);
    },

    land: function() { _tone(200,'sine',0.1,0.06); },
    wall: function() { _tone(220,'square',0.08,0.05); },

    deal: function() {
      _tone(440,'sine',0.12,0.08);
      setTimeout(function(){ _tone(550,'sine',0.1,0.08); }, 60);
    },

    jackpot: function() {
      var seq=[523,659,784,1047,1319,1568];
      seq.forEach(function(f,i){
        setTimeout(function(){ _tone(f,'sine',0.2,0.2,0.15); }, i*55);
      });
    },

    roulette_spin: function() {
      var t=0;
      for(var i=0;i<20;i++){
        (function(delay){
          setTimeout(function(){
            _tone(200+Math.random()*200,'sine',0.06,0.04);
          },delay);
        })(t);
        t+=30+i*8;
      }
    },

    toggle: function() { _tone(440,'sine',0.08,0.05); },
  };

  function play(name, extra) {
    if (!_enabled()) return;
    if (SOUNDS[name]) {
      try { SOUNDS[name](extra); } catch(e) {}
    }
  }

  /* ── Wire up global click sounds ── */
  document.addEventListener('click', function(e) {
    if (!_enabled()) return;
    var t = e.target;
    if (t.tagName === 'BUTTON' || t.closest('button') || t.classList.contains('btn')) {
      play('click');
    }
  }, true);

  return { play: play, ctx: _ctx };
})();

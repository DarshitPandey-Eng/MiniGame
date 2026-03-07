/**
 * ARCADE ZONE — CoinEngine v3
 * window.CoinEngine available on every page after <script src="coins.js">
 */
window.CoinEngine = (function () {
  'use strict';

  /* ─── Storage keys ─── */
  var K = {
    BAL:'az_coins', STATS:'az_stats', CHALL:'az_challenges',
    THEME:'az_theme', HIST:'az_history', XP:'az_xp',
    STREAK:'az_streak', QUESTS:'az_quests', ACHIEVE:'az_achieve',
    SOUND:'az_sound', POWERUP:'az_powerup',
  };

  /* ─── Helpers ─── */
  function load(key,fb){ try{var v=localStorage.getItem(key);return v?JSON.parse(v):fb;}catch(e){return fb;} }
  function save(key,val){ try{localStorage.setItem(key,JSON.stringify(val));}catch(e){} }
  function today(){ return new Date().toISOString().slice(0,10); }
  function thisWeek(){
    var d=new Date(),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1);
    return new Date(d.setDate(diff)).toISOString().slice(0,10);
  }

  /* ═══════════════════════════════
     BALANCE
  ═══════════════════════════════ */
  function getBalance(){ var v=parseInt(localStorage.getItem(K.BAL),10); return isNaN(v)?150:v; }
  function setBalance(n){
    var v=Math.max(0,Math.floor(n));
    try{localStorage.setItem(K.BAL,String(v));}catch(e){}
    _fire('az:balance',v); _refreshWidgets(v); return v;
  }
  function add(n,label,icon){
    var result=setBalance(getBalance()+Number(n));
    if(n>0&&label) addHistory(icon||'🪙',label,n);
    _animateCoinGain(n);
    return result;
  }
  function spend(n){ if(getBalance()<Number(n))return false; setBalance(getBalance()-Number(n)); return true; }
  function _refreshWidgets(v){ document.querySelectorAll('.az-bal').forEach(function(e){
    _countUp(e,parseInt(e.textContent)||0,v,400);
  }); }

  /* Animated counter */
  function _countUp(el,from,to,ms){
    var start=performance.now(),diff=to-from;
    if(Math.abs(diff)<2){el.textContent=to;return;}
    function step(ts){
      var p=Math.min(1,(ts-start)/ms);
      el.textContent=Math.round(from+diff*p);
      if(p<1)requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Float-up coin gain animation */
  function _animateCoinGain(n){
    if(n<=0)return;
    var el=document.createElement('div');
    el.textContent='+'+n+' 🪙';
    el.style.cssText='position:fixed;top:70px;right:20px;font-family:var(--font-mono,monospace);'+
      'font-size:.82rem;font-weight:700;color:#ffe135;pointer-events:none;z-index:9999;'+
      'animation:azCoinFloat 1.2s ease-out forwards;text-shadow:0 0 8px rgba(255,225,53,.6)';
    document.body.appendChild(el);
    setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},1300);
    _ensureCoinAnim();
  }
  function _ensureCoinAnim(){
    if(document.getElementById('az-coin-anim'))return;
    var s=document.createElement('style');s.id='az-coin-anim';
    s.textContent='@keyframes azCoinFloat{0%{opacity:0;transform:translateY(0) scale(.8)}'+
      '20%{opacity:1;transform:translateY(-10px) scale(1.1)}'+
      '80%{opacity:1;transform:translateY(-40px) scale(1)}'+
      '100%{opacity:0;transform:translateY(-60px) scale(.9)}}';
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════
     HISTORY
  ═══════════════════════════════ */
  function addHistory(icon,label,amount){
    var h=load(K.HIST,[]);
    h.unshift({icon:icon,label:label,amount:amount,ts:Date.now()});
    if(h.length>60)h.pop();
    save(K.HIST,h);
  }
  function getHistory(){ return load(K.HIST,[]); }

  /* ═══════════════════════════════
     XP + LEVELS
  ═══════════════════════════════ */
  var XP_PER_LEVEL=[0,100,250,450,700,1000,1400,1900,2500,3200,4000,
    5000,6200,7600,9200,11000,13100,15500,18200,21200,24500,
    28100,32000,36200,40700,45500,50600,56000,61700,67700,74000,
    80600,87500,94700,102200,110000,118100,126500,135200,144200,153500,
    163100,173000,183200,193700,204500,215600,227000,238700,250700,263000];
  function getXPData(){ return load(K.XP,{xp:0,level:1}); }
  function getLevelForXP(xp){
    for(var i=XP_PER_LEVEL.length-1;i>=0;i--) if(xp>=XP_PER_LEVEL[i]) return Math.min(i+1,50);
    return 1;
  }
  function getXPForNextLevel(level){
    return level>=50?Infinity:XP_PER_LEVEL[level]||Infinity;
  }
  function gainXP(amount){
    var d=getXPData();
    var oldLevel=d.level;
    d.xp+=amount;
    d.level=getLevelForXP(d.xp);
    save(K.XP,d);
    _fire('az:xp',{xp:d.xp,level:d.level,gained:amount});
    _refreshXPBar(d);
    if(d.level>oldLevel) _onLevelUp(d.level);
    return d;
  }
  function _refreshXPBar(d){
    d=d||getXPData();
    var bars=document.querySelectorAll('.az-xp-bar');
    var txts=document.querySelectorAll('.az-level');
    var cur=d.xp-(XP_PER_LEVEL[d.level-1]||0);
    var needed=(getXPForNextLevel(d.level))-(XP_PER_LEVEL[d.level-1]||0);
    var pct=d.level>=50?100:Math.min(100,Math.round(cur/needed*100));
    bars.forEach(function(b){b.style.width=pct+'%';b.setAttribute('title',cur+'/'+needed+' XP');});
    txts.forEach(function(e){e.textContent='Lv.'+d.level;});
  }
  function _onLevelUp(level){
    SoundEngine.play('levelup');
    toast('🎉 LEVEL UP! You are now Level '+level,'coin');
    _fire('az:levelup',level);
    /* bonus coins for leveling */
    var bonus=level*10;
    add(bonus,'Level '+level+' bonus','⭐');
  }

  /* ═══════════════════════════════
     DAILY STREAK
  ═══════════════════════════════ */
  function getStreak(){ return load(K.STREAK,{current:0,best:0,lastDate:''}); }
  function checkStreak(){
    var s=getStreak(),t=today();
    if(s.lastDate===t) return s; /* already checked today */
    var yest=new Date(); yest.setDate(yest.getDate()-1);
    var yestStr=yest.toISOString().slice(0,10);
    if(s.lastDate===yestStr){ s.current++; }
    else if(s.lastDate!==t){ s.current=1; }
    s.best=Math.max(s.best,s.current);
    s.lastDate=t;
    save(K.STREAK,s);
    _fire('az:streak',s);
    _refreshStreakWidgets(s);
    /* streak bonus */
    var bonus=Math.min(s.current*5,100);
    if(bonus>0) add(bonus,'Day '+s.current+' streak bonus','🔥');
    return s;
  }
  function _refreshStreakWidgets(s){
    s=s||getStreak();
    document.querySelectorAll('.az-streak').forEach(function(e){ e.textContent=s.current; });
  }

  /* ═══════════════════════════════
     QUESTS
  ═══════════════════════════════ */
  var DAILY_POOL=[
    {id:'dq_play3',   label:'Play any 3 games',      target:3,  type:'plays',  reward:30,  icon:'🎮'},
    {id:'dq_earn50',  label:'Earn 50 coins from games',target:50, type:'earn',   reward:25,  icon:'🪙'},
    {id:'dq_snake30', label:'Score 30+ in Snake',     target:30, type:'score',  game:'snake',reward:35,icon:'🐍'},
    {id:'dq_tetris',  label:'Clear 3 lines in Tetris',target:3,  type:'lines',  game:'tetris',reward:40,icon:'🟦'},
    {id:'dq_flappy3', label:'Score 3 in Flappy Bird', target:3,  type:'score',  game:'flappy',reward:45,icon:'🐦'},
    {id:'dq_mole10',  label:'Score 10 in Whack-a-Mole',target:10,type:'score',  game:'mole',reward:30, icon:'🦔'},
    {id:'dq_casino2', label:'Win 2 casino bets',      target:2,  type:'wins',   game:'casino',reward:50,icon:'🎰'},
    {id:'dq_memory',  label:'Win a Memory Match',     target:1,  type:'wins',   game:'memory',reward:30,icon:'🃏'},
    {id:'dq_type50',  label:'Type at 50+ WPM',        target:50, type:'score',  game:'typing',reward:40,icon:'⌨️'},
    {id:'dq_simon5',  label:'Reach Simon round 5',    target:5,  type:'score',  game:'simon', reward:35,icon:'🔴'},
  ];
  var WEEKLY_POOL=[
    {id:'wq_spend100',label:'Spend 100 coins on games',target:100,type:'spend',  reward:150, icon:'💸'},
    {id:'wq_play15',  label:'Play 15 games this week', target:15, type:'plays',  reward:120, icon:'🎮'},
    {id:'wq_snake100',label:'Score 100+ in Snake',     target:100,type:'score',  game:'snake',reward:100,icon:'🐍'},
    {id:'wq_tetris1k',label:'Score 1000+ in Tetris',   target:1000,type:'score', game:'tetris',reward:150,icon:'🟦'},
    {id:'wq_jackpot', label:'Hit the slots jackpot',   target:1,  type:'wins',   game:'slots',reward:200,icon:'🎰'},
    {id:'wq_flappy10',label:'Score 10 in Flappy Bird', target:10, type:'score',  game:'flappy',reward:180,icon:'🐦'},
    {id:'wq_streak7', label:'Maintain a 7-day streak', target:7,  type:'streak', reward:250, icon:'🔥'},
  ];

  function _pickQuests(pool,n,seed){
    var rng=seed%pool.length;
    var result=[];
    for(var i=0;i<n&&i<pool.length;i++) result.push(pool[(rng+i)%pool.length]);
    return result;
  }
  function getQuests(){
    var stored=load(K.QUESTS,{});
    var todaySeed=parseInt(today().replace(/-/g,''))%1000;
    var weekSeed=parseInt(thisWeek().replace(/-/g,''))%1000;
    /* regenerate if date changed */
    if(stored.dailyDate!==today()){
      var picks=_pickQuests(DAILY_POOL,3,todaySeed);
      stored.daily=picks.map(function(q){ return {def:q,progress:0,done:false}; });
      stored.dailyDate=today();
    }
    if(stored.weeklyDate!==thisWeek()){
      var wpicks=_pickQuests(WEEKLY_POOL,2,weekSeed);
      stored.weekly=wpicks.map(function(q){ return {def:q,progress:0,done:false}; });
      stored.weeklyDate=thisWeek();
    }
    save(K.QUESTS,stored);
    return stored;
  }
  function updateQuestProgress(type,game,value){
    var q=getQuests();
    var changed=false;
    function check(list){
      if(!list)return;
      list.forEach(function(entry){
        if(entry.done)return;
        var d=entry.def;
        var match=(d.type===type)&&(!d.game||d.game===game);
        if(match){
          if(type==='score'||type==='lines') entry.progress=Math.max(entry.progress,value);
          else entry.progress+=value;
          if(entry.progress>=d.target&&!entry.done){
            entry.done=true; changed=true;
            add(d.reward,'Quest: '+d.label,d.icon);
            gainXP(d.reward/2);
            toast(d.icon+' Quest complete! +'+d.reward+' 🪙','success');
          }
        }
      });
    }
    check(q.daily); check(q.weekly);
    if(changed||true) save(K.QUESTS,q);
    _fire('az:quests',q);
  }

  /* ═══════════════════════════════
     ACHIEVEMENTS
  ═══════════════════════════════ */
  var ACHIEVEMENTS=[
    {id:'a1', icon:'🥉',label:'First Blood',    desc:'Complete your first game',   xp:50,  secret:false},
    {id:'a2', icon:'🥈',label:'Getting Warmed Up',desc:'Play 25 games',            xp:100, secret:false},
    {id:'a3', icon:'🥇',label:'Arcade Veteran', desc:'Play 100 games',             xp:300, secret:false},
    {id:'a4', icon:'💰',label:'Coin Hoarder',   desc:'Reach 1000 coins',           xp:150, secret:false},
    {id:'a5', icon:'🐍',label:'Snake Master',   desc:'Score 300 in Snake',         xp:200, secret:false},
    {id:'a6', icon:'🟦',label:'Tetris God',      desc:'Score 5000 in Tetris',      xp:300, secret:false},
    {id:'a7', icon:'💎',label:'Jackpot!',        desc:'Hit the slots jackpot',     xp:400, secret:false},
    {id:'a8', icon:'🔥',label:'On Fire',         desc:'Reach a 7-day streak',      xp:200, secret:false},
    {id:'a9', icon:'⚡',label:'Reflexes of Steel',desc:'Reaction under 150ms',     xp:250, secret:false},
    {id:'a10',icon:'🎓',label:'Speed Typist',    desc:'Type at 80+ WPM',           xp:200, secret:false},
    {id:'a11',icon:'🦋',label:'Flutter',         desc:'Score 10 in Flappy Bird',   xp:200, secret:false},
    {id:'a12',icon:'🧠',label:'Total Recall',    desc:'Win Memory Match in ≤20 moves',xp:150,secret:false},
    {id:'a13',icon:'🎯',label:'All-In',          desc:'Win a casino all-in bet',   xp:350, secret:true},
    {id:'a14',icon:'⭐',label:'Level 10',        desc:'Reach player level 10',     xp:500, secret:false},
    {id:'a15',icon:'🏆',label:'Legend',          desc:'Reach player level 25',     xp:1000,secret:true},
  ];
  function getAchievements(){ return load(K.ACHIEVE,{}); }
  function unlockAchievement(id){
    var state=getAchievements();
    if(state[id])return false;
    var ach=null;
    for(var i=0;i<ACHIEVEMENTS.length;i++) if(ACHIEVEMENTS[i].id===id){ach=ACHIEVEMENTS[i];break;}
    if(!ach)return false;
    state[id]={ts:Date.now()};
    save(K.ACHIEVE,state);
    gainXP(ach.xp);
    SoundEngine.play('achievement');
    toast(ach.icon+' Achievement: '+ach.label,'coin');
    _fire('az:achievement',ach);
    return true;
  }
  function checkAchievements(gameId,score,won,extraData){
    extraData=extraData||{};
    var stats=getStats();
    var totalPlays=Object.values?Object.values(stats).reduce(function(a,s){return a+(s.plays||0);},0):0;
    var bal=getBalance();
    var streak=getStreak().current;
    var xpData=getXPData();
    if(totalPlays>=1)  unlockAchievement('a1');
    if(totalPlays>=25) unlockAchievement('a2');
    if(totalPlays>=100)unlockAchievement('a3');
    if(bal>=1000)      unlockAchievement('a4');
    if(gameId==='snake'&&score>=300) unlockAchievement('a5');
    if(gameId==='tetris'&&score>=5000) unlockAchievement('a6');
    if(gameId==='slots'&&won&&extraData.jackpot) unlockAchievement('a7');
    if(streak>=7)      unlockAchievement('a8');
    if(gameId==='reaction'&&score>0&&score<=150) unlockAchievement('a9');
    if(gameId==='typing'&&score>=80) unlockAchievement('a10');
    if(gameId==='flappy'&&score>=10) unlockAchievement('a11');
    if(gameId==='memory'&&won&&extraData.moves<=20) unlockAchievement('a12');
    if(gameId==='casino'&&extraData.allIn&&won) unlockAchievement('a13');
    if(xpData.level>=10) unlockAchievement('a14');
    if(xpData.level>=25) unlockAchievement('a15');
  }

  /* ═══════════════════════════════
     STATS + RECORD GAME
  ═══════════════════════════════ */
  function getStats(){ return load(K.STATS,{}); }
  function recordGame(gameId,score,won,extraData){
    won=!!won; extraData=extraData||{};
    var s=getStats();
    if(!s[gameId]) s[gameId]={plays:0,best:0,wins:0};
    s[gameId].plays++;
    if(score>s[gameId].best) s[gameId].best=score;
    if(won) s[gameId].wins++;
    save(K.STATS,s);
    var totalPlays=0;
    for(var k in s) totalPlays+=s[k].plays||0;
    /* XP for playing */
    var xpGain=won?30:10;
    gainXP(xpGain);
    /* Quest progress */
    updateQuestProgress('plays',gameId,1);
    if(score>0) updateQuestProgress('score',gameId,score);
    if(won) updateQuestProgress('wins',gameId,1);
    if(extraData.lines) updateQuestProgress('lines',gameId,extraData.lines);
    if(extraData.earned) updateQuestProgress('earn',gameId,extraData.earned);
    /* Challenges */
    _checkChallenges(gameId,score,s[gameId],s,totalPlays);
    /* Achievements */
    checkAchievements(gameId,score,won,extraData);
  }

  /* ═══════════════════════════════
     CHALLENGES (carry-forward from v2)
  ═══════════════════════════════ */
  var CHALLENGE_DEFS=[
    {id:'c1', game:'snake',   type:'score',target:50,  reward:30, label:'Snake: Score 50+',         icon:'🐍'},
    {id:'c2', game:'snake',   type:'score',target:200, reward:100,label:'Snake: Score 200+',        icon:'🐍'},
    {id:'c3', game:'tetris',  type:'score',target:500, reward:50, label:'Tetris: Score 500+',       icon:'🟦'},
    {id:'c4', game:'tetris',  type:'score',target:3000,reward:150,label:'Tetris: Score 3000+',      icon:'🟦'},
    {id:'c5', game:'breakout',type:'score',target:300, reward:40, label:'Breakout: Score 300+',     icon:'🟠'},
    {id:'c6', game:'breakout',type:'win',  target:1,   reward:80, label:'Breakout: Clear the board',icon:'🟠'},
    {id:'c7', game:'flappy',  type:'score',target:5,   reward:30, label:'Flappy: Score 5',          icon:'🐦'},
    {id:'c8', game:'flappy',  type:'score',target:20,  reward:120,label:'Flappy: Score 20',         icon:'🐦'},
    {id:'c9', game:'2048',    type:'score',target:1000,reward:50, label:'2048: Score 1000+',        icon:'🔢'},
    {id:'c10',game:'2048',    type:'win',  target:1,   reward:200,label:'2048: Reach 2048 tile!',   icon:'🔢'},
    {id:'c11',game:'mole',    type:'score',target:15,  reward:30, label:'Whack: Score 15+',         icon:'🦔'},
    {id:'c12',game:'typing',  type:'score',target:40,  reward:40, label:'Typing: 40+ WPM',          icon:'⌨️'},
    {id:'c13',game:'typing',  type:'score',target:70,  reward:100,label:'Typing: 70+ WPM',          icon:'⌨️'},
    {id:'c14',game:'simon',   type:'score',target:10,  reward:60, label:'Simon: Round 10',          icon:'🔴'},
    {id:'c15',game:'reaction',type:'score',target:200, reward:40, label:'Reaction: Under 200ms',icon:'⚡',inverted:true},
    {id:'c16',game:'memory',  type:'win',  target:1,   reward:25, label:'Memory: Complete a game',  icon:'🃏'},
    {id:'c17',game:'any',     type:'plays',target:10,  reward:50, label:'Play any game 10 times',   icon:'🎮'},
    {id:'c18',game:'casino',  type:'win',  target:3,   reward:75, label:'Casino: Win 3 bets',       icon:'🎰'},
  ];
  function getChallengeState(){ return load(K.CHALL,{}); }
  function _checkChallenges(gameId,score,gameStats,allStats,totalPlays){
    var state=getChallengeState(),changed=false;
    CHALLENGE_DEFS.forEach(function(ch){
      if(state[ch.id]&&(state[ch.id].met||state[ch.id].claimed))return;
      if(ch.game!=='any'&&ch.game!==gameId)return;
      var met=false;
      if(ch.type==='score') met=ch.inverted?(score<=ch.target):(score>=ch.target);
      else if(ch.type==='win') met=gameStats.wins>=ch.target;
      else if(ch.type==='plays') met=totalPlays>=ch.target;
      if(met){ if(!state[ch.id])state[ch.id]={}; state[ch.id].met=true; changed=true; }
    });
    if(changed) save(K.CHALL,state);
  }
  function claimChallenge(id){
    var state=getChallengeState();
    if(!state[id]||!state[id].met||state[id].claimed)return null;
    var ch=CHALLENGE_DEFS.filter(function(c){return c.id===id;})[0];
    if(!ch)return null;
    state[id].claimed=true; save(K.CHALL,state);
    add(ch.reward,'Challenge: '+ch.label,'🏆');
    gainXP(ch.reward);
    return ch.reward;
  }

  /* ═══════════════════════════════
     POWER-UPS
  ═══════════════════════════════ */
  var POWERUP_DEFS=[
    {id:'pu_2x',  label:'2× Coin Multiplier', desc:'Double coins on next game',cost:30, icon:'✖️2'},
    {id:'pu_3x',  label:'3× Coin Multiplier', desc:'Triple coins on next game', cost:80, icon:'✖️3'},
    {id:'pu_shield',label:'Shield',           desc:'Free retry on game over',   cost:40, icon:'🛡️'},
    {id:'pu_xp2', label:'2× XP Boost',        desc:'Double XP on next game',   cost:25, icon:'⚡XP'},
  ];
  function getPowerUps(){ return load(K.POWERUP,{}); }
  function buyPowerUp(id){
    var def=POWERUP_DEFS.filter(function(p){return p.id===id;})[0];
    if(!def)return false;
    if(!spend(def.cost))return false;
    var pu=getPowerUps();
    pu[id]=(pu[id]||0)+1;
    save(K.POWERUP,pu);
    addHistory(def.icon,'Power-up: '+def.label,-def.cost);
    toast(def.icon+' '+def.label+' activated!','info');
    return true;
  }
  function usePowerUp(id){
    var pu=getPowerUps();
    if(!pu[id]||pu[id]<=0)return false;
    pu[id]--;
    save(K.POWERUP,pu);
    return true;
  }
  function hasActivePowerUp(id){ var pu=getPowerUps(); return (pu[id]||0)>0; }
  function getMultiplier(){
    if(usePowerUp('pu_3x'))return 3;
    if(usePowerUp('pu_2x'))return 2;
    return 1;
  }

  /* ═══════════════════════════════
     THEME
  ═══════════════════════════════ */
  function getTheme(){ return localStorage.getItem(K.THEME)||'dark'; }
  function setTheme(t){
    try{localStorage.setItem(K.THEME,t);}catch(e){}
    document.documentElement.setAttribute('data-theme',t);
    _fire('az:theme',t);
  }
  function toggleTheme(){ setTheme(getTheme()==='dark'?'light':'dark'); }
  function applyTheme(){ document.documentElement.setAttribute('data-theme',getTheme()); }

  /* ═══════════════════════════════
     SOUND TOGGLE
  ═══════════════════════════════ */
  function getSoundEnabled(){ return localStorage.getItem(K.SOUND)!=='off'; }
  function toggleSound(){ localStorage.setItem(K.SOUND,getSoundEnabled()?'off':'on'); _fire('az:sound',getSoundEnabled()); }

  /* ═══════════════════════════════
     REWARDS TABLE
  ═══════════════════════════════ */
  var REWARDS={
    snake:   function(s){return Math.floor(s*0.8);},
    tetris:  function(s){return Math.floor(s*0.04);},
    breakout:function(s){return Math.floor(s*0.15);},
    '2048':  function(s){return Math.floor(s*0.01);},
    flappy:  function(s){return s*8;},
    mole:    function(s){return Math.floor(s*1.5);},
    memory:  function(s,w){return w?20:0;},
    reaction:function(s){return s<200?15:s<300?8:0;},
    typing:  function(s){return Math.floor(s*0.4);},
    simon:   function(s){return s*5;},
    casino:  function(s){return s;},
  };
  var COSTS={snake:10,tetris:10,breakout:10,'2048':10,flappy:10,mole:5,memory:5,reaction:0,typing:0,simon:5,casino:0};

  /* ═══════════════════════════════
     TOAST
  ═══════════════════════════════ */
  function toast(msg,type){
    _ensureToastStyle();
    var colors={success:'#00e676',warn:'#ff2d78',info:'#00e5ff',coin:'#ffe135'};
    var el=document.createElement('div');
    el.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);'+
      'background:'+(colors[type]||colors.success)+';color:#000;'+
      'font-family:var(--font-mono,monospace);font-size:.78rem;font-weight:700;'+
      'padding:11px 22px;border-radius:8px;z-index:9000;'+
      'box-shadow:0 8px 24px rgba(0,0,0,.5);white-space:nowrap;'+
      'animation:azToastIn .25s ease';
    el.textContent=msg;
    document.body.appendChild(el);
    setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},2600);
  }
  function _ensureToastStyle(){
    if(document.getElementById('az-toast-s'))return;
    var s=document.createElement('style');s.id='az-toast-s';
    s.textContent='@keyframes azToastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════
     EVENT BUS
  ═══════════════════════════════ */
  function _fire(name,detail){
    try{document.dispatchEvent(new CustomEvent(name,{detail:detail}));}catch(e){}
  }

  /* ═══════════════════════════════
     AUTO INIT
  ═══════════════════════════════ */
  function _init(){
    applyTheme();
    var bal=getBalance();
    setTimeout(function(){
      _refreshWidgets(bal);
      _refreshXPBar();
      _refreshStreakWidgets();
    },60);
    checkStreak();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_init);
  else _init();

  return {
    getBalance:getBalance, setBalance:setBalance, add:add, spend:spend,
    addHistory:addHistory, getHistory:getHistory,
    gainXP:gainXP, getXPData:getXPData, XP_PER_LEVEL:XP_PER_LEVEL, getXPForNextLevel:getXPForNextLevel,
    getStreak:getStreak, checkStreak:checkStreak,
    getQuests:getQuests, updateQuestProgress:updateQuestProgress,
    ACHIEVEMENTS:ACHIEVEMENTS, getAchievements:getAchievements, unlockAchievement:unlockAchievement,
    checkAchievements:checkAchievements,
    CHALLENGE_DEFS:CHALLENGE_DEFS, getChallengeState:getChallengeState, claimChallenge:claimChallenge,
    POWERUP_DEFS:POWERUP_DEFS, getPowerUps:getPowerUps, buyPowerUp:buyPowerUp,
    usePowerUp:usePowerUp, hasActivePowerUp:hasActivePowerUp, getMultiplier:getMultiplier,
    REWARDS:REWARDS, COSTS:COSTS,
    recordGame:recordGame, getStats:getStats,
    getTheme:getTheme, setTheme:setTheme, toggleTheme:toggleTheme, applyTheme:applyTheme,
    getSoundEnabled:getSoundEnabled, toggleSound:toggleSound,
    toast:toast,
  };
})();

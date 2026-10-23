'use strict';
const { Game, COLORS } = PocketEngine;
const $ = id => document.getElementById(id);
const PAINT = { red:'#f04f5f',yellow:'#e9ad20',green:'#24a875',blue:'#347fe8',wild:'#452b79' };
const SYMBOL = { skip:'⊘',reverse:'⇄',draw2:'+2',wild:'★',draw4:'+4' };
const MARK = { red:'●',yellow:'◆',green:'▲',blue:'■',wild:'✦' };
const GAME_KEY = 'shufflePopGameV1', WINS_KEY = 'shufflePopWins';
let game = null, timer = null, modalKind = '', pending = null, paused = false, lastFocus = null;
let soloRound = 0, resultTimer = null;
function stopResult(){if(resultTimer!==null)clearTimeout(resultTimer);resultTimer=null;}
let handOpen = false;
function setHandOpen(value) {
  handOpen = !!value;
  const panel = $('handPanel'), toggle = $('handToggle');
  if (panel) panel.hidden = !handOpen;
  document.body.classList.toggle('hand-open', handOpen);
  $('hand').classList.toggle('is-open', handOpen);
  if (toggle) { toggle.setAttribute('aria-expanded', String(handOpen)); toggle.setAttribute('aria-label', handOpen ? 'Close your hand' : 'Open your hand'); }
  if ($('handToggleHint')) $('handToggleHint').textContent = handOpen ? 'Close cards' : 'Open cards';
  if(handOpen)layoutOpenHand();else if(panel?.dataset)delete panel.dataset.handLayout;
}
function layoutOpenHand(){
  if(!handOpen)return;
  const panel=$('handPanel'),hand=$('hand'),first=hand.querySelector?.('.card');
  if(!panel||!first||panel.hidden)return;
  delete panel.dataset.handLayout;
  const cardStyle=getComputedStyle(first),self=$('selfPlayer').getBoundingClientRect(),table=$('table').getBoundingClientRect();
  const originalHeight=parseFloat(cardStyle.height),originalWidth=parseFloat(cardStyle.width);
  const portrait=window.innerHeight>window.innerWidth,ratio=originalWidth/originalHeight;
  const width=portrait?Math.min(420,table.width-32):self.width,frame=portrait?16:12;
  let bottom=Math.min(table.bottom-7,window.innerHeight-7),cardHeight,top;
  if(portrait){
    // Always leave the action row clear, including before End turn appears.
    bottom-=55;
    const cardWidth=Math.min(originalWidth*.98,(width-81)/3.6);
    cardHeight=cardWidth/ratio;
    top=bottom-cardHeight-frame;
  }else{
    const message=$('gameMessages').getBoundingClientRect();
    const available=bottom-(message.bottom+7);
    cardHeight=Math.min(Math.max(32,(bottom-self.top-16)*1.4)*1.24,available-frame);
    top=bottom-cardHeight-frame;
  }
  const height=cardHeight+frame,parent=panel.offsetParent,parentRect=parent?parent.getBoundingClientRect():{top:0,left:0};
  panel.style.setProperty('--open-hand-top',(top-parentRect.top+(parent?.scrollTop||0))+'px');
  panel.style.setProperty('--open-hand-left',(self.left+(self.width-width)/2-parentRect.left+(parent?.scrollLeft||0))+'px');
  panel.style.setProperty('--open-hand-width',width+'px');
  panel.style.setProperty('--open-hand-height',height+'px');
  panel.style.setProperty('--hand-inner-padding',portrait?'6px':'4px');
  panel.style.setProperty('--open-card-height',cardHeight+'px');
  panel.style.setProperty('--open-card-width',(originalWidth*cardHeight/originalHeight)+'px');
  panel.style.setProperty('--open-card-font',Math.max(15,parseFloat(cardStyle.fontSize)*cardHeight/originalHeight)+'px');
  panel.style.setProperty('--open-card-corner-font',Math.max(7,11*cardHeight/originalHeight)+'px');
  panel.style.setProperty('--open-oval-y',(20*cardHeight/originalHeight)+'px');
  panel.style.setProperty('--open-oval-x',(8*cardHeight/originalHeight)+'px');
  panel.dataset.handLayout='true';
}
window.addEventListener?.('resize',()=>{if(handOpen)window.requestAnimationFrame(layoutOpenHand);});
function updateSelfSeat(count, active, avatar = '🙂') {
  if ($('selfPlayer')) $('selfPlayer').classList.toggle('active', active);
  if ($('selfAvatar')) $('selfAvatar').textContent = avatar;
  $('handTitle').textContent = `Your cards · ${count}`;
  if(handOpen)window.requestAnimationFrame?.(layoutOpenHand);
}
function relativeSeat(index, me, count) {
  const relative = (index - me + count) % count;
  if (count === 2) return 'top';
  if (count === 3) return relative === 1 ? 'left' : 'right';
  return ['bottom','left','top','right'][relative];
}
window.HandView = {setOpen:setHandOpen, update:updateSelfSeat, seat:relativeSeat, get open(){return handOpen;}};
let wins = Number(read(WINS_KEY) || 0);
if (!Number.isFinite(wins) || wins < 0) wins = 0;
wins = Math.floor(wins);
let surface = TableThemes.solo;
const REACTIONS = ['😂','😎','😭','😡','👏','🔥'];
let reactionStates = {}, reactionTimer = null, lastReactionAt = 0;
function paintReactions() {
  const now = Date.now();
  document.querySelectorAll('[data-player]').forEach(node => {
    const old = node.querySelector('.reactionBubble'); if (old) old.remove();
    const state = reactionStates[node.dataset.player];
    if (state && state.until > now) {
      const bubble = document.createElement('span'); bubble.className = 'reactionBubble';
      bubble.textContent = state.emoji; bubble.setAttribute('aria-label','Reaction '+state.emoji); node.appendChild(bubble);
    }
  });
  const mine = reactionStates[0];
  $('selfReaction').hidden = !mine || mine.until <= now;
  if (!$('selfReaction').hidden) $('selfReaction').innerHTML = '<span>You</span><span class="reactionBubble">'+mine.emoji+'</span>';
}
function react(player, emoji) {
  if (!game || paused || modalKind || !$('homeScreen').hidden || !REACTIONS.includes(emoji)) return false;
  const now = Date.now();
  if (player === 0 && now-lastReactionAt < 2200) return false;
  if (player === 0) lastReactionAt = now;
  reactionStates[player] = {emoji, until:now+2000}; paintReactions();
  if(window.GameExperience)GameExperience.react({player,emoji,id:player+':'+now},{scope:'solo'});
  scheduleReactionExpiry();
  return true;
}
function scheduleReactionExpiry() {
  if (reactionTimer) clearTimeout(reactionTimer);
  const now = Date.now();
  for (const player of Object.keys(reactionStates)) if (reactionStates[player].until <= now) delete reactionStates[player];
  const expiry = Object.values(reactionStates).map(state => state.until);
  reactionTimer = expiry.length ? setTimeout(() => { paintReactions();scheduleReactionExpiry(); }, Math.max(1,Math.min(...expiry)-now)) : null;
}
function clearReactions() {
  if (reactionTimer) clearTimeout(reactionTimer);
  reactionTimer=null;reactionStates={};lastReactionAt=0;paintReactions();
}

function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
function write(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
function save() { if (game) write(GAME_KEY, JSON.stringify(game.s)); }
function stopBot() { if (timer !== null) clearTimeout(timer); timer = null; }
function card(c, index, enabled) {
  const tag = index === undefined ? 'div' : 'button', label = SYMBOL[c.v] || c.v;
  return `<${tag} class="card ${index === undefined ? '' : enabled ? 'playable' : 'unplayable'}" style="--c:${PAINT[c.c]};${c.c==='yellow'?'color:#30220b':''}" ${index === undefined ? '' : `data-index="${index}" aria-label="${c.c} ${c.v}" ${enabled ? '' : 'disabled'}`}><em>${label}</em><span>${label}</span><b class="mark">${MARK[c.c]}</b></${tag}>`;
}
function applySurface() {
  $('table').className = `table ${surface}`;
  TableThemes.apply(surface);
}
function render() {
  if (window.Online && Online.active) { Online.renderGame(); return; }
  $('reactions').hidden = false;
  $('onlineFinish').hidden = true;
  $('onlineRoomMenu').hidden = true;
  
  applySurface();
  if (!game) return;
  const s = game.s, active = s.turn === 0 && !game.over && !paused && !modalKind && pending === null;
  $('players').innerHTML = s.names.slice(1).map((name,offset) => {
    const i = offset + 1;
    return `<div class="player ${s.turn===i?'active':''}" data-seat="${relativeSeat(i,0,s.names.length)}" data-player="${i}" ${s.turn===i?'aria-current="true"':''}><div class="avatar">${['🦊','🤖','👽'][offset]}</div><strong>${name}</strong><div class="backs">${s.hands[i].length} cards${s.hands[i].length===1?' · ONE!':''}</div></div>`;
  }).join('');
  $('discard').innerHTML = card(game.top);
  $('direction').textContent = s.dir===1 ? '↻' : '↺';
  $('direction').setAttribute('aria-label', s.dir===1 ? 'Clockwise' : 'Counterclockwise');
  $('color').textContent = `${MARK[s.color]} ${s.color.toUpperCase()}`;
  $('color').style.color = PAINT[s.color];
  updateSelfSeat(s.hands[0].length, s.turn === 0 && !game.over);
  if($('handToggle'))$('handToggle').disabled=game.over;
  $('hand').innerHTML = s.hands[0].map((c,i) => card(c,i,active && game.canPlay(i))).join('');
  $('status').textContent = game.over ? s.notice : `${s.turn===0?'YOUR TURN':s.names[s.turn]+'’S TURN'} · ${s.notice}`;
  $('draw').disabled = $('deck').disabled = !active || s.drew || s.combo !== null;
  $('draw').hidden = true;
  $('pass').hidden = !active || (!s.drew && s.combo === null);
  $('pass').disabled = $('pass').hidden;
  $('call').hidden = !active || s.hands[0].length !== 2 || s.called;
  $('call').disabled = !active || s.hands[0].length !== 2 || s.called;
  $('call').textContent = s.called && s.turn===0 ? 'ONE! called ✓' : 'Call ONE!';
  paintReactions();
  const feedback={roundId:soloRound,turn:s.turn,me:0,top:game.top,handCount:s.hands[0].length,counts:s.hands.map(h=>h.length),names:s.names,color:s.color,combo:s.combo,winner:s.winner,dir:s.dir,called:s.called};
  const feedbackOptions={scope:'solo',initial:paused||document.hidden||!$('homeScreen').hidden};
  if(window.GameFeel)GameFeel.observe(feedback,feedbackOptions);
  if(window.GameExperience)GameExperience.observe(feedback,feedbackOptions);
}
function show(kind, html) {
  stopBot(); lastFocus = document.activeElement; modalKind = kind;
  $('dialog').innerHTML = html; $('modal').hidden = false;
  document.querySelector('main').setAttribute('aria-hidden','true');
  $('homeScreen').setAttribute('aria-hidden','true');
  render(); const first = $('dialog').querySelector('button,select'); if (first) first.focus();
}
function hide() {
  modalKind = ''; $('modal').hidden = true; document.querySelector('main').removeAttribute('aria-hidden'); $('homeScreen').removeAttribute('aria-hidden');
  render(); if (lastFocus && lastFocus.isConnected) lastFocus.focus();
}
function scheduleBot() {
  stopBot();
  if (window.Online && Online.active) return;
  if (!game || game.over || game.s.turn===0 || paused || modalKind || window.Tutorial?.active || window.GameFeel?.settingsOpen || document.hidden || !$('homeScreen').hidden) return;
  timer = setTimeout(() => { timer=null; if (!paused && !modalKind && !document.hidden) {
    const botPlayer = game.s.turn; game.bot(); afterMove();
    if (!game.over && Math.random() < 0.2) react(botPlayer, REACTIONS[Math.floor(Math.random()*REACTIONS.length)]);
  } }, 460);
}
function result() {
  const s = game.s, won = s.winner === 0;
  show('result',`<div class="eyebrow">ROUND COMPLETE</div><h2>${s.winner===-1?'The table is stuck!':won?'You popped off! 🎉':s.names[s.winner]+' wins!'}</h2><p>${won?'Excellent card work. The bots will pretend this never happened.':'Shuffle again and settle the score.'}</p><button class="primary" id="again">Play again →</button><button class="quiet" id="home">Back to home</button>`);
  $('again').onclick = () => start(); $('home').onclick = home;
}
function afterMove() {
  if (game.over && !game.s.counted) {
    game.s.counted = true;
    if (game.s.winner === 0) { wins++; write(WINS_KEY,String(wins));window.SoloLeaderboard?.finish(game); }
  }
  if(game.over)setHandOpen(false);
  save(); render();
  stopResult();
  if(game.over){stopBot();const delay=window.GameFeel?.getSettings().reducedMotion?0:480;resultTimer=setTimeout(()=>{resultTimer=null;if(game?.over&&!paused&&$('homeScreen').hidden&&!modalKind)result();},delay);}else scheduleBot();
}
function resumeGame() {
  if(window.GameFeel)GameFeel.reset('solo');
  pending = null; showGameScreen(); hide();
  if (window.Online && Online.active) { Online.renderGame(); return; }
  if (!game) { home(); return; }
  if (game.over) result(); else scheduleBot();
}
function showGameScreen() {
  $('homeScreen').hidden = true;
  document.querySelector('header').hidden = false;
  document.querySelector('main').hidden = false;
}
function home() {
  if (window.Online && Online.visible) { Online.back(); return; }
  window.SoloLeaderboard?.cancelStart();
  clearReactions();stopResult();TableThemes.apply(surface);
  if(window.GameExperience)GameExperience.reset('solo');
  if(window.GameFeel)GameFeel.reset('solo');
  setHandOpen(false);stopBot(); save(); pending = null; modalKind = ''; $('modal').hidden = true;
  document.querySelector('header').hidden = true; document.querySelector('main').hidden = true; $('homeScreen').hidden = false;
  $('homeScreen').removeAttribute('aria-hidden');
  $('homePlay').textContent = 'Continue solo game →';
  $('homePlay').hidden = !game||game.over;
  $('homeNewSolo').onclick = firstSolo;
  updateSoloStats();
  window.SoloLeaderboard?.refreshProfile();
  $('homePlay').onclick = () => game&&!game.over ? resumeGame() : firstSolo();
  $('homeOnline').textContent = 'Host / Join online room →';
  $('homeOnline').onclick = () => Online.open();
  $('homeRules').onclick = () => rules('home'); $('homePrivacy').onclick = () => privacy('home');
}
function updateSoloStats() {
  const board=window.SoloLeaderboard, global=board?.globalWins;
  $('homeStats').textContent = `${wins} local solo wins · ${global!==null&&global!==undefined?global+' global solo wins':board?.joined?'Global solo wins: syncing…':'Global solo wins: join leaderboard'}`;
}
function start() {if(window.SoloLeaderboard?.enabled)return SoloLeaderboard.startRanked();startSolo();}
function startSolo(nextGame) { stopResult();if(window.GameExperience)GameExperience.reset('solo'); setHandOpen(false); clearReactions(); soloRound++;if(window.Clarity)Clarity.clearHistory();game = nextGame||new Game('solo'); pending = null; showGameScreen(); hide(); afterMove(); }
function play(index) {
  if (window.Online && Online.active) { Online.play(index); return; }
  if (!game || game.s.turn!==0 || modalKind || paused || window.Tutorial?.active || !game.canPlay(index)) return;
  const c = game.s.hands[0][index];
  if (c.c === 'wild') {
    pending = index;
    show('color',`<h2>Pick your color</h2><p>Choose what everyone must match next.</p><div class="colors">${COLORS.map(color=>`<button data-color="${color}" style="background:${PAINT[color]}" aria-label="${color}">${MARK[color]}</button>`).join('')}</div><button class="quiet" id="cancelColor">Choose another card</button>`);
    $('dialog').querySelectorAll('[data-color]').forEach(button => button.onclick = () => { const i=pending; pending=null; game.play(i,button.dataset.color); hide(); afterMove(); });
    $('cancelColor').onclick = () => { pending=null; hide(); };
  } else { game.play(index); afterMove(); }
}
function rules(origin='game') {
  show('rules',`<h2>How to play</h2><p>First match the active color or top card's number or symbol. After playing a number, tap more cards with that same number in any color, then tap <b>End turn</b>. The last card sets the active color. You can stop after one card.</p><p>You may draw one card instead. Only the drawn card may start your play; if it is a number, you can then continue with the same number. You cannot draw after playing.</p><p><b>⊘ Skip</b> skips the next player.<br><b>⇄ Reverse</b> changes direction.<br><b>+2 / +4</b> makes the next player draw and lose a turn.<br><b>★ Wild</b> lets you choose the color. +4 is legal only without the active color. Action and wild cards end the turn immediately; no stacking.</p><p>Call <b>ONE!</b> with two cards before playing your second-to-last card, including during a same-number run. Forget and you draw two. First empty hand wins.</p><p>Easy bots use the same rules with relaxed choices. Color shapes: ● red · ◆ yellow · ▲ green · ■ blue.</p><button class="primary" id="back">Got it</button>`);
  $('back').onclick = () => origin==='home' ? home() : resumeGame();
}
function privacy(origin='game') {
  show('privacy',`<h2>Your game data.</h2><p>Solo play works offline. Your solo game, win count and table theme stay on this device; Android cloud backup is disabled.</p><p>Online play sends your nickname, avatar, room participation and game moves to the room server. Other room members see your nickname, avatar and card count, but not your hand. Guest session tokens identify your seat without an account. The service holds rooms in memory and removes idle rooms after 30 minutes. Server hosting may also process network addresses and operational logs.</p><p>The optional solo leaderboard publishes your chosen nickname and server-verified solo win count. Ranked round seeds and action replays are sent to verify results. Your leaderboard credential stays on this device; reinstalling or clearing app data loses access to that profile. Offline wins remain local. ShufflePop has no ads, analytics SDKs or purchases. Online play connects to the ShufflePop room service; solo play works without an internet connection.</p><p>Publisher: Dhaval Rajput</p><button class="primary" id="back">Back</button><button class="quiet danger" id="clear">Delete solo saved data</button>`);
  $('back').onclick = () => origin==='home' ? home() : resumeGame();
  $('clear').onclick = () => {
    show('delete',`<h2>Delete saved data?</h2><p>This clears your current game, win count and saved solo table theme.</p><button class="primary" id="deleteData">Delete data</button><button class="quiet" id="cancelDelete">Cancel</button>`);
    $('deleteData').onclick = () => { stopBot(); game=null; wins=0; TableThemes.clear();surface=TableThemes.solo; try{localStorage.removeItem(GAME_KEY);localStorage.removeItem(WINS_KEY);}catch(_){} home(); };
    $('cancelDelete').onclick = () => privacy(origin);
  };
}

if ($('handToggle')) $('handToggle').onclick = () => setHandOpen(!handOpen);
$('handClose').onclick = () => {setHandOpen(false);$('handToggle').focus();};
$('hand').onclick = event => { const button=event.target.closest('[data-index]'); if(button&&!button.disabled) play(Number(button.dataset.index)); };
$('draw').onclick = $('deck').onclick = () => { if(window.Online&&Online.active){Online.move('draw');return;} if(game&&game.s.turn===0&&!modalKind&&!paused&&game.draw()){setHandOpen(true);save();render();} };
$('pass').onclick = () => { if(window.Online&&Online.active){Online.move('endTurn');return;} if(game&&game.s.turn===0&&!modalKind&&!paused&&game.pass()){afterMove();} };
$('call').onclick = () => { if(window.Online&&Online.active){Online.move('call');return;} if(game&&game.s.turn===0&&!modalKind&&!paused&&game.call()){game.s.notice='ONE! called. Now play your card.';save();render();} };
$('rules').onclick = () => rules(); $('privacy').onclick = () => privacy();
$('heroCards').onclick = event => {
  const cardButton = event.target.closest('.card'); if (!cardButton) return;
  cardButton.classList.toggle('popped');
  cardButton.setAttribute('aria-pressed', String(cardButton.classList.contains('popped')));
};
$('reactions').onclick = event => {
  const button = event.target.closest('[data-reaction]'); if (button) { if(window.Online&&Online.active)Online.react(button.dataset.reaction);else react(0,button.dataset.reaction); }
};
function launchPractice(){
  if(window.Online?.visible)return;
  stopBot();save();Tutorial.start();
}
function firstSolo(){
  if(read('shufflepop.learn.offered') || window.Tutorial?.completed){start();return;}
  write('shufflepop.learn.offered','1');
  show('learnOffer','<h2>A quick practice?</h2><p>Learn matching cards, same-number turns and ONE by playing five short lessons.</p><button class="primary" id="tryPractice">Learn by playing</button><button class="quiet" id="skipPractice">Play now</button>');
  $('tryPractice').onclick=()=>{home();launchPractice();};$('skipPractice').onclick=start;
}
function tableThemeMenu(origin='game'){
  show('tableThemes','<div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>Choose your table</h2><p>Your solo theme is saved on this device. The host chooses the theme for online rooms.</p><div class="table-theme-options">'+TableThemes.themes.map(t=>'<button class="table-theme-choice" data-surface="'+t.surface+'" aria-pressed="'+(surface===t.surface)+'"><span class="theme-swatch" aria-hidden="true" style="--swatch-felt:'+t.felt+';--swatch-trim:'+t.trim+';--swatch-back:'+t.back+'"></span><span><strong>'+t.name+'</strong><small>'+t.description+'</small></span><span class="theme-check" aria-hidden="true">✓</span></button>').join('')+'</div><p id="themeSaved" role="status"></p><button class="primary" id="themeDone">Done</button>');
  $('dialog').querySelectorAll('[data-surface]').forEach(button=>button.onclick=()=>{
    if(!TableThemes.setSolo(button.dataset.surface))return;surface=TableThemes.solo;applySurface();
    $('dialog').querySelectorAll('[data-surface]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.surface===surface)));
    $('themeSaved').textContent=TableThemes.get(surface).name+' saved for solo play.';
  });
  $('themeDone').onclick=()=>origin==='home'?home():resumeGame();
}
function openFeedbackSettings(){stopBot();GameFeel.settings();}
function openGameMenu(){
  const online=!!window.Online?.active;
  show('gameMenu','<h2>Game settings</h2><button class="theme-menu-highlight" id="themeOptions">✦ Table themes</button><button class="quiet" id="feedbackOptions">Sound &amp; motion</button><button class="quiet" id="rulesOptions">How to play</button>'+(online?'<button class="quiet" id="roomOptions">Room options</button>':'')+'<button class="quiet" id="menuHome">Back to home</button>'+(!online?'<button class="quiet" id="newSoloGame">New solo game</button>':'')+'<button class="primary" id="closeGameMenu">Continue</button>');
  $('feedbackOptions').onclick=()=>{hide();openFeedbackSettings();};
  $('rulesOptions').onclick=()=>rules();
  $('themeOptions').onclick=()=>online?$('roomOptions').click():tableThemeMenu();
  if(online)$('roomOptions').onclick=()=>{hide();$('onlineRoomMenu').click();};
  if(!online)$('newSoloGame').onclick=start;
  $('menuHome').onclick=home;$('closeGameMenu').onclick=resumeGame;
}
document.addEventListener('tutorialclosed',()=>{render();scheduleBot();});
document.addEventListener('gamefeel:settingsClosed',()=>{render();scheduleBot();});
window.addEventListener('load',()=>{
  if($('learnPractice'))$('learnPractice').onclick=launchPractice;
  if($('homeSettings'))$('homeSettings').onclick=openFeedbackSettings;
  if($('gameSettings'))$('gameSettings').onclick=openGameMenu;
});
window.Pocket = {
  pause(){paused=true;stopResult();if(window.GameExperience)GameExperience.reset();if(window.GameFeel)GameFeel.suspend();if(window.Online)Online.pause();stopBot();clearReactions();save();render();},
  resume(){paused=false;if(window.GameFeel)GameFeel.resume();if(window.Online)Online.resume();render();if(!window.Online?.active&&game?.over&&$('homeScreen').hidden&&!modalKind)result();else scheduleBot();},
  back(){if(window.Tutorial?.active){Tutorial.close();return true;}if(window.GameFeel?.closeSettings())return true;if(window.Online&&Online.visible){if(modalKind){pending=null;hide();return true;}return Online.back();}if(modalKind || $('homeScreen').hidden){pending=null;home();return true;}return false;}
};
document.addEventListener('visibilitychange',()=>document.hidden?Pocket.pause():Pocket.resume());
window.addEventListener('pagehide',save);
document.addEventListener('keydown',event => {
  if(event.key==='Escape') Pocket.back();
  if(event.key==='Tab'&&modalKind){const nodes=[...$('dialog').querySelectorAll('button:not(:disabled),select')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
try { const saved=read(GAME_KEY); if(saved) game=Game.restore(JSON.parse(saved)); } catch (_) { game=null; }
applySurface(); render(); home();

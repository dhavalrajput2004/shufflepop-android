'use strict';
const { Game, COLORS } = PocketEngine;
const $ = id => document.getElementById(id);
const PAINT = { red:'#f04f5f',yellow:'#e9ad20',green:'#24a875',blue:'#347fe8',wild:'#452b79' };
const SYMBOL = { skip:'⊘',reverse:'⇄',draw2:'+2',wild:'★',draw4:'+4' };
const MARK = { red:'●',yellow:'◆',green:'▲',blue:'■',wild:'✦' };
const GAME_KEY = 'shufflePopGameV1', WINS_KEY = 'shufflePopWins';
let game = null, timer = null, modalKind = '', pending = null, paused = false, lastFocus = null;
let wins = Number(read(WINS_KEY) || 0);
if (!Number.isFinite(wins) || wins < 0) wins = 0;
wins = Math.floor(wins);
const surface = 'mat';
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
}
function render() {
  if (window.Online && Online.active) { Online.renderGame(); return; }
  $('reactions').hidden = false;
  $('onlineFinish').hidden = true;
  $('onlineRoomMenu').hidden = true;
  const badge = document.querySelector('header .pill'); if (badge) badge.textContent = 'Solo · Easy';
  applySurface();
  if (!game) return;
  const s = game.s, active = s.turn === 0 && !game.over && !paused && !modalKind && pending === null;
  $('players').innerHTML = s.names.slice(1).map((name,offset) => {
    const i = offset + 1;
    return `<div class="player ${s.turn===i?'active':''}" data-player="${i}" ${s.turn===i?'aria-current="true"':''}><div class="avatar">${['🦊','🤖','👽'][offset]}</div><strong>${name}</strong><div class="backs">${s.hands[i].length} cards${s.hands[i].length===1?' · ONE!':''}</div></div>`;
  }).join('');
  $('discard').innerHTML = card(game.top);
  $('direction').textContent = s.dir===1 ? '↻' : '↺';
  $('direction').setAttribute('aria-label', s.dir===1 ? 'Clockwise' : 'Counterclockwise');
  $('color').textContent = `${MARK[s.color]} ${s.color.toUpperCase()}`;
  $('color').style.color = PAINT[s.color];
  $('handTitle').textContent = `Your hand · ${s.hands[0].length}`;
  $('hand').innerHTML = s.hands[0].map((c,i) => card(c,i,active && game.canPlay(i))).join('');
  $('status').textContent = game.over ? s.notice : `${s.turn===0?'YOUR TURN':s.names[s.turn]+'’S TURN'} · ${s.notice}`;
  $('draw').disabled = $('deck').disabled = !active || s.drew || s.combo !== null;
  $('draw').hidden = !active || s.drew || s.combo !== null;
  $('pass').hidden = !active || (!s.drew && s.combo === null);
  $('pass').disabled = $('pass').hidden;
  $('call').hidden = !active || s.hands[0].length !== 2 || s.called;
  $('call').disabled = !active || s.hands[0].length !== 2 || s.called;
  $('call').textContent = s.called && s.turn===0 ? 'ONE! called ✓' : 'Call ONE!';
  paintReactions();
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
  if (!game || game.over || game.s.turn===0 || paused || modalKind || document.hidden || !$('homeScreen').hidden) return;
  timer = setTimeout(() => { timer=null; if (!paused && !modalKind && !document.hidden) {
    const botPlayer = game.s.turn; game.bot(); afterMove();
    if (!game.over && Math.random() < 0.2) react(botPlayer, REACTIONS[Math.floor(Math.random()*REACTIONS.length)]);
  } }, 700);
}
function result() {
  const s = game.s, won = s.winner === 0;
  show('result',`<div class="eyebrow">ROUND COMPLETE</div><h2>${s.winner===-1?'The table is stuck!':won?'You popped off! 🎉':s.names[s.winner]+' wins!'}</h2><p>${won?'Excellent card work. The bots will pretend this never happened.':'Shuffle again and settle the score.'}</p><button class="primary" id="again">Play again →</button><button class="quiet" id="home">Back to home</button>`);
  $('again').onclick = () => start(); $('home').onclick = home;
}
function afterMove() {
  if (game.over && !game.s.counted) {
    game.s.counted = true;
    if (game.s.winner === 0) { wins++; write(WINS_KEY,String(wins)); }
  }
  save(); render();
  if (game.over) result(); else scheduleBot();
}
function resumeGame() {
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
  clearReactions();
  stopBot(); save(); pending = null; modalKind = ''; $('modal').hidden = true;
  document.querySelector('header').hidden = true; document.querySelector('main').hidden = true; $('homeScreen').hidden = false;
  $('homeScreen').removeAttribute('aria-hidden');
  $('homePlay').textContent = game&&!game.over ? 'Continue solo game →' : 'Play solo →';
  $('homeStats').textContent = `${wins} solo wins · Offline · No ads`;
  $('homePlay').onclick = () => game&&!game.over ? resumeGame() : start();
  $('homeOnline').textContent = 'Host / Join online room →';
  $('homeOnline').onclick = () => Online.open();
  $('homeRules').onclick = () => rules('home'); $('homePrivacy').onclick = () => privacy('home');
}
function confirmFresh() {
  show('confirm',`<h2>Deal a fresh round?</h2><p>This replaces the current saved game.</p><button class="primary" id="confirmStart">Shuffle & deal</button><button class="quiet" id="cancelStart">Keep current game</button>`);
  $('confirmStart').onclick = start; $('cancelStart').onclick = home;
}
function start() { clearReactions(); game = new Game('solo'); pending = null; showGameScreen(); hide(); afterMove(); }
function play(index) {
  if (window.Online && Online.active) { Online.play(index); return; }
  if (!game || game.s.turn!==0 || modalKind || paused || !game.canPlay(index)) return;
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
  show('privacy',`<h2>Your game data.</h2><p>Solo play works offline. Your solo game and win count stay on this device; Android cloud backup is disabled.</p><p>Online play sends your nickname, avatar, room participation and game moves to the room server. Other room members see your nickname, avatar and card count, but not your hand. Guest session tokens identify your seat without an account. The service holds rooms in memory and removes idle rooms after 30 minutes. Server hosting may also process network addresses and operational logs.</p><p>This development version has no ads, analytics SDKs or purchases. Online hosting and the public privacy policy must be configured before release.</p><p>Publisher: Dhaval Rajput</p><button class="primary" id="back">Back</button><button class="quiet danger" id="clear">Delete solo saved data</button>`);
  $('back').onclick = () => origin==='home' ? home() : resumeGame();
  $('clear').onclick = () => {
    show('delete',`<h2>Delete saved data?</h2><p>This clears your current game and win count.</p><button class="primary" id="deleteData">Delete data</button><button class="quiet" id="cancelDelete">Cancel</button>`);
    $('deleteData').onclick = () => { stopBot(); game=null; wins=0; try{localStorage.removeItem(GAME_KEY);localStorage.removeItem(WINS_KEY);}catch(_){} home(); };
    $('cancelDelete').onclick = () => privacy(origin);
  };
}

$('hand').onclick = event => { const button=event.target.closest('[data-index]'); if(button&&!button.disabled) play(Number(button.dataset.index)); };
$('draw').onclick = $('deck').onclick = () => { if(window.Online&&Online.active){Online.move('draw');return;} if(game&&game.s.turn===0&&!modalKind&&!paused&&game.draw()){save();render();} };
$('pass').onclick = () => { if(window.Online&&Online.active){Online.move('endTurn');return;} if(game&&game.s.turn===0&&!modalKind&&!paused&&game.pass()) afterMove(); };
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
window.Pocket = {
  pause(){paused=true;if(window.Online)Online.pause();stopBot();clearReactions();save();render();},
  resume(){paused=false;if(window.Online)Online.resume();render();scheduleBot();},
  back(){if(window.Online&&Online.visible){if(modalKind){pending=null;hide();return true;}return Online.back();}if(modalKind || $('homeScreen').hidden){pending=null;home();return true;}return false;}
};
document.addEventListener('visibilitychange',()=>document.hidden?Pocket.pause():Pocket.resume());
window.addEventListener('pagehide',save);
document.addEventListener('keydown',event => {
  if(event.key==='Escape') Pocket.back();
  if(event.key==='Tab'&&modalKind){const nodes=[...$('dialog').querySelectorAll('button:not(:disabled),select')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
try { const saved=read(GAME_KEY); if(saved) game=Game.restore(JSON.parse(saved)); } catch (_) { game=null; }
applySurface(); render(); home();

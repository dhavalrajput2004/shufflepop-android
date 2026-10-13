'use strict';
window.Online = (() => {
  const avatarIcons={fox:'🦊',robot:'🤖',alien:'👽',cat:'🐱'};
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const base=window.SHUFFLEPOP_API_BASE||'';
  const configured=/^https:\/\/[^/]+$/.test(base);
  const sessionKey='shufflePopOnlineSessionV1';
  function storedToken(){try{const s=JSON.parse(localStorage.getItem(sessionKey));return configured&&s?.base===base&&/^[A-Za-z0-9_-]{43}$/.test(s.token)?s.token:null;}catch(_){return null;}}
  function persist(){try{if(token)localStorage.setItem(sessionKey,JSON.stringify({base,token}));else localStorage.removeItem(sessionKey);}catch(_){}}
  let token=storedToken(),state=null,active=false,visible=false,busy=false,poll=null,generation=0,note='',onlinePaused=false,connected=false,failures=0;
  let awayPromise=Promise.resolve();
  const errors={ROOM_FULL:'This room is full.',ROOM_NOT_FOUND:'Room not found. Check the code.',NAME_TAKEN:'That nickname is taken. Try another.',NOT_READY:'At least two players must be ready.',HOST_ONLY:'Only the host can do that.',INVALID_SESSION:'Your room session has expired.',GAME_STARTED:'That game has already started.',RATE_LIMITED:'Too many requests. Try again shortly.',STALE_MOVE:'The table changed. Please try your move again.',ILLEGAL_MOVE:'That move is not allowed.',NOT_YOUR_TURN:'Wait for your turn.'};
  function stop(){if(poll)clearTimeout(poll);poll=null;}
  async function api(path,body,authToken=token){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(base+'/v1/rooms/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(authToken?{Authorization:'Bearer '+authToken}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,credentials:'omit',cache:'no-store'});
      const data=await response.json();
      if(!response.ok){const e=new Error(errors[data.error]||'Unable to update this room.');e.code=data.error;e.view=data.view;throw e;}
      return data;
    }finally{clearTimeout(timeout);}
  }
  function schedule(){stop();if(visible&&!onlinePaused&&token)poll=setTimeout(refresh,Math.min(10000,1200*2**failures));}
  async function refresh(){
    if(busy){schedule();return;}const g=generation;
    try{const next=await api('view');if(g!==generation)return;state=next;connected=true;failures=0;note='';paint();}
    catch(e){if(g!==generation)return;connected=false;failures=Math.min(4,failures+1);note='Reconnecting… '+e.message;if(e.code==='INVALID_SESSION'){token=null;persist();state=null;active=false;showPanel();note='Your room expired. Create or join another room.';}paint();}
    finally{if(g===generation)schedule();}
  }
  async function action(path,body){
    if(busy)return;busy=true;const g=++generation;stop();paint();
    try{const data=await api(path,body);if(g!==generation)return false;
      if(data.token){token=data.token;state={lobby:data.lobby,game:null};}
      else if(path==='leave'){token=null;state=null;active=false;}
      else if(path==='move'){state.game=data.view;}
      else state=data;
      persist();connected=true;failures=0;note='';return true;
    }catch(e){if(g!==generation)return false;if(e.view&&state)state.game=e.view;note=e.code==='ROOM_PAUSED'?'Waiting for a player to reconnect.':e.code==='REACTION_COOLDOWN'?'Wait a moment before sending another reaction.':e.message;if(!e.code){connected=false;failures=Math.min(4,failures+1);note='Reconnecting…';}if(e.code==='INVALID_SESSION'){token=null;persist();state=null;active=false;showPanel();}return false;}
    finally{if(g===generation){busy=false;paint();schedule();}}
  }
  function showPanel(){document.getElementById('onlineScreen').hidden=false;document.querySelector('header').hidden=true;document.querySelector('main').hidden=true;document.getElementById('homeScreen').hidden=true;}
  function markAway(){if(token&&configured){const previous=token;awayPromise=awayPromise.catch(()=>{}).then(()=>api('disconnect',{},previous)).catch(()=>{});}connected=false;}
  function open(){home();visible=true;onlinePaused=false;connected=false;showPanel();paint();if(token)return awayPromise.then(()=>{if(visible&&token)return refresh();});}
  function back(){if(!visible)return false;markAway();visible=false;active=false;generation++;busy=false;stop();document.getElementById('onlineScreen').hidden=true;document.getElementById('reactions').hidden=false;document.getElementById('onlineFinish').hidden=true;home();return true;}
  function paint(){
    if(!visible)return;
    document.getElementById('onlineRoomMenu').hidden=!state?.game;
    if(state?.game){active=true;document.getElementById('onlineScreen').hidden=true;showGameScreen();renderGame();return;}
    active=false;showPanel();const panel=document.getElementById('onlineBody');
    if(token&&!state){panel.innerHTML='<h2>Returning to your room…</h2><p id="onlineMessage" role="status"></p><button class="quiet" id="forgetRoom">Forget this room</button>';document.getElementById('onlineMessage').textContent=note;document.getElementById('forgetRoom').onclick=()=>{generation++;token=null;persist();state=null;busy=false;stop();paint();};return;}
    if(!token){
      // Do not replace a form while typing or awaiting its request.
      if(!panel.querySelector('#roomName')){
        panel.innerHTML=`<div class="eyebrow">PLAY WITH FRIENDS</div><h2>Your table. Your people.</h2><p>Create a private room or enter a friend's code.</p><label class="onlineLabel" for="roomName">Nickname</label><input id="roomName" maxlength="24" autocomplete="nickname" placeholder="Your name"><label class="onlineLabel" for="roomAvatar">Avatar</label><select id="roomAvatar"><option value="fox">🦊 Fox</option><option value="robot">🤖 Robot</option><option value="alien">👽 Alien</option><option value="cat">🐱 Cat</option></select><div class="onlineHost"><label class="onlineLabel" for="roomCapacity">Players</label><select id="roomCapacity"><option value="4">Up to 4</option><option value="3">Up to 3</option><option value="2">2 players</option></select><label class="onlineLabel" for="roomSurface">Table surface</label><select id="roomSurface"><option value="mat">Mat</option><option value="wood">Wood</option><option value="grass">Grass</option></select><button class="primary" id="createRoom">Host a room →</button></div><label class="onlineLabel" for="roomCode">Room code</label><input id="roomCode" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="ABC234"><button class="quiet" id="joinRoom">Join a room →</button><p id="onlineMessage" role="status"></p>`;
        const identity=()=>({name:document.getElementById('roomName').value.trim(),avatar:document.getElementById('roomAvatar').value});
        document.getElementById('createRoom').onclick=()=>action('create',{...identity(),capacity:Number(document.getElementById('roomCapacity').value),surface:document.getElementById('roomSurface').value});
        document.getElementById('joinRoom').onclick=()=>action('join',{...identity(),code:document.getElementById('roomCode').value.trim().toUpperCase()});
      }
      panel.querySelectorAll('button').forEach(b=>b.disabled=busy||!configured);
      document.getElementById('onlineMessage').textContent=note||(!configured?'Online rooms are not available in this build yet. Solo play is ready offline.':'Share the code privately with your friends.');return;
    }
    const l=state.lobby,mine=l.players.find(p=>p.id===l.you),host=l.host===l.you;
    panel.innerHTML=`<div class="eyebrow">PRIVATE ROOM</div><h2 class="roomCodeDisplay">${escape(l.code)}</h2><p>Share this code with your friends · ${l.players.length}/${l.capacity} players</p><div class="onlineSeats">${l.players.map(p=>`<div class="onlineSeat"><span>${avatarIcons[p.avatar]}</span><div><strong>${escape(p.name)}</strong><small>${p.id===l.host?'Host · ':''}${p.ready?'Ready ✓':'Getting ready'}</small></div></div>`).join('')}</div><p>Table: ${escape(l.surface)}</p>${host?`<label class="onlineLabel" for="lobbySurface">Choose table surface</label><select id="lobbySurface">${['mat','wood','grass'].map(s=>`<option value="${s}" ${l.surface===s?'selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select>`:''}<button class="primary" id="roomReady">${mine.ready?'Not ready':'Ready to play ✓'}</button>${host?'<button class="quiet" id="roomStart">Start game →</button>':'<p>Waiting for the host to start.</p>'}<button class="quiet" id="roomLeave">Leave room</button><p id="onlineMessage" role="status"></p>`;
    panel.querySelectorAll('button,select').forEach(b=>b.disabled=busy);
    document.getElementById('roomReady').onclick=()=>action('ready',{ready:!mine.ready});
    document.getElementById('roomLeave').onclick=()=>action('leave',{});
    if(host){document.getElementById('roomStart').disabled=busy||!l.canStart;document.getElementById('roomStart').onclick=()=>action('start',{});document.getElementById('lobbySurface').onchange=e=>action('settings',{surface:e.target.value});}
    document.getElementById('onlineMessage').textContent=note||l.notice||'Everyone must be ready before the host starts.';
  }
  function renderGame(){
    if(!active||!state?.game)return;const v=state.game,l=state.lobby,enabled=connected&&!v.paused&&!busy&&!onlinePaused&&!modalKind;
    const badge=document.querySelector('header .pill');if(badge)badge.textContent='Room · '+l.code;
    $('table').className='table '+l.surface;
    const bubble=id=>{const r=(state.reactions||[]).find(r=>r.player===id);return r?'<span class="reactionBubble">'+escape(r.emoji)+'</span>':'';};
    $('players').innerHTML=v.players.map((p,i)=>({p,i})).filter(({i})=>i!==v.seat).map(({p,i})=>`<div class="player ${i===v.turn?'active':''}"><div class="avatar">${avatarIcons[l.players[i].avatar]}</div><strong>${escape(p.name)}</strong><div class="backs">${p.cards} cards${l.players[i].connected?'':' · Reconnecting'}</div>${bubble(l.players[i].id)}</div>`).join('');
    $('discard').innerHTML=card(v.top);$('direction').textContent=v.direction===1?'↻':'↺';$('color').textContent=MARK[v.color]+' '+v.color.toUpperCase();$('color').style.color=PAINT[v.color];
    $('handTitle').textContent='Your hand · '+v.hand.length;$('hand').innerHTML=v.hand.map((c,i)=>card(c,i,enabled&&v.playableIds.includes(c.id))).join('');
    $('status').textContent=note||(!connected?'Reconnecting…':v.paused?'Waiting for a player to reconnect.':v.winner===null?(v.turn===v.seat?'YOUR TURN':v.players[v.turn].name+'’S TURN')+' · '+v.notice:v.winner===-1?'The round is a draw.':v.players[v.winner].name+' wins!');
    $('draw').hidden=!v.canDraw;$('draw').disabled=$('deck').disabled=!enabled||!v.canDraw;
    $('pass').hidden=!v.canEndTurn;$('pass').disabled=!enabled||!v.canEndTurn;
    $('call').hidden=!v.canCall;$('call').disabled=!enabled||!v.canCall;$('call').textContent='Call ONE!';
    $('reactions').hidden=false;
    $('selfReaction').innerHTML=bubble(l.you);$('selfReaction').hidden=!$('selfReaction').innerHTML;
    $('onlineFinish').hidden=v.winner===null;
    if(v.winner!==null){const host=l.host===l.you;$('onlineFinish').innerHTML=`<button class="primary" id="onlineRematch" ${host?'':'disabled'}>${host?'Rematch →':'Waiting for host rematch'}</button><button class="quiet" id="onlineLeave">Leave room</button>`;$('onlineRematch').disabled=!host||busy||!connected;$('onlineRematch').onclick=()=>action('rematch',{});$('onlineLeave').onclick=()=>action('leave',{});}
  }
  async function move(type,extra={}){if(!active||!connected||state.game.paused||busy||onlinePaused||modalKind)return;await action('move',{type,revision:state.game.revision,...extra});}
  function play(index){
    if(!active||!connected||state.game.paused||busy||onlinePaused||modalKind)return;const c=state.game.hand[index];if(!c||!state.game.playableIds.includes(c.id))return;
    if(c.c!=='wild')return move('play',{cardId:c.id});
    show('onlineColor',`<h2>Pick your color</h2><div class="colors">${COLORS.map(color=>`<button data-color="${color}" style="background:${PAINT[color]}" aria-label="${color}">${MARK[color]}</button>`).join('')}</div><button class="quiet" id="cancelOnlineColor">Choose another card</button>`);
    $('dialog').querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{hide();move('play',{cardId:c.id,color:b.dataset.color});});
    $('cancelOnlineColor').onclick=hide;
  }
  document.getElementById('onlineBack').onclick=back;
  document.getElementById('onlineRoomMenu').onclick=()=>{
    if(!active)return;
    show('onlineOptions',`<h2>Room ${escape(state.lobby.code)}</h2><p>Leaving ends this round for everyone. Going back to Home reserves your seat for 90 seconds.</p><button class="quiet" id="keepOnlinePlaying">Keep playing</button><button class="call" id="leaveOnlineGame">Leave room</button>`);
    $('keepOnlinePlaying').onclick=hide;
    $('leaveOnlineGame').onclick=()=>{hide();action('leave',{});};
  };
  return {open,back,renderGame,move,play,react(emoji){if(active&&connected&&!busy&&!onlinePaused&&!modalKind)return action('react',{emoji});},get active(){return active;},pause(){onlinePaused=true;generation++;busy=false;stop();markAway();renderGame();},resume(){onlinePaused=false;connected=false;if(visible&&token)return awayPromise.then(()=>{if(visible&&token)return refresh();});},get visible(){return visible;}};
})();

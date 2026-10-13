'use strict';
const {randomInt, randomBytes} = require('node:crypto');
const {Match} = require('./match.js');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMOJIS = ['😂','😎','😭','😡','👏','🔥'];
class RoomError extends Error { constructor(code) { super(code); this.code=code; } }
function fail(code) { throw new RoomError(code); }
function identity(name, avatar='fox') {
  if (typeof name !== 'string' || !name.trim() || name.trim().length>24 || /[\x00-\x1f\x7f]/.test(name)) fail('INVALID_NAME');
  if (!['fox','robot','alien','cat'].includes(avatar)) fail('INVALID_AVATAR');
  return {name:name.trim(),avatar};
}
class Rooms {
  #rooms = new Map();
  #sessions = new Map();
  constructor({now=Date.now, ttl=30*60*1000, maxRooms=1000, heartbeatTimeout=10000, reconnectGrace=90000}={}) { this.now=now;this.ttl=ttl;this.maxRooms=maxRooms;this.heartbeatTimeout=heartbeatTimeout;this.reconnectGrace=reconnectGrace; }
  #connected(p) { return p.disconnectedAt===null && this.now()-p.lastSeen<=this.heartbeatTimeout; }
  #reset(room,notice) {
    if(room.match)room.revisionFloor=room.match.view(0).revision+1;
    room.match=null;room.notice=notice;room.reactions=[];room.players.forEach(p=>p.ready=false);
  }
  cleanup() {
    for(const [code,room] of this.#rooms) {
      if(room.match){
        const lost=room.players.filter(p=>this.now()-(p.disconnectedAt??(p.lastSeen+this.heartbeatTimeout))>this.reconnectGrace);
        if(lost.length){
          this.#reset(room,'A player disconnected. The round ended; ready up for a fresh game.');
          lost.forEach(p=>this.#sessions.delete(p.token));room.players=room.players.filter(p=>!lost.includes(p));
          if(!room.players.some(p=>p.id===room.host))room.host=room.players[0]?.id;
        }
      }
      if(room.expires<=this.now()||!room.players.length) {
      for(const p of room.players) this.#sessions.delete(p.token);
      this.#rooms.delete(code);
      }
    }
  }
  #touch(room) { room.expires=this.now()+this.ttl; }
  #resolve(token) {
    this.cleanup();const entry=this.#sessions.get(token);
    if(!entry) fail('INVALID_SESSION');
    const room=this.#rooms.get(entry.code),player=room.players.find(p=>p.token===token);
    player.lastSeen=this.now();player.disconnectedAt=null;this.#touch(room);
    return {room,player};
  }
  #player(info) { return {...info,id:randomBytes(12).toString('hex'),token:randomBytes(32).toString('base64url'),ready:false,lastSeen:this.now(),disconnectedAt:null,lastReaction:null}; }
  #lobby(room,player) {
    return {code:room.code,you:player.id,host:room.host,status:room.match?'playing':'lobby',surface:room.surface,capacity:room.capacity,
      expiresAt:room.expires,notice:room.notice||'',round:room.round||0,players:room.players.map(p=>({id:p.id,name:p.name,avatar:p.avatar,ready:p.ready,connected:this.#connected(p)})),
      canStart:player.id===room.host && !room.match && room.players.length>=2 && room.players.every(p=>p.ready&&this.#connected(p))};
  }
  create({name,avatar,capacity=4,surface='mat'}={}) {
    const info=identity(name,avatar);this.cleanup();
    if(!Number.isInteger(capacity)||capacity<2||capacity>4) fail('INVALID_CAPACITY');
    if(!['wood','mat','grass'].includes(surface)) fail('INVALID_SURFACE');
    if(this.#rooms.size>=this.maxRooms) fail('ROOM_LIMIT');
    let code;
    do { code=Array.from({length:6},()=>ALPHABET[randomInt(ALPHABET.length)]).join(''); } while(this.#rooms.has(code));
    const p=this.#player(info),room={code,host:p.id,players:[p],capacity,surface,match:null,round:0,revisionFloor:0,reactions:[],reactionId:0};
    this.#touch(room);this.#rooms.set(code,room);this.#sessions.set(p.token,{code});
    return {token:p.token,lobby:this.#lobby(room,p)};
  }
  join({code,name,avatar}={}) {
    const info=identity(name,avatar);this.cleanup();
    if(typeof code!=='string'||!/^[A-Z2-9]{6}$/.test(code.trim().toUpperCase())) fail('INVALID_CODE');
    const room=this.#rooms.get(code.trim().toUpperCase());
    if(!room) fail('ROOM_NOT_FOUND');
    if(room.match) fail('GAME_STARTED');
    if(room.players.length>=room.capacity) fail('ROOM_FULL');
    if(room.players.some(p=>p.name.toLowerCase()===info.name.toLowerCase())) fail('NAME_TAKEN');
    const p=this.#player(info);room.players.push(p);this.#sessions.set(p.token,{code:room.code});this.#touch(room);
    return {token:p.token,lobby:this.#lobby(room,p)};
  }
  view(token) {
    const {room,player}=this.#resolve(token);
    room.reactions=room.reactions.filter(r=>r.until>this.now());
    const game=room.match?{...room.match.view(room.players.indexOf(player)),round:room.round,paused:room.players.some(p=>!this.#connected(p))}:null;
    return {lobby:this.#lobby(room,player),game,reactions:room.reactions.map(r=>({...r}))};
  }
  ready(token,ready) {
    const {room,player}=this.#resolve(token);
    if(room.match) fail('GAME_STARTED');if(typeof ready!=='boolean') fail('INVALID_READY');
    player.ready=ready;this.#touch(room);return this.view(token);
  }
  settings(token,{surface,capacity}={}) {
    const {room,player}=this.#resolve(token);
    if(player.id!==room.host) fail('HOST_ONLY');if(room.match) fail('GAME_STARTED');
    if(surface!==undefined&&!['wood','mat','grass'].includes(surface)) fail('INVALID_SURFACE');
    if(capacity!==undefined&&(!Number.isInteger(capacity)||capacity<2||capacity>4||capacity<room.players.length)) fail('INVALID_CAPACITY');
    if(surface!==undefined) room.surface=surface;if(capacity!==undefined) room.capacity=capacity;
    room.players.forEach(p=>p.ready=false);this.#touch(room);return this.view(token);
  }
  start(token) {
    const {room,player}=this.#resolve(token);
    if(player.id!==room.host) fail('HOST_ONLY');if(room.match) fail('GAME_STARTED');
    if(room.players.length<2||!room.players.every(p=>p.ready&&this.#connected(p))) fail('NOT_READY');
    room.match=new Match(room.players.map(p=>p.name),()=>randomInt(0x100000000)/0x100000000,room.revisionFloor);
    room.round++;room.notice='';room.reactions=[];
    this.#touch(room);return this.view(token);
  }
  move(token,command) {
    const {room,player}=this.#resolve(token);if(!room.match) fail('GAME_NOT_STARTED');
    if(room.players.some(p=>!this.#connected(p))) fail('ROOM_PAUSED');
    const result=room.match.dispatch(room.players.indexOf(player),command);
    if(result.ok)this.#touch(room);result.view={...result.view,round:room.round,paused:false};return result;
  }
  disconnect(token) {
    const {room,player}=this.#resolve(token);player.disconnectedAt=this.now();
    return {disconnected:true,graceMs:this.reconnectGrace};
  }
  rematch(token) {
    const {room,player}=this.#resolve(token);
    if(player.id!==room.host)fail('HOST_ONLY');
    if(!room.match||room.match.view(0).winner===null)fail('ROUND_NOT_FINISHED');
    this.#reset(room,'Ready up for the next round.');return this.view(token);
  }
  react(token,emoji) {
    const {room,player}=this.#resolve(token);if(!room.match)fail('GAME_NOT_STARTED');
    if(!EMOJIS.includes(emoji))fail('INVALID_REACTION');
    if(player.lastReaction!==null&&this.now()-player.lastReaction<2200)fail('REACTION_COOLDOWN');
    player.lastReaction=this.now();room.reactions=room.reactions.filter(r=>r.until>this.now()&&r.player!==player.id);
    room.reactions.push({id:++room.reactionId,player:player.id,emoji,until:this.now()+3000});
    return this.view(token);
  }
  leave(token) {
    const {room,player}=this.#resolve(token);
    if(room.match)this.#reset(room,'A player left. The round ended; ready up for a fresh game.');
    room.players=room.players.filter(p=>p!==player);this.#sessions.delete(token);
    if(!room.players.length){this.#rooms.delete(room.code);return {left:true};}
    if(player.id===room.host)room.host=room.players[0].id;
    room.players.forEach(p=>p.ready=false);this.#touch(room);return {left:true};
  }
}
module.exports={Rooms,RoomError};

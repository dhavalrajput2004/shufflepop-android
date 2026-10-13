const test=require('node:test');const assert=require('node:assert/strict');
const {Rooms}=require('../server/rooms.js');
const pair=()=>{const rooms=new Rooms();const host=rooms.create({name:'Dhaval'});const guest=rooms.join({code:host.lobby.code,name:'Friend'});return {rooms,host,guest};};
test('secure room code and private session credentials',()=>{
 const {rooms,host,guest}=pair();assert.match(host.lobby.code,/^[A-Z2-9]{6}$/);assert.notEqual(host.token,guest.token);
 assert.ok(host.token.length>=43);assert.equal(rooms.view(host.token).lobby.players.length,2);
 assert.ok(!JSON.stringify(rooms.view(host.token)).includes(guest.token));assert.ok(!JSON.stringify(rooms.view(host.token)).includes(host.token));
 assert.throws(()=>rooms.view('fake'),/INVALID_SESSION/);
});
test('capacity, duplicate names, invalid inputs and code normalization',()=>{
 const r=new Rooms();const h=r.create({name:'A',capacity:2});r.join({code:h.lobby.code.toLowerCase(),name:'B'});
 assert.throws(()=>r.join({code:h.lobby.code,name:'C'}),/ROOM_FULL/);
 const x=r.create({name:'Alice'});assert.throws(()=>r.join({code:x.lobby.code,name:'alice'}),/NAME_TAKEN/);
 assert.throws(()=>r.create({name:'A',capacity:5}),/INVALID_CAPACITY/);
 assert.throws(()=>r.create({name:'A',surface:'moon'}),/INVALID_SURFACE/);
 assert.throws(()=>r.create({name:'\n'}),/INVALID_NAME/);
 assert.throws(()=>r.join({code:'?',name:'A'}),/INVALID_CODE/);
});
test('only host can start and every player must be ready',()=>{
 const {rooms:r,host:h,guest:g}=pair();assert.throws(()=>r.start(g.token),/HOST_ONLY/);assert.throws(()=>r.start(h.token),/NOT_READY/);
 r.ready(h.token,true);r.ready(g.token,true);assert.ok(r.view(h.token).lobby.canStart);
 const started=r.start(h.token);assert.equal(started.lobby.status,'playing');assert.equal(started.game.hand.length,7);
 assert.throws(()=>r.join({code:h.lobby.code,name:'Late'}),/GAME_STARTED/);
 assert.throws(()=>r.start(h.token),/GAME_STARTED/);
 assert.equal(r.move(g.token,{type:'draw',revision:0}).error,'NOT_YOUR_TURN');
 assert.ok(r.move(h.token,{type:'draw',revision:0}).ok);
});
test('host-only surface changes reset readiness and validate atomically',()=>{
 const {rooms:r,host:h,guest:g}=pair();r.ready(h.token,true);r.ready(g.token,true);
 assert.throws(()=>r.settings(g.token,{surface:'wood'}),/HOST_ONLY/);
 assert.throws(()=>r.settings(h.token,{surface:'wood',capacity:1}),/INVALID_CAPACITY/);
 assert.equal(r.view(h.token).lobby.surface,'mat');r.settings(h.token,{surface:'grass'});
 assert.ok(r.view(g.token).lobby.players.every(p=>!p.ready));assert.equal(r.view(g.token).lobby.surface,'grass');
});
test('leaving transfers host, clears readiness and invalidates old session',()=>{
 const {rooms:r,host:h,guest:g}=pair();r.ready(g.token,true);r.leave(h.token);
 const v=r.view(g.token).lobby;assert.equal(v.host,g.lobby.you);assert.equal(v.players[0].ready,false);
 assert.throws(()=>r.view(h.token),/INVALID_SESSION/);r.leave(g.token);
 assert.throws(()=>r.join({code:h.lobby.code,name:'New'}),/ROOM_NOT_FOUND/);
});
test('idle rooms expire; capacity limit recovers after cleanup',()=>{
 let now=0;const r=new Rooms({now:()=>now,ttl:100,maxRooms:1});const h=r.create({name:'A'});
 assert.throws(()=>r.create({name:'B'}),/ROOM_LIMIT/);now=101;
 assert.throws(()=>r.view(h.token),/INVALID_SESSION/);assert.ok(r.create({name:'B'}).token);
});
test('single host cannot start; leaving ends round instead of shifting active seats',()=>{
 const r=new Rooms();const h=r.create({name:'A'});r.ready(h.token,true);assert.throws(()=>r.start(h.token),/NOT_READY/);
 const g=r.join({code:h.lobby.code,name:'B'});r.ready(g.token,true);r.start(h.token);
 r.leave(h.token);assert.equal(r.view(g.token).game,null);assert.equal(r.view(g.token).lobby.host,g.lobby.you);
});

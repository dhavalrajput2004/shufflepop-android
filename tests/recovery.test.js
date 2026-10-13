const test=require('node:test'),assert=require('node:assert/strict');
const {Rooms}=require('../server/rooms.js');
function setup(){let time=0;const rooms=new Rooms({now:()=>time});const h=rooms.create({name:'Host'}),g=rooms.join({code:h.lobby.code,name:'Guest'});rooms.ready(h.token,true);rooms.ready(g.token,true);rooms.start(h.token);return {rooms,h,g,setTime:t=>time=t};}
test('disconnect pauses moves; returning token restores exact hand and seat',()=>{
 const {rooms:r,h,g,setTime}=setup();const before=r.view(g.token).game;
 r.disconnect(g.token);assert.equal(r.view(h.token).game.paused,true);
 assert.throws(()=>r.move(h.token,{type:'draw',revision:0}),/ROOM_PAUSED/);
 setTime(89000);r.view(h.token);const after=r.view(g.token).game;
 assert.equal(after.seat,before.seat);assert.deepEqual(after.hand,before.hand);assert.equal(after.revision,before.revision);assert.equal(after.paused,false);
 assert.ok(r.move(h.token,{type:'draw',revision:0}).ok);
});
test('grace expiry removes lost seat, aborts round and transfers host',()=>{
 const {rooms:r,h,g,setTime}=setup();r.disconnect(h.token);
 // The remaining guest continues heartbeat requests during the grace period.
 for(let t=1000;t<=90000;t+=1000){setTime(t);r.view(g.token);}
 setTime(90001);const recovered=r.view(g.token);assert.equal(recovered.game,null);
 assert.equal(recovered.lobby.host,g.lobby.you);assert.equal(recovered.lobby.players.length,1);assert.equal(recovered.lobby.players[0].ready,false);
 assert.throws(()=>r.view(h.token),/INVALID_SESSION/);
});
test('silent loss pauses after heartbeat timeout without explicit disconnect',()=>{
 const {rooms:r,h,g,setTime}=setup();setTime(10001);assert.equal(r.view(h.token).game.paused,true);
 assert.equal(r.view(g.token).game.paused,false);
});
test('emoji reactions are shared, limited, short-lived, and omit private tokens',()=>{
 const {rooms:r,h,g,setTime}=setup();r.react(h.token,'🔥');let view=r.view(g.token);
 assert.equal(view.reactions[0].player,h.lobby.you);assert.equal(view.reactions[0].emoji,'🔥');
 assert.ok(!JSON.stringify(view.reactions).includes(h.token));assert.throws(()=>r.react(h.token,'🔥'),/REACTION_COOLDOWN/);
 assert.throws(()=>r.react(g.token,'<script>'),/INVALID_REACTION/);
 setTime(2200);r.react(h.token,'👏');assert.equal(r.view(g.token).reactions.length,1);
 setTime(5201);assert.equal(r.view(g.token).reactions.length,0);
});
test('completed round rematches in same room; previous round commands cannot apply',()=>{
 const {rooms:r,h,g}=setup();const tokens=[h.token,g.token];assert.throws(()=>r.rematch(h.token),/ROUND_NOT_FINISHED/);
 let v=r.view(h.token).game;
 for(let n=0;n<3000&&v.winner===null;n++){
   const t=tokens[v.turn];v=r.view(t).game;
   if(v.canCall)v=r.move(t,{type:'call',revision:v.revision}).view;
   const move=v.playableIds.length?{type:'play',cardId:v.playableIds[0],color:'red'}:{type:v.canEndTurn?'endTurn':'draw'};
   const result=r.move(t,{...move,revision:v.revision});assert.ok(result.ok);v=result.view;
 }
 assert.notEqual(v.winner,null);const previousRevision=v.revision;
 assert.throws(()=>r.rematch(g.token),/HOST_ONLY/);
 const lobby=r.rematch(h.token);assert.equal(lobby.game,null);assert.ok(lobby.lobby.players.every(p=>!p.ready));
 assert.equal(lobby.lobby.code,h.lobby.code);r.ready(h.token,true);r.ready(g.token,true);
 const next=r.start(h.token).game;assert.equal(next.round,2);assert.ok(next.revision>previousRevision);assert.equal(next.hand.length,7);
 assert.equal(r.move(h.token,{type:'draw',revision:previousRevision}).error,'STALE_MOVE');
});

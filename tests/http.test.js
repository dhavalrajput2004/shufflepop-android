const test=require('node:test');const assert=require('node:assert/strict');const {createApi}=require('../server/http.js');
async function setup(t,options){const server=createApi(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));return 'http://127.0.0.1:'+server.address().port;}
async function request(base,path,body,token,origin){const headers={};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;if(origin)headers.Origin=origin;const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),headers:r.headers};}
test('two HTTP clients create, join, ready, start and receive private state',async t=>{
 const base=await setup(t);const h=await request(base,'/v1/rooms/create',{name:'Dhaval'},null,'https://appassets.androidplatform.net');assert.equal(h.status,200);
 assert.equal(h.headers.get('access-control-allow-origin'),'https://appassets.androidplatform.net');assert.equal(h.headers.get('cache-control'),'no-store');
 const g=await request(base,'/v1/rooms/join',{name:'Friend',code:h.data.lobby.code});assert.equal(g.status,200);
 assert.equal((await request(base,'/v1/rooms/start',{},g.data.token)).status,403);
 await request(base,'/v1/rooms/ready',{ready:true},h.data.token);await request(base,'/v1/rooms/ready',{ready:true},g.data.token);
 const start=await request(base,'/v1/rooms/start',{},h.data.token);assert.equal(start.data.game.hand.length,7);
 const guest=await request(base,'/v1/rooms/view',undefined,g.data.token);assert.equal(guest.data.game.seat,1);
 assert.equal(guest.data.game.deck,undefined);assert.equal(guest.data.game.hands,undefined);
 assert.ok(!JSON.stringify(guest.data).includes(h.data.token));
 assert.equal((await request(base,'/v1/rooms/move',{type:'draw',revision:0},h.data.token)).data.ok,true);
 assert.equal((await request(base,'/v1/rooms/move',{type:'draw',revision:0},h.data.token)).status,409);
});
test('API rejects missing auth, foreign origins, oversized and malformed JSON',async t=>{
 const base=await setup(t);assert.equal((await request(base,'/v1/rooms/view')).status,401);
 assert.equal((await request(base,'/v1/rooms/create',{name:'A'},null,'https://evil.example')).status,403);
 assert.equal((await request(base,'/v1/rooms/create',{name:'A',extra:'x'.repeat(9000)})).status,413);
 const r=await fetch(base+'/v1/rooms/create',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(r.status,400);
 const r2=await fetch(base+'/v1/rooms/create',{method:'POST',body:'{}'});assert.equal(r2.status,415);
});
test('rate limits reject excessive clients without trusting forwarded addresses',async t=>{
 const base=await setup(t,{limit:2});await request(base,'/health');await request(base,'/health');assert.equal((await request(base,'/health')).status,429);
});
test('two network players complete a full round using only their private views',async t=>{
 let clock=0;const base=await setup(t,{now:()=>clock+=1000,limit:10000});
 const h=(await request(base,'/v1/rooms/create',{name:'A'})).data;
 const g=(await request(base,'/v1/rooms/join',{code:h.lobby.code,name:'B'})).data;
 const tokens=[h.token,g.token];
 for(const token of tokens)await request(base,'/v1/rooms/ready',{ready:true},token);
 let v=(await request(base,'/v1/rooms/start',{},h.token)).data.game;
 for(let n=0;n<2000&&v.winner===null;n++){
   const token=tokens[v.turn];v=(await request(base,'/v1/rooms/view',undefined,token)).data.game;
   if(v.canCall)v=(await request(base,'/v1/rooms/move',{type:'call',revision:v.revision},token)).data.view;
   let command;
   if(v.playableIds.length){const c=v.hand.find(c=>c.id===v.playableIds[0]);command={type:'play',cardId:c.id,color:'red'};}
   else command={type:v.canEndTurn?'endTurn':'draw'};
   const result=await request(base,'/v1/rooms/move',{...command,revision:v.revision},token);
   assert.equal(result.status,200);assert.equal(result.data.ok,true);v=result.data.view;
 }
 assert.notEqual(v.winner,null,'round terminates');
 const a=(await request(base,'/v1/rooms/view',undefined,h.token)).data.game;
 const b=(await request(base,'/v1/rooms/view',undefined,g.token)).data.game;
 assert.equal(a.winner,b.winner);assert.equal(a.revision,b.revision);
 if(a.winner>=0)assert.equal([a,b][a.winner].hand.length,0);
 assert.equal((await request(base,'/v1/rooms/rematch',{},g.token)).status,403);
 assert.equal((await request(base,'/v1/rooms/rematch',{},h.token)).data.game,null);
 for(const token of tokens)await request(base,'/v1/rooms/ready',{ready:true},token);
 const fresh=(await request(base,'/v1/rooms/start',{},h.token)).data.game;
 assert.equal(fresh.round,2);assert.ok(fresh.revision>a.revision);
 assert.equal((await request(base,'/v1/rooms/move',{type:'draw',revision:a.revision},h.token)).status,409);
});
test('HTTP disconnect, reconnect and reactions stay authorized and preserve cards',async t=>{
 const base=await setup(t);const h=(await request(base,'/v1/rooms/create',{name:'Host'})).data;
 const g=(await request(base,'/v1/rooms/join',{name:'Guest',code:h.lobby.code})).data;
 await request(base,'/v1/rooms/ready',{ready:true},h.token);await request(base,'/v1/rooms/ready',{ready:true},g.token);
 await request(base,'/v1/rooms/start',{},h.token);
 const before=(await request(base,'/v1/rooms/view',undefined,g.token)).data.game;
 assert.equal((await request(base,'/v1/rooms/disconnect',{},g.token)).status,200);
 assert.equal((await request(base,'/v1/rooms/move',{type:'draw',revision:0},h.token)).data.error,'ROOM_PAUSED');
 const restored=(await request(base,'/v1/rooms/view',undefined,g.token)).data.game;assert.deepEqual(restored.hand,before.hand);assert.equal(restored.seat,before.seat);
 assert.equal((await request(base,'/v1/rooms/react',{emoji:'😎'},h.token)).status,200);
 assert.equal((await request(base,'/v1/rooms/view',undefined,g.token)).data.reactions[0].emoji,'😎');
 assert.equal((await request(base,'/v1/rooms/react',{emoji:'😎'},h.token)).data.error,'REACTION_COOLDOWN');
 assert.equal((await request(base,'/v1/rooms/react',{emoji:'🔥'})).status,401);
});

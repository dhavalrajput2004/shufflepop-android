'use strict';
const assert=require('node:assert/strict');
function origin(value){
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.origin!==value)throw new Error('Use an HTTPS origin without path, trailing slash or credentials.');
  return u.origin;
}
async function verifyDeployment(base,request=fetch){
  const tokens=[];
  const call=async(path,body,token)=>{
    const r=await request(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:'https://appassets.androidplatform.net',...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(65000)});
    assert.equal(r.status,200,'API request must succeed');assert.equal(r.headers.get('cache-control'),'no-store');
    if(path!=='/health')assert.equal(r.headers.get('access-control-allow-origin'),'https://appassets.androidplatform.net');
    return r.json();
  };
  try{
    assert.equal((await call('/health')).ok,true);
    const host=await call('/v1/rooms/create',{name:'Deployment Host',capacity:2});tokens.push(host.token);
    const guest=await call('/v1/rooms/join',{name:'Deployment Guest',code:host.lobby.code});tokens.push(guest.token);
    for(const token of tokens)await call('/v1/rooms/ready',{ready:true},token);
    const start=await call('/v1/rooms/start',{},tokens[0]);assert.equal(start.game.hand.length,7);
    const guestView=await call('/v1/rooms/view',undefined,tokens[1]);assert.equal(guestView.game.seat,1);
    assert.equal(guestView.game.deck,undefined);assert.equal(guestView.game.hands,undefined);
    assert.ok(!JSON.stringify(guestView).includes(tokens[0]));
    const move=await call('/v1/rooms/move',{type:'draw',revision:start.game.revision},tokens[0]);assert.equal(move.ok,true);assert.equal(move.view.hand.length,8);
    return {ok:true,checks:['health','CORS','create/join','readiness','private hands','server move']};
  }finally{
    // Remove only the temporary sessions created by this smoke test.
    for(const token of tokens)try{await call('/v1/rooms/leave',{},token);}catch(_){}
  }
}
if(require.main===module){
  Promise.resolve().then(()=>verifyDeployment(origin(process.argv[2]))).then(r=>console.log('Deployment checks passed:',r.checks.join(', '))).catch(()=>{console.error('Deployment checks failed. Verify server health, API routes, and HTTPS configuration.');process.exitCode=1;});
}
module.exports={verifyDeployment,origin};

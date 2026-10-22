'use strict';
const http=require('node:http');
const {Rooms,RoomError}=require('./rooms.js');
const {Leaderboard,BoardError}=require('./leaderboard.js');
const APP_ORIGIN='https://appassets.androidplatform.net';
function createApi({rooms=new Rooms(),now=Date.now,allowedOrigins=[APP_ORIGIN],limit=600,maxBuckets=10000,leaderboard=null,soloUpstream=null}={}) {
  if(soloUpstream){const u=new URL(soloUpstream);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Solo upstream must be an HTTPS origin');soloUpstream=u.origin;}
  const buckets=new Map();
  function consume(ip,kind,max){
    const key=ip+':'+kind,t=now();let b=buckets.get(key);
    if(!b||t-b.since>=60000){
      if(!b&&buckets.size>=maxBuckets){
        for(const [k,v]of buckets)if(t-v.since>=60000)buckets.delete(k);
        // Fail closed when full; never evict an active client's limit.
        if(buckets.size>=maxBuckets)return false;
      }
      b={since:t,count:0};buckets.set(key,b);
    }
    return ++b.count<=max;
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
    const send=(status,data)=>{res.writeHead(status);res.end(JSON.stringify(data));};
    const origin=req.headers.origin;
    if(origin&&!allowedOrigins.includes(origin))return send(403,{error:'ORIGIN_DENIED'});
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    const ip=req.socket.remoteAddress||'unknown'; // Do not trust client X-Forwarded-For.
    if(!consume(ip,'all',limit))return send(429,{error:'RATE_LIMITED'});
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
      res.writeHead(204);return res.end();
    }
    let path;try{path=new URL(req.url,'http://localhost').pathname;}catch(_){return send(400,{error:'INVALID_URL'});}
    if(req.method==='GET'&&path==='/health')return send(200,{ok:true,soloLeaderboard:!!(leaderboard||soloUpstream)});
    if(!['GET','POST'].includes(req.method))return send(405,{error:'METHOD_NOT_ALLOWED'});
    const boardRead=req.method==='GET'&&path==='/v1/solo/leaderboard';
    const boardRoute=path.startsWith('/v1/solo/');
    if(boardRoute&&!leaderboard&&!soloUpstream)return send(503,{error:'LEADERBOARD_UNAVAILABLE'});
    const open=boardRead||(req.method==='POST'&&['/v1/rooms/create','/v1/rooms/join','/v1/solo/profile'].includes(path));
    let token;
    if(!open){
      token=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization||'')?.[1];
      if(!token)return send(401,{error:'INVALID_SESSION'});
      if(!consume(token,'session',120))return send(429,{error:'RATE_LIMITED'});
    }
    if(open&&!consume(ip,'entry',12))return send(429,{error:'RATE_LIMITED'});
    let body={};
    if(req.method==='POST'){
      if(!(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'JSON_REQUIRED'});
      try {
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>(boardRoute?131072:8192)){send(413,{error:'BODY_TOO_LARGE'});req.resume();return;}chunks.push(chunk);}
        body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body||Array.isArray(body)||typeof body!=='object')throw new Error();
      } catch(_){return send(400,{error:'INVALID_JSON'});}
    }
    try {
      let result;
      if(boardRoute){
        if(soloUpstream){
          if(!['/v1/solo/leaderboard','/v1/solo/profile','/v1/solo/start','/v1/solo/finish'].includes(path))return send(404,{error:'NOT_FOUND'});
          try{const response=await fetch(soloUpstream+path,{method:req.method,headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},body:req.method==='POST'?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(12000)});const data=await response.json();return send(response.status,data);}catch(_){return send(503,{error:'LEADERBOARD_UNAVAILABLE'});}
        }
        if(boardRead)result=await leaderboard.board(/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization||'')?.[1]);
        else if(req.method==='POST'&&path==='/v1/solo/profile')result=await leaderboard.register(body.name);
        else if(req.method==='POST'&&path==='/v1/solo/start')result=await leaderboard.start(token);
        else if(req.method==='POST'&&path==='/v1/solo/finish')result=await leaderboard.finish(token,body);
        if(!result)return send(404,{error:'NOT_FOUND'});return send(200,result);
      }
      if(req.method==='GET'&&path==='/v1/rooms/view')result=rooms.view(token);
      else if(req.method==='POST')switch(path){
        case '/v1/rooms/create':result=rooms.create(body);break;
        case '/v1/rooms/join':result=rooms.join(body);break;
        case '/v1/rooms/ready':result=rooms.ready(token,body.ready);break;
        case '/v1/rooms/settings':result=rooms.settings(token,body);break;
        case '/v1/rooms/start':result=rooms.start(token);break;
        case '/v1/rooms/leave':result=rooms.leave(token);break;
        case '/v1/rooms/move':result=rooms.move(token,body);break;
        case '/v1/rooms/disconnect':result=rooms.disconnect(token);break;
        case '/v1/rooms/rematch':result=rooms.rematch(token);break;
        case '/v1/rooms/react':result=rooms.react(token,body.emoji);break;
      }
      if(!result)return send(404,{error:'NOT_FOUND'});
      return send(result.ok===false?409:200,result);
    }catch(err){
      if(!(err instanceof RoomError)&&!(err instanceof BoardError))return send(500,{error:'SERVER_ERROR'});
      const status=err.code==='INVALID_SESSION'?401:err.code==='HOST_ONLY'?403:err.code==='ROOM_NOT_FOUND'?404:400;
      return send(status,{error:err.code});
    }
  });
  server.headersTimeout=10000;server.requestTimeout=15000;
  const cleanup=setInterval(()=>rooms.cleanup(),60000);cleanup.unref();server.on('close',()=>clearInterval(cleanup));
  return server;
}
if(require.main===module){
  const board=process.env.DATABASE_URL?require('./postgres-leaderboard.js').fromEnvironment():process.env.LEADERBOARD_FILE?new Leaderboard(process.env.LEADERBOARD_FILE):null;
  const server=createApi({leaderboard:board,soloUpstream:process.env.DATABASE_URL?null:process.env.SOLO_LEADERBOARD_UPSTREAM||null});server.on('close',()=>board?.close?.());server.listen(Number(process.env.PORT||8080),process.env.HOST||'127.0.0.1',()=>console.log('ShufflePop room API started. Use HTTPS hosting for phones.'));
}
module.exports={createApi};

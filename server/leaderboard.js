'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {Game}=require('../app/src/main/assets/engine.js');
function randomFor(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
class BoardError extends Error{constructor(code){super(code);this.code=code;}}
class Leaderboard{
 constructor(file){this.file=file;this.data={players:[]};if(file&&fs.existsSync(file))this.data=JSON.parse(fs.readFileSync(file,'utf8'));}
 persist(){if(!this.file)return;fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';const fd=fs.openSync(tmp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(this.data));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,this.file);if(process.platform!=='win32'){const dir=fs.openSync(path.dirname(this.file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}}
 transaction(fn){const before=JSON.stringify(this.data);try{const result=fn();this.persist();return result;}catch(e){this.data=JSON.parse(before);throw e;}}
 hash(token){return crypto.createHash('sha256').update(token||'').digest('hex');}
 player(token){const p=this.data.players.find(p=>p.auth===this.hash(token));if(!p)throw new BoardError('INVALID_SESSION');return p;}
 register(name){name=typeof name==='string'?name.trim():'';if(!/^[\p{L}\p{N} _.-]{2,20}$/u.test(name))throw new BoardError('INVALID_NAME');if(this.data.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new BoardError('NAME_TAKEN');if(this.data.players.length>=100000)throw new BoardError('BOARD_FULL');const token=crypto.randomBytes(32).toString('base64url');return this.transaction(()=>{const p={id:crypto.randomUUID(),name,auth:this.hash(token),wins:0,at:Date.now(),active:null,last:null};this.data.players.push(p);return {token,player:{id:p.id,name:p.name,wins:0}};});}
 board(token){const sorted=[...this.data.players].sort((a,b)=>b.wins-a.wins||a.at-b.at||a.id.localeCompare(b.id));const row=(p,i)=>({rank:i+1,id:p.id,name:p.name,wins:p.wins});let me=null;if(token){const p=this.player(token);me=row(p,sorted.indexOf(p));}return {players:sorted.filter(p=>p.wins>0).slice(0,50).map((p)=>row(p,sorted.indexOf(p))),me};}
 start(token){const p=this.player(token);return this.transaction(()=>{p.active={id:crypto.randomUUID(),seed:crypto.randomBytes(4).readUInt32LE(),at:Date.now()};return p.active;});}
 finish(token,{id,actions}){const p=this.player(token);if(p.last===id)return {ok:true,wins:p.wins};if(!p.active||p.active.id!==id)throw new BoardError('INVALID_ROUND');if(Date.now()-p.active.at>7*86400000)throw new BoardError('ROUND_EXPIRED');if(!Array.isArray(actions)||!actions.length||actions.length>4096)throw new BoardError('INVALID_REPLAY');const g=new Game('solo',randomFor(p.active.seed));for(const a of actions){if(g.over||!Array.isArray(a))throw new BoardError('INVALID_REPLAY');const [method,...args]=a;if(method==='bot'){if(args.length||g.s.turn===0)throw new BoardError('INVALID_REPLAY');g.bot();}else{if(g.s.turn!==0||!['play','draw','pass','call'].includes(method))throw new BoardError('INVALID_REPLAY');if(method==='play'?args.length!==2||!Number.isInteger(args[0])||args[0]<0||args[0]>107:args.length!==0)throw new BoardError('INVALID_REPLAY');if(!g[method](...args))throw new BoardError('INVALID_REPLAY');}}
 if(g.s.winner!==0)throw new BoardError('NOT_A_WIN');return this.transaction(()=>{p.wins++;p.at=Date.now();p.last=id;p.active=null;return {ok:true,wins:p.wins};});}
}
module.exports={Leaderboard,BoardError,randomFor};

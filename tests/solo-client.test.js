const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Game}=require('../app/src/main/assets/engine.js');
function client(saved={},fetchImpl=async()=>({ok:true,json:async()=>({players:[],me:null})})){
 const storage=new Map([['shufflePopSoloBoardV1',JSON.stringify(saved)],['shufflePopWins','2']]),nodes=new Map(),shown=[],starts=[];
 const get=id=>{if(!nodes.has(id))nodes.set(id,{id,textContent:id,dataset:{},disabled:false,hidden:id==='homeScreen',isConnected:true,value:'',set outerHTML(html){this.html=html;}});return nodes.get(id);};
 const c={window:{SHUFFLEPOP_API_BASE:'https://game.example',addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},$:get,Game,game:null,modalKind:'',fetch:fetchImpl,AbortController,setTimeout,clearTimeout,updateSoloStats(){},show(kind){shown.push(kind);c.modalKind=kind;},startSolo(g){c.game=g||new Game('solo');c.modalKind='';starts.push(c.game);},save(){},render(){},home(){},resumeGame(){}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('app/src/main/assets/solo-leaderboard.js','utf8'),c);return {board:c.window.SoloLeaderboard,get,storage,shown,starts,c};
}
const response=(data,ok=true)=>({ok,json:async()=>data});
test('expired profile recovers to the join form without touching local wins',async()=>{
 const c=client({token:'old',enabled:true,profile:{name:'Returning',wins:3}},async(url,options)=>options.headers.Authorization?response({error:'INVALID_SESSION'},false):response({players:[],me:null}));
 await c.board.board();assert.equal(c.board.joined,false);assert.equal(c.board.globalWins,null);assert.equal(c.storage.get('shufflePopWins'),'2');assert.match(c.get('boardBody').html,/Join leaderboard/);assert.match(c.get('boardBody').html,/Your local wins are safe/);assert.match(c.get('boardBody').html,/value="Returning"/);assert(!c.get('boardBody').html.includes('profile is unavailable'));
});
test('ranked start has no extra modal, suppresses double taps, and cancellation ignores late responses',async()=>{
 let release;const c=client({token:'valid',enabled:true},()=>new Promise(r=>release=r));const a=c.board.startRanked();await Promise.resolve();await Promise.resolve();await c.board.startRanked();assert.equal(c.shown.length,0);assert.equal(c.get('homeNewSolo').disabled,true);c.board.cancelStart();release(response({id:'round',seed:42}));await a;assert.equal(c.starts.length,0);assert.equal(c.get('homeNewSolo').disabled,false);
});
test('failed ranked connection starts local solo directly and keeps a valid profile',async()=>{
 const c=client({token:'valid',enabled:true,profile:{name:'Player',wins:4}},async()=>{throw Error('offline');});await c.board.startRanked();assert.equal(c.shown.length,0);assert.equal(c.starts.length,1);assert.equal(c.board.globalWins,4);assert.equal(c.board.joined,true);assert.match(c.c.game.s.notice,/Offline solo/);
});
test('ranked start uses server seed and refresh exposes verified global wins',async()=>{
 const c=client({token:'valid',enabled:true},async url=>response(url.endsWith('/start')?{id:'round',seed:42}:{players:[],me:{name:'Player',wins:7,rank:1}}));await c.board.startRanked();assert.equal(c.starts.length,1);assert.equal(c.starts[0].s.rankId,'round');await c.board.refreshProfile();assert.equal(c.board.globalWins,7);assert.equal(c.shown.length,0);
});

test('joined profiles automatically score future games and standings have no mode toggle',async()=>{
 const c=client({token:'valid',enabled:false},async()=>response({players:[{id:'me',name:'Player',wins:1,rank:1}],me:{id:'me',name:'Player',wins:1,rank:1}}));
 assert.equal(c.board.enabled,true);await c.board.board();const html=c.get('boardBody').html;assert.match(html,/Player/);assert.match(html,/1 wins/);assert.doesNotMatch(html,/boardToggle|Use offline solo|Rank future solo games/);
});

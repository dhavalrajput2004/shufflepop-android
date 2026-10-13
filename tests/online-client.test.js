const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createApi}=require('../server/http.js');
// DOM stub verifies event wiring/state changes; it does not verify browser layout.
function client(base,origin='https://room.example',storage=new Map()){
 const nodes=new Map();
 class Node {
  constructor(id,tag='div'){this.id=id;this.tag=tag;this.hidden=false;this.disabled=false;this.value='';this.style={};this.children=[];this._html='';}
  set innerHTML(s){this._html=s;this.children=[];for(const m of s.matchAll(/<(input|select|button|p)[^>]*id="([^"]+)"[^>]*>/g)){const n=new Node(m[2],m[1]);nodes.set(m[2],n);this.children.push(n);if(m[2]==='roomAvatar')n.value='fox';if(m[2]==='roomCapacity')n.value='4';if(m[2]==='roomSurface'||m[2]==='lobbySurface')n.value='mat';}}
  get innerHTML(){return this._html;}
  querySelector(s){return this.children.find(n=>'#'+n.id===s)||null;}
  querySelectorAll(s){return this.children.filter(n=>s.split(',').includes(n.tag));}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 const context={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{SHUFFLEPOP_API_BASE:origin},document:{getElementById:get,querySelector:get},setTimeout,clearTimeout,AbortController,fetch:(url,options)=>fetch(base+new URL(url).pathname,options),$:get,PAINT:{red:'red',yellow:'yellow',green:'green',blue:'blue'},MARK:{red:'●',yellow:'◆',green:'▲',blue:'■'},COLORS:['red','yellow','green','blue'],modalKind:'',home(){},showGameScreen(){},card:c=>'<card>'+c.id+'</card>',show(){},hide(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('app/src/main/assets/online.js','utf8'),context);return {online:context.window.Online,get};
}
test('Android client controls create and join, ready and start a real HTTP match',async t=>{
 const server=createApi();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port,h=client(base),g=client(base);t.after(()=>{h.online.back();g.online.back();});
 h.online.open();h.get('roomName').value='Dhaval';await h.get('createRoom').onclick();
 const code=h.get('onlineBody').innerHTML.match(/roomCodeDisplay">([A-Z2-9]{6})/)[1];
 g.online.open();g.get('roomName').value='Friend';g.get('roomCode').value=code;await g.get('joinRoom').onclick();
 await h.get('roomReady').onclick();await g.get('roomReady').onclick();
 // Refresh host by resuming rather than waiting for scheduled polling.
 h.online.pause();await h.online.resume();
 // Direct start action still validates readiness on the server.
 await h.get('roomStart').onclick();assert.equal(h.online.active,true);
 assert.match(h.get('handTitle').textContent,/7/);assert.equal(h.get('reactions').hidden,false);
 await h.online.react('😎');assert.match(h.get('selfReaction').innerHTML,/😎/);
 await h.online.move('draw');assert.match(h.get('handTitle').textContent,/8/);
 assert.equal(h.online.back(),true);assert.equal(h.online.active,false);assert.equal(h.get('onlineScreen').hidden,true);
});
test('unconfigured client displays unavailable notice and disables entry',()=>{
 const c=client('http://unused','');
 assert.match(fs.readFileSync('app/src/main/assets/api-config.js','utf8'),/BASE = ''/);
 c.online.open();assert.equal(c.get('createRoom').disabled,true);assert.equal(c.get('joinRoom').disabled,true);assert.match(c.get('onlineMessage').textContent,/not available/);c.online.back();
});
test('client reload restores guest session; stale session is cleared',async t=>{
 const server=createApi();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port,storage=new Map();const first=client(base,'https://room.example',storage);
 first.online.open();first.get('roomName').value='Returning';await first.get('createRoom').onclick();
 const code=first.get('onlineBody').innerHTML.match(/roomCodeDisplay">([A-Z2-9]{6})/)[1];first.online.back();
 const reload=client(base,'https://room.example',storage);await reload.online.open();assert.ok(reload.get('onlineBody').innerHTML.includes(code));reload.online.back();
 const staleStore=new Map([['shufflePopOnlineSessionV1',JSON.stringify({base:'https://room.example',token:'a'.repeat(43)})]]);
 const stale=client(base,'https://room.example',staleStore);await stale.online.open();assert.equal(staleStore.size,0);assert.ok(stale.get('createRoom'));stale.online.back();
});

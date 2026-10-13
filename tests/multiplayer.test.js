const test = require('node:test');
const assert = require('node:assert/strict');
const {Game} = require('../app/src/main/assets/engine.js');
const {Match} = require('../server/match.js');
for (const count of [2,3,4]) {
  test(`${count} players deal, rotate, restore and conserve cards`, () => {
    const g = new Game('online',()=>.42,null,Array.from({length:count},(_,i)=>`Player ${i}`));
    assert.equal(g.s.hands.length,count);
    assert.ok(g.s.hands.every(h=>h.length===7));
    assert.equal(g.s.deck.length+g.s.discard.length+g.s.hands.flat().length,108);
    g.s.dir=-1;g.next();assert.equal(g.s.turn,count-1);
    assert.deepEqual(Game.restore(g.s).s,g.s);
  });
}
test('two-player reverse behaves as a skip',()=>{
  const g=new Game('online',()=>.42,null,['A','B']);
  const at=g.s.deck.findIndex(c=>c.v==='reverse');
  const c=g.s.deck.splice(at,1)[0];g.s.hands[0].push(c);g.s.color=c.c;
  assert.ok(g.play(g.s.hands[0].length-1));assert.equal(g.s.turn,0);
});
test('player view excludes opponents hands and deck; returned data is detached',()=>{
  const m=new Match(['A','B','C']);const a=m.view(0),b=m.view(1);
  assert.equal(a.deck,undefined);assert.equal(a.hands,undefined);
  assert.ok(a.players.every(p=>Object.keys(p).sort().join(',')==='cards,name'));
  assert.ok(!a.hand.some(c=>b.hand.some(other=>c.id===other.id)));
  a.hand[0].v='tampered';a.players[0].name='tampered';
  assert.notEqual(m.view(0).hand[0].v,'tampered');assert.equal(m.view(0).players[0].name,'A');
  assert.throws(()=>m.view(-1));assert.throws(()=>m.view(0.5));
});
test('server rejects out-of-turn, foreign-card and repeated moves',()=>{
  const m=new Match(['A','B']);
  assert.equal(m.dispatch(1,{type:'draw',revision:0}).error,'NOT_YOUR_TURN');
  assert.equal(m.dispatch(0,{type:'play',cardId:m.view(1).hand[0].id,revision:0}).error,'ILLEGAL_MOVE');
  const drawn=m.dispatch(0,{type:'draw',revision:0});assert.ok(drawn.ok);
  assert.equal(drawn.view.hand.length,8);
  assert.equal(m.dispatch(0,{type:'draw',revision:0}).error,'STALE_MOVE');
  assert.equal(m.view(0).hand.length,8);
  assert.ok(m.dispatch(0,{type:'endTurn',revision:1}).ok);
  assert.equal(m.view(0).turn,1);
});
test('online matches never run solo bots and validate player names',()=>{
  const g=new Game('online',Math.random,null,['A','B']);const before=JSON.stringify(g.s);
  g.bot();assert.equal(JSON.stringify(g.s),before);
  for(const names of [[],['A'],['A',''],['A','x'.repeat(25)]]) assert.throws(()=>new Match(names));
});

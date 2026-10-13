const test = require('node:test');
const assert = require('node:assert/strict');
const {Game, deck} = require('../app/src/main/assets/engine.js');
function setup() {
  const g = new Game();
  const all = deck();
  const take = (c,v) => all.splice(all.findIndex(x=>x.c===c && x.v===v),1)[0];
  g.s.discard=[take('red','9')]; g.s.color='red';
  g.s.hands=[['red','blue','green'].map(c=>take(c,'7')).concat(take('red','skip')), [], [], []];
  for(let p=1;p<4;p++)g.s.hands[p]=all.splice(0,7);
  g.s.deck=all;
  return g;
}
test('same-number cards play sequentially until end turn; last color persists',()=>{
  const g=setup();
  assert.equal(g.canPlay(1),false);
  assert.equal(g.play(0),true);
  assert.equal(g.s.turn,0);
  assert.equal(g.s.combo,'7');
  assert.equal(g.canPlay(2),false);
  assert.equal(g.draw(),false);
  assert.equal(g.play(0),true);
  assert.equal(g.s.color,'blue');
  assert.equal(g.call(),true);
  assert.equal(g.play(0),true);
  assert.equal(g.s.hands[0].length,1);
  assert.equal(g.pass(),true);
  assert.equal(g.s.turn,1);
  assert.equal(g.s.combo,null);
  assert.equal(g.s.color,'green');
});
test('end turn after one number is allowed',()=>{
  const g=setup();g.play(0);g.pass();
  assert.equal(g.s.turn,1);assert.equal(g.s.hands[0].length,3);
});
test('action cards resolve immediately',()=>{
  const g=setup();g.play(3);
  assert.equal(g.s.turn,2);assert.equal(g.s.combo,null);
});
test('mid-combo save resumes and old saves migrate',()=>{
  const g=setup();g.play(0);
  const restored=Game.restore(JSON.parse(JSON.stringify(g.s)));
  assert.equal(restored.s.combo,'7');assert.equal(restored.canPlay(0),true);
  const old = new Game().s;delete old.combo;
  assert.equal(Game.restore(old).s.combo,null);
});
test('forgetting ONE within a run draws two',()=>{
  const g=setup();g.play(0);g.play(0);g.play(0);
  assert.equal(g.s.hands[0].length,3);
});
test('last card wins without needing end turn',()=>{
  const g=setup();g.s.hands[0]=g.s.hands[0].slice(0,3);
  g.play(0);g.call();g.play(0);g.play(0);
  assert.equal(g.s.winner,0);
});

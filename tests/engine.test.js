'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, deck } = require('../app/src/main/assets/engine.js');

function seeded(seed=1) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

test('deck has 108 unique canonical cards', () => {
  const cards = deck();
  assert.equal(cards.length, 108);
  assert.equal(new Set(cards.map(c => c.id)).size, 108);
  assert.equal(cards.filter(c => c.v === 'wild').length, 4);
  assert.equal(cards.filter(c => c.v === 'draw4').length, 4);
  for (const color of ['red','yellow','green','blue']) assert.equal(cards.filter(c => c.c===color).length, 25);
});

test('new match deals seven each and starts on a number', () => {
  const g = new Game('solo', seeded(4));
  assert.deepEqual(g.s.hands.map(h => h.length), [7,7,7,7]);
  assert.match(g.top.v, /^\d$/);
  assert.equal([...g.s.deck,...g.s.discard,...g.s.hands.flat()].length, 108);
});

test('cards match by color, value, or wild', () => {
  const g = new Game('solo', seeded(2));
  g.s.color='red'; g.s.discard=[{c:'red',v:'5',id:0}];
  assert.equal(g.matches({c:'red',v:'9'}), true);
  assert.equal(g.matches({c:'blue',v:'5'}), true);
  assert.equal(g.matches({c:'wild',v:'wild'}), true);
  assert.equal(g.matches({c:'blue',v:'9'}), false);
});

test('draw four is legal only with no active-color card', () => {
  const g = new Game('solo', seeded(3));
  g.s.color='red'; g.s.hands[0]=[{c:'wild',v:'draw4',id:100},{c:'red',v:'2',id:3}];
  assert.equal(g.matches(g.s.hands[0][0]), false);
  g.s.hands[0].pop();
  assert.equal(g.matches(g.s.hands[0][0]), true);
});

test('only the newly drawn card may be played after drawing', () => {
  const g = new Game('solo', seeded(8));
  g.s.turn=0; g.s.color=g.s.hands[0][0].c; g.s.discard=[{...g.s.hands[0][0]}];
  assert.equal(g.draw(), true);
  const last=g.s.hands[0].length-1;
  assert.equal(g.canPlay(0), false);
  assert.equal(g.s.drawnId, g.s.hands[0][last].id);
});

test('missed ONE call adds two cards', () => {
  const g = new Game('solo', seeded(10));
  g.s.turn=0; g.s.hands[0]=[{c:'red',v:'3',id:1},{c:'red',v:'4',id:2}];
  g.s.color='red'; g.s.discard=[{c:'red',v:'8',id:3}];
  const before=g.s.hands[0].length;
  assert.equal(g.play(0), true);
  assert.equal(g.s.hands[0].length, before-1+2);
});

test('restore round trip succeeds', () => {
  const g = new Game('solo', seeded(12));
  const restored = Game.restore(JSON.parse(JSON.stringify(g.s)));
  assert.deepEqual(restored.s, g.s);
});

test('restore rejects corrupted card and winner state', () => {
  const g = new Game('solo', seeded(13));
  const badCard=JSON.parse(JSON.stringify(g.s)); badCard.deck[0].v='hacked';
  assert.throws(() => Game.restore(badCard));
  const badWinner=JSON.parse(JSON.stringify(g.s)); badWinner.winner=99;
  assert.throws(() => Game.restore(badWinner));
});

test('unsupported modes fail clearly', () => {
  assert.throws(() => new Game('online', seeded(1)), /Invalid players/);
  assert.throws(() => new Game('unknown', seeded(1)), /Unsupported mode/);
});

test('500 deterministic bot matches terminate and conserve cards', () => {
  for (let seed=1; seed<=500; seed++) {
    const g = new Game('solo', seeded(seed));
    let turns=0;
    while (!g.over && turns++ < 1000) g.bot();
    assert.equal(g.over, true, `seed ${seed} did not finish`);
    const cards=[...g.s.deck,...g.s.discard,...g.s.hands.flat()];
    assert.equal(cards.length,108);
    assert.equal(new Set(cards.map(c=>c.id)).size,108);
  }
});

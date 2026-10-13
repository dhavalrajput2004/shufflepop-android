/* ShufflePop: deterministic rule engine, independent of the Android UI. */
(function (root) {
  'use strict';
  const COLORS = ['red', 'yellow', 'green', 'blue'];
  function shuffle(cards, random = Math.random) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }
  function deck() {
    const cards = [];
    let id = 0;
    COLORS.forEach(c => {
      cards.push({ c, v: '0', id: id++ });
      ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2'].forEach(v => {
        cards.push({ c, v, id: id++ }, { c, v, id: id++ });
      });
    });
    for (let n = 0; n < 4; n++) cards.push({ c: 'wild', v: 'wild', id: id++ }, { c: 'wild', v: 'draw4', id: id++ });
    return cards;
  }
  class Game {
    constructor(mode = 'solo', random = Math.random, saved = null, names = null) {
      this.random = random;
      if (saved) { this.s = JSON.parse(JSON.stringify(saved)); this.s.combo = saved.combo ?? null; return; }
      if (!['solo','online'].includes(mode)) throw new Error('Unsupported mode');
      if (mode === 'online' && (!Array.isArray(names) || names.length < 2 || names.length > 4 || !names.every(n => typeof n === 'string' && n.trim().length > 0 && n.length <= 24))) throw new Error('Invalid players');
      const players = mode === 'solo' ? ['You', 'Fox', 'Byte', 'Nova'] : names.map(n => n.trim());
      this.s = { schema: 2, mode, names: players,
        hands: players.map(() => []), deck: shuffle(deck(), random), discard: [], turn: 0, dir: 1, drew: false,
        drawnId: null, combo: null, called: false, winner: null, stalled: 0, notice: 'Match the color or symbol.' };
      for (let p = 0; p < players.length; p++) this.take(p, 7);
      const i = this.s.deck.findIndex(c => /^\d$/.test(c.v));
      this.s.discard.push(this.s.deck.splice(i, 1)[0]);
      this.s.color = this.top.c;
    }
    get top() { return this.s.discard[this.s.discard.length - 1]; }
    get over() { return this.s.winner !== null; }
    matches(card) {
      if (!card) return false;
      if (card.v === 'draw4') return !this.s.hands[this.s.turn].some(c => c.c === this.s.color);
      return card.c === 'wild' || card.c === this.s.color || card.v === this.top.v;
    }
    canPlay(index) {
      const c = this.s.hands[this.s.turn][index];
      if (this.s.combo !== null) return !this.over && !!c && c.v === this.s.combo;
      return !this.over && !!c && this.matches(c) && (!this.s.drew || this.s.drawnId === c.id);
    }
    take(player, count) {
      let added = 0;
      for (let i = 0; i < count; i++) {
        if (!this.s.deck.length && this.s.discard.length > 1) {
          const top = this.s.discard.pop();
          this.s.deck = shuffle(this.s.discard, this.random);
          this.s.discard = [top];
        }
        if (this.s.deck.length) { this.s.hands[player].push(this.s.deck.pop()); added++; }
      }
      return added;
    }
    call() {
      if (!this.over && this.s.hands[this.s.turn].length === 2) { this.s.called = true; return true; }
      return false;
    }
    next(steps = 1) {
      const count = this.s.hands.length;
      this.s.turn = ((this.s.turn + this.s.dir * steps) % count + count) % count;
      this.s.drew = false; this.s.drawnId = null; this.s.called = false; this.s.combo = null;
    }
    draw() {
      if (this.over || this.s.drew || this.s.combo !== null) return false;
      const added = this.take(this.s.turn, 1);
      this.s.drew = true;
      const hand = this.s.hands[this.s.turn];
      this.s.drawnId = added ? hand[hand.length - 1].id : null;
      this.s.stalled = added ? 0 : this.s.stalled + 1;
      this.s.notice = added ? 'Play the new card if it matches, or pass.' : 'Draw pile is empty. Pass this turn.';
      return true;
    }
    pass() {
      if (this.over || (!this.s.drew && this.s.combo === null)) return false;
      if (this.s.combo !== null) { this.s.notice = this.s.names[this.s.turn] + ' ended the turn.'; this.next(); return true; }
      const anyMove = this.s.hands.some(hand => hand.some(c => c.c === 'wild' || c.c === this.s.color || c.v === this.top.v));
      if (this.s.stalled >= this.s.hands.length && !anyMove) { this.s.winner = -1; this.s.notice = 'No moves left. This round is a draw.'; return true; }
      this.s.notice = this.s.names[this.s.turn] + ' passed.';
      this.next(); return true;
    }
    play(index, chosenColor) {
      if (!this.canPlay(index)) return false;
      const hand = this.s.hands[this.s.turn], card = hand[index], player = this.s.turn;
      if (card.c === 'wild' && !COLORS.includes(chosenColor)) return false;
      hand.splice(index, 1); this.s.discard.push(card); this.s.color = card.c === 'wild' ? chosenColor : card.c;
      this.s.stalled = 0;
      let missed = hand.length === 1 && !this.s.called;
      if (missed) this.take(player, 2);
      let steps = 1;
      if (card.v === 'reverse') { this.s.dir *= -1; if (this.s.hands.length === 2) steps = 2; }
      if (card.v === 'skip') steps = 2;
      const next = (player + this.s.dir + this.s.hands.length) % this.s.hands.length;
      if (card.v === 'draw2' || card.v === 'draw4') { this.take(next, card.v === 'draw2' ? 2 : 4); steps = 2; }
      this.s.notice = missed ? this.s.names[player] + ' missed ONE! and drew 2.' : this.s.names[player] + ' played ' + (card.c === 'wild' ? chosenColor + ' wild' : card.c + ' ' + card.v) + '.';
      if (!hand.length) { this.s.winner = player; return true; }
      if (/^\d$/.test(card.v)) {
        this.s.combo = card.v;
        this.s.drew = false; this.s.drawnId = null;
        if (missed) this.s.called = false;
        this.s.notice += ' Play another ' + card.v + ' or end turn.';
        return true;
      }
      this.next(steps); return true;
    }
    bot() {
      if (this.over || this.s.mode !== 'solo') return;
      let hand = this.s.hands[this.s.turn];
      const easy = this.s.turn !== 0;
      if (this.s.combo !== null && easy && this.random() < 0.65) { this.pass(); return; }
      let i = hand.findIndex((c, index) => this.canPlay(index));
      if (this.s.combo === null && !this.s.drew && easy && i >= 0 && this.random() < 0.25) {
        this.draw(); this.pass(); return;
      }
      if (i < 0 && !this.s.drew) { this.draw(); i = hand.findIndex((c, index) => this.canPlay(index)); }
      if (i < 0) { this.pass(); return; }
      this.call();
      const color = easy ? COLORS[Math.floor(this.random() * COLORS.length)] : COLORS.reduce((a, b) => hand.filter(c => c.c === a).length >= hand.filter(c => c.c === b).length ? a : b);
      this.play(i, color);
    }
    static restore(saved) {
      if (saved && saved.combo != null && (typeof saved.combo !== 'string' || !/^\d$/.test(saved.combo))) throw new Error('Invalid combo');
      if (!saved || saved.schema !== 2 || !['solo','online'].includes(saved.mode) || !Array.isArray(saved.hands) || !saved.hands.every(Array.isArray) || (saved.mode === 'solo' ? saved.hands.length !== 4 : saved.hands.length < 2 || saved.hands.length > 4) || !Number.isInteger(saved.turn) || saved.turn < 0 || saved.turn >= saved.hands.length || !Array.isArray(saved.deck) || !Array.isArray(saved.discard) || !saved.discard.length) throw new Error('Invalid save');
      const all = [...saved.deck, ...saved.discard, ...saved.hands.flat()];
      const canonical = deck();
      const validCard = c => c && Number.isInteger(c.id) && c.id >= 0 && c.id < canonical.length && c.c === canonical[c.id].c && c.v === canonical[c.id].v;
      const validWinner = saved.winner === null || saved.winner === -1 || (Number.isInteger(saved.winner) && saved.winner >= 0 && saved.winner < saved.hands.length);
      const validDrawn = saved.drawnId === null || (Number.isInteger(saved.drawnId) && saved.hands[saved.turn].some(c => c.id === saved.drawnId));
      if (!Array.isArray(saved.names) || saved.names.length !== saved.hands.length || !saved.names.every(n => typeof n === 'string' && n.length > 0 && n.length <= 24) ||
          all.length !== 108 || !all.every(validCard) || new Set(all.map(c => c.id)).size !== 108 || !COLORS.includes(saved.color) ||
          ![1,-1].includes(saved.dir) || typeof saved.drew !== 'boolean' ||
          typeof saved.called !== 'boolean' || !validDrawn || (!saved.drew && saved.drawnId !== null) || !validWinner ||
          !Number.isInteger(saved.stalled) || saved.stalled < 0 || typeof saved.notice !== 'string') throw new Error('Invalid save');
      return new Game(saved.mode, Math.random, saved);
    }
  }
  const api = { Game, COLORS, deck };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);

'use strict';
const {Game} = require('../app/src/main/assets/engine.js');

// Transport must resolve a session token to a seat. Never trust a client seat field.
class Match {
  #game;
  #revision = 0;
  constructor(names, random = Math.random, revision = 0) {
    this.#revision = revision;
    this.#game = new Game('online', random, null, names);
  }
  view(seat) {
    const s = this.#game.s;
    if (!Number.isInteger(seat) || seat < 0 || seat >= s.hands.length) throw new Error('Invalid seat');
    const active = s.turn === seat && !this.#game.over;
    return {
      revision: this.#revision, seat, turn: s.turn, direction: s.dir,
      players: s.names.map((name,i) => ({name, cards: s.hands[i].length})),
      hand: s.hands[seat].map(c => ({...c})), top: {...this.#game.top},
      color: s.color, winner: s.winner, notice: s.notice,
      playableIds: active ? s.hands[seat].filter((_,i) => this.#game.canPlay(i)).map(c => c.id) : [],
      canDraw: active && !s.drew && s.combo === null,
      canEndTurn: active && (s.drew || s.combo !== null),
      canCall: active && s.hands[seat].length === 2 && !s.called
    };
  }
  dispatch(authenticatedSeat, command) {
    const current = this.view(authenticatedSeat);
    if (!command || typeof command !== 'object') return {ok:false, error:'INVALID_COMMAND', view:current};
    if (command.revision !== this.#revision) return {ok:false, error:'STALE_MOVE', view:current};
    if (current.winner !== null || current.turn !== authenticatedSeat) return {ok:false, error:'NOT_YOUR_TURN', view:current};
    let accepted = false;
    switch (command.type) {
      case 'play': {
        if (!Number.isInteger(command.cardId)) break;
        const index = this.#game.s.hands[authenticatedSeat].findIndex(c => c.id === command.cardId);
        if (index >= 0) accepted = this.#game.play(index,command.color);
        break;
      }
      case 'draw': accepted = this.#game.draw(); break;
      case 'endTurn': accepted = this.#game.pass(); break;
      case 'call': if (current.canCall) accepted = this.#game.call(); break;
    }
    if (accepted) this.#revision++;
    return {ok:accepted, error:accepted ? null : 'ILLEGAL_MOVE', view:this.view(authenticatedSeat)};
  }
}
module.exports = {Match};

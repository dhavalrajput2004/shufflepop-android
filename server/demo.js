'use strict';
const {Rooms}=require('./rooms.js');
const rooms=new Rooms();
const host=rooms.create({name:'Dhaval',avatar:'fox',surface:'mat'});
const friend=rooms.join({code:host.lobby.code,name:'Friend',avatar:'robot'});
rooms.ready(host.token,true);rooms.ready(friend.token,true);
const started=rooms.start(host.token);
console.log('Created room:',host.lobby.code);
console.log('Players:',started.lobby.players.map(p=>p.name).join(', '));
console.log('Match started; own cards:',started.game.hand.length);
const move=rooms.move(host.token,{type:'draw',revision:0});
console.log('Host drew:',move.ok,'; host cards:',move.view.hand.length);
console.log('Friend sees their own cards:',rooms.view(friend.token).game.hand.length);
// Session tokens and raw match state are deliberately never logged.

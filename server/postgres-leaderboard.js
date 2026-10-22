'use strict';
const crypto=require('node:crypto');
const {BoardError,verifySoloWin}=require('./leaderboard.js');
const sha=token=>crypto.createHash('sha256').update(token||'').digest('hex');
function publicRow(p){return {rank:Number(p.rank),id:p.id,name:p.name,wins:Number(p.wins)};}
class PostgresLeaderboard{
 constructor(pool){this.pool=pool;}
 async register(name){name=typeof name==='string'?name.trim():'';if(!/^[\p{L}\p{N} _.-]{2,20}$/u.test(name))throw new BoardError('INVALID_NAME');const token=crypto.randomBytes(32).toString('base64url'),id=crypto.randomUUID();try{await this.pool.query('INSERT INTO solo_players(id,name,auth,wins,at) VALUES($1,$2,$3,0,$4)',[id,name,sha(token),Date.now()]);}catch(e){if(e.code==='23505')throw new BoardError('NAME_TAKEN');throw e;}return {token,player:{id,name,wins:0}};}
 async board(token){const top=await this.pool.query('SELECT id,name,wins,row_number() OVER (ORDER BY wins DESC,at ASC,id ASC) AS rank FROM solo_players WHERE wins>0 ORDER BY wins DESC,at ASC,id ASC LIMIT 50');let me=null;if(token){const r=await this.pool.query('SELECT id,name,wins,rank FROM (SELECT id,name,wins,auth,row_number() OVER (ORDER BY wins DESC,at ASC,id ASC) AS rank FROM solo_players) ranked WHERE auth=$1',[sha(token)]);if(!r.rows.length)throw new BoardError('INVALID_SESSION');me=publicRow(r.rows[0]);}return {players:top.rows.map(publicRow),me};}
 async start(token){const active={id:crypto.randomUUID(),seed:crypto.randomBytes(4).readUInt32LE(),at:Date.now()};const r=await this.pool.query('UPDATE solo_players SET active=$2::jsonb WHERE auth=$1 RETURNING id',[sha(token),JSON.stringify(active)]);if(!r.rows.length)throw new BoardError('INVALID_SESSION');return active;}
 async finish(token,replay){const client=await this.pool.connect();try{await client.query('BEGIN');const r=await client.query('SELECT id,wins,active,last FROM solo_players WHERE auth=$1 FOR UPDATE',[sha(token)]);const p=r.rows[0];if(!p)throw new BoardError('INVALID_SESSION');if(p.last===replay.id){await client.query('COMMIT');return {ok:true,wins:Number(p.wins)};}verifySoloWin(p.active,replay);const updated=await client.query('UPDATE solo_players SET wins=wins+1,at=$2,last=$3,active=NULL WHERE id=$1 RETURNING wins',[p.id,Date.now(),replay.id]);await client.query('COMMIT');return {ok:true,wins:Number(updated.rows[0].wins)};}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}}
 async close(){await this.pool.end();}
}
function fromEnvironment(){const {Pool}=require('pg');const u=new URL(process.env.DATABASE_URL);if(!u.searchParams.has('sslmode')||u.searchParams.get('sslmode')==='require')u.searchParams.set('sslmode','verify-full');return new PostgresLeaderboard(new Pool({connectionString:u.toString(),max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:15000,statement_timeout:15000}));}
module.exports={PostgresLeaderboard,fromEnvironment};

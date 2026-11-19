'use strict';
// Legacy Strike - servidor multiplayer (relay WebSocket)
// Requer Node.js 18+ e o pacote ws.
const http = require('node:http');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8080);
const MAX_PLAYERS = Math.max(2, Math.min(20, Number(process.env.MAX_PLAYERS || 10)));
const rooms = new Map();
let nextId = 1;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('Legacy Strike multiplayer server: online\n');
});
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

function code() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out;
  do { out = Array.from(crypto.randomBytes(6), b => chars[b % chars.length]).join(''); }
  while (rooms.has(out));
  return out;
}
function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function roster(room) {
  return [...room.players.values()].map(p => ({ id: p.id, name: p.name, team: p.team }));
}
function publishRoster(room) {
  const packet = { t: 'roster', list: roster(room), host: room.host };
  for (const p of room.players.values()) send(p.ws, packet);
}
function leave(ws) {
  const p = ws.player;
  if (!p) return;
  ws.player = null;
  const room = rooms.get(p.room);
  if (!room) return;
  room.players.delete(p.id);
  for (const other of room.players.values()) send(other.ws, { t: 'left', id: p.id });
  if (!room.players.size) rooms.delete(p.room);
  else {
    if (room.host === p.id) room.host = room.players.keys().next().value;
    publishRoster(room);
  }
}
function join(ws, msg) {
  if (ws.player) return send(ws, { t: 'error', m: 'Você já está em uma sala.' });
  let roomCode = String(msg.room || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!roomCode) roomCode = code();
  let room = rooms.get(roomCode);
  if (!room) { room = { players: new Map(), host: null, started: false, map: 'de_dust2' }; rooms.set(roomCode, room); }
  if (room.started) return send(ws, { t: 'error', m: 'Essa partida já começou. Crie outra sala.' });
  if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'error', m: 'Sala cheia. Limite: ' + MAX_PLAYERS + ' jogadores.' });
  const id = nextId++;
  const name = String(msg.name || 'Jogador').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 20) || 'Jogador';
  const countT = [...room.players.values()].filter(p => p.team === 't').length;
  const countCT = room.players.size - countT;
  const team = countT <= countCT ? 't' : 'ct';
  const player = { id, name, team, room: roomCode, ws };
  room.players.set(id, player);
  if (room.host == null) room.host = id;
  ws.player = player;
  send(ws, { t: 'welcome', id, team, room: roomCode });
  publishRoster(room);
}
function onMessage(ws, raw) {
  let msg;
  try { msg = JSON.parse(raw.toString()); } catch { return; }
  if (!msg || typeof msg.t !== 'string') return;
  if (msg.t === 'join') return join(ws, msg);
  const p = ws.player;
  if (!p) return send(ws, { t: 'error', m: 'Entre em uma sala primeiro.' });
  const room = rooms.get(p.room);
  if (!room) return leave(ws);
  if (msg.t === 'start') {
    if (p.id !== room.host) return send(ws, { t: 'error', m: 'Somente o anfitrião pode iniciar.' });
    if (room.players.size < 2) return send(ws, { t: 'error', m: 'Espere pelo menos mais um jogador entrar.' });
    room.started = true;
    room.map = String(msg.map || 'de_dust2').slice(0, 40);
    const packet = { t: 'start', map: room.map, roster: roster(room) };
    for (const player of room.players.values()) send(player.ws, packet);
    return;
  }
  if (!room.started) return;
  if (msg.t === 's') {
    const x = Number(msg.x), z = Number(msg.z), yaw = Number(msg.yaw);
    if (![x, z, yaw].every(Number.isFinite)) return;
    const packet = { t: 's', id: p.id, x: Math.max(-100, Math.min(100, x)), z: Math.max(-100, Math.min(100, z)), yaw, a: msg.a ? 1 : 0 };
    for (const other of room.players.values()) if (other.id !== p.id) send(other.ws, packet);
  } else if (msg.t === 'shot') {
    if (!Array.isArray(msg.a) || !Array.isArray(msg.b) || msg.a.length !== 3 || msg.b.length !== 3) return;
    const packet = { t: 'shot', id: p.id, a: msg.a.map(Number), b: msg.b.map(Number), w: String(msg.w || 'rifle').slice(0, 20) };
    if (![...packet.a, ...packet.b].every(Number.isFinite)) return;
    for (const other of room.players.values()) if (other.id !== p.id) send(other.ws, packet);
  } else if (msg.t === 'hit') {
    const target = room.players.get(Number(msg.to));
    const d = Number(msg.d);
    if (!target || target.id === p.id || !Number.isFinite(d)) return;
    send(target.ws, { t: 'hit', id: p.id, d: Math.max(0, Math.min(500, d)), h: msg.h ? 1 : 0 });
  } else if (msg.t === 'dead') {
    // A morte só é aceita do próprio jogador atingido, evitando que terceiros a forcem.
    const by = Number(msg.by);
    if (!room.players.has(by) || by === p.id) return;
    const packet = { t: 'dead', id: p.id, by, h: msg.h ? 1 : 0 };
    for (const other of room.players.values()) send(other.ws, packet);
  }
}
wss.on('connection', ws => {
  ws.on('message', raw => onMessage(ws, raw));
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on('connection', ws => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });
server.listen(PORT, '0.0.0.0', () => console.log(`Legacy Strike multiplayer ativo na porta ${PORT} (máx. ${MAX_PLAYERS} jogadores/sala)`));
process.on('SIGTERM', () => { clearInterval(heartbeat); server.close(() => process.exit(0)); });

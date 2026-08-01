import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
}

type Player = { id: string; nickname: string; shots: number; connected: boolean; joinedAt: number };
type RoomState = { hostId: string | null; players: Player[]; phase: "lobby" | "playing" | "paused" | "finished"; round: number; currentPlayer: number; card: unknown | null; responses: Record<string, boolean>; confirmed: boolean };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "shot-rooms" }, { headers: cors });
    if (url.pathname === "/rooms" && request.method === "POST") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      return Response.json({ code, websocket: `${url.origin.replace("http", "ws")}/rooms/${code}/connect` }, { headers: cors });
    }
    const match = url.pathname.match(/^\/rooms\/(\d{6})(\/connect)?$/);
    if (!match) return Response.json({ error: "Not found" }, { status: 404, headers: cors });
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
    return room.fetch(request);
  },
};

export class GameRoom extends DurableObject<Env> {
  private state: RoomState = { hostId: null, players: [], phase: "lobby", round: 0, currentPlayer: 0, card: null, responses: {}, confirmed: false };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<RoomState>("state")) ?? this.state;
      for (const ws of ctx.getWebSockets()) {
        const meta = ws.deserializeAttachment() as { playerId?: string } | null;
        if (meta?.playerId) this.setConnected(meta.playerId, true);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return Response.json(this.publicState(), { headers: cors });
    }
    const url = new URL(request.url);
    const nickname = (url.searchParams.get("nickname") || "Oyuncu").trim().slice(0, 24);
    const playerId = url.searchParams.get("playerId") || crypto.randomUUID();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId });
    let player = this.state.players.find((p) => p.id === playerId);
    if (player) Object.assign(player, { nickname, connected: true });
    else {
      player = { id: playerId, nickname, shots: 0, connected: true, joinedAt: Date.now() };
      this.state.players.push(player);
      if (!this.state.hostId) this.state.hostId = playerId;
    }
    await this.saveAndBroadcast();
    server.send(JSON.stringify({ type: "welcome", playerId, state: this.publicState() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const { playerId } = (ws.deserializeAttachment() || {}) as { playerId: string };
    try {
      const msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
      const isHost = this.state.hostId === playerId;
      if (msg.type === "start" && isHost) Object.assign(this.state, { phase: "playing", round: 1, currentPlayer: 0 });
      if (msg.type === "pause" && isHost) this.state.phase = this.state.phase === "paused" ? "playing" : "paused";
      if (msg.type === "card" && isHost) this.state.card = msg.card;
      if (msg.type === "answer" && this.state.phase === "playing" && !this.state.confirmed) this.state.responses[playerId] = Boolean(msg.drank);
      if (msg.type === "confirm" && isHost && !this.state.confirmed) {
        this.state.players = this.state.players.map((p) => ({ ...p, shots: p.shots + (this.state.responses[p.id] ? 1 : 0) }));
        this.state.confirmed = true;
      }
      if (msg.type === "shots" && isHost) {
        this.state.players = this.state.players.map((p) => ({ ...p, shots: Math.max(0, Number(msg.shots?.[p.id] ?? p.shots)) }));
      }
      if (msg.type === "next" && isHost && this.state.players.length) {
        this.state.round += 1; this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length; this.state.card = null; this.state.responses = {}; this.state.confirmed = false;
      }
      if (msg.type === "transfer" && isHost && this.state.players.some((p) => p.id === msg.playerId)) this.state.hostId = msg.playerId;
      if (msg.type === "kick" && isHost && msg.playerId !== playerId) this.state.players = this.state.players.filter((p) => p.id !== msg.playerId);
      await this.saveAndBroadcast();
    } catch { ws.send(JSON.stringify({ type: "error", message: "Geçersiz mesaj" })); }
  }

  async webSocketClose(ws: WebSocket) { await this.disconnect(ws); }
  async webSocketError(ws: WebSocket) { await this.disconnect(ws); }

  private async disconnect(ws: WebSocket) {
    const { playerId } = (ws.deserializeAttachment() || {}) as { playerId?: string };
    if (!playerId) return;
    this.setConnected(playerId, false);
    if (this.state.hostId === playerId) this.state.hostId = this.state.players.find((p) => p.connected && p.id !== playerId)?.id ?? this.state.players.find((p) => p.id !== playerId)?.id ?? null;
    await this.saveAndBroadcast();
  }

  private setConnected(id: string, connected: boolean) { const p = this.state.players.find((x) => x.id === id); if (p) p.connected = connected; }
  private publicState() { return { ...this.state, playerCount: this.state.players.length }; }
  private async saveAndBroadcast() {
    await this.ctx.storage.put("state", this.state);
    const message = JSON.stringify({ type: "state", state: this.publicState() });
    for (const socket of this.ctx.getWebSockets()) try { socket.send(message); } catch { /* closed */ }
  }
}

import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
}

type Player = { id: string; nickname: string; shots: number; connected: boolean; joinedAt: number };
type GameCard = { id?: number; kind?: string; maxSelections?: number; outcome?: string; [key: string]: unknown };
type RoomState = { hostId: string | null; players: Player[]; phase: "lobby" | "playing" | "paused" | "finished"; round: number; totalCards: number; deck: GameCard[]; currentPlayer: number; card: GameCard | null; revealedBy: string | null; responses: Record<string, boolean>; votes: Record<string, string[]>; voteRevealed: boolean; voteWinners: string[]; confirmed: boolean };

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
  private state: RoomState = { hostId: null, players: [], phase: "lobby", round: 0, totalCards: 30, deck: [], currentPlayer: 0, card: null, revealedBy: null, responses: {}, votes: {}, voteRevealed: false, voteWinners: [], confirmed: false };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RoomState>("state");
      this.state = { ...this.state, ...(stored ?? {}), deck: stored?.deck ?? [], responses: stored?.responses ?? {}, votes: stored?.votes ?? {} };
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
    this.ensureHost();
    await this.saveAndBroadcast();
    server.send(JSON.stringify({ type: "welcome", playerId, state: this.publicState(playerId) }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const { playerId } = (ws.deserializeAttachment() || {}) as { playerId: string };
    try {
      const msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
      this.ensureHost();
      const isHost = this.state.hostId === playerId;
      if (msg.type === "configure" && isHost && this.state.phase === "lobby") this.state.totalCards = Math.max(10, Math.min(100, Number(msg.totalCards ?? 30)));
      if (msg.type === "start" && isHost && this.state.phase === "lobby" && Array.isArray(msg.deck)) {
        const deck = msg.deck.slice(0, this.state.totalCards);
        if (deck.length >= 10) Object.assign(this.state, { phase: "playing", round: 1, currentPlayer: 0, deck, card: null, revealedBy: null, responses: {}, votes: {}, confirmed: false });
      }
      if (msg.type === "pause" && isHost) this.state.phase = this.state.phase === "paused" ? "playing" : "paused";
      if (msg.type === "revealCard" && this.state.phase === "playing" && !this.state.card && this.state.players[this.state.currentPlayer]?.id === playerId) {
        this.state.card = this.state.deck[this.state.round - 1] ?? null;
        this.state.revealedBy = playerId;
      }
      if (msg.type === "answer" && this.state.phase === "playing" && this.state.card && !this.state.confirmed) this.state.responses[playerId] = Boolean(msg.drank);
      if (msg.type === "vote" && this.state.card?.kind === "vote" && !this.state.voteRevealed) {
        const max = Math.max(1, Math.min(2, this.state.players.length - 1, Number(this.state.card.maxSelections ?? 1)));
        const validIds = new Set(this.state.players.filter((p) => p.id !== playerId).map((p) => p.id));
        const selections = [...new Set(Array.isArray(msg.selections) ? msg.selections : [])].filter((id) => validIds.has(id)).slice(0, max);
        if (selections.length === max) this.state.votes[playerId] = selections;
      }
      const connectedIds = this.state.players.filter((p) => p.connected).map((p) => p.id);
      const everyoneVoted = connectedIds.every((id) => id in this.state.votes);
      if (msg.type === "revealVotes" && isHost && everyoneVoted && this.state.card?.kind === "vote" && !this.state.voteRevealed) {
        const tally: Record<string, number> = {};
        Object.values(this.state.votes).flat().forEach((id) => tally[id] = (tally[id] ?? 0) + 1);
        const counts = this.state.players.map((p) => tally[p.id] ?? 0);
        const top = Math.max(0, ...counts); const bottom = Math.min(...counts);
        const topIds = this.state.players.filter((p) => (tally[p.id] ?? 0) === top).map((p) => p.id);
        const outcome = this.state.card.outcome ?? "highest";
        if (outcome === "lowest") this.state.voteWinners = this.state.players.filter((p) => (tally[p.id] ?? 0) === bottom).map((p) => p.id);
        else if (outcome === "zero") this.state.voteWinners = this.state.players.filter((p) => !tally[p.id]).map((p) => p.id);
        else if (outcome === "except_top") this.state.voteWinners = this.state.players.filter((p) => !topIds.includes(p.id)).map((p) => p.id);
        else if (outcome === "tie_all") this.state.voteWinners = new Set(counts).size === 1 ? this.state.players.map((p) => p.id) : [];
        else this.state.voteWinners = top ? topIds : [];
        const appliesShot = outcome !== "winner_chooses";
        this.state.players = this.state.players.map((p) => ({ ...p, shots: p.shots + (appliesShot && this.state.voteWinners.includes(p.id) ? 1 : 0) }));
        this.state.voteRevealed = true; this.state.confirmed = true;
      }
      const activeIds = this.state.players.filter((p) => p.connected).map((p) => p.id);
      const everyoneAnswered = activeIds.every((id) => id in this.state.responses);
      if (msg.type === "confirm" && isHost && everyoneAnswered && !this.state.confirmed && this.state.card?.kind !== "vote") {
        this.state.players = this.state.players.map((p) => ({ ...p, shots: p.shots + (this.state.responses[p.id] ? 1 : 0) }));
        this.state.confirmed = true;
      }
      if (msg.type === "shots" && isHost) {
        this.state.players = this.state.players.map((p) => ({ ...p, shots: Math.max(0, Number(msg.shots?.[p.id] ?? p.shots)) }));
      }
      if (msg.type === "next" && isHost && this.state.players.length && this.state.confirmed) {
        if (this.state.round >= this.state.totalCards) this.state.phase = "finished";
        else {
          this.state.round += 1; this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length; this.state.card = null; this.state.revealedBy = null; this.state.responses = {}; this.state.votes = {}; this.state.voteRevealed = false; this.state.voteWinners = []; this.state.confirmed = false;
        }
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
    const hasAnotherConnection = this.ctx.getWebSockets().some((socket) => {
      const meta = socket.deserializeAttachment() as { playerId?: string } | null;
      return socket !== ws && socket.readyState === WebSocket.OPEN && meta?.playerId === playerId;
    });
    if (hasAnotherConnection) return;
    this.setConnected(playerId, false);
    this.ensureHost();
    await this.saveAndBroadcast();
  }

  private setConnected(id: string, connected: boolean) { const p = this.state.players.find((x) => x.id === id); if (p) p.connected = connected; }
  private ensureHost() {
    const host = this.state.players.find((p) => p.id === this.state.hostId);
    if (!host?.connected) this.state.hostId = this.state.players.find((p) => p.connected)?.id ?? this.state.players[0]?.id ?? null;
  }
  private publicState(viewerId?: string) {
    const tally: Record<string, number> = {};
    if (this.state.voteRevealed) Object.values(this.state.votes).flat().forEach((id) => tally[id] = (tally[id] ?? 0) + 1);
    const { votes: _secretVotes, deck: _secretDeck, ...safe } = this.state;
    return { ...safe, playerCount: this.state.players.length, votedPlayerIds: Object.keys(this.state.votes), myVote: viewerId ? this.state.votes[viewerId] ?? [] : [], voteTally: tally };
  }
  private async saveAndBroadcast() {
    await this.ctx.storage.put("state", this.state);
    for (const socket of this.ctx.getWebSockets()) try {
      const meta = socket.deserializeAttachment() as { playerId?: string } | null;
      socket.send(JSON.stringify({ type: "state", state: this.publicState(meta?.playerId) }));
    } catch { /* closed */ }
  }
}

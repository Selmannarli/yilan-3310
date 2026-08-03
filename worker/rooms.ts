import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
}

type Player = { id: string; nickname: string; avatar: string; shots: number; connected: boolean; joinedAt: number };
type GameCard = { id?: number; kind?: string; maxSelections?: number; outcome?: string; [key: string]: unknown };
type MiniGame = { game: string; phase: "selecting" | "ready" | "playing" | "result"; challengerId: string; opponentId: string | null; readyIds: string[]; startedAt: number | null; triggerAt: number | null; endsAt: number | null; challenge: Record<string, unknown>; submissions: Record<string, { value: unknown; at: number }>; winners: string[]; losers: string[]; details: Record<string, unknown> };
type TurnResult = { drinkers: string[]; nonDrinkers: string[] };
type RoomState = { hostId: string | null; players: Player[]; phase: "lobby" | "playing" | "paused" | "finished"; round: number; totalCards: number; passLimit: number; passes: Record<string, number>; activeCategories: string[]; deck: GameCard[]; currentPlayer: number; card: GameCard | null; revealedBy: string | null; miniGame: MiniGame | null; responses: Record<string, boolean>; votes: Record<string, string[]>; voteRevealed: boolean; voteWinners: string[]; turnResult: TurnResult | null; confirmed: boolean };

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
      for (let attempt = 0; attempt < 12; attempt++) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        const created = await room.fetch(new Request(`${url.origin}/create`, { method: "POST" }));
        if (created.status === 201) return Response.json({ code, websocket: `${url.origin.replace("http", "ws")}/rooms/${code}/connect` }, { headers: cors });
      }
      return Response.json({ error: "room_code_unavailable" }, { status: 503, headers: cors });
    }
    const match = url.pathname.match(/^\/rooms\/(\d{6})(\/connect)?$/);
    if (!match) return Response.json({ error: "Not found" }, { status: 404, headers: cors });
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
    return room.fetch(request);
  },
};

export class GameRoom extends DurableObject<Env> {
  private created = false;
  private state: RoomState = { hostId: null, players: [], phase: "lobby", round: 0, totalCards: 30, passLimit: 2, passes: {}, activeCategories: ["condition", "vote", "duel", "digital"], deck: [], currentPlayer: 0, card: null, revealedBy: null, miniGame: null, responses: {}, votes: {}, voteRevealed: false, voteWinners: [], turnResult: null, confirmed: false };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RoomState>("state");
      const storedCreated = await ctx.storage.get<boolean>("created");
      this.created = storedCreated ?? false;
      this.state = { ...this.state, ...(stored ?? {}), deck: stored?.deck ?? [], passes: stored?.passes ?? {}, responses: stored?.responses ?? {}, votes: stored?.votes ?? {}, turnResult: stored?.turnResult ?? null };
      this.state.players = this.state.players.map((player) => ({ ...player, avatar: player.avatar || "🎲" }));
      for (const ws of ctx.getWebSockets()) {
        const meta = ws.deserializeAttachment() as { playerId?: string } | null;
        if (meta?.playerId) this.setConnected(meta.playerId, true);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/create") {
      const registered = await this.ctx.storage.get<boolean>("created");
      if (registered) return Response.json({ error: "room_exists" }, { status: 409, headers: cors });
      this.created = true;
      await this.ctx.storage.put("created", true);
      return Response.json({ created: true }, { status: 201, headers: cors });
    }
    const registered = await this.ctx.storage.get<boolean>("created");
    if (!registered) return Response.json({ error: "room_not_found" }, { status: 404, headers: cors });
    this.created = true;
    if (request.headers.get("Upgrade") !== "websocket") {
      return Response.json(this.publicState(), { headers: cors });
    }
    const nickname = (url.searchParams.get("nickname") || "Oyuncu").trim().slice(0, 24);
    const avatar = (url.searchParams.get("avatar") || "🎲").trim().slice(0, 8);
    const playerId = url.searchParams.get("playerId") || crypto.randomUUID();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId });
    let player = this.state.players.find((p) => p.id === playerId);
    if (player) Object.assign(player, { nickname, avatar, connected: true });
    else {
      player = { id: playerId, nickname, avatar, shots: 0, connected: true, joinedAt: Date.now() };
      this.state.players.push(player);
      if (!this.state.hostId) this.state.hostId = playerId;
    }
    if (!(playerId in this.state.passes)) this.state.passes[playerId] = this.state.passLimit;
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
      if (msg.type === "configurePasses" && isHost && this.state.phase === "lobby") this.state.passLimit = Number(msg.passLimit) === 1 ? 1 : 2;
      if (msg.type === "configureCategories" && isHost && this.state.phase === "lobby") {
        const allowed = new Set(["condition", "vote", "duel", "digital"]);
        const selected = [...new Set(Array.isArray(msg.categories) ? msg.categories : [])].filter((kind) => allowed.has(kind));
        if (selected.length) this.state.activeCategories = selected;
      }
      if (msg.type === "start" && isHost && this.state.phase === "lobby" && Array.isArray(msg.deck)) {
        const deck = msg.deck.filter((card: GameCard) => card && typeof card === "object" && this.state.activeCategories.includes(String(card.kind))).slice(0, this.state.totalCards);
        if (deck.length === this.state.totalCards) Object.assign(this.state, { phase: "playing", round: 1, currentPlayer: 0, deck, passes: Object.fromEntries(this.state.players.map((player) => [player.id, this.state.passLimit])), card: null, revealedBy: null, miniGame: null, responses: {}, votes: {}, voteRevealed: false, voteWinners: [], turnResult: null, confirmed: false });
      }
      if (msg.type === "pause" && isHost) this.state.phase = this.state.phase === "paused" ? "playing" : "paused";
      if (msg.type === "revealCard" && this.state.phase === "playing" && !this.state.card && this.state.players[this.state.currentPlayer]?.id === playerId) {
        this.state.card = this.state.deck[this.state.round - 1] ?? null;
        this.state.revealedBy = playerId;
        if (this.state.card?.kind === "digital") this.state.miniGame = { game: String(this.state.card.game), phase: "selecting", challengerId: playerId, opponentId: null, readyIds: [], startedAt: null, triggerAt: null, endsAt: null, challenge: {}, submissions: {}, winners: [], losers: [], details: {} };
      }
      if (msg.type === "selectMiniOpponent" && this.state.miniGame?.phase === "selecting" && this.state.miniGame.challengerId === playerId && this.state.players.some((p) => p.id === msg.opponentId && p.id !== playerId && p.connected)) {
        this.state.miniGame.opponentId = msg.opponentId; this.state.miniGame.phase = "ready";
      }
      if (msg.type === "miniReady" && this.state.miniGame?.phase === "ready" && this.isMiniPlayer(playerId)) {
        if (!this.state.miniGame.readyIds.includes(playerId)) this.state.miniGame.readyIds.push(playerId);
        if (this.state.miniGame.readyIds.length === 2) this.startMiniGame();
      }
      if (msg.type === "miniAction" && this.state.miniGame?.phase === "playing" && this.isMiniPlayer(playerId)) this.handleMiniAction(playerId, msg.action, msg.value);
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
        const drinkers = appliesShot ? this.state.voteWinners.filter((id) => connectedIds.includes(id)) : [];
        this.state.turnResult = { drinkers, nonDrinkers: connectedIds.filter((id) => !drinkers.includes(id)) };
        this.state.voteRevealed = true; this.state.confirmed = true;
      }
      const activeIds = this.state.players.filter((p) => p.connected).map((p) => p.id);
      const everyoneAnswered = activeIds.every((id) => id in this.state.responses);
      if (msg.type === "confirm" && isHost && everyoneAnswered && !this.state.confirmed && this.state.card?.kind !== "vote") {
        this.state.players = this.state.players.map((p) => ({ ...p, shots: p.shots + (this.state.responses[p.id] ? 1 : 0) }));
        this.state.turnResult = { drinkers: activeIds.filter((id) => this.state.responses[id]), nonDrinkers: activeIds.filter((id) => !this.state.responses[id]) };
        this.state.confirmed = true;
      }
      if (msg.type === "shots" && isHost) {
        this.state.players = this.state.players.map((p) => ({ ...p, shots: Math.max(0, Number(msg.shots?.[p.id] ?? p.shots)) }));
      }
      if (msg.type === "next" && isHost && this.state.players.length && this.state.confirmed) {
        if (this.state.round >= this.state.totalCards) this.state.phase = "finished";
        else {
          this.state.round += 1; this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length; this.state.card = null; this.state.revealedBy = null; this.state.miniGame = null; this.state.responses = {}; this.state.votes = {}; this.state.voteRevealed = false; this.state.voteWinners = []; this.state.turnResult = null; this.state.confirmed = false;
        }
      }
      if (msg.type === "skip" && this.state.phase === "playing" && this.state.card && !this.state.confirmed && this.state.players[this.state.currentPlayer]?.id === playerId && (this.state.passes[playerId] ?? 0) > 0) {
        this.state.passes[playerId] -= 1;
        if (this.state.round >= this.state.totalCards) this.state.phase = "finished";
        else {
          this.state.round += 1; this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length; this.state.card = null; this.state.revealedBy = null; this.state.miniGame = null; this.state.responses = {}; this.state.votes = {}; this.state.voteRevealed = false; this.state.voteWinners = []; this.state.turnResult = null; this.state.confirmed = false;
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
  private isMiniPlayer(id: string) { const game = this.state.miniGame; return Boolean(game && (game.challengerId === id || game.opponentId === id)); }
  private otherMiniPlayer(id: string) { const game = this.state.miniGame!; return game.challengerId === id ? game.opponentId! : game.challengerId; }
  private makeChallenge(game: string) {
    if (game === "emoji_memory") {
      const emojis = ["🍋", "🦊", "🎲", "🚀", "🌵", "🎧", "🍕", "🐙"];
      const sequence = Array.from({ length: 4 }, () => emojis[Math.floor(Math.random() * emojis.length)]);
      const options = [sequence, ...Array.from({ length: 3 }, () => [...sequence].sort(() => Math.random() - .5))].sort(() => Math.random() - .5);
      return { sequence, options, correctIndex: options.findIndex((item) => item.join("") === sequence.join("")) };
    }
    if (game === "odd_one") return { targetIndex: Math.floor(Math.random() * 24), normal: "●", odd: "◉" };
    return {};
  }
  private startMiniGame() {
    const game = this.state.miniGame!; const now = Date.now();
    game.phase = "playing"; game.submissions = {}; game.challenge = this.makeChallenge(game.game);
    game.startedAt = game.game === "rapid_tap" ? now + 3000 : now;
    game.triggerAt = game.game === "reflex" ? now + 2000 + Math.floor(Math.random() * 4000) : null;
    game.endsAt = game.game === "rapid_tap" ? game.startedAt + 5000 : null;
  }
  private handleMiniAction(playerId: string, action: string, value: unknown) {
    const game = this.state.miniGame!; const now = Date.now(); const other = this.otherMiniPlayer(playerId);
    if (game.submissions[playerId]) return;
    if (game.game === "reflex" && action === "tap") {
      game.submissions[playerId] = { value: game.triggerAt ? now - game.triggerAt : -1, at: now };
      if (!game.triggerAt || now < game.triggerAt) this.finishMini([other], [playerId], { reason: "early", times: this.miniValues() });
      else this.finishMini([playerId], [other], { times: this.miniValues() });
      return;
    }
    if (game.game === "rapid_tap" && action === "finish") game.submissions[playerId] = { value: Math.max(0, Math.min(250, Number(value) || 0)), at: now };
    if (game.game === "five_seconds" && action === "stop") game.submissions[playerId] = { value: now - (game.startedAt ?? now), at: now };
    if ((game.game === "emoji_memory" || game.game === "odd_one") && action === "answer") game.submissions[playerId] = { value: Number(value), at: now };
    if (game.game === "trust" && action === "choice" && (value === "trust" || value === "betray")) game.submissions[playerId] = { value, at: now };
    if (Object.keys(game.submissions).length < 2) return;
    const a = game.challengerId, b = game.opponentId!, av = game.submissions[a].value, bv = game.submissions[b].value;
    if (game.game === "rapid_tap") this.finishByScore(a, b, Number(av), Number(bv), true, { taps: this.miniValues() });
    if (game.game === "five_seconds") this.finishByScore(a, b, Math.abs(5000 - Number(av)), Math.abs(5000 - Number(bv)), false, { times: this.miniValues() });
    if (game.game === "emoji_memory") {
      const correct = Number(game.challenge.correctIndex); const ac = av === correct, bc = bv === correct;
      if (!ac && !bc) { game.challenge = this.makeChallenge(game.game); game.submissions = {}; game.startedAt = Date.now(); return; }
      if (ac && bc) this.finishByScore(a, b, game.submissions[a].at, game.submissions[b].at, false, { answers: this.miniValues() });
      else this.finishMini(ac ? [a] : [b], ac ? [b] : [a], { answers: this.miniValues() });
    }
    if (game.game === "odd_one") {
      const target = Number(game.challenge.targetIndex); const ac = av === target, bc = bv === target;
      if (ac === bc) this.finishByScore(a, b, game.submissions[a].at, game.submissions[b].at, false, { answers: this.miniValues() });
      else this.finishMini(ac ? [a] : [b], ac ? [b] : [a], { answers: this.miniValues() });
    }
    if (game.game === "trust") {
      if (av === "trust" && bv === "trust") this.finishMini([], [], { choices: this.miniValues() });
      else if (av === "betray" && bv === "betray") this.finishMini([], [a, b], { choices: this.miniValues() });
      else this.finishMini([av === "betray" ? a : b], [av === "trust" ? a : b], { choices: this.miniValues() });
    }
  }
  private finishByScore(a: string, b: string, av: number, bv: number, higherWins: boolean, details: Record<string, unknown>) {
    if (av === bv) this.finishMini([], [], details);
    else { const aWins = higherWins ? av > bv : av < bv; this.finishMini(aWins ? [a] : [b], aWins ? [b] : [a], details); }
  }
  private miniValues() { return Object.fromEntries(Object.entries(this.state.miniGame!.submissions).map(([id, item]) => [id, item.value])); }
  private finishMini(winners: string[], losers: string[], details: Record<string, unknown>) {
    const game = this.state.miniGame!; game.phase = "result"; game.winners = winners; game.losers = losers; game.details = details;
    this.state.players = this.state.players.map((p) => ({ ...p, shots: p.shots + (losers.includes(p.id) ? 1 : 0) }));
    const connectedIds = this.state.players.filter((p) => p.connected).map((p) => p.id);
    this.state.turnResult = { drinkers: losers.filter((id) => connectedIds.includes(id)), nonDrinkers: connectedIds.filter((id) => !losers.includes(id)) };
    this.state.confirmed = true;
  }
  private ensureHost() {
    const host = this.state.players.find((p) => p.id === this.state.hostId);
    if (!host?.connected) this.state.hostId = this.state.players.find((p) => p.connected)?.id ?? this.state.players[0]?.id ?? null;
  }
  private publicState(viewerId?: string) {
    const tally: Record<string, number> = {};
    if (this.state.voteRevealed) Object.values(this.state.votes).flat().forEach((id) => tally[id] = (tally[id] ?? 0) + 1);
    const { votes: _secretVotes, deck: _secretDeck, ...safe } = this.state;
    const miniGame = this.state.miniGame ? { ...this.state.miniGame, submissions: this.state.miniGame.phase === "result" ? this.state.miniGame.submissions : {}, submittedIds: Object.keys(this.state.miniGame.submissions) } : null;
    return { ...safe, miniGame, playerCount: this.state.players.length, votedPlayerIds: Object.keys(this.state.votes), myVote: viewerId ? this.state.votes[viewerId] ?? [] : [], voteTally: tally };
  }
  private async saveAndBroadcast() {
    await this.ctx.storage.put("state", this.state);
    for (const socket of this.ctx.getWebSockets()) try {
      const meta = socket.deserializeAttachment() as { playerId?: string } | null;
      socket.send(JSON.stringify({ type: "state", state: this.publicState(meta?.playerId) }));
    } catch { /* closed */ }
  }
}

import { DurableObject } from "cloudflare:workers";

export interface Env { ROOMS: DurableObjectNamespace<GameRoom>; }

type Player = { id: string; nickname: string; avatar: string; shots: number; connected: boolean; joinedAt: number };
type GameCard = { id?: number; kind?: string; game?: string; maxSelections?: number; outcome?: string; [key: string]: unknown };
type Submission = { value: unknown; at: number; valid?: boolean };
type MiniGame = {
  game: string;
  phase: "selecting" | "ready" | "countdown" | "playing" | "result";
  challengerId: string;
  opponentId: string | null;
  participantIds: string[];
  readyIds: string[];
  startedAt: number | null;
  triggerAt: number | null;
  endsAt: number | null;
  challenge: Record<string, unknown>;
  submissions: Record<string, Submission>;
  winners: string[];
  losers: string[];
  rankings: string[];
  details: Record<string, unknown>;
  confirmed: boolean;
};
type TurnResult = { drinkers: string[]; nonDrinkers: string[] };
type RoomState = {
  hostId: string | null; players: Player[]; phase: "lobby" | "playing" | "paused" | "finished";
  round: number; totalCards: number; passLimit: number; passes: Record<string, number>;
  activeCategories: string[]; deck: GameCard[]; currentPlayer: number; card: GameCard | null;
  revealedBy: string | null; miniGame: MiniGame | null; responses: Record<string, boolean>;
  votes: Record<string, string[]>; voteRevealed: boolean; voteWinners: string[];
  turnResult: TurnResult | null; confirmed: boolean; disconnectDeadlines: Record<string, number>; lastColorCombo: string;
};

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
const CATEGORY_WEIGHTS: Record<string, number> = { condition: 30, vote: 30, duel: 20, digital: 20 };
const MINI_GAMES = new Set(["odd_one", "reflex", "rapid_tap", "five_seconds", "emoji_memory", "trust", "follow_target", "quick_math", "color_word", "number_memory"]);
const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const shuffle = <T,>(items: T[]) => {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "shot-rooms" }, { headers: cors });
    if (url.pathname === "/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 12; attempt++) {
        const code = String(randomInt(100000, 999999));
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        const created = await room.fetch(new Request(`${url.origin}/create`, { method: "POST" }));
        if (created.status === 201) return Response.json({ code, websocket: `${url.origin.replace("http", "ws")}/rooms/${code}/connect` }, { headers: cors });
      }
      return Response.json({ error: "room_code_unavailable" }, { status: 503, headers: cors });
    }
    const match = url.pathname.match(/^\/rooms\/(\d{6})(\/connect)?$/);
    if (!match) return Response.json({ error: "Not found" }, { status: 404, headers: cors });
    return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
  },
};

export class GameRoom extends DurableObject<Env> {
  private created = false;
  private state: RoomState = {
    hostId: null, players: [], phase: "lobby", round: 0, totalCards: 30, passLimit: 2,
    passes: {}, activeCategories: ["condition", "vote", "duel", "digital"], deck: [], currentPlayer: 0,
    card: null, revealedBy: null, miniGame: null, responses: {}, votes: {}, voteRevealed: false,
    voteWinners: [], turnResult: null, confirmed: false, disconnectDeadlines: {}, lastColorCombo: "",
  };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RoomState>("state");
      const storedCreated = await ctx.storage.get<boolean>("created");
      this.created = storedCreated ?? false;
      this.state = { ...this.state, ...(stored ?? {}), deck: stored?.deck ?? [], passes: stored?.passes ?? {}, responses: stored?.responses ?? {}, votes: stored?.votes ?? {}, disconnectDeadlines: stored?.disconnectDeadlines ?? {} };
      this.state.players = this.state.players.map((player) => ({ ...player, avatar: player.avatar || "🎲" }));
      if (this.state.miniGame && !Array.isArray(this.state.miniGame.participantIds)) {
        const legacy = this.state.miniGame as MiniGame & { opponentId?: string | null };
        legacy.participantIds = [legacy.challengerId, legacy.opponentId].filter(Boolean) as string[];
        legacy.rankings = legacy.rankings ?? []; legacy.confirmed = legacy.confirmed ?? this.state.confirmed;
      }
      for (const ws of ctx.getWebSockets()) {
        const meta = ws.deserializeAttachment() as { playerId?: string } | null;
        if (meta?.playerId) this.setConnected(meta.playerId, true);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/create") {
      if (await this.ctx.storage.get<boolean>("created")) return Response.json({ error: "room_exists" }, { status: 409, headers: cors });
      this.created = true; await this.ctx.storage.put("created", true);
      return Response.json({ created: true }, { status: 201, headers: cors });
    }
    if (!await this.ctx.storage.get<boolean>("created")) return Response.json({ error: "room_not_found" }, { status: 404, headers: cors });
    this.created = true;
    if (request.headers.get("Upgrade") !== "websocket") return Response.json(this.publicState(), { headers: cors });
    const nickname = (url.searchParams.get("nickname") || "Oyuncu").trim().slice(0, 24);
    const avatar = (url.searchParams.get("avatar") || "🎲").trim().slice(0, 8);
    const playerId = url.searchParams.get("playerId") || crypto.randomUUID();
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server); server.serializeAttachment({ playerId });
    let player = this.state.players.find((item) => item.id === playerId);
    if (player) Object.assign(player, { nickname, avatar, connected: true });
    else {
      player = { id: playerId, nickname, avatar, shots: 0, connected: true, joinedAt: Date.now() };
      this.state.players.push(player); if (!this.state.hostId) this.state.hostId = playerId;
    }
    delete this.state.disconnectDeadlines[playerId];
    if (!(playerId in this.state.passes)) this.state.passes[playerId] = this.state.passLimit;
    this.ensureHost(); await this.saveAndBroadcast();
    server.send(JSON.stringify({ type: "welcome", playerId, state: this.publicState(playerId) }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const { playerId } = (ws.deserializeAttachment() || {}) as { playerId: string };
    try {
      const msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
      this.ensureHost(); const isHost = this.state.hostId === playerId;
      if (msg.type === "configure" && isHost && this.state.phase === "lobby") this.state.totalCards = Math.max(10, Math.min(100, Number(msg.totalCards ?? 30)));
      if (msg.type === "configurePasses" && isHost && this.state.phase === "lobby") this.state.passLimit = Number(msg.passLimit) === 1 ? 1 : 2;
      if (msg.type === "configureCategories" && isHost && this.state.phase === "lobby") {
        const allowed = new Set(Object.keys(CATEGORY_WEIGHTS));
        const selected = [...new Set<string>(Array.isArray(msg.categories) ? msg.categories.map(String) : [])].filter((kind) => allowed.has(kind));
        if (selected.length) this.state.activeCategories = selected;
      }
      if (msg.type === "start" && isHost && this.state.phase === "lobby" && Array.isArray(msg.cards)) {
        const pool = msg.cards.filter((card: GameCard) => card && typeof card === "object" && this.state.activeCategories.includes(String(card.kind)));
        const deck = this.buildWeightedDeck(pool, this.state.totalCards);
        if (deck.length === this.state.totalCards) Object.assign(this.state, { phase: "playing", round: 1, currentPlayer: 0, deck, passes: Object.fromEntries(this.state.players.map((player) => [player.id, this.state.passLimit])), card: null, revealedBy: null, miniGame: null, responses: {}, votes: {}, voteRevealed: false, voteWinners: [], turnResult: null, confirmed: false });
      }
      if (msg.type === "pause" && isHost && this.state.phase !== "lobby" && this.state.phase !== "finished") this.state.phase = this.state.phase === "paused" ? "playing" : "paused";
      if (msg.type === "revealCard" && this.state.phase === "playing" && !this.state.card && this.currentPlayerId() === playerId) {
        this.state.card = this.state.deck[this.state.round - 1] ?? null; this.state.revealedBy = playerId;
        if (this.state.card?.kind === "digital") this.createMini(String(this.state.card.game), playerId);
      }
      if (msg.type === "selectMiniOpponent" && this.state.miniGame?.phase === "selecting" && this.state.miniGame.challengerId === playerId) {
        const opponent = this.state.players.find((p) => p.id === msg.opponentId && p.id !== playerId && p.connected);
        if (opponent) { this.state.miniGame.opponentId = opponent.id; this.state.miniGame.participantIds = [playerId, opponent.id]; this.state.miniGame.phase = "ready"; }
      }
      if (msg.type === "miniReady" && this.state.miniGame?.phase === "ready" && this.isMiniPlayer(playerId) && this.connectedParticipantIds().includes(playerId)) {
        if (!this.state.miniGame.readyIds.includes(playerId)) this.state.miniGame.readyIds.push(playerId);
        if (this.connectedParticipantIds().every((id) => this.state.miniGame!.readyIds.includes(id))) this.startMiniGame();
      }
      if (msg.type === "miniAction" && ["countdown", "playing"].includes(this.state.miniGame?.phase ?? "") && this.isMiniPlayer(playerId)) this.handleMiniAction(playerId, String(msg.action), msg.value);
      if (msg.type === "restartMini" && isHost && this.state.miniGame) this.resetMini();
      if (msg.type === "cancelMini" && isHost && this.state.miniGame && !this.state.confirmed) {
        this.state.miniGame.phase = "result"; this.state.miniGame.winners = []; this.state.miniGame.losers = []; this.state.miniGame.details = { reason: "cancelled" };
      }
      if (msg.type === "confirmMini" && isHost && this.state.miniGame?.phase === "result" && !this.state.miniGame.confirmed) this.confirmMiniResult();
      if (msg.type === "answer" && this.state.phase === "playing" && this.state.card && this.state.card.kind !== "digital" && !this.state.confirmed) this.state.responses[playerId] = Boolean(msg.drank);
      if (msg.type === "vote" && this.state.card?.kind === "vote" && !this.state.voteRevealed) this.recordVote(playerId, msg.selections);
      const connectedIds = this.activePlayerIds();
      const everyoneVoted = connectedIds.every((id) => id in this.state.votes);
      if (msg.type === "revealVotes" && isHost && everyoneVoted && this.state.card?.kind === "vote" && !this.state.voteRevealed) this.revealVotes(connectedIds);
      const everyoneAnswered = connectedIds.every((id) => id in this.state.responses);
      if (msg.type === "confirm" && isHost && everyoneAnswered && !this.state.confirmed && this.state.card?.kind !== "vote" && this.state.card?.kind !== "digital") this.confirmAnswers(connectedIds);
      if (msg.type === "shots" && isHost) this.state.players = this.state.players.map((p) => ({ ...p, shots: Math.max(0, Number(msg.shots?.[p.id] ?? p.shots)) }));
      if (msg.type === "next" && isHost && this.state.players.length && this.state.confirmed) this.advanceTurn();
      if (msg.type === "skip" && this.state.phase === "playing" && this.state.card && !this.state.confirmed && this.currentPlayerId() === playerId && (this.state.passes[playerId] ?? 0) > 0) { this.state.passes[playerId] -= 1; this.advanceTurn(true); }
      if (msg.type === "transfer" && isHost && this.state.players.some((p) => p.id === msg.playerId)) this.state.hostId = msg.playerId;
      if (msg.type === "kick" && isHost && msg.playerId !== playerId) this.state.players = this.state.players.filter((p) => p.id !== msg.playerId);
      if (msg.type === "endGame" && isHost && this.state.phase !== "lobby") this.state.phase = "finished";
      await this.scheduleAlarm(); await this.saveAndBroadcast();
    } catch { ws.send(JSON.stringify({ type: "error", message: "Geçersiz mesaj" })); }
  }

  async webSocketClose(ws: WebSocket) { await this.disconnect(ws); }
  async webSocketError(ws: WebSocket) { await this.disconnect(ws); }

  async alarm() {
    const now = Date.now();
    for (const [id, deadline] of Object.entries(this.state.disconnectDeadlines)) {
      if (deadline > now) continue;
      delete this.state.disconnectDeadlines[id];
      const mini = this.state.miniGame;
      if (mini && mini.participantIds.includes(id) && !mini.submissions[id] && mini.phase !== "result") mini.submissions[id] = { value: "disconnected", at: now, valid: false };
    }
    const mini = this.state.miniGame;
    if (mini && mini.phase !== "result" && mini.endsAt && now >= mini.endsAt + 2500) {
      for (const id of mini.participantIds) if (!mini.submissions[id]) mini.submissions[id] = { value: "timeout", at: now, valid: false };
      this.evaluateMini(true);
    }
    await this.scheduleAlarm(); await this.saveAndBroadcast();
  }

  private buildWeightedDeck(pool: GameCard[], total: number) {
    const grouped: Record<string, GameCard[]> = {};
    for (const kind of this.state.activeCategories) grouped[kind] = pool.filter((card) => card.kind === kind);
    const queues = Object.fromEntries(Object.entries(grouped).map(([kind, list]) => [kind, shuffle(list)])) as Record<string, GameCard[]>;
    const lastCard: Record<string, number | undefined> = {};
    const deck: GameCard[] = []; const kinds: string[] = [];
    while (deck.length < total) {
      let candidates = this.state.activeCategories.filter((kind) => grouped[kind]?.length);
      const previous = kinds.at(-1); const previousTwo = kinds.at(-2);
      const strict = candidates.filter((kind) => !(kind === previous && kind === previousTwo) && !(["digital", "duel"].includes(kind) && ["digital", "duel"].includes(previous ?? "")));
      if (strict.length) candidates = strict;
      const weightTotal = candidates.reduce((sum, kind) => sum + CATEGORY_WEIGHTS[kind], 0);
      let roll = Math.random() * weightTotal; let chosen = candidates[0];
      for (const kind of candidates) { roll -= CATEGORY_WEIGHTS[kind]; if (roll <= 0) { chosen = kind; break; } }
      if (!queues[chosen].length) {
        queues[chosen] = shuffle(grouped[chosen]);
        if (queues[chosen].length > 1 && queues[chosen][0].id === lastCard[chosen]) [queues[chosen][0], queues[chosen][1]] = [queues[chosen][1], queues[chosen][0]];
      }
      const card = queues[chosen].shift(); if (!card) break;
      deck.push(card); kinds.push(chosen); lastCard[chosen] = card.id;
    }
    return deck;
  }

  private createMini(gameName: string, challengerId: string) {
    const game = MINI_GAMES.has(gameName) ? gameName : "reflex";
    const trust = game === "trust";
    this.state.miniGame = { game, phase: trust ? "selecting" : "ready", challengerId, opponentId: null, participantIds: trust ? [challengerId] : this.activePlayerIds(), readyIds: [], startedAt: null, triggerAt: null, endsAt: null, challenge: {}, submissions: {}, winners: [], losers: [], rankings: [], details: {}, confirmed: false };
  }

  private resetMini() {
    const old = this.state.miniGame!; this.createMini(old.game, old.challengerId);
    if (old.game === "trust" && old.opponentId && this.state.players.some((p) => p.id === old.opponentId && p.connected)) {
      const mini = this.state.miniGame!; mini.opponentId = old.opponentId; mini.participantIds = [old.challengerId, old.opponentId]; mini.phase = "ready";
    }
  }

  private makeChallenge(game: string) {
    if (game === "odd_one") return { targetIndex: randomInt(0, 23), normal: "●", odd: "◉" };
    if (game === "emoji_memory") {
      const sequence = shuffle(["🍋", "🦊", "🎲", "🚀", "🌵", "🎧", "🍕", "🐙", "🌙", "⚡"]).slice(0, 4);
      const options = shuffle(sequence); if (options.join("") === sequence.join("")) [options[0], options[1]] = [options[1], options[0]];
      return { sequence, options };
    }
    if (game === "follow_target") {
      const targetId = randomInt(0, 5); const path = Array.from({ length: 5 }, () => shuffle([0, 1, 2, 3, 4, 5]));
      return { targetId, path, finalIndex: path.at(-1)?.indexOf(targetId) ?? targetId };
    }
    if (game === "quick_math") {
      const a = randomInt(3, 18), b = randomInt(2, 12), operation = randomInt(0, 2);
      const correct = operation === 0 ? a + b : operation === 1 ? a - b : a * b;
      const symbol = operation === 0 ? "+" : operation === 1 ? "−" : "×";
      const optionSet = new Set<number>([correct]);
      while (optionSet.size < 4) { const candidate = correct + randomInt(-8, 8); optionSet.add(candidate === correct ? correct + optionSet.size : candidate); }
      const options = shuffle([...optionSet]);
      return { question: `${a} ${symbol} ${b}`, options: shuffle(options), correct };
    }
    if (game === "color_word") {
      const colors = [{ key: "red", label: "KIRMIZI", hex: "#ff5268" }, { key: "blue", label: "MAVİ", hex: "#39bdf8" }, { key: "green", label: "YEŞİL", hex: "#43d17d" }, { key: "yellow", label: "SARI", hex: "#ffd452" }];
      let word = colors[randomInt(0, colors.length - 1)]; let ink = colors[randomInt(0, colors.length - 1)]; if (ink.key === word.key) ink = colors[(colors.indexOf(ink) + 1) % colors.length];
      let mode = Math.random() < .5 ? "meaning" : "ink"; let combo = `${word.key}-${ink.key}-${mode}`;
      if (combo === this.state.lastColorCombo) { word = colors[(colors.indexOf(word) + 1) % colors.length]; if (word.key === ink.key) ink = colors[(colors.indexOf(ink) + 1) % colors.length]; mode = mode === "meaning" ? "ink" : "meaning"; combo = `${word.key}-${ink.key}-${mode}`; }
      this.state.lastColorCombo = combo;
      return { word: word.label, ink: ink.hex, task: mode === "meaning" ? "Kelimenin anlamını seç" : "Yazının rengini seç", correct: mode === "meaning" ? word.key : ink.key, options: colors };
    }
    if (game === "number_memory") return { sequence: shuffle([0,1,2,3,4,5,6,7,8,9]).slice(0, 5) };
    return {};
  }

  private startMiniGame() {
    const mini = this.state.miniGame!; const now = Date.now();
    mini.phase = "countdown"; mini.challenge = this.makeChallenge(mini.game); mini.submissions = {}; mini.winners = []; mini.losers = []; mini.rankings = []; mini.details = {};
    mini.startedAt = now + 3000;
    mini.triggerAt = mini.game === "reflex" ? mini.startedAt + randomInt(2000, 6000) : null;
    const durations: Record<string, number> = { rapid_tap: 5000, reflex: 14000, five_seconds: 12000, emoji_memory: 15000, odd_one: 12000, trust: 20000, follow_target: 12000, quick_math: 12000, color_word: 12000, number_memory: 15000 };
    mini.endsAt = mini.startedAt + (durations[mini.game] ?? 15000);
  }

  private handleMiniAction(playerId: string, action: string, value: unknown) {
    const mini = this.state.miniGame!; const now = Date.now(); if (mini.submissions[playerId]) return;
    const started = mini.startedAt ?? now;
    if (mini.game !== "reflex" && now < started) return;
    let accepted = false; let normalized: unknown = value; let valid = true;
    if (mini.game === "reflex" && action === "tap") { normalized = now < (mini.triggerAt ?? now) ? -1 : now - (mini.triggerAt ?? now); valid = Number(normalized) >= 0; accepted = true; }
    if (mini.game === "rapid_tap" && action === "finish" && now >= (mini.endsAt ?? now) - 350 && now <= (mini.endsAt ?? now) + 3000) { const taps = Math.floor(Number(value)); normalized = Number.isFinite(taps) && taps >= 0 && taps <= 150 ? taps : 0; valid = taps <= 150; accepted = true; }
    if (mini.game === "five_seconds" && action === "stop") { normalized = now - started; accepted = true; }
    if (["odd_one", "follow_target", "quick_math", "color_word"].includes(mini.game) && action === "answer") { normalized = typeof value === "string" ? value : Number(value); accepted = true; }
    if ((mini.game === "emoji_memory" || mini.game === "number_memory") && action === "answer" && Array.isArray(value)) { normalized = value.slice(0, mini.game === "number_memory" ? 5 : 4); accepted = true; }
    if (mini.game === "trust" && action === "choice" && (value === "trust" || value === "betray")) { normalized = value; accepted = true; }
    if (!accepted) return;
    mini.submissions[playerId] = { value: normalized, at: now, valid };
    this.evaluateMini(false);
  }

  private evaluateMini(force: boolean) {
    const mini = this.state.miniGame!; if (mini.phase === "result") return;
    if (!force && mini.participantIds.some((id) => !mini.submissions[id])) return;
    for (const id of mini.participantIds) if (!mini.submissions[id]) mini.submissions[id] = { value: "timeout", at: Date.now(), valid: false };
    const ids = mini.participantIds; const values = Object.fromEntries(ids.map((id) => [id, mini.submissions[id].value]));
    if (mini.game === "trust") {
      const [a, b] = ids; const av = values[a], bv = values[b];
      if (av === "trust" && bv === "trust") this.finishMini([], [], ids, { choices: values });
      else if (av === "betray" && bv === "betray") this.finishMini([], [a, b], ids, { choices: values });
      else if (av === "betray" && bv === "trust") this.finishMini([a], [b], [a, b], { choices: values });
      else if (av === "trust" && bv === "betray") this.finishMini([b], [a], [b, a], { choices: values });
      else this.finishMini([], ids.filter((id) => !mini.submissions[id].valid), ids, { choices: values });
      return;
    }
    if (mini.game === "rapid_tap") {
      const score = (id: string) => mini.submissions[id].valid === false ? -1 : Number(values[id]);
      const ranked = [...ids].sort((a,b) => score(b)-score(a)); const min = Math.min(...ids.map(score));
      this.finishMini(ranked.filter((id)=>score(id)>min), ids.filter((id)=>score(id)===min), ranked, { taps: values }); return;
    }
    if (mini.game === "five_seconds") {
      const error = (id: string) => mini.submissions[id].valid === false ? Infinity : Math.abs(5000 - Number(values[id]));
      const ranked = [...ids].sort((a,b)=>error(a)-error(b)); const worst = Math.max(...ids.map(error));
      this.finishMini(ranked.filter((id)=>error(id)<worst), ids.filter((id)=>error(id)===worst), ranked, { times: values }); return;
    }
    if (mini.game === "reflex") {
      const time = (id: string) => mini.submissions[id].valid === false ? Infinity : Number(values[id]);
      const validIds = ids.filter((id)=>Number.isFinite(time(id))); const early = ids.filter((id)=>!Number.isFinite(time(id)));
      const slowest = validIds.length > 1 ? Math.max(...validIds.map(time)) : -1;
      const losers = [...new Set([...early, ...validIds.filter((id)=>time(id)===slowest)])]; const ranked = [...ids].sort((a,b)=>time(a)-time(b));
      this.finishMini(ranked.filter((id)=>!losers.includes(id)), losers, ranked, { times: values }); return;
    }
    const correct = (id: string) => {
      if (mini.submissions[id].valid === false) return false;
      if (mini.game === "odd_one") return Number(values[id]) === Number(mini.challenge.targetIndex);
      if (mini.game === "follow_target") return Number(values[id]) === Number(mini.challenge.finalIndex);
      if (mini.game === "quick_math") return Number(values[id]) === Number(mini.challenge.correct);
      if (mini.game === "color_word") return String(values[id]) === String(mini.challenge.correct);
      const expected = (mini.challenge.sequence as unknown[]).map(String).join("|");
      return Array.isArray(values[id]) && (values[id] as unknown[]).map(String).join("|") === expected;
    };
    const correctIds = ids.filter(correct), wrongIds = ids.filter((id)=>!correct(id));
    const speed = (id: string) => mini.submissions[id].at - (mini.startedAt ?? mini.submissions[id].at);
    const slowest = correctIds.length > 1 ? Math.max(...correctIds.map(speed)) : -1;
    const losers = wrongIds.length === ids.length ? [...ids] : [...wrongIds, ...correctIds.filter((id)=>speed(id)===slowest)];
    const ranked = [...correctIds].sort((a,b)=>speed(a)-speed(b)).concat(wrongIds);
    this.finishMini(ranked.filter((id)=>!losers.includes(id)), [...new Set(losers)], ranked, { answers: values, times: Object.fromEntries(ids.map((id)=>[id, speed(id)])) });
  }

  private finishMini(winners: string[], losers: string[], rankings: string[], details: Record<string, unknown>) {
    const mini = this.state.miniGame!; mini.phase = "result"; mini.winners = winners; mini.losers = losers; mini.rankings = rankings; mini.details = details;
  }

  private confirmMiniResult() {
    const mini = this.state.miniGame!; mini.confirmed = true;
    this.state.players = this.state.players.map((p) => ({ ...p, shots: p.shots + (mini.losers.includes(p.id) ? 1 : 0) }));
    const active = this.activePlayerIds(); this.state.turnResult = { drinkers: mini.losers.filter((id)=>active.includes(id)), nonDrinkers: active.filter((id)=>!mini.losers.includes(id)) };
    this.state.confirmed = true;
  }

  private recordVote(playerId: string, selections: unknown) {
    const max = Math.max(1, Math.min(2, this.state.players.length - 1, Number(this.state.card?.maxSelections ?? 1)));
    const validIds = new Set(this.state.players.filter((p) => p.id !== playerId).map((p) => p.id));
    const picked = [...new Set<string>(Array.isArray(selections) ? selections.map(String) : [])].filter((id) => validIds.has(id)).slice(0, max);
    if (picked.length === max) this.state.votes[playerId] = picked;
  }

  private revealVotes(connectedIds: string[]) {
    const tally: Record<string, number> = {}; Object.values(this.state.votes).flat().forEach((id) => tally[id] = (tally[id] ?? 0) + 1);
    const counts = this.state.players.map((p) => tally[p.id] ?? 0); const top = Math.max(0, ...counts), bottom = Math.min(...counts);
    const topIds = this.state.players.filter((p) => (tally[p.id] ?? 0) === top).map((p) => p.id); const outcome = this.state.card?.outcome ?? "highest";
    if (outcome === "lowest") this.state.voteWinners = this.state.players.filter((p) => (tally[p.id] ?? 0) === bottom).map((p) => p.id);
    else if (outcome === "zero") this.state.voteWinners = this.state.players.filter((p) => !tally[p.id]).map((p) => p.id);
    else if (outcome === "except_top") this.state.voteWinners = this.state.players.filter((p) => !topIds.includes(p.id)).map((p) => p.id);
    else if (outcome === "tie_all") this.state.voteWinners = new Set(counts).size === 1 ? this.state.players.map((p) => p.id) : [];
    else this.state.voteWinners = top ? topIds : [];
    const appliesShot = outcome !== "winner_chooses";
    this.state.players = this.state.players.map((p) => ({ ...p, shots: p.shots + (appliesShot && this.state.voteWinners.includes(p.id) ? 1 : 0) }));
    const drinkers = appliesShot ? this.state.voteWinners.filter((id) => connectedIds.includes(id)) : [];
    this.state.turnResult = { drinkers, nonDrinkers: connectedIds.filter((id) => !drinkers.includes(id)) }; this.state.voteRevealed = true; this.state.confirmed = true;
  }

  private confirmAnswers(active: string[]) {
    this.state.players = this.state.players.map((p) => ({ ...p, shots: p.shots + (this.state.responses[p.id] ? 1 : 0) }));
    this.state.turnResult = { drinkers: active.filter((id) => this.state.responses[id]), nonDrinkers: active.filter((id) => !this.state.responses[id]) }; this.state.confirmed = true;
  }

  private advanceTurn(skipped = false) {
    if (!skipped && !this.state.confirmed) return;
    if (this.state.round >= this.state.totalCards) { this.state.phase = "finished"; return; }
    this.state.round += 1; this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length;
    this.state.card = null; this.state.revealedBy = null; this.state.miniGame = null; this.state.responses = {}; this.state.votes = {}; this.state.voteRevealed = false; this.state.voteWinners = []; this.state.turnResult = null; this.state.confirmed = false;
  }

  private async disconnect(ws: WebSocket) {
    const { playerId } = (ws.deserializeAttachment() || {}) as { playerId?: string }; if (!playerId) return;
    const hasAnother = this.ctx.getWebSockets().some((socket) => { const meta = socket.deserializeAttachment() as { playerId?: string } | null; return socket !== ws && socket.readyState === WebSocket.OPEN && meta?.playerId === playerId; });
    if (hasAnother) return;
    this.setConnected(playerId, false); this.state.disconnectDeadlines[playerId] = Date.now() + 12000; this.ensureHost(); await this.scheduleAlarm(); await this.saveAndBroadcast();
  }

  private currentPlayerId() { return this.state.players[this.state.currentPlayer]?.id; }
  private activePlayerIds() { return this.state.players.filter((p) => p.connected).map((p) => p.id); }
  private connectedParticipantIds() { const mini = this.state.miniGame; return mini ? mini.participantIds.filter((id)=>this.state.players.some((p)=>p.id===id&&p.connected)) : []; }
  private isMiniPlayer(id: string) { return Boolean(this.state.miniGame?.participantIds.includes(id)); }
  private setConnected(id: string, connected: boolean) { const player = this.state.players.find((p) => p.id === id); if (player) player.connected = connected; }
  private ensureHost() { const host = this.state.players.find((p) => p.id === this.state.hostId); if (!host?.connected) this.state.hostId = this.state.players.find((p) => p.connected)?.id ?? this.state.players[0]?.id ?? null; }
  private async scheduleAlarm() {
    const times = Object.values(this.state.disconnectDeadlines);
    if (this.state.miniGame?.phase !== "result" && this.state.miniGame?.endsAt) times.push(this.state.miniGame.endsAt + 2500);
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times)); else await this.ctx.storage.deleteAlarm();
  }
  private publicState(viewerId?: string) {
    const tally: Record<string, number> = {}; if (this.state.voteRevealed) Object.values(this.state.votes).flat().forEach((id) => tally[id] = (tally[id] ?? 0) + 1);
    const { votes: _votes, deck: _deck, disconnectDeadlines: _deadlines, ...safe } = this.state;
    const miniGame = this.state.miniGame ? { ...this.state.miniGame, submissions: this.state.miniGame.phase === "result" ? this.state.miniGame.submissions : {}, submittedIds: Object.keys(this.state.miniGame.submissions) } : null;
    return { ...safe, miniGame, playerCount: this.state.players.length, votedPlayerIds: Object.keys(this.state.votes), myVote: viewerId ? this.state.votes[viewerId] ?? [] : [], voteTally: tally };
  }
  private async saveAndBroadcast() {
    await this.ctx.storage.put("state", this.state);
    for (const socket of this.ctx.getWebSockets()) try { const meta = socket.deserializeAttachment() as { playerId?: string } | null; socket.send(JSON.stringify({ type: "state", state: this.publicState(meta?.playerId) })); } catch { /* closed */ }
  }
}

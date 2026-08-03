"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cards, categoryMeta, type Card } from "./cards";

const API = "https://shot-room-server.selman-narli.workers.dev";
const colors = ["lime", "purple", "orange", "pink"];
const avatars = ["🦊", "🐼", "🦁", "🐸", "🐙", "🦄", "🐯", "🐨", "🦋", "🐲", "🦩", "🐧"];
const nicknameAdjectives = ["Neşeli", "Cesur", "Parlak", "Meraklı", "Uykulu", "Hızlı", "Sakin", "Şanslı", "Çılgın", "Gizemli", "Tatlı", "Enerjik"];
const nicknameAnimals = ["Panda", "Tilki", "Lama", "Koala", "Penguen", "Kaplan", "Ahtapot", "Kurbağa", "Ejderha", "Flamingo", "Aslan", "Baykuş"];
const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const randomNickname = () => `${randomItem(nicknameAdjectives)} ${randomItem(nicknameAnimals)}`;
type Player = { id: string; nickname: string; avatar: string; shots: number; connected: boolean };
type MiniGameState = { game: string; phase: "selecting"|"ready"|"countdown"|"playing"|"result"; challengerId: string; opponentId: string|null; participantIds: string[]; readyIds: string[]; startedAt: number|null; triggerAt: number|null; endsAt: number|null; challenge: { sequence?: Array<string|number>; options?: Array<string|number|{key:string;label:string;hex:string}>; targetIndex?: number; normal?: string; odd?: string; targetId?:number; path?:number[][]; finalIndex?:number; question?:string; correct?:string|number; word?:string; ink?:string; task?:string }; submittedIds: string[]; winners: string[]; losers: string[]; rankings: string[]; details: Record<string, unknown>; confirmed: boolean };
type RoomState = { hostId: string | null; players: Player[]; phase: "lobby" | "playing" | "paused" | "finished"; round: number; totalCards: number; passLimit: number; passes: Record<string, number>; activeCategories: string[]; currentPlayer: number; card: Card | null; revealedBy: string | null; miniGame: MiniGameState|null; responses: Record<string, boolean>; votedPlayerIds: string[]; myVote: string[]; voteTally: Record<string, number>; voteRevealed: boolean; voteWinners: string[]; turnResult: { drinkers: string[]; nonDrinkers: string[] } | null; confirmed: boolean };
const initials = (name: string) => name.trim().slice(0, 2).toLocaleUpperCase("tr-TR");
function PlayerAvatar({ player, index = 0, small = false }: { player?: Player; index?: number; small?: boolean }) { return <span className={`${small ? "mini-avatar" : "avatar"} ${colors[index%colors.length]}`}>{player?.avatar || initials(player?.nickname ?? "")}</span>; }

function TurnResult({ result, players, miniGame }: { result: NonNullable<RoomState["turnResult"]>; players: Player[]; miniGame?: MiniGameState | null }) {
  const group = (ids: string[]) => ids.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  const fiveSecondTimes = miniGame?.game === "five_seconds" ? (miniGame.details.times ?? {}) as Record<string, number> : null;
  return <section className="turn-result"><div className="result-heading"><small>TUR TAMAMLANDI</small><h2>Herkes yerini alsın</h2></div>{fiveSecondTimes&&<div className="five-second-results"><span>⏱ SÜRELER</span>{Object.entries(fiveSecondTimes).map(([id,value],i)=>{const player=players.find((p)=>p.id===id);return <div key={id}><PlayerAvatar player={player} index={i}/><b>{player?.nickname??"Oyuncu"}</b><strong>{(Number(value)/1000).toFixed(2)} sn <small>· {(Math.abs(5000-Number(value))/1000).toFixed(2)} sn fark</small></strong></div>})}</div>}<div className="result-sides"><div className="drinker-side"><span>🥃 İÇENLER</span>{group(result.drinkers).map((p,i)=><div key={p.id}><PlayerAvatar player={p} index={i}/><b>{p.nickname}</b></div>)}{!result.drinkers.length&&<p>Bu tur kimse içmedi.</p>}</div><div className="safe-side"><span>✨ İÇMEYENLER</span>{group(result.nonDrinkers).map((p,i)=><div key={p.id}><PlayerAvatar player={p} index={i+2}/><b>{p.nickname}</b></div>)}{!result.nonDrinkers.length&&<p>Bu tarafta kimse yok.</p>}</div></div></section>;
}

function MiniGamePanel({ game, playerId, players, send, isHost }: { game: MiniGameState; playerId: string; players: Player[]; send: (message: object) => void; isHost: boolean }) {
  const [now, setNow] = useState(0);
  const [taps, setTaps] = useState(0);
  const sentRef = useRef(false);
  const [answer, setAnswer] = useState<Array<string|number>>([]);
  const participant = game.participantIds.includes(playerId);
  const name = (id: string) => players.find((p) => p.id === id)?.nickname ?? "Oyuncu";
  const submitted = game.submittedIds.includes(playerId);
  useEffect(() => { if (!["countdown","playing"].includes(game.phase)) return; const timer = setInterval(() => setNow(Date.now()), 40); return () => clearInterval(timer); }, [game.phase]);
  useEffect(() => {
    if (game.game === "rapid_tap" && participant && game.endsAt && now >= game.endsAt && !sentRef.current) { sentRef.current = true; send({ type:"miniAction", action:"finish", value:taps }); }
  }, [now, game.game, game.endsAt, participant, taps, send]);
  const started = Boolean(game.startedAt && now >= game.startedAt);
  const count = game.startedAt ? Math.max(0, Math.ceil((game.startedAt-now)/1000)) : 3;
  const sendSequence = (item: string|number, length: number) => {
    if (submitted) return; const next = [...answer, item].slice(0, length); setAnswer(next);
    if (next.length === length) send({type:"miniAction",action:"answer",value:next});
  };
  if (game.phase === "selecting") return <section className="mini-stage"><div className="mini-title"><span>2</span><div><small>GÜVEN / İHANET</small><h2>Bir oyuncu seç</h2></div></div>{playerId===game.challengerId?<div className="opponent-grid">{players.filter(p=>p.id!==playerId&&p.connected).map((p,i)=><button key={p.id} onClick={()=>send({type:"selectMiniOpponent",opponentId:p.id})}><PlayerAvatar player={p} index={i+1}/><b>{p.nickname}</b><i>→</i></button>)}</div>:<div className="mini-wait"><span className="dots"><i/><i/><i/></span><b>{name(game.challengerId)}</b> eşleşme seçiyor</div>}</section>;
  if (game.phase === "ready") return <section className="mini-stage ready-stage"><small>TÜM OYUNCULAR HAZIRLANIYOR</small><div className="ready-roster">{game.participantIds.map((id,i)=><span key={id} className={game.readyIds.includes(id)?"done":""}><PlayerAvatar player={players.find(p=>p.id===id)} index={i} small/><b>{name(id)}</b><i>{game.readyIds.includes(id)?"✓":"…"}</i></span>)}</div>{participant?<button className="mini-ready" disabled={game.readyIds.includes(playerId)} onClick={()=>send({type:"miniReady"})}>{game.readyIds.includes(playerId)?"Hazırsın ✓":"Hazırım"}</button>:<p>Bu turu izliyorsun.</p>}<small>{game.readyIds.length}/{game.participantIds.length} HAZIR</small></section>;
  if (!started && game.phase === "countdown") return <section className="mini-stage mini-countdown"><small>AYNI ANDA BAŞLIYOR</small><strong>{count || "BAŞLA"}</strong><p>Telefonunu hazır tut.</p></section>;
  if (game.phase === "result") {
    const statSource = (game.details.times ?? game.details.taps ?? game.details.choices ?? game.details.answers ?? {}) as Record<string,number|string>;
    return <section className="mini-stage result-stage"><span className="result-icon">{game.losers.length?"🏁":"🤝"}</span><small>DOĞRULANMIŞ SONUÇ</small><h2>{game.losers.length?`${game.losers.map(name).join(", ")} kaybetti`:"Bu tur berabere"}</h2><div className="result-stats">{(game.rankings.length?game.rankings:Object.keys(statSource)).map((id,index)=><span key={id} className={game.losers.includes(id)?"lost":""}><b>{index+1}. {name(id)}</b><em>{game.game==="five_seconds"?(Number(statSource[id])/1000).toFixed(2)+" sn":game.game==="reflex"?(Number(statSource[id])<0?"Erken":statSource[id]+" ms"):String(statSource[id]??"—")}</em></span>)}</div>{isHost&&!game.confirmed&&<div className="mini-host-actions"><button onClick={()=>send({type:"restartMini"})}>Yeniden başlat</button><button className="primary" onClick={()=>send({type:"confirmMini"})}>Sonucu onayla</button></div>}</section>;
  }
  if (!participant) return <section className="mini-stage"><div className="mini-wait"><span className="dots"><i/><i/><i/></span><b>Oyuncular yarışıyor</b><p>Sonuçlar aynı anda açıklanacak.</p></div></section>;
  if (submitted) return <section className="mini-stage"><div className="mini-wait"><span className="dots"><i/><i/><i/></span><b>Cevabın kilitlendi</b><p>Diğer oyuncular bekleniyor.</p></div></section>;
  if (game.game === "reflex") { const go=Boolean(game.triggerAt&&now>=game.triggerAt); return <section className={`mini-stage reflex ${go?"go":"hold"}`}><small>{go?"ŞİMDİ!":"BEKLE…"}</small><button onClick={()=>send({type:"miniAction",action:"tap"})}>{go?"DOKUN!":"ERKEN DOKUNMA"}</button></section>; }
  if (game.game === "rapid_tap") return <section className="mini-stage tap-stage"><small>5 SANİYE · HIZLI DOKUN</small><strong>{taps}</strong><button disabled={Boolean(game.endsAt&&now>=game.endsAt)} onClick={()=>setTaps(v=>v+1)}>DOKUN</button></section>;
  if (game.game === "five_seconds") { const elapsed=now-(game.startedAt??now); return <section className="mini-stage five-stage"><small>TAM 5 SANİYEDE DURDUR</small><strong>{elapsed<1000?(elapsed/1000).toFixed(2):"?.??"}</strong><button onClick={()=>send({type:"miniAction",action:"stop"})}>DURDUR</button></section>; }
  if (game.game === "emoji_memory") { const show=now-(game.startedAt??now)<2000; const options=(game.challenge.options??[]) as string[]; return <section className="mini-stage memory-stage"><small>{show?"SIRAYI EZBERLE":"EMOJİLERİ SIRAYLA SEÇ"}</small>{show?<div className="emoji-sequence">{game.challenge.sequence?.map((e,i)=><span key={i}>{e}</span>)}</div>:<><div className="picked-sequence">{answer.map((e,i)=><span key={i}>{e}</span>)}</div><div className="memory-options">{options.map((item,i)=><button key={i} disabled={answer.includes(item)} onClick={()=>sendSequence(item,4)}>{item}</button>)}</div></>}</section>; }
  if (game.game === "number_memory") { const show=now-(game.startedAt??now)<2000; return <section className="mini-stage memory-stage"><small>{show?"SAYIYI EZBERLE":"RAKAMLARI SIRAYLA GİR"}</small>{show?<div className="number-sequence">{game.challenge.sequence?.join(" ")}</div>:<><div className="picked-sequence">{answer.map((e,i)=><span key={i}>{e}</span>)}</div><div className="number-pad">{Array.from({length:10},(_,i)=><button key={i} onClick={()=>sendSequence(i,5)}>{i}</button>)}</div></>}</section>; }
  if (game.game === "odd_one") return <section className="mini-stage odd-stage"><small>FARKLI OLANI BUL</small><div>{Array.from({length:24},(_,i)=><button key={i} onClick={()=>send({type:"miniAction",action:"answer",value:i})}>{i===game.challenge.targetIndex?game.challenge.odd:game.challenge.normal}</button>)}</div></section>;
  if (game.game === "follow_target") { const elapsed=now-(game.startedAt??now); const step=Math.min(4,Math.floor(elapsed/700)); const order=game.challenge.path?.[step]??[0,1,2,3,4,5]; const canPick=elapsed>=3500; return <section className="mini-stage target-stage"><small>{canPick?"HEDEFİN SON YERİNİ SEÇ":"PARLAYAN HEDEFİ TAKİP ET"}</small><div>{order.map((token,index)=><button key={token} className={!canPick&&token===game.challenge.targetId?"target":""} disabled={!canPick} onClick={()=>send({type:"miniAction",action:"answer",value:index})}>{token===game.challenge.targetId?"◎":"●"}</button>)}</div></section>; }
  if (game.game === "quick_math") return <section className="mini-stage quiz-stage"><small>HIZLI HESAP</small><strong>{game.challenge.question}</strong><div>{(game.challenge.options as number[]).map(value=><button key={value} onClick={()=>send({type:"miniAction",action:"answer",value})}>{value}</button>)}</div></section>;
  if (game.game === "color_word") return <section className="mini-stage quiz-stage"><small>{game.challenge.task}</small><strong style={{color:game.challenge.ink}}>{game.challenge.word}</strong><div>{(game.challenge.options as Array<{key:string;label:string}>).map(item=><button key={item.key} onClick={()=>send({type:"miniAction",action:"answer",value:item.key})}>{item.label}</button>)}</div></section>;
  return <section className="mini-stage trust-stage"><small>SEÇİMİN GİZLİ KALACAK</small><h2>Güven mi, İhanet mi?</h2><div><button onClick={()=>send({type:"miniAction",action:"choice",value:"trust"})}>🤝<b>GÜVEN</b></button><button onClick={()=>send({type:"miniAction",action:"choice",value:"betray"})}>🗡️<b>İHANET</b></button></div></section>;
}

export default function Home() {
  const socket = useRef<WebSocket | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connection, setConnection] = useState<"idle" | "connecting" | "online" | "error">("idle");
  const [error, setError] = useState("");
  const [voteDraft, setVoteDraft] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get("room");
    if (code) setJoinCode(code.replace(/\D/g, "").slice(0, 6));
    setNickname(localStorage.getItem("shot-nickname") || randomNickname());
    setAvatar(localStorage.getItem("shot-avatar") || randomItem(avatars));
    setSoundOn(localStorage.getItem("shot-sound") !== "off");
    setVibrationOn(localStorage.getItem("shot-vibration") !== "off");
    return () => socket.current?.close();
  }, []);

  useEffect(() => { if (nickname) localStorage.setItem("shot-nickname", nickname); }, [nickname]);
  useEffect(() => { localStorage.setItem("shot-avatar", avatar); }, [avatar]);
  useEffect(() => { localStorage.setItem("shot-sound", soundOn ? "on" : "off"); }, [soundOn]);
  useEffect(() => { localStorage.setItem("shot-vibration", vibrationOn ? "on" : "off"); }, [vibrationOn]);

  const me = room?.players.find((p) => p.id === playerId);
  const myPasses = room?.passes?.[playerId] ?? room?.passLimit ?? 0;
  const isHost = room?.hostId === playerId;
  const answer = room && playerId in room.responses ? (room.responses[playerId] ? "drank" : "no") : null;
  const responseCount = Object.keys(room?.responses ?? {}).length;
  const connectedCount = room?.players.filter((p) => p.connected).length ?? 0;
  const everyoneAnswered = connectedCount > 0 && responseCount === connectedCount;
  const current = room?.players[room.currentPlayer];
  const isMyTurn = current?.id === playerId;
  const card = room?.card ?? { id: 0, kind: "condition" as const, category: "Koşul", icon: "◎", text: "", tag: "" };
  const paused = room?.phase === "paused";
  const isVote = card.kind === "vote";
  const isDigital = card.kind === "digital";
  const maxSelections = Math.min(card.maxSelections ?? 1, Math.max(1, (room?.players.length ?? 2) - 1));
  const allVotesIn = Boolean(room && isVote && room.players.filter((p) => p.connected).every((p) => room.votedPlayerIds?.includes(p.id)));
  const accent = categoryMeta[card.kind]?.color ?? "#a855f7";
  const activeCategories = room?.activeCategories ?? Object.keys(categoryMeta);
  const availableCardCount = cards.filter((item) => activeCategories.includes(item.kind)).length;
  const shareUrl = typeof window === "undefined" ? "" : `${location.origin}?room=${roomCode}`;

  function feedback() {
    if (vibrationOn) navigator.vibrate?.(25);
    if (soundOn) try { const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext; const context = new Audio(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 520; gain.gain.value = .025; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .06); } catch { /* cihaz desteklemiyor */ }
  }
  function send(message: object) { if (socket.current?.readyState === WebSocket.OPEN) { socket.current.send(JSON.stringify(message)); if (["revealCard","answer","vote","miniAction"].includes(String((message as {type?:string}).type))) feedback(); } }

  useEffect(() => {
    if (!allVotesIn || !isHost || room?.voteRevealed) return;
    setCountdown(3);
    const one = window.setTimeout(() => setCountdown(2), 800);
    const two = window.setTimeout(() => setCountdown(1), 1600);
    const reveal = window.setTimeout(() => { setCountdown(0); send({ type: "revealVotes" }); }, 2400);
    return () => [one, two, reveal].forEach(clearTimeout);
  }, [allVotesIn, isHost, room?.voteRevealed, room?.round]);

  async function createRoom() {
    if (!nickname.trim()) return setError("Önce takma adını yaz.");
    setConnection("connecting"); setError("");
    try { const response = await fetch(`${API}/rooms`, { method: "POST" }); if (!response.ok) throw new Error("create_failed"); const data = await response.json() as {code:string}; connect(data.code); }
    catch { setConnection("error"); setError("Oda oluşturulamadı. Tekrar dene."); }
  }

  function joinRoom() {
    if (!nickname.trim()) return setError("Önce takma adını yaz.");
    if (!/^\d{6}$/.test(joinCode)) return setError("6 haneli oda kodunu gir.");
    connect(joinCode);
  }

  function connect(code: string) {
    socket.current?.close(); setConnection("connecting"); setRoomCode(code);
    const savedId = localStorage.getItem(`shot-player-${code}`) || "";
    const url = `${API.replace("https", "wss")}/rooms/${code}/connect?nickname=${encodeURIComponent(nickname.trim())}&avatar=${encodeURIComponent(avatar)}${savedId ? `&playerId=${savedId}` : ""}`;
    const ws = new WebSocket(url); socket.current = ws;
    let welcomed = false;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "welcome") { welcomed = true; setPlayerId(msg.playerId); localStorage.setItem(`shot-player-${code}`, msg.playerId); setRoom(msg.state); setConnection("online"); }
      if (msg.type === "state") setRoom(msg.state);
    };
    ws.onerror = () => { if (!welcomed) { setConnection("error"); setError("Bu oda bulunamadı. Kodu kontrol edip tekrar dene."); } };
    ws.onclose = () => { if (!welcomed) { setConnection("error"); setRoom(null); setError("Bu oda bulunamadı. Kodu kontrol edip tekrar dene."); } else setConnection("idle"); };
  }

  function startGame() {
    const pool = cards.filter((item) => activeCategories.includes(item.kind));
    send({ type: "start", cards: pool });
  }
  function nextCard() { setVoteDraft([]); send({ type: "next" }); }
  function passCard() { if (!isMyTurn || myPasses < 1 || room?.confirmed) return; setVoteDraft([]); send({ type: "skip" }); }
  function leave() { socket.current?.close(); setRoom(null); setRoomCode(""); setPlayerId(""); setConnection("idle"); setSettingsOpen(false); setPlayersOpen(false); history.replaceState({}, "", location.pathname); }
  async function copyRoom() { await navigator.clipboard?.writeText(shareUrl); setCopied(true); window.setTimeout(()=>setCopied(false),1600); }
  function toggleCategory(kind: string) {
    if (!isHost) return;
    const next = activeCategories.includes(kind) ? activeCategories.filter((item) => item !== kind) : [...activeCategories, kind];
    if (next.length) send({ type: "configureCategories", categories: next });
  }
  function toggleVote(id: string) {
    if (room?.myVote?.length || room?.voteRevealed || id === playerId) return;
    setVoteDraft((old) => old.includes(id) ? old.filter((x) => x !== id) : old.length < maxSelections ? [...old, id] : maxSelections === 1 ? [id] : old);
  }
  function submitVote() { if (voteDraft.length === maxSelections) send({ type: "vote", selections: voteDraft }); }
  const orderedPlayers = useMemo(() => room?.players ?? [], [room]);

  return (
    <main className={`app-shell phase-${room?.phase ?? "welcome"}`}>
      <header className={`topbar ${!room || room.phase==="lobby" ? "landing-topbar" : ""}`}>
        <button className="brand" onClick={leave} aria-label="SHOT ana ekran"><span className="brand-mark"><i>!</i></span><span className="brand-word">SHOT<span>!</span></span></button>
        <div className="room-pill"><i className={connection === "online" ? "" : "offline"}/> ODA <strong>{roomCode ? `${roomCode.slice(0,3)} ${roomCode.slice(3)}` : "— — —"}</strong></div>
        <div className="top-actions">{room&&room.phase!=="lobby"&&<button className="icon-button players-button" onClick={() => setPlayersOpen(true)} aria-label="Oyuncuları aç">♟</button>}<button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Ayarları aç">⚙</button></div>
      </header>

      {!room ? (
        <section className="lobby welcome">
          <div className="eyebrow">CANLI PARTİ OYUNU</div><h1>Ekibi topla,<br/><em>oyunu başlat.</em></h1>
          <p>Kendine bir oyun kimliği seç. Sonra yeni bir oda aç veya arkadaşının 6 haneli koduyla katıl.</p>
          <section className="identity-card"><div className="identity-head"><PlayerAvatar player={{id:"preview",nickname,avatar,shots:0,connected:true}} index={1}/><label className="field"><span>TAKMA ADIN</span><input value={nickname} onChange={(e) => setNickname(e.target.value.slice(0,24))} aria-label="Takma ad" autoComplete="nickname"/></label><button className="reroll" onClick={()=>setNickname(randomNickname())} aria-label="Yeni rastgele takma ad">↻</button></div><div className="avatar-picker" aria-label="Avatar seç">{avatars.map((item)=><button key={item} className={avatar===item?"active":""} onClick={()=>setAvatar(item)} aria-label={`${item} avatarını seç`}>{item}</button>)}</div></section>
          <button className="start-button create cta-button" disabled={connection === "connecting"} onClick={createRoom}><span className="cta-icon">🥃<i>+</i></span><span className="cta-copy"><b>{connection === "connecting" ? "Oda hazırlanıyor…" : "Yeni oda oluştur"}</b><small>Arkadaşlarını davet et ve oyunu başlat</small></span><em>→</em></button>
          <div className="divider"><span>ODA KODUN VAR MI?</span></div>
          <div className="join-form"><input inputMode="numeric" value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0,6))} placeholder="000 000" aria-label="6 haneli oda kodu"/><button onClick={joinRoom}>Odaya katıl →</button></div>
          {error && <p className="error">{error}</p>}
          <div className="server-badge"><i/> CLOUDFLARE · CANLI SUNUCU</div>
        </section>
      ) : room.phase === "lobby" ? (
        <section className="lobby">
          <div className="eyebrow">ODA HAZIR · CANLI</div><h1>Arkadaşlarını çağır,<br/><em>ayarları seç.</em></h1>
          <p>Oda kodunu arkadaşlarınla paylaş. Herkes hazır olduğunda oyunu başlat.</p>
          <div className="join-card"><div className="room-code-block"><small>ODA KODU</small><strong>{roomCode.slice(0,3)} {roomCode.slice(3)}</strong><span><i/> Kod geçerli, arkadaşların katılabilir.</span></div><div className="qr-actions"><div className="fake-qr" aria-label="Oda bağlantısı"><span>SHOT!</span></div><button onClick={copyRoom}>{copied?"✓ Kopyalandı":"↥ Kodu paylaş"}</button></div></div>
          <div className="lobby-head"><b>OYUNCULAR · {orderedPlayers.length}</b><span>CANLI BAĞLANTI</span></div>
          <div className="lobby-players">{orderedPlayers.map((p,i) => <div key={p.id}><PlayerAvatar player={p} index={i}/><b>{p.nickname}{p.id === room.hostId && <small> YÖNETİCİ</small>}</b><i className={p.connected ? "" : "away"}>{p.connected ? "✓" : "○"}</i></div>)}<button className="invite-tile" onClick={copyRoom}><strong>＋</strong><span>Davet et</span></button></div>
          <section className="lobby-settings"><div className="settings-kicker">OYUN ÖZETİ · {room.totalCards} TUR · {activeCategories.length} KATEGORİ</div><details open><summary>Oyun ayarları</summary>
          <div className="card-count-picker"><div><small>OYUN UZUNLUĞU</small><strong>{room.totalCards} kart</strong></div><div>{[15,30,50,75].map((count)=><button key={count} disabled={!isHost} className={room.totalCards===count?"active":""} onClick={()=>send({type:"configure",totalCards:count})}>{count}</button>)}</div><p>{room.totalCards<=15?"Hızlı · yaklaşık 20 dakika":room.totalCards<=30?"Standart · yaklaşık 45 dakika":room.totalCards<=50?"Uzun · yaklaşık 75 dakika":"Maraton · 2 saate kadar"}</p></div>
          <div className="pass-count-picker"><div><small>KİŞİ BAŞI PAS HAKKI</small><strong>{room.passLimit} hak</strong></div><div>{[1,2].map((count)=><button key={count} disabled={!isHost} className={room.passLimit===count?"active":""} onClick={()=>send({type:"configurePasses",passLimit:count})}>{count}</button>)}</div><p>Her oyuncu, sırası kendisindeyken istemediği kartı değiştirebilir.</p></div>
          </details><details><summary>Kart kategorileri <span>{activeCategories.length}/4 açık</span></summary><div className="category-filter-head"><div><small>KART KATEGORİLERİ</small><strong>{availableCardCount} farklı kart</strong></div><span>{isHost?"İstediklerini aç veya kapat":"Oda yöneticisi seçiyor"}</span></div>
          <div className="category-filter">{Object.entries(categoryMeta).map(([key,meta])=>{const active=activeCategories.includes(key);return <button key={key} disabled={!isHost} className={active?"active":""} onClick={()=>toggleCategory(key)} style={{"--cat":meta.color} as React.CSSProperties}><i>{meta.icon}</i><span><b>{meta.label}</b><small>{cards.filter(c=>c.kind===key).length} kart</small></span><em>{active?"✓":"+"}</em></button>})}</div>
          </details>
          </section>
          {isHost ? <button className="start-button cta-button lobby-start" onClick={startGame} disabled={orderedPlayers.length < 2}><span className="cta-icon">🥃<i>+</i></span><span className="cta-copy"><b>Oyunu başlat</b><small>{orderedPlayers.length < 2 ? "En az 2 oyuncu gerekli" : `${orderedPlayers.length} oyuncu hazır`}</small></span><em>→</em></button> : <div className="waiting-host">Oda yöneticisi oyunu başlatacak <span className="dots"><i/><i/><i/></span></div>}
        </section>
      ) : room.phase === "finished" ? (
        <section className="lobby finish-screen"><div className="finish-icon">★</div><div className="eyebrow">OYUN TAMAMLANDI</div><h1>Harika oyundu,<br/><em>efsane ekip.</em></h1><p>Seçtiğiniz {room.totalCards} turun tamamı oynandı. Gecenin tablosu:</p><div className="final-ranking">{orderedPlayers.slice().sort((a,b)=>b.shots-a.shots).map((p,i)=><div key={p.id}><b>{i+1}</b><PlayerAvatar player={p} index={orderedPlayers.indexOf(p)}/><p>{p.nickname}</p><strong>{p.shots} <small>SHOT</small></strong></div>)}</div><button className="start-button" onClick={leave}>Ana ekrana dön →</button></section>
      ) : (
        <>
          <section className="status-strip"><div><span>TUR</span><strong>{String(room.round).padStart(2,"0")}<small>/ {room.totalCards}</small></strong></div><div className="turn"><span>{isMyTurn ? (room.card ? "Kartı açtın" : "Sıra sende") : "Sıradaki oyuncu"}</span><strong><PlayerAvatar player={current} index={room.currentPlayer} small/> {current?.nickname}</strong></div><button className="pause" onClick={() => setPlayersOpen(true)} aria-label="Oyuncuları aç">♟</button></section>
          <section className="game-area">
            <div className="round-progress"><i style={{width:`${Math.min(100,(room.round/room.totalCards)*100)}%`}}/><span>{room.totalCards-room.round} tur kaldı</span></div>
            {!room.card ? <div className={`closed-card-wrap ${isMyTurn ? "your-turn" : ""}`}><div className="closed-card"><span className="closed-logo">S!</span><i>SHOT!</i><small>KART #{String(room.round).padStart(2,"0")}</small></div>{isMyTurn ? <><p>Sıra sende. Hazır olduğunda kartını aç.</p><button className="reveal-button" onClick={()=>send({type:"revealCard"})}>KARTI AÇ <span>✦</span></button></> : <div className="waiting-reveal"><span className="dots"><i/><i/><i/></span><p><strong>{current?.nickname}</strong> kartını açacak</p></div>}</div> : <>
            <div className={`card-stack ${room.revealedBy===playerId?"opener-highlight":""}`} style={{"--accent":accent} as React.CSSProperties}><div className="back-card one"/><div className="back-card two"/><article className={`game-card category-${card.kind} ${room.confirmed ? "confirmed" : ""}`}><div className="card-top"><span>{card.category}</span><span className="card-icon">{card.icon}</span></div><div className="card-copy"><div className="quote">“</div><h1>{card.text}</h1><p>{isVote ? "Oylar gizli tutulur · Kendine oy veremezsin" : "Cevabını dürüstçe seç."}</p></div><div className="card-bottom"><span>#{String(card.id).padStart(3,"0")}</span><b>{room.confirmed ? "Tur tamamlandı" : card.tag}</b></div></article></div>
            <div className="pass-row"><span>{isMyTurn?"Kartı değiştirmek ister misin?":`${current?.nickname} isterse kartı değiştirebilir.`}</span><button disabled={!isMyTurn || myPasses===0 || room.confirmed} onClick={passCard}>↷ Pas <b>{isMyTurn?myPasses:"—"}</b></button></div>
            {room.confirmed&&room.turnResult ? <TurnResult result={room.turnResult} players={orderedPlayers} miniGame={room.miniGame}/> : isDigital&&room.miniGame ? <MiniGamePanel key={`${room.round}-${room.miniGame.startedAt ?? "ready"}`} game={room.miniGame} playerId={playerId} players={orderedPlayers} send={send} isHost={isHost}/> : isVote ? (
              <section className="response-panel vote-panel">
                <div className="response-title"><div><small>GİZLİ OYLAMA</small><h2>{room.voteRevealed ? "Sonuçlar açıklandı" : `${maxSelections} kişi seç`}</h2></div><span>{room.votedPlayerIds?.length??0}/{orderedPlayers.filter(p=>p.connected).length} OY</span></div>
                {room.voteRevealed ? <div className="vote-results">{orderedPlayers.slice().sort((a,b)=>(room.voteTally[b.id]??0)-(room.voteTally[a.id]??0)).map((p,i)=>{const n=room.voteTally[p.id]??0;const winner=room.voteWinners.includes(p.id);return <div key={p.id} className={winner?"winner":""}><PlayerAvatar player={p} index={orderedPlayers.indexOf(p)}/><p><b>{p.nickname}</b><i><em style={{width:`${Math.max(6,n/Math.max(1,...Object.values(room.voteTally))*100)}%`}}/></i></p><strong>{n}<small> OY</small></strong>{winner&&<label>{card.outcome==="winner_chooses"?"SEÇİM HAKKI":"+1 SHOT"}</label>}</div>})}</div> : <><div className="vote-grid">{orderedPlayers.filter(p=>p.id!==playerId).map((p,i)=>{const locked=Boolean(room.myVote?.length);const selected=(locked?room.myVote:voteDraft).includes(p.id);return <button key={p.id} className={selected?"selected":""} disabled={locked} onClick={()=>toggleVote(p.id)}><PlayerAvatar player={p} index={i+1}/><b>{p.nickname}</b><i>{selected?"✓":"+"}</i></button>})}</div><button className="submit-vote" disabled={Boolean(room.myVote?.length)||voteDraft.length!==maxSelections} onClick={submitVote}>{room.myVote?.length?"Oyun kaydedildi ✓":`Oyunu gönder · ${voteDraft.length}/${maxSelections}`}</button></>}
                {!room.voteRevealed&&<div className="waiting"><span className="dots"><i/><i/><i/></span><p><strong>{room.votedPlayerIds?.length??0} kişi oy verdi.</strong><br/>{allVotesIn?"Sonuçlar açıklanıyor...":"Oy verenlerin kimliği gizli."}</p><div className="tiny-avatars">{orderedPlayers.map((p,i)=><span key={p.id} className={`${colors[i%4]} ${room.votedPlayerIds?.includes(p.id)?"done":""}`}>{initials(p.nickname)}</span>)}</div></div>}
              </section>
            ) : <section className="response-panel"><div className="response-title"><div><small>CEVABINI SEÇ</small><h2>Bu tur içtin mi?</h2></div><span>{responseCount}/{connectedCount} CEVAP</span></div><div className="answer-buttons"><button disabled={room.confirmed} className={answer==="drank"?"selected drank":""} onClick={() => send({type:"answer",drank:true})}><span>▰</span><b>İÇTİM</b><small>+1 shot</small></button><button disabled={room.confirmed} className={answer==="no"?"selected no":""} onClick={() => send({type:"answer",drank:false})}><span>✕</span><b>İÇMEDİM</b><small>Bu tur değil</small></button></div><div className={`waiting ${everyoneAnswered?"ready":""}`}><span className="dots"><i/><i/><i/></span><p><strong>{everyoneAnswered?"Herkes cevapladı!":`${responseCount} kişi cevapladı.`}</strong><br/>{everyoneAnswered?"Oda yöneticisi sonucu kaydedebilir.":"Diğer cevaplar bekleniyor..."}</p><div className="tiny-avatars">{orderedPlayers.filter(p=>p.connected).map((p,i)=><span key={p.id} className={`${colors[i%4]} ${p.id in room.responses?"done":""}`}>{p.avatar||initials(p.nickname)}</span>)}</div></div></section>}</>}
          </section>
          {isHost&&<div className="floating-host-control"><span>{room.confirmed?"Tur tamamlandı":isDigital?"Mini oyun sürüyor":isVote?"Oylar toplanıyor":everyoneAnswered?"Herkes hazır":"Cevaplar bekleniyor"}</span><button disabled={room.confirmed?false:isDigital||isVote?!room.voteRevealed:!everyoneAnswered} onClick={room.confirmed?nextCard:()=>send({type:"confirm"})}>{room.confirmed?(room.round===room.totalCards?"Oyunu bitir →":"Sonraki tur →"):isDigital?"Sonucu bekle":isVote?"Oyları bekle":"Sonucu kaydet ✓"}</button></div>}
        </>
      )}
      {playersOpen&&room&&<div className="drawer-backdrop" onClick={()=>setPlayersOpen(false)}><aside className="players-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-title"><div><small>ODA {roomCode.slice(0,3)} {roomCode.slice(3)}</small><h2>Oyuncular</h2></div><button onClick={()=>setPlayersOpen(false)}>×</button></div><div className="score-list">{orderedPlayers.map((p,i)=><div key={p.id} className={p.id===playerId?"you":""}><PlayerAvatar player={p} index={i}/><p><b>{p.nickname}</b><small>{p.id===room.hostId?`YÖNETİCİ${p.id===playerId?" · SEN":""}`:p.connected?"ÇEVRİMİÇİ":"BAĞLANTI BEKLENİYOR"}</small></p><strong>{p.shots}<small>SHOT</small></strong></div>)}</div></aside></div>}
      {settingsOpen&&<div className="settings-modal" role="dialog" aria-modal="true" aria-label="Oyun ayarları" onClick={()=>setSettingsOpen(false)}><section className="settings-sheet" onClick={(event)=>event.stopPropagation()}><div className="settings-title"><div><small>SHOT!</small><h2>Ayarlar</h2></div><button onClick={()=>setSettingsOpen(false)} aria-label="Ayarları kapat">×</button></div><div className="setting-row"><span><b>Ses efektleri</b><small>Kart ve seçim geri bildirimleri</small></span><button className={soundOn?"toggle on":"toggle"} onClick={()=>setSoundOn(v=>!v)} aria-pressed={soundOn}><i/></button></div><div className="setting-row"><span><b>Titreşim</b><small>Destekleyen telefonlarda kısa dokunuş hissi</small></span><button className={vibrationOn?"toggle on":"toggle"} onClick={()=>setVibrationOn(v=>!v)} aria-pressed={vibrationOn}><i/></button></div>{room&&<><details className="settings-group"><summary>Oyun bilgileri</summary><div className="settings-room"><span><small>ODA KODU</small><b>{roomCode.slice(0,3)} {roomCode.slice(3)}</b></span><button onClick={copyRoom}>{copied?"Kopyalandı ✓":"Bağlantıyı kopyala"}</button></div><p>{room.totalCards} tur · Kişi başı {room.passLimit} pas · {activeCategories.map(kind=>categoryMeta[kind as keyof typeof categoryMeta]?.label).join(", ")}</p></details><div className="connection-row"><i className={connection==="online"?"":"offline"}/><span>{connection==="online"?"Canlı bağlantı açık":"Bağlantı kesildi"}</span></div></>}{room&&isHost&&room.phase!=="lobby"&&<><button className="settings-action" onClick={()=>{send({type:"pause"});setSettingsOpen(false)}}>{paused?"Oyuna devam et ▶":"Oyuna mola ver Ⅱ"}</button>{room.miniGame&&!room.confirmed&&<div className="mini-settings-actions"><button onClick={()=>{send({type:"restartMini"});setSettingsOpen(false)}}>Mini oyunu yeniden başlat</button><button onClick={()=>{send({type:"cancelMini"});setSettingsOpen(false)}}>Mini oyunu iptal et</button></div>}<button className="end-action" onClick={()=>{if(confirm("Oyunu herkes için bitirmek istiyor musun?")){send({type:"endGame"});setSettingsOpen(false)}}}>Oyunu bitir</button></>}<details className="rules"><summary>Nasıl oynanır?</summary><ol><li>Sırası gelen oyuncu kendi kartını açar.</li><li>Dijital oyunlarda herkes hazır olunca ortak geri sayım başlar.</li><li>Sonuç sunucuda hesaplanır ve yönetici onayından sonra skora eklenir.</li><li>Seçilen tur sayısı tamamlanınca oyun biter.</li></ol></details>{room&&<button className="leave-action" onClick={leave}>Odadan ayrıl</button>}<p className="responsible-note">18+ · Oyun alkolsüz içeceklerle de oynanabilir. Kendi sınırını koru.</p></section></div>}
      {paused&&<div className="modal"><div><span>OYUNA MOLA VERİLDİ</span><h2>Bir nefes alın.</h2><p>Oda yöneticisi hazır olduğunda oyun devam edecek.</p>{isHost&&<button onClick={()=>send({type:"pause"})}>Oyuna devam et ▶</button>}</div></div>}
      {countdown>0&&<div className="countdown"><small>OY BİTTİ</small><strong>{countdown}</strong><span>Sonuçlar geliyor</span></div>}
      <footer className="safe-note">18+ · Sorumlu tüket. Alkolsüz de oynanır.</footer>
    </main>
  );
}

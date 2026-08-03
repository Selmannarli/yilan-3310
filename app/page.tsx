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
type MiniGameState = { game: string; phase: "selecting"|"ready"|"playing"|"result"; challengerId: string; opponentId: string|null; readyIds: string[]; startedAt: number|null; triggerAt: number|null; endsAt: number|null; challenge: { sequence?: string[]; options?: string[][]; correctIndex?: number; targetIndex?: number; normal?: string; odd?: string }; submittedIds: string[]; winners: string[]; losers: string[]; details: Record<string, Record<string, number|string>> };
type RoomState = { hostId: string | null; players: Player[]; phase: "lobby" | "playing" | "paused" | "finished"; round: number; totalCards: number; activeCategories: string[]; currentPlayer: number; card: Card | null; revealedBy: string | null; miniGame: MiniGameState|null; responses: Record<string, boolean>; votedPlayerIds: string[]; myVote: string[]; voteTally: Record<string, number>; voteRevealed: boolean; voteWinners: string[]; turnResult: { drinkers: string[]; nonDrinkers: string[] } | null; confirmed: boolean };
const initials = (name: string) => name.trim().slice(0, 2).toLocaleUpperCase("tr-TR");
function PlayerAvatar({ player, index = 0, small = false }: { player?: Player; index?: number; small?: boolean }) { return <span className={`${small ? "mini-avatar" : "avatar"} ${colors[index%colors.length]}`}>{player?.avatar || initials(player?.nickname ?? "")}</span>; }

function TurnResult({ result, players }: { result: NonNullable<RoomState["turnResult"]>; players: Player[] }) {
  const group = (ids: string[]) => ids.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
  return <section className="turn-result"><div className="result-heading"><small>TUR TAMAMLANDI</small><h2>Herkes yerini alsın</h2></div><div className="result-sides"><div className="drinker-side"><span>🥃 İÇENLER</span>{group(result.drinkers).map((p,i)=><div key={p.id}><PlayerAvatar player={p} index={i}/><b>{p.nickname}</b></div>)}{!result.drinkers.length&&<p>Bu tur kimse içmedi.</p>}</div><div className="safe-side"><span>✨ İÇMEYENLER</span>{group(result.nonDrinkers).map((p,i)=><div key={p.id}><PlayerAvatar player={p} index={i+2}/><b>{p.nickname}</b></div>)}{!result.nonDrinkers.length&&<p>Bu tarafta kimse yok.</p>}</div></div></section>;
}

function MiniGamePanel({ game, playerId, players, send }: { game: MiniGameState; playerId: string; players: Player[]; send: (message: object) => void }) {
  const [now, setNow] = useState(Date.now()); const [taps, setTaps] = useState(0); const [sent, setSent] = useState(false);
  const participant = playerId === game.challengerId || playerId === game.opponentId;
  const name = (id: string) => players.find((p) => p.id === id)?.nickname ?? "Oyuncu";
  useEffect(() => { setTaps(0); setSent(false); }, [game.game, game.startedAt]);
  useEffect(() => { if (game.phase !== "playing") return; const timer = setInterval(() => setNow(Date.now()), 50); return () => clearInterval(timer); }, [game.phase]);
  useEffect(() => { if (game.game === "rapid_tap" && participant && game.endsAt && now >= game.endsAt && !sent) { setSent(true); send({ type:"miniAction", action:"finish", value:taps }); } }, [now, game.game, game.endsAt, participant, sent, taps]);
  if (game.phase === "selecting") return <section className="mini-stage"><div className="mini-title"><span>1</span><div><small>RAKİP SEÇ</small><h2>Düelloya kimi çağırıyorsun?</h2></div></div>{playerId===game.challengerId?<div className="opponent-grid">{players.filter(p=>p.id!==playerId&&p.connected).map((p,i)=><button key={p.id} onClick={()=>send({type:"selectMiniOpponent",opponentId:p.id})}><PlayerAvatar player={p} index={i+1}/><b>{p.nickname}</b><i>→</i></button>)}</div>:<div className="mini-wait"><span className="dots"><i/><i/><i/></span><b>{name(game.challengerId)}</b> rakibini seçiyor</div>}</section>;
  if (game.phase === "ready") { const challenger=players.find(p=>p.id===game.challengerId); const opponent=players.find(p=>p.id===game.opponentId); return <section className="mini-stage ready-stage"><div className="versus"><div><PlayerAvatar player={challenger} index={1}/><b>{name(game.challengerId)}</b></div><i>VS</i><div><PlayerAvatar player={opponent} index={2}/><b>{name(game.opponentId!)}</b></div></div>{participant?<button className="mini-ready" disabled={game.readyIds.includes(playerId)} onClick={()=>send({type:"miniReady"})}>{game.readyIds.includes(playerId)?"Hazırsın ✓":"Hazırım"}</button>:<p>Oyuncular hazırlanıyor...</p>}<small>{game.readyIds.length}/2 HAZIR</small></section>; }
  if (game.phase === "result") return <section className="mini-stage result-stage"><span className="result-icon">{game.losers.length?"🏆":"🤝"}</span><small>MİNİ OYUN SONUCU</small><h2>{game.winners.length?`${game.winners.map(name).join(" & ")} kazandı!`:"Berabere!"}</h2>{game.losers.length?<p><b>{game.losers.map(name).join(" & ")}</b> +1 shot</p>:<p>Bu tur kimse içmiyor.</p>}<div className="result-stats">{Object.entries((game.details.times??game.details.taps??game.details.choices??{}) as Record<string,number|string>).map(([id,value])=><span key={id}><b>{name(id)}</b><em>{game.game==="five_seconds"?(Number(value)/1000).toFixed(2)+" sn":game.game==="reflex"?value+" ms":String(value)}</em></span>)}</div></section>;
  if (!participant) return <section className="mini-stage"><div className="mini-wait"><span className="dots"><i/><i/><i/></span><b>{name(game.challengerId)} ve {name(game.opponentId!)}</b> oynuyor</div></section>;
  if (game.game === "reflex") { const go=Boolean(game.triggerAt&&now>=game.triggerAt); return <section className={`mini-stage reflex ${go?"go":"hold"}`}><small>{go?"ŞİMDİ!":"BEKLE..."}</small><button onClick={()=>send({type:"miniAction",action:"tap"})}>{go?"DOKUN!":"ERKEN DOKUNMA"}</button></section>; }
  if (game.game === "rapid_tap") { const started=Boolean(game.startedAt&&now>=game.startedAt); const left=game.startedAt?Math.max(0,Math.ceil((game.startedAt-now)/1000)):3; return <section className="mini-stage tap-stage"><small>{started?"MÜMKÜN OLDUĞUNCA HIZLI":"HAZIR OL"}</small><strong>{started?taps:left}</strong><button disabled={!started||Boolean(game.endsAt&&now>=game.endsAt)} onClick={()=>setTaps(v=>v+1)}>DOKUN</button></section>; }
  if (game.game === "five_seconds") { const elapsed=now-(game.startedAt??now); return <section className="mini-stage five-stage"><small>TAM 5 SANİYEDE DURDUR</small><strong>{elapsed<1000?(elapsed/1000).toFixed(2):"?.??"}</strong><button onClick={()=>send({type:"miniAction",action:"stop"})}>DURDUR</button></section>; }
  if (game.game === "emoji_memory") { const show=now-(game.startedAt??now)<2000; return <section className="mini-stage memory-stage"><small>{show?"SIRAYI EZBERLE":"DOĞRU SIRAYI SEÇ"}</small>{show?<div className="emoji-sequence">{game.challenge.sequence?.map((e,i)=><span key={i}>{e}</span>)}</div>:<div className="memory-options">{game.challenge.options?.map((option,i)=><button key={i} onClick={()=>send({type:"miniAction",action:"answer",value:i})}>{option.join(" ")}</button>)}</div>}</section>; }
  if (game.game === "odd_one") return <section className="mini-stage odd-stage"><small>FARKLI OLANI BUL</small><div>{Array.from({length:24},(_,i)=><button key={i} onClick={()=>send({type:"miniAction",action:"answer",value:i})}>{i===game.challenge.targetIndex?game.challenge.odd:game.challenge.normal}</button>)}</div></section>;
  return <section className="mini-stage trust-stage"><small>SEÇİMİN GİZLİ KALACAK</small><h2>Güven mi, İhanet mi?</h2><div><button onClick={()=>send({type:"miniAction",action:"choice",value:"trust"})}>🤝<b>GÜVEN</b></button><button onClick={()=>send({type:"miniAction",action:"choice",value:"betray"})}>🗡️<b>İHANET</b></button></div>{game.submittedIds.includes(playerId)&&<p>Seçimin kilitlendi. Rakibin bekleniyor...</p>}</section>;
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
  const [passes, setPasses] = useState(2);
  const [voteDraft, setVoteDraft] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    const target = room?.totalCards ?? 30; const deck: Card[] = [];
    while (pool.length && deck.length < target) {
      const cycle = [...pool];
      for (let i = cycle.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cycle[i], cycle[j]] = [cycle[j], cycle[i]]; }
      if (cycle.length > 1 && deck.at(-1)?.id === cycle[0].id) [cycle[0], cycle[1]] = [cycle[1], cycle[0]];
      deck.push(...cycle.slice(0, target - deck.length));
    }
    send({ type: "start", deck });
  }
  function nextCard() { setVoteDraft([]); send({ type: "next" }); }
  function passCard() { if (!isHost || passes < 1) return; setPasses((p) => p - 1); setVoteDraft([]); send({ type: "skip" }); }
  function leave() { socket.current?.close(); setRoom(null); setRoomCode(""); setPlayerId(""); setConnection("idle"); setSettingsOpen(false); history.replaceState({}, "", location.pathname); }
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
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={leave} aria-label="SHOT ana ekran"><span className="brand-mark"><i>!</i></span><span className="brand-word">SHOT<span>!</span></span></button>
        <div className="room-pill"><i className={connection === "online" ? "" : "offline"}/> ODA <strong>{roomCode ? `${roomCode.slice(0,3)} ${roomCode.slice(3)}` : "— — —"}</strong></div>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Ayarları aç">⚙</button>
      </header>

      {!room ? (
        <section className="lobby welcome">
          <div className="eyebrow">CANLI PARTİ OYUNU</div><h1>Ekibi topla,<br/><em>oyunu başlat.</em></h1>
          <p>Kendine bir oyun kimliği seç. Sonra yeni bir oda aç veya arkadaşının 6 haneli koduyla katıl.</p>
          <section className="identity-card"><div className="identity-head"><PlayerAvatar player={{id:"preview",nickname,avatar,shots:0,connected:true}} index={1}/><label className="field"><span>TAKMA ADIN</span><input value={nickname} onChange={(e) => setNickname(e.target.value.slice(0,24))} aria-label="Takma ad" autoComplete="nickname"/></label><button className="reroll" onClick={()=>setNickname(randomNickname())} aria-label="Yeni rastgele takma ad">↻</button></div><div className="avatar-picker" aria-label="Avatar seç">{avatars.map((item)=><button key={item} className={avatar===item?"active":""} onClick={()=>setAvatar(item)} aria-label={`${item} avatarını seç`}>{item}</button>)}</div></section>
          <button className="start-button create" disabled={connection === "connecting"} onClick={createRoom}>{connection === "connecting" ? "Oda hazırlanıyor…" : "+ Oda oluştur"}</button>
          <div className="divider"><span>ODA KODUN VAR MI?</span></div>
          <div className="join-form"><input inputMode="numeric" value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0,6))} placeholder="000 000" aria-label="6 haneli oda kodu"/><button onClick={joinRoom}>Odaya katıl →</button></div>
          {error && <p className="error">{error}</p>}
          <div className="server-badge"><i/> CLOUDFLARE · CANLI SUNUCU</div>
        </section>
      ) : room.phase === "lobby" ? (
        <section className="lobby">
          <div className="eyebrow">ODA HAZIR · CANLI</div><h1>Arkadaşlarını çağır,<br/><em>ayarları seç.</em></h1>
          <p>Katılmak için bu oda kodunu paylaş. Oda yalnızca sen oluşturduğun için kullanılabilir.</p>
          <div className="join-card"><div className="fake-qr" aria-label="Oda bağlantısı"><span>SHOT!</span></div><div><small>ODA KODU</small><strong>{roomCode.slice(0,3)} {roomCode.slice(3)}</strong><button onClick={copyRoom}>{copied?"✓ Bağlantı kopyalandı":"Bağlantıyı kopyala"}</button></div></div>
          <div className="lobby-head"><b>OYUNCULAR · {orderedPlayers.length}</b><span>CANLI BAĞLANTI</span></div>
          <div className="lobby-players">{orderedPlayers.map((p,i) => <div key={p.id}><PlayerAvatar player={p} index={i}/><b>{p.nickname}{p.id === room.hostId && <small> YÖNETİCİ</small>}</b><i className={p.connected ? "" : "away"}>{p.connected ? "✓" : "○"}</i></div>)}</div>
          <div className="card-count-picker"><div><small>OYUN UZUNLUĞU</small><strong>{room.totalCards} kart</strong></div><div>{[15,30,50,75].map((count)=><button key={count} disabled={!isHost} className={room.totalCards===count?"active":""} onClick={()=>send({type:"configure",totalCards:count})}>{count}</button>)}</div><p>{room.totalCards<=15?"Hızlı · yaklaşık 20 dakika":room.totalCards<=30?"Standart · yaklaşık 45 dakika":room.totalCards<=50?"Uzun · yaklaşık 75 dakika":"Maraton · 2 saate kadar"}</p></div>
          <div className="category-filter-head"><div><small>KART KATEGORİLERİ</small><strong>{availableCardCount} farklı kart</strong></div><span>{isHost?"İstediklerini aç veya kapat":"Oda yöneticisi seçiyor"}</span></div>
          <div className="category-filter">{Object.entries(categoryMeta).map(([key,meta])=>{const active=activeCategories.includes(key);return <button key={key} disabled={!isHost} className={active?"active":""} onClick={()=>toggleCategory(key)} style={{"--cat":meta.color} as React.CSSProperties}><i>{meta.icon}</i><span><b>{meta.label}</b><small>{cards.filter(c=>c.kind===key).length} kart</small></span><em>{active?"✓":"+"}</em></button>})}</div>
          {availableCardCount<room.totalCards&&<p className="deck-warning">Tüm {availableCardCount} kart görüldükten sonra deste yeniden karıştırılacak. Oyun yine {room.totalCards} tur sürecek.</p>}
          {isHost ? <button className="start-button" onClick={startGame} disabled={orderedPlayers.length < 2}>{orderedPlayers.length < 2 ? "En az 2 oyuncu gerekli" : "Oyunu başlat"} <span>→</span></button> : <div className="waiting-host">Oda yöneticisi oyunu başlatacak <span className="dots"><i/><i/><i/></span></div>}
        </section>
      ) : room.phase === "finished" ? (
        <section className="lobby finish-screen"><div className="finish-icon">★</div><div className="eyebrow">OYUN TAMAMLANDI</div><h1>Harika oyundu,<br/><em>efsane ekip.</em></h1><p>Seçtiğiniz {room.totalCards} turun tamamı oynandı. Gecenin tablosu:</p><div className="final-ranking">{orderedPlayers.slice().sort((a,b)=>b.shots-a.shots).map((p,i)=><div key={p.id}><b>{i+1}</b><PlayerAvatar player={p} index={orderedPlayers.indexOf(p)}/><p>{p.nickname}</p><strong>{p.shots} <small>SHOT</small></strong></div>)}</div><button className="start-button" onClick={leave}>Ana ekrana dön →</button></section>
      ) : (
        <>
          <section className="status-strip"><div><span>TUR</span><strong>{String(room.round).padStart(2,"0")}<small>/ {room.totalCards}</small></strong></div><div className="turn"><span>{isMyTurn ? (room.card ? "Kartın açık" : "Kartını aç") : "Sıra onda"}</span><strong><PlayerAvatar player={current} index={room.currentPlayer} small/> {current?.nickname}</strong></div><button className="pause" onClick={() => setSettingsOpen(true)} aria-label="Oyun ayarlarını aç">⚙</button></section>
          <section className="game-area">
            <div className="round-progress"><i style={{width:`${Math.min(100,(room.round/room.totalCards)*100)}%`}}/><span>{room.totalCards-room.round} tur kaldı</span></div>
            {!room.card ? <div className={`closed-card-wrap ${isMyTurn ? "your-turn" : ""}`}><div className="closed-card"><span className="closed-logo">S!</span><i>SHOT!</i><small>KART #{String(room.round).padStart(2,"0")}</small></div>{isMyTurn ? <><p>Sıra sende. Hazır olduğunda kartını aç.</p><button className="reveal-button" onClick={()=>send({type:"revealCard"})}>KARTI AÇ <span>✦</span></button></> : <div className="waiting-reveal"><span className="dots"><i/><i/><i/></span><p><strong>{current?.nickname}</strong> kartını açacak</p></div>}</div> : <>
            <div className={`card-stack ${room.revealedBy===playerId?"opener-highlight":""}`} style={{"--accent":accent} as React.CSSProperties}><div className="back-card one"/><div className="back-card two"/><article className={`game-card category-${card.kind} ${room.confirmed ? "confirmed" : ""}`}><div className="card-top"><span>{card.category}</span><span className="card-icon">{card.icon}</span></div><div className="card-copy"><div className="quote">“</div><h1>{card.text}</h1><p>{isVote ? "Oylar gizli tutulur · Kendine oy veremezsin" : "Cevabını dürüstçe seç."}</p></div><div className="card-bottom"><span>#{String(card.id).padStart(3,"0")}</span><b>{room.confirmed ? "Tur tamamlandı" : card.tag}</b></div></article></div>
            <div className="pass-row"><span>Bu kart gruba uymadı mı?</span><button disabled={!isHost || passes===0} onClick={passCard}>↷ Kartı geç <b>{passes}</b></button></div>
            {room.confirmed&&room.turnResult ? <TurnResult result={room.turnResult} players={orderedPlayers}/> : isDigital&&room.miniGame ? <MiniGamePanel game={room.miniGame} playerId={playerId} players={orderedPlayers} send={send}/> : isVote ? (
              <section className="response-panel vote-panel">
                <div className="response-title"><div><small>GİZLİ OYLAMA</small><h2>{room.voteRevealed ? "Sonuçlar açıklandı" : `${maxSelections} kişi seç`}</h2></div><span>{room.votedPlayerIds?.length??0}/{orderedPlayers.filter(p=>p.connected).length} OY</span></div>
                {room.voteRevealed ? <div className="vote-results">{orderedPlayers.slice().sort((a,b)=>(room.voteTally[b.id]??0)-(room.voteTally[a.id]??0)).map((p,i)=>{const n=room.voteTally[p.id]??0;const winner=room.voteWinners.includes(p.id);return <div key={p.id} className={winner?"winner":""}><PlayerAvatar player={p} index={orderedPlayers.indexOf(p)}/><p><b>{p.nickname}</b><i><em style={{width:`${Math.max(6,n/Math.max(1,...Object.values(room.voteTally))*100)}%`}}/></i></p><strong>{n}<small> OY</small></strong>{winner&&<label>{card.outcome==="winner_chooses"?"SEÇİM HAKKI":"+1 SHOT"}</label>}</div>})}</div> : <><div className="vote-grid">{orderedPlayers.filter(p=>p.id!==playerId).map((p,i)=>{const locked=Boolean(room.myVote?.length);const selected=(locked?room.myVote:voteDraft).includes(p.id);return <button key={p.id} className={selected?"selected":""} disabled={locked} onClick={()=>toggleVote(p.id)}><PlayerAvatar player={p} index={i+1}/><b>{p.nickname}</b><i>{selected?"✓":"+"}</i></button>})}</div><button className="submit-vote" disabled={Boolean(room.myVote?.length)||voteDraft.length!==maxSelections} onClick={submitVote}>{room.myVote?.length?"Oyun kaydedildi ✓":`Oyunu gönder · ${voteDraft.length}/${maxSelections}`}</button></>}
                {!room.voteRevealed&&<div className="waiting"><span className="dots"><i/><i/><i/></span><p><strong>{room.votedPlayerIds?.length??0} kişi oy verdi.</strong><br/>{allVotesIn?"Sonuçlar açıklanıyor...":"Oy verenlerin kimliği gizli."}</p><div className="tiny-avatars">{orderedPlayers.map((p,i)=><span key={p.id} className={`${colors[i%4]} ${room.votedPlayerIds?.includes(p.id)?"done":""}`}>{initials(p.nickname)}</span>)}</div></div>}
              </section>
            ) : <section className="response-panel"><div className="response-title"><div><small>CEVABINI SEÇ</small><h2>Bu tur içtin mi?</h2></div><span>{responseCount}/{connectedCount} CEVAP</span></div><div className="answer-buttons"><button disabled={room.confirmed} className={answer==="drank"?"selected drank":""} onClick={() => send({type:"answer",drank:true})}><span>▰</span><b>İÇTİM</b><small>+1 shot</small></button><button disabled={room.confirmed} className={answer==="no"?"selected no":""} onClick={() => send({type:"answer",drank:false})}><span>✕</span><b>İÇMEDİM</b><small>Bu tur değil</small></button></div><div className={`waiting ${everyoneAnswered?"ready":""}`}><span className="dots"><i/><i/><i/></span><p><strong>{everyoneAnswered?"Herkes cevapladı!":`${responseCount} kişi cevapladı.`}</strong><br/>{everyoneAnswered?"Oda yöneticisi sonucu kaydedebilir.":"Diğer cevaplar bekleniyor..."}</p><div className="tiny-avatars">{orderedPlayers.filter(p=>p.connected).map((p,i)=><span key={p.id} className={`${colors[i%4]} ${p.id in room.responses?"done":""}`}>{p.avatar||initials(p.nickname)}</span>)}</div></div></section>}</>}
          </section>
          <aside className="scoreboard"><div className="score-head"><span>OYUNCULAR</span><button onClick={()=>setSettingsOpen(true)}>AYARLAR</button></div><div className="score-list">{orderedPlayers.map((p,i)=><div key={p.id} className={p.id===playerId?"you":""}><PlayerAvatar player={p} index={i}/><p><b>{p.nickname}</b><small>{p.id===room.hostId?`YÖNETİCİ${p.id===playerId?" · SEN":""}`:`${i+1}. SIRADA`}</small></p><strong>{p.shots}<small>SHOT</small></strong></div>)}</div>{isHost&&<div className="host-control"><span>{room.confirmed?"Tur tamamlandı":isVote?"Oylar toplanıyor":everyoneAnswered?"Herkes hazır":"Cevaplar bekleniyor"}</span><button disabled={room.confirmed?false:isVote?!room.voteRevealed:!everyoneAnswered} onClick={room.confirmed?nextCard:()=>send({type:"confirm"})}>{room.confirmed?(room.round===room.totalCards?"Oyunu bitir →":"Sonraki tur →"):isVote?"Oyları bekle":"Sonucu kaydet ✓"}</button></div>}</aside>
        </>
      )}
      {settingsOpen&&<div className="settings-modal" role="dialog" aria-modal="true" aria-label="Oyun ayarları" onClick={()=>setSettingsOpen(false)}><section className="settings-sheet" onClick={(event)=>event.stopPropagation()}><div className="settings-title"><div><small>SHOT!</small><h2>Ayarlar</h2></div><button onClick={()=>setSettingsOpen(false)} aria-label="Ayarları kapat">×</button></div><div className="setting-row"><span><b>Ses efektleri</b><small>Kart ve seçim geri bildirimleri</small></span><button className={soundOn?"toggle on":"toggle"} onClick={()=>setSoundOn(v=>!v)} aria-pressed={soundOn}><i/></button></div><div className="setting-row"><span><b>Titreşim</b><small>Destekleyen telefonlarda kısa dokunuş hissi</small></span><button className={vibrationOn?"toggle on":"toggle"} onClick={()=>setVibrationOn(v=>!v)} aria-pressed={vibrationOn}><i/></button></div>{room&&<><div className="settings-room"><span><small>ODA KODU</small><b>{roomCode.slice(0,3)} {roomCode.slice(3)}</b></span><button onClick={copyRoom}>{copied?"Kopyalandı ✓":"Bağlantıyı kopyala"}</button></div><div className="connection-row"><i className={connection==="online"?"":"offline"}/><span>{connection==="online"?"Canlı bağlantı açık":"Bağlantı kesildi"}</span></div></>}<details className="rules"><summary>Nasıl oynanır?</summary><ol><li>Sırası gelen oyuncu kendi kartını açar.</li><li>Herkes karttaki görevi tamamlar ve cevabını seçer.</li><li>Oda yöneticisi sonucu kaydeder, ardından sonraki tura geçer.</li><li>Seçilen tur sayısı tamamlanınca oyun biter.</li></ol></details>{room&&isHost&&room.phase!=="lobby"&&<button className="settings-action" onClick={()=>{send({type:"pause"});setSettingsOpen(false)}}>{paused?"Oyuna devam et ▶":"Oyuna mola ver Ⅱ"}</button>}{room&&<button className="leave-action" onClick={leave}>Odadan ayrıl</button>}<p className="responsible-note">18+ · Oyun alkolsüz içeceklerle de oynanabilir. Kendi sınırını koru.</p></section></div>}
      {paused&&<div className="modal"><div><span>OYUNA MOLA VERİLDİ</span><h2>Bir nefes alın.</h2><p>Oda yöneticisi hazır olduğunda oyun devam edecek.</p>{isHost&&<button onClick={()=>send({type:"pause"})}>Oyuna devam et ▶</button>}</div></div>}
      {countdown>0&&<div className="countdown"><small>OY BİTTİ</small><strong>{countdown}</strong><span>Sonuçlar geliyor</span></div>}
      <footer className="safe-note">18+ · Sorumlu tüket. Alkolsüz de oynanır.</footer>
    </main>
  );
}

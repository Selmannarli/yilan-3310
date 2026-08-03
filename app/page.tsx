"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cards, categoryMeta, type Card } from "./cards";

const API = "https://shot-room-server.selman-narli.workers.dev";
const colors = ["lime", "purple", "orange", "pink"];
type Player = { id: string; nickname: string; shots: number; connected: boolean };
type RoomState = { hostId: string | null; players: Player[]; phase: "lobby" | "playing" | "paused" | "finished"; round: number; totalCards: number; currentPlayer: number; card: Card | null; revealedBy: string | null; responses: Record<string, boolean>; votedPlayerIds: string[]; myVote: string[]; voteTally: Record<string, number>; voteRevealed: boolean; voteWinners: string[]; confirmed: boolean };
const initials = (name: string) => name.trim().slice(0, 2).toLocaleUpperCase("tr-TR");

export default function Home() {
  const socket = useRef<WebSocket | null>(null);
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connection, setConnection] = useState<"idle" | "connecting" | "online" | "error">("idle");
  const [error, setError] = useState("");
  const [passes, setPasses] = useState(2);
  const [voteDraft, setVoteDraft] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get("room");
    if (code) setJoinCode(code.replace(/\D/g, "").slice(0, 6));
    return () => socket.current?.close();
  }, []);

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
  const shareUrl = typeof window === "undefined" ? "" : `${location.origin}?room=${roomCode}`;

  function send(message: object) { if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message)); }

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
    try { const data = await fetch(`${API}/rooms`, { method: "POST" }).then((r) => r.json()); connect(data.code); }
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
    const url = `${API.replace("https", "wss")}/rooms/${code}/connect?nickname=${encodeURIComponent(nickname.trim())}${savedId ? `&playerId=${savedId}` : ""}`;
    const ws = new WebSocket(url); socket.current = ws;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "welcome") { setPlayerId(msg.playerId); localStorage.setItem(`shot-player-${code}`, msg.playerId); setRoom(msg.state); setConnection("online"); }
      if (msg.type === "state") setRoom(msg.state);
    };
    ws.onerror = () => { setConnection("error"); setError("Odaya bağlanılamadı."); };
    ws.onclose = () => setConnection((v) => v === "error" ? v : "idle");
  }

  function startGame() {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    send({ type: "start", deck: shuffled.slice(0, room?.totalCards ?? 30) });
  }
  function nextCard() { setVoteDraft([]); send({ type: "next" }); }
  function passCard() { if (!isHost || passes < 1) return; setPasses((p) => p - 1); nextCard(); }
  function leave() { socket.current?.close(); setRoom(null); setRoomCode(""); setPlayerId(""); setConnection("idle"); }
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
        <button className="icon-button" onClick={() => isHost && send({ type: "pause" })} aria-label="Ayarlar">⚙</button>
      </header>

      {!room ? (
        <section className="lobby welcome">
          <div className="eyebrow">CANLI PARTİ OYUNU</div><h1>Ekibi topla,<br/><em>geceyi başlat.</em></h1>
          <p>Bir oda oluştur veya arkadaşının 6 haneli koduyla anında katıl.</p>
          <label className="field"><span>TAKMA ADIN</span><input value={nickname} onChange={(e) => setNickname(e.target.value.slice(0,24))} placeholder="Örn. Selma" autoComplete="nickname"/></label>
          <button className="start-button create" disabled={connection === "connecting"} onClick={createRoom}>+ YENİ ODA OLUŞTUR</button>
          <div className="divider"><span>VEYA KODLA KATIL</span></div>
          <div className="join-form"><input inputMode="numeric" value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0,6))} placeholder="000 000"/><button onClick={joinRoom}>KATIL →</button></div>
          {error && <p className="error">{error}</p>}
          <div className="server-badge"><i/> CLOUDFLARE · CANLI SUNUCU</div>
        </section>
      ) : room.phase === "lobby" ? (
        <section className="lobby">
          <div className="eyebrow">ODA HAZIR · CANLI</div><h1>Ekibi topla,<br/><em>geceyi başlat.</em></h1>
          <p>Arkadaşların bağlantıyı açsın veya <strong>{roomCode}</strong> koduyla katılsın.</p>
          <div className="join-card"><div className="fake-qr" aria-label="Oda bağlantısı"><span>SHOT!</span></div><div><small>ODA KODU</small><strong>{roomCode.slice(0,3)} {roomCode.slice(3)}</strong><button onClick={() => navigator.clipboard?.writeText(shareUrl)}>⌘ Linki kopyala</button></div></div>
          <div className="lobby-head"><b>OYUNCULAR · {orderedPlayers.length}</b><span>CANLI BAĞLANTI</span></div>
          <div className="lobby-players">{orderedPlayers.map((p,i) => <div key={p.id}><span className={`avatar ${colors[i%4]}`}>{initials(p.nickname)}</span><b>{p.nickname}{p.id === room.hostId && <small> HOST</small>}</b><i className={p.connected ? "" : "away"}>{p.connected ? "✓" : "○"}</i></div>)}</div>
          <div className="card-count-picker"><div><small>OYUN UZUNLUĞU</small><strong>{room.totalCards} kart</strong></div><div>{[15,30,50,75].map((count)=><button key={count} disabled={!isHost} className={room.totalCards===count?"active":""} onClick={()=>send({type:"configure",totalCards:count})}>{count}</button>)}</div><p>{room.totalCards<=15?"Hızlı · yaklaşık 20 dakika":room.totalCards<=30?"Standart · yaklaşık 45 dakika":room.totalCards<=50?"Uzun · yaklaşık 75 dakika":"Maraton · 2 saate kadar"}</p></div>
          <div className="deck-summary"><strong>{cards.length}</strong><span>BENZERSİZ KART</span><i/>Her tur farklı bir kategori</div>
          <div className="category-legend">{Object.entries(categoryMeta).map(([key,meta])=><span key={key} style={{"--cat":meta.color} as React.CSSProperties}><i>{meta.icon}</i>{meta.label}<b>{cards.filter(c=>c.kind===key).length}</b></span>)}</div>
          {isHost ? <button className="start-button" onClick={startGame} disabled={orderedPlayers.length < 2}>{orderedPlayers.length < 2 ? "EN AZ 2 OYUNCU GEREKLİ" : "OYUNU BAŞLAT"} <span>→</span></button> : <div className="waiting-host">HOST OYUNU BAŞLATACAK <span className="dots"><i/><i/><i/></span></div>}
        </section>
      ) : room.phase === "finished" ? (
        <section className="lobby finish-screen"><div className="finish-icon">★</div><div className="eyebrow">OYUN TAMAMLANDI</div><h1>İyi geceler,<br/><em>efsane ekip.</em></h1><p>{room.totalCards} kart tamamlandı. Gecenin shot tablosu:</p><div className="final-ranking">{orderedPlayers.slice().sort((a,b)=>b.shots-a.shots).map((p,i)=><div key={p.id}><b>{i+1}</b><span className={`avatar ${colors[orderedPlayers.indexOf(p)%4]}`}>{initials(p.nickname)}</span><p>{p.nickname}</p><strong>{p.shots} <small>SHOT</small></strong></div>)}</div><button className="start-button" onClick={leave}>ANA EKRANA DÖN →</button></section>
      ) : (
        <>
          <section className="status-strip"><div><span>TUR</span><strong>{String(room.round).padStart(2,"0")}<small>/ {room.totalCards}</small></strong></div><div className="turn"><span>{isMyTurn ? (room.card ? "KARTIN AÇIK" : "KARTINI AÇ") : "SIRA ONDA"}</span><strong><i className="mini-avatar">{initials(current?.nickname ?? "")}</i> {current?.nickname.toUpperCase()}</strong></div><button className="pause" onClick={() => isHost && send({ type:"pause" })}>{paused ? "▶" : "Ⅱ"}</button></section>
          <section className="game-area">
            <div className="round-progress"><i style={{width:`${Math.min(100,(room.round/room.totalCards)*100)}%`}}/><span>{room.totalCards-room.round} KART KALDI</span></div>
            {!room.card ? <div className={`closed-card-wrap ${isMyTurn ? "your-turn" : ""}`}><div className="closed-card"><span className="closed-logo">S!</span><i>SHOT!</i><small>KART #{String(room.round).padStart(2,"0")}</small></div>{isMyTurn ? <><p>Sıra sende. Hazır olduğunda kartını aç.</p><button className="reveal-button" onClick={()=>send({type:"revealCard"})}>KARTI AÇ <span>✦</span></button></> : <div className="waiting-reveal"><span className="dots"><i/><i/><i/></span><p><strong>{current?.nickname}</strong> kartını açacak</p></div>}</div> : <>
            <div className={`card-stack ${room.revealedBy===playerId?"opener-highlight":""}`} style={{"--accent":accent} as React.CSSProperties}><div className="back-card one"/><div className="back-card two"/><article className={`game-card category-${card.kind} ${room.confirmed ? "confirmed" : ""}`}><div className="card-top"><span>{card.category}</span><span className="card-icon">{card.icon}</span></div><div className="card-copy"><div className="quote">“</div><h1>{card.text}</h1><p>{isVote ? "Oylar gizlidir · Kendine oy veremezsin" : "Dürüst ol, bahane yok."}</p></div><div className="card-bottom"><span>#{String(card.id).padStart(3,"0")}</span><b>{room.confirmed ? "SONUÇ ONAYLANDI" : card.tag}</b></div></article></div>
            <div className="pass-row"><span>Sana uymadı mı?</span><button disabled={!isHost || passes===0} onClick={passCard}>↷ PAS GEÇ <b>{passes}</b></button></div>
            {isDigital&&<details className="mini-game-brief"><summary><span>⌁</span><div><small>DİJİTAL MİNİ OYUN</small><b>{card.tag}</b></div><i>⌄</i></summary><p>{card.instructions}</p><label>Bu sürümde sonucu oyuncular işaretler. Etkileşimli oyun motoru mobil aşamadan önce bağlanacak.</label></details>}
            {isVote ? (
              <section className="response-panel vote-panel">
                <div className="response-title"><div><small>GİZLİ OYLAMA</small><h2>{room.voteRevealed ? "Sonuçlar açıklandı" : `${maxSelections} kişi seç`}</h2></div><span>{room.votedPlayerIds?.length??0}/{orderedPlayers.filter(p=>p.connected).length} OY</span></div>
                {room.voteRevealed ? <div className="vote-results">{orderedPlayers.slice().sort((a,b)=>(room.voteTally[b.id]??0)-(room.voteTally[a.id]??0)).map((p,i)=>{const n=room.voteTally[p.id]??0;const winner=room.voteWinners.includes(p.id);return <div key={p.id} className={winner?"winner":""}><span className={`avatar ${colors[orderedPlayers.indexOf(p)%4]}`}>{initials(p.nickname)}</span><p><b>{p.nickname}</b><i><em style={{width:`${Math.max(6,n/Math.max(1,...Object.values(room.voteTally))*100)}%`}}/></i></p><strong>{n}<small> OY</small></strong>{winner&&<label>{card.outcome==="winner_chooses"?"SEÇİM HAKKI":"+1 SHOT"}</label>}</div>})}</div> : <><div className="vote-grid">{orderedPlayers.filter(p=>p.id!==playerId).map((p,i)=>{const locked=Boolean(room.myVote?.length);const selected=(locked?room.myVote:voteDraft).includes(p.id);return <button key={p.id} className={selected?"selected":""} disabled={locked} onClick={()=>toggleVote(p.id)}><span className={`avatar ${colors[(i+1)%4]}`}>{initials(p.nickname)}</span><b>{p.nickname}</b><i>{selected?"✓":"+"}</i></button>})}</div><button className="submit-vote" disabled={Boolean(room.myVote?.length)||voteDraft.length!==maxSelections} onClick={submitVote}>{room.myVote?.length?"OYUN KAYDEDİLDİ ✓":`OYU GÖNDER · ${voteDraft.length}/${maxSelections}`}</button></>}
                {!room.voteRevealed&&<div className="waiting"><span className="dots"><i/><i/><i/></span><p><strong>{room.votedPlayerIds?.length??0} kişi oy verdi.</strong><br/>{allVotesIn?"Sonuçlar açıklanıyor...":"Oy verenlerin kimliği gizli."}</p><div className="tiny-avatars">{orderedPlayers.map((p,i)=><span key={p.id} className={`${colors[i%4]} ${room.votedPlayerIds?.includes(p.id)?"done":""}`}>{initials(p.nickname)}</span>)}</div></div>}
              </section>
            ) : <section className="response-panel"><div className="response-title"><div><small>CEVABINI SEÇ</small><h2>Sen içtin mi?</h2></div><span>{responseCount}/{connectedCount} CEVAP</span></div><div className="answer-buttons"><button disabled={room.confirmed} className={answer==="drank"?"selected drank":""} onClick={() => send({type:"answer",drank:true})}><span>▰</span><b>İÇTİM</b><small>+1 shot</small></button><button disabled={room.confirmed} className={answer==="no"?"selected no":""} onClick={() => send({type:"answer",drank:false})}><span>✕</span><b>İÇMEDİM</b><small>Bu tur değil</small></button></div><div className={`waiting ${everyoneAnswered?"ready":""}`}><span className="dots"><i/><i/><i/></span><p><strong>{everyoneAnswered?"Herkes cevapladı!":`${responseCount} kişi cevapladı.`}</strong><br/>{everyoneAnswered?"Host sonucu onaylayabilir.":"Diğerleri bekleniyor..."}</p><div className="tiny-avatars">{orderedPlayers.filter(p=>p.connected).map((p,i)=><span key={p.id} className={`${colors[i%4]} ${p.id in room.responses?"done":""}`}>{initials(p.nickname)}</span>)}</div></div></section>}</>}
          </section>
          <aside className="scoreboard"><div className="score-head"><span>SHOT DURUMU</span><button onClick={leave}>ÇIK</button></div><div className="score-list">{orderedPlayers.map((p,i)=><div key={p.id} className={p.id===playerId?"you":""}><span className={`avatar ${colors[i%4]}`}>{initials(p.nickname)}</span><p><b>{p.nickname}</b><small>{p.id===room.hostId?`HOST${p.id===playerId?" · SEN":""}`:`${i+1}. SIRADA`}</small></p><strong>{p.shots}<small>SHOT</small></strong></div>)}</div>{isHost&&<div className="host-control"><span>{room.confirmed?"TUR TAMAM":isVote?"OY TOPLANIYOR":everyoneAnswered?"HERKES HAZIR":"CEVAPLAR BEKLENİYOR"}</span><button disabled={room.confirmed?false:isVote?!room.voteRevealed:!everyoneAnswered} onClick={room.confirmed?nextCard:()=>send({type:"confirm"})}>{room.confirmed?(room.round===room.totalCards?"OYUNU BİTİR →":"SONRAKİ KART →"):isVote?"OYLARI BEKLE":"SONUCU ONAYLA ✓"}</button></div>}</aside>
        </>
      )}
      {paused&&<div className="modal"><div><span>OYUN DURAKLATILDI</span><h2>Bir nefes alın.</h2><p>Host hazır olduğunda oyun devam edecek.</p>{isHost&&<button onClick={()=>send({type:"pause"})}>DEVAM ET ▶</button>}</div></div>}
      {countdown>0&&<div className="countdown"><small>OY BİTTİ</small><strong>{countdown}</strong><span>Sonuçlar geliyor</span></div>}
      <footer className="safe-note">18+ · Sorumlu tüket. Alkolsüz de oynanır.</footer>
    </main>
  );
}

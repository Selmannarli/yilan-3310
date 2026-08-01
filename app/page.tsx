"use client";

import { useMemo, useState } from "react";

type Player = { name: string; initials: string; color: string; shots: number; host?: boolean; answered?: boolean };

const initialPlayers: Player[] = [
  { name: "Mert", initials: "ME", color: "lime", shots: 2, host: true, answered: true },
  { name: "Selin", initials: "SE", color: "purple", shots: 1, answered: true },
  { name: "Can", initials: "CA", color: "orange", shots: 3, answered: false },
  { name: "Ece", initials: "EC", color: "pink", shots: 0, answered: true },
];

const cards = [
  { kicker: "KOŞUL KARTI", icon: "◎", text: "Bu gruptaki herkesi bir yıldan uzun süredir tanıyanlar shot atsın.", tag: "HAFİF" },
  { kicker: "İFŞA KARTI", icon: "◇", text: "Telefonunda eski sevgilisinin fotoğrafı bulunan herkes shot atsın.", tag: "NORMAL" },
  { kicker: "KAOS KARTI", icon: "⚡", text: "Önümüzdeki üç tur boyunca isim söylemek yasak. Söyleyen shot atsın.", tag: "SERT" },
  { kicker: "OYLAMA", icon: "✦", text: "Bu grupta eski sevgilisine dönme ihtimali en yüksek kişi kim?", tag: "GİZLİ OY" },
];

export default function Home() {
  const [screen, setScreen] = useState<"lobby" | "game">("game");
  const [players, setPlayers] = useState(initialPlayers);
  const [answer, setAnswer] = useState<"drank" | "no" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [round, setRound] = useState(7);
  const [cardIndex, setCardIndex] = useState(0);
  const [passes, setPasses] = useState(2);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState("Klasik");
  const card = cards[cardIndex % cards.length];
  const responseCount = useMemo(() => players.filter((p) => p.answered).length, [players]);

  function choose(value: "drank" | "no") {
    if (confirmed) return;
    setAnswer(value);
    setPlayers((list) => list.map((p, i) => i === 0 ? { ...p, answered: true } : p));
  }

  function nextCard() {
    setCardIndex((i) => i + 1);
    setRound((r) => r + 1);
    setConfirmed(false);
    setAnswer(null);
    setPlayers((list) => list.map((p) => ({ ...p, answered: false })));
  }

  function confirm() {
    if (!confirmed && answer === "drank") setPlayers((list) => list.map((p, i) => i === 0 ? { ...p, shots: p.shots + 1 } : p));
    setConfirmed(true);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen("game")} aria-label="Ana oyun ekranı"><span className="brand-mark">S!</span><span>SHOT!</span></button>
        <div className="room-pill"><i /> ODA <strong>728 419</strong></div>
        <button className="icon-button" onClick={() => setPaused(!paused)} aria-label="Ayarlar">⚙</button>
      </header>

      {screen === "lobby" ? (
        <section className="lobby">
          <div className="eyebrow">ODA HAZIR</div>
          <h1>Ekibi topla,<br/><em>geceyi başlat.</em></h1>
          <p>Arkadaşların QR kodu tarasın veya <strong>728 419</strong> koduyla katılsın.</p>
          <div className="join-card">
            <div className="fake-qr" aria-label="Oda QR kodu"><span>SHOT!</span></div>
            <div><small>ODA KODU</small><strong>728 419</strong><button>⌘ Kodu paylaş</button></div>
          </div>
          <div className="lobby-head"><b>OYUNCULAR · {players.length}</b><span>HERKES HAZIR</span></div>
          <div className="lobby-players">{players.map((p) => <div key={p.name}><span className={`avatar ${p.color}`}>{p.initials}</span><b>{p.name}{p.host && <small> HOST</small>}</b><i>✓</i></div>)}</div>
          <div className="mode-picker"><small>OYUN MODU</small><div>{["Klasik", "İfşa", "Kaos"].map((m) => <button key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>{m}</button>)}</div></div>
          <button className="start-button" onClick={() => setScreen("game")}>OYUNU BAŞLAT <span>→</span></button>
        </section>
      ) : (
        <>
          <section className="status-strip">
            <div><span>TUR</span><strong>{String(round).padStart(2,"0")}<small>/ 30</small></strong></div>
            <div className="turn"><span>SIRA SENDE</span><strong><i className="mini-avatar">ME</i> MERT</strong></div>
            <button className="pause" onClick={() => setPaused(!paused)} aria-label="Oyunu duraklat">{paused ? "▶" : "Ⅱ"}</button>
          </section>

          <section className="game-area">
            <div className="card-stack">
              <div className="back-card one"/><div className="back-card two"/>
              <article className={`game-card ${confirmed ? "confirmed" : ""}`}>
                <div className="card-top"><span>{card.kicker}</span><span className="card-icon">{card.icon}</span></div>
                <div className="card-copy"><div className="quote">“</div><h1>{card.text}</h1><p>— Dürüst ol, bahane yok.</p></div>
                <div className="card-bottom"><span>#{String(cardIndex + 42).padStart(3,"0")}</span><b>{confirmed ? "SONUÇ ONAYLANDI" : card.tag}</b></div>
              </article>
            </div>

            <div className="pass-row"><span>Sana uymadı mı?</span><button disabled={passes === 0} onClick={() => { setPasses((p) => p - 1); nextCard(); }}>↷ PAS GEÇ <b>{passes}</b></button></div>

            <section className="response-panel">
              <div className="response-title"><div><small>CEVABINI SEÇ</small><h2>Sen içtin mi?</h2></div><span>{responseCount}/{players.length} CEVAP</span></div>
              <div className="answer-buttons">
                <button className={answer === "drank" ? "selected drank" : ""} onClick={() => choose("drank")}><span>▰</span><b>İÇTİM</b><small>+1 shot</small></button>
                <button className={answer === "no" ? "selected no" : ""} onClick={() => choose("no")}><span>✕</span><b>İÇMEDİM</b><small>Bu tur değil</small></button>
              </div>
              <div className="waiting"><span className="dots"><i/><i/><i/></span><p><strong>{responseCount} kişi cevapladı.</strong><br/>Diğerleri bekleniyor...</p><div className="tiny-avatars">{players.map((p) => <span key={p.name} className={`${p.color} ${p.answered ? "done" : ""}`}>{p.initials}</span>)}</div></div>
            </section>
          </section>

          <aside className="scoreboard">
            <div className="score-head"><span>SHOT DURUMU</span><button onClick={() => setScreen("lobby")}>⋯</button></div>
            <div className="score-list">{players.map((p, i) => <div key={p.name} className={i === 0 ? "you" : ""}><span className={`avatar ${p.color}`}>{p.initials}</span><p><b>{p.name}</b><small>{p.host ? "HOST · SEN" : `${i + 1}. SIRADA`}</small></p><strong>{p.shots}<small>SHOT</small></strong></div>)}</div>
            <div className="host-control"><span>HOST KONTROLÜ</span><button disabled={!answer} onClick={confirmed ? nextCard : confirm}>{confirmed ? "SONRAKİ KART →" : "SONUCU ONAYLA ✓"}</button></div>
          </aside>
        </>
      )}

      {paused && <div className="modal"><div><span>OYUN DURAKLATILDI</span><h2>Bir nefes alın.</h2><p>Hazır olduğunuzda kaldığınız yerden devam edin.</p><button onClick={() => setPaused(false)}>DEVAM ET ▶</button></div></div>}
      <footer className="safe-note">18+ · Sorumlu tüket. Alkolsüz de oynanır.</footer>
    </main>
  );
}

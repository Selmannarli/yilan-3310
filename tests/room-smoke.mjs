const api = process.env.SHOT_ROOM_API || "https://shot-room-server.selman-narli.workers.dev";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const room = await fetch(`${api}/rooms`, { method: "POST" }).then((response) => response.json());
const states = new Map();

function open(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${api.replace("https", "wss")}/rooms/${room.code}/connect?nickname=${name}&avatar=test`);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "welcome") { states.set(name, message.state); resolve({ ws, id: message.playerId }); }
      if (message.type === "state") states.set(name, message.state);
    };
    ws.onerror = reject;
  });
}

const first = await open("TestA");
const second = await open("TestB");
await delay(500);
first.ws.send(JSON.stringify({ type: "configureCategories", categories: ["digital"] }));
first.ws.send(JSON.stringify({ type: "configure", totalCards: 10 }));
const games = ["reflex", "rapid_tap", "five_seconds", "emoji_memory", "odd_one", "trust", "follow_target", "quick_math", "color_word", "number_memory"];
first.ws.send(JSON.stringify({ type: "start", cards: games.map((game, index) => ({ id: 900 + index, kind: "digital", game, text: game, category: "Dijital", tag: game, icon: "x" })) }));
await delay(500);
first.ws.send(JSON.stringify({ type: "revealCard" }));
await delay(500);
let state = states.get("TestA");
if (state.miniGame.phase === "selecting") { first.ws.send(JSON.stringify({ type: "selectMiniOpponent", opponentId: second.id })); await delay(300); }
first.ws.send(JSON.stringify({ type: "miniReady" }));
second.ws.send(JSON.stringify({ type: "miniReady" }));
await delay(500);
state = states.get("TestA");
const check = { code: room.code, phase: state.phase, round: state.round, cardGame: state.card.game, miniPhase: state.miniGame.phase, participants: state.miniGame.participantIds.length, ready: state.miniGame.readyIds.length, hasChallenge: Object.keys(state.miniGame.challenge).length > 0, startsInMs: state.miniGame.startedAt - Date.now() };
first.ws.send(JSON.stringify({ type: "cancelMini" }));
await delay(300);
first.ws.send(JSON.stringify({ type: "confirmMini" }));
await delay(300);
state = states.get("TestA");
check.confirmed = state.confirmed;
check.result = state.turnResult;
first.ws.close(); second.ws.close();
if (check.phase !== "playing" || check.round !== 1 || check.participants !== 2 || check.ready !== 2 || !check.hasChallenge || !check.confirmed) throw new Error(JSON.stringify(check));
console.log(JSON.stringify(check));

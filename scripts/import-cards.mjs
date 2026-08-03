import { readFileSync, writeFileSync } from "node:fs";

const source = process.argv[2];
if (!source) throw new Error("Kart listesinin yolu gerekli.");
const raw = readFileSync(source, "utf8");
const part = (start, end) => raw.slice(raw.indexOf(start), end ? raw.indexOf(end) : undefined);
const bullets = (text) => text.split(/\r?\n/).map((line) => line.match(/^\*\s+(.+?)\s*$/)?.[1]).filter(Boolean);

function voteOutcome(text) {
  const lower = text.toLocaleLowerCase("tr-TR");
  if (/en çok oy alan dışındaki herkes/.test(lower)) return "except_top";
  if (/en az oy alan shot atsın/.test(lower)) return "lowest";
  if (/en çok oy alan bir oyuncuyu/.test(lower)) return "winner_chooses";
  return "highest";
}

const condition = bullets(part("# 1. KOŞUL", "# 2. OYLAMA"));
const vote = bullets(part("# 2. OYLAMA", "## 3. IRL"));
const duel = bullets(part("## 3. IRL", "4. DİJİTAL"));
const digitalPart = part("4. DİJİTAL");
const digital = [...digitalPart.matchAll(/(?:^|\n)(\d+)\.\s+([^\n]+)\s*\n\s*Kart metni:\s*\n\s*([^\n]+)\s*\n\s*Mini oyun detayı:\s*\n\s*([\s\S]*?)(?=\n\d+\.\s+[^\n]+\s*\n|$)/g)].map((match) => ({
  title: match[2].trim(), text: match[3].trim(), instructions: match[4].trim().replace(/\n{2,}/g, "\n"),
}));
const gameMap = { "Refleks": "reflex", "Hızlı Dokunma": "rapid_tap", "Beş Saniyeyi Yakala": "five_seconds", "Emoji Hafızası": "emoji_memory", "Farklı Olanı Bul": "odd_one", "Güven mi, İhanet mi?": "trust" };

let id = 1;
const cards = [
  ...condition.map((text) => ({ id: id++, kind: "condition", category: "Koşul", icon: "◎", tag: "İÇTİM / İÇMEDİM", text })),
  ...vote.map((text) => ({ id: id++, kind: "vote", category: "Oylama", icon: "✦", tag: "GİZLİ OY", text, maxSelections: 1, outcome: voteOutcome(text) })),
  ...duel.map((text) => ({ id: id++, kind: "duel", category: "IRL Düello", icon: "⚔", tag: "RAKİP SEÇ", text })),
  ...digital.map((item) => ({ id: id++, kind: "digital", category: "Dijital Mini Oyun", icon: "⌁", tag: item.title.toLocaleUpperCase("tr-TR"), text: item.text, game: gameMap[item.title], instructions: item.instructions })),
];

const output = `import type { Card } from "./cards";\n\nexport const importedCards: Card[] = ${JSON.stringify(cards, null, 2)};\n`;
writeFileSync(new URL("../app/generatedCards.ts", import.meta.url), output);
console.log(JSON.stringify({ total: cards.length, categories: { condition: condition.length, vote: vote.length, duel: duel.length, digital: digital.length } }));

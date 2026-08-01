import { readFileSync, writeFileSync } from "node:fs";

const source = process.argv[2];
if (!source) throw new Error("Kart listesinin yolu gerekli.");
const lines = readFileSync(source, "utf8").split(/\r?\n/).map((line) => line.match(/^\*\s+(.+?)\s*$/)?.[1]).filter(Boolean);

function kindOf(text) {
  const lower = text.toLocaleLowerCase("tr-TR");
  if (/gizli oy|gizlice bir kişiye oy|gözlerini kapatsın|aynı anda bir oyuncuyu işaret|hakkında gizli oy/.test(lower)) return "vote";
  if (/kartı açan oyuncu bir rakip seçsin/.test(lower)) return "duel";
  if (/önümüzdeki üç tur/.test(lower)) return "rule";
  if (/^(son |oyunda |bu oyunda |birbirine |en uzun süredir |arka arkaya )/.test(lower)) return "dynamic";
  if (/^kartı açan oyuncu/.test(lower)) return "target";
  return "condition";
}

function outcomeOf(text) {
  const lower = text.toLocaleLowerCase("tr-TR");
  if (/hiç oy almayan herkes/.test(lower)) return "zero";
  if (/oylar eşit dağılırsa herkes/.test(lower)) return "tie_all";
  if (/en çok oy alan dışındaki herkes/.test(lower)) return "except_top";
  if (/en az oy alan shot atsın/.test(lower)) return "lowest";
  if (/en çok oy alan bir oyuncuyu|en çok oy alan birini/.test(lower)) return "winner_chooses";
  return "highest";
}

const meta = {
  condition: ["Koşul", "◎", "HERKES"], vote: ["Oylama", "✦", "GİZLİ OY"], target: ["Hedef", "⌖", "HEDEF SEÇ"],
  duel: ["Düello", "⚔", "2 OYUNCU"], rule: ["Kalıcı Kural", "§", "3 TUR"], dynamic: ["Dinamik", "↗", "OYUN GEÇMİŞİ"],
};
const seen = new Set();
const cards = lines.filter((text) => { const key = text.toLocaleLowerCase("tr-TR").replace(/[.!?]+$/, ""); if (seen.has(key)) return false; seen.add(key); return true; }).map((text, index) => {
  const kind = kindOf(text); const [category, icon, tag] = meta[kind];
  const card = { id: 1001 + index, kind, category, icon, tag, text };
  if (kind === "vote") Object.assign(card, { maxSelections: /iki kiş/i.test(text) ? 2 : 1, outcome: outcomeOf(text) });
  return card;
});

const output = `import type { Card } from "./cards";\n\nexport const importedCards: Card[] = ${JSON.stringify(cards, null, 2)};\n`;
writeFileSync(new URL("../app/generatedCards.ts", import.meta.url), output);
console.log(JSON.stringify({ total: cards.length, categories: Object.fromEntries(Object.keys(meta).map((k) => [k, cards.filter((c) => c.kind === k).length])) }));

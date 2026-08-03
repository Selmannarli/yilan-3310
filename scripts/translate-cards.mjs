import { readFile, writeFile } from "node:fs/promises";

const source = await readFile(new URL("../app/generatedCards.ts", import.meta.url), "utf8");
const payload = source.slice(source.indexOf("= [") + 2).replace(/;\s*$/, "");
const cards = JSON.parse(payload);
const output = {};

async function translate(text) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.search = new URLSearchParams({ client: "gtx", sl: "tr", tl: "en", dt: "t", q: text }).toString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return data[0].map((part) => part[0]).join("").replaceAll("shot shot", "take a shot");
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw new Error(`Translation failed: ${text.slice(0, 40)}`);
}

for (let index = 0; index < cards.length; index += 8) {
  const group = cards.slice(index, index + 8);
  const translated = await Promise.all(group.map((card) => translate(card.text)));
  group.forEach((card, offset) => { output[String(card.id)] = translated[offset]; });
  process.stdout.write(`\r${Math.min(index + group.length, cards.length)}/${cards.length}`);
}

await writeFile(new URL("../app/cardTranslations.en.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log("\nTranslations written.");

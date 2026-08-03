import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(){
  const workerUrl=new URL("../dist/server/index.js",import.meta.url);workerUrl.searchParams.set("test",`${process.pid}-${Date.now()}`);const {default:worker}=await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/",{headers:{accept:"text/html"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
}

test("server-renders the finished SHOT welcome screen",async()=>{
  const response=await render();assert.equal(response.status,200);assert.match(response.headers.get("content-type")??"",/^text\/html\b/i);const html=await response.text();
  assert.match(html,/<title>SHOT! — Parti Oyunu<\/title>/i);assert.match(html,/Ekibi topla, oyunu başlat/);assert.match(html,/Yeni oda oluştur/);assert.match(html,/Odaya katıl/);assert.match(html,/class="shot-app phase-welcome/);assert.doesNotMatch(html,/codex-preview|Building your site|react-loading-skeleton/i);
});

test("ships bilingual resources and one icon system",async()=>{
  const [page,i18n,cards,icons,english]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/i18n.ts",import.meta.url),"utf8"),readFile(new URL("../app/cards.ts",import.meta.url),"utf8"),readFile(new URL("../app/icons.tsx",import.meta.url),"utf8"),readFile(new URL("../app/cardTranslations.en.json",import.meta.url),"utf8")]);
  assert.match(page,/translate\(language,key,values\)/);assert.match(i18n,/const tr =/);assert.match(i18n,/const en:/);assert.match(cards,/textEn/);assert.equal(Object.keys(JSON.parse(english)).length,245);assert.match(icons,/export function Icon/);assert.doesNotMatch(page,/🦊|🐼|⚙|🥃/);
});

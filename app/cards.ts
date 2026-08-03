import { importedCards } from "./generatedCards";
import englishCards from "./cardTranslations.en.json";

export type Language = "tr" | "en";
export type CardKind = "condition" | "vote" | "duel" | "digital";
export type ContentLevel = "light" | "normal" | "hard";
export type VoteOutcome = "highest" | "lowest" | "except_top" | "winner_chooses";
export type MiniGameKind = "odd_one" | "reflex" | "rapid_tap" | "five_seconds" | "emoji_memory" | "trust" | "quick_math" | "xox" | "bomb" | "common_answer";
export type RawCard = { id: number; kind: CardKind; category: string; icon: string; text: string; tag: string; maxSelections?: number; outcome?: VoteOutcome; game?: string; instructions?: string };
export type Card = {
  id: number; kind: CardKind; text: string; textEn: string; tag: string; tagEn: string;
  level: ContentLevel; maxSelections?: number; outcome?: VoteOutcome; game?: MiniGameKind;
};

export const categoryMeta: Record<CardKind, { labelKey: string; icon: "condition"|"vote"|"duel"|"digital"; color: string }> = {
  condition: { labelKey: "category.condition", icon: "condition", color: "#9b6cff" },
  vote: { labelKey: "category.vote", icon: "vote", color: "#e45aa7" },
  duel: { labelKey: "category.duel", icon: "duel", color: "#f36b69" },
  digital: { labelKey: "category.digital", icon: "digital", color: "#35b9d5" },
};

const digitalCopy: Record<MiniGameKind, { tr: string; en: string; tagTr: string; tagEn: string }> = {
  odd_one: { tagTr: "Farklı Olanı Bul", tagEn: "Find the Odd One", tr: "Benzer semboller arasındaki farklı olanı herkesten önce bul.", en: "Find the different symbol among the matching ones before everyone else." },
  reflex: { tagTr: "Refleks", tagEn: "Reflex", tr: "Ekran yeşile döndüğünde dokun. Erken davranma.", en: "Tap when the screen turns green. Do not jump the start." },
  rapid_tap: { tagTr: "Hızlı Dokunma", tagEn: "Rapid Tap", tr: "Beş saniye boyunca büyük butona olabildiğince hızlı dokun.", en: "Tap the large button as fast as you can for five seconds." },
  five_seconds: { tagTr: "Beş Saniyeyi Yakala", tagEn: "Catch Five Seconds", tr: "Gizli sayacı tam beş saniyede durdurmaya çalış.", en: "Try to stop the hidden timer at exactly five seconds." },
  emoji_memory: { tagTr: "Emoji Sıralaması", tagEn: "Emoji Sequence", tr: "Dört emojiyi ezberle ve kaybolduklarında aynı sırayla seç.", en: "Memorize four symbols and select them in the same order after they disappear." },
  trust: { tagTr: "Güven mi, İhanet mi?", tagEn: "Trust or Betray?", tr: "Bir rakip seçin ve kararlarınızı gizlice verin.", en: "Choose an opponent and make your decisions in secret." },
  quick_math: { tagTr: "Hızlı Hesap", tagEn: "Quick Math", tr: "Aynı işlemi doğru ve hızlı çöz.", en: "Solve the same calculation quickly and correctly." },
  xox: { tagTr: "XOX", tagEn: "Tic-tac-toe", tr: "Bir rakip seç ve beş saniyelik hamlelerle XOX oyna.", en: "Choose an opponent and play tic-tac-toe with five-second turns." },
  bomb: { tagTr: "Bomba Kimde?", tagEn: "Who Has the Bomb?", tr: "Gizli süre dolmadan bombayı başka bir oyuncuya gönder.", en: "Pass the bomb to another player before the hidden timer expires." },
  common_answer: { tagTr: "Ortak Cevap", tagEn: "Common Answer", tr: "Gizlice bir seçenek seç. Çoğunluğun cevabında buluş.", en: "Choose an option secretly and match the majority." },
};

const legacyGames: MiniGameKind[] = ["reflex", "rapid_tap", "five_seconds", "emoji_memory", "odd_one", "trust"];
const baseCards: Card[] = importedCards.map((source) => {
  const game = source.kind === "digital" ? legacyGames.includes(source.game as MiniGameKind) ? source.game as MiniGameKind : undefined : undefined;
  const copy = game ? digitalCopy[game] : null;
  return {
    id: source.id,
    kind: source.kind,
    text: copy?.tr ?? source.text,
    textEn: copy?.en ?? (englishCards as Record<string,string>)[String(source.id)] ?? source.text,
    tag: copy?.tagTr ?? source.tag,
    tagEn: copy?.tagEn ?? source.tag,
    level: source.kind === "digital" ? "normal" : source.id % 3 === 0 ? "light" : source.id % 3 === 1 ? "normal" : "hard",
    maxSelections: source.maxSelections,
    outcome: source.outcome,
    game,
  };
});

const extraDigitalCards: Card[] = (["quick_math", "xox", "bomb", "common_answer"] as MiniGameKind[]).map((game, index) => ({
  id: 246 + index, kind: "digital", game, level: "normal",
  text: digitalCopy[game].tr, textEn: digitalCopy[game].en,
  tag: digitalCopy[game].tagTr, tagEn: digitalCopy[game].tagEn,
}));

export const cards: Card[] = [...baseCards, ...extraDigitalCards];
export const miniGameKinds = Object.keys(digitalCopy) as MiniGameKind[];
export const getCardText = (card: Card, language: Language) => language === "tr" ? card.text : card.textEn;
export const getCardTag = (card: Card, language: Language) => language === "tr" ? card.tag : card.tagEn;

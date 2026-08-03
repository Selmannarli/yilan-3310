import { importedCards } from "./generatedCards";

export type CardKind = "condition" | "vote" | "duel" | "digital";
export type VoteOutcome = "highest" | "lowest" | "except_top" | "winner_chooses";
export type MiniGameKind = "reflex" | "rapid_tap" | "five_seconds" | "emoji_memory" | "odd_one" | "trust" | "follow_target" | "quick_math" | "color_word" | "number_memory";
export type Card = { id: number; kind: CardKind; category: string; icon: string; text: string; tag: string; maxSelections?: number; outcome?: VoteOutcome; game?: MiniGameKind; instructions?: string };

export const categoryMeta: Record<CardKind, { label: string; color: string; icon: string }> = {
  condition: { label: "Koşul", color: "#a855f7", icon: "◎" },
  vote: { label: "Oylama", color: "#c084fc", icon: "✦" },
  duel: { label: "IRL Düello", color: "#ff5757", icon: "⚔" },
  digital: { label: "Dijital Oyun", color: "#38bdf8", icon: "⌁" },
};

const extraDigitalCards: Card[] = [
  { id: 246, kind: "digital", category: "Dijital Mini Oyun", icon: "⌁", tag: "HEDEFİ TAKİP ET", text: "Hareket eden hedefi gözünden kaçırma. Animasyon bittiğinde doğru daireyi seç; yanlış seçenler shot atsın.", game: "follow_target" },
  { id: 247, kind: "digital", category: "Dijital Mini Oyun", icon: "⌁", tag: "HIZLI HESAP", text: "Ekrandaki işlemi herkesten hızlı ve doğru çöz. Yanlış cevap verenler shot atsın.", game: "quick_math" },
  { id: 248, kind: "digital", category: "Dijital Mini Oyun", icon: "⌁", tag: "RENK Mİ, KELİME Mİ?", text: "Görevi dikkatle oku: yazının anlamını mı, rengini mi seçmen gerektiğine odaklan. Şaşıranlar shot atsın.", game: "color_word" },
  { id: 249, kind: "digital", category: "Dijital Mini Oyun", icon: "⌁", tag: "SAYI HAFIZASI", text: "Beş rakamı ezberle. Rakamlar kaybolunca aynı sırayla gir; yanlış yapanlar shot atsın.", game: "number_memory" },
];

const digitalCopy: Partial<Record<MiniGameKind, Pick<Card, "text" | "tag">>> = {
  reflex: { tag: "REFLEKS", text: "Ekran yeşile döndüğünde dokun. Erken davrananlar ve geçerli dokunuşlar arasındaki en yavaş oyuncu shot atsın." },
  rapid_tap: { tag: "HIZLI DOKUNMA", text: "Beş saniye boyunca ekrana olabildiğince hızlı dokun. En az geçerli dokunuşu yapanlar shot atsın." },
  five_seconds: { tag: "BEŞ SANİYE", text: "Sayacı görmeden tam beş saniyede durdurmaya çalış. Hedeften en uzak kalanlar shot atsın." },
  emoji_memory: { tag: "EMOJİ HAFIZASI", text: "Gösterilen dört emojiyi ezberle ve kaybolduklarında aynı sırayla seç. Yanlış yapanlar shot atsın." },
  odd_one: { tag: "FARKLI OLAN", text: "Semboller arasındaki farklı olanı bul. Yanlış seçenler ve doğru seçenlerin en yavaşı shot atsın." },
  trust: { tag: "GÜVEN / İHANET", text: "Kartı açan oyuncu bir eş seçsin. İkiniz de gizlice Güven veya İhanet seçin; sonuç seçimlerinize göre belirlensin." },
};

export const cards: Card[] = [
  ...importedCards.map((card) => card.kind === "digital" && card.game && digitalCopy[card.game as MiniGameKind] ? { ...card, ...digitalCopy[card.game as MiniGameKind] } : card),
  ...extraDigitalCards,
];

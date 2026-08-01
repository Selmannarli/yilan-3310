export type CardKind = "condition" | "vote" | "duel";
import { importedCards } from "./generatedCards";

export type VoteOutcome = "highest" | "lowest" | "zero" | "tie_all" | "except_top" | "winner_chooses";
export type Card = { id: number; kind: CardKind; category: string; icon: string; text: string; tag: string; maxSelections?: number; outcome?: VoteOutcome };

export const categoryMeta: Record<CardKind, { label: string; color: string; icon: string }> = {
  condition: { label: "Koşul", color: "#c9ff37", icon: "◎" },
  vote: { label: "Oylama", color: "#a98bff", icon: "✦" },
  duel: { label: "Düello", color: "#ff5757", icon: "⚔" },
};

const originalCards: Card[] = [
  { id: 1, kind: "condition", category: "Koşul", icon: "◎", tag: "HERKES", text: "Bu gruptaki herkesi bir yıldan uzun süredir tanıyanlar shot atsın." },
  { id: 2, kind: "condition", category: "Koşul", icon: "◎", tag: "HERKES", text: "Son bir yıl içinde iş değiştiren herkes shot atsın." },
  { id: 3, kind: "condition", category: "Koşul", icon: "◎", tag: "HERKES", text: "Telefonunda eski sevgilisinin fotoğrafı bulunan herkes shot atsın." },
  { id: 4, kind: "condition", category: "Koşul", icon: "◎", tag: "HERKES", text: "Daha önce uçağını kaçıran herkes shot atsın." },
  { id: 5, kind: "condition", category: "Koşul", icon: "◎", tag: "HERKES", text: "Bugün gruba en son gelen kişi shot atsın." },
  { id: 6, kind: "condition", category: "Koşul", icon: "◎", tag: "HERKES", text: "Üzerinde siyah bir şey bulunan herkes shot atsın." },
  { id: 7, kind: "vote", category: "Oylama", icon: "✦", tag: "1 KİŞİ SEÇ", text: "Bu grupta eski sevgilisine dönme ihtimali en yüksek kişi kim?", maxSelections: 1 },
  { id: 8, kind: "vote", category: "Oylama", icon: "✦", tag: "1 KİŞİ SEÇ", text: "Bir zombi istilasında grubu en uzun süre hayatta tutacak kişi kim?", maxSelections: 1 },
  { id: 9, kind: "vote", category: "Oylama", icon: "✦", tag: "2 KİŞİ SEÇ", text: "Birlikte tatile çıkmak istemeyeceğin iki kişiyi seç.", maxSelections: 2 },
  { id: 10, kind: "vote", category: "Oylama", icon: "✦", tag: "1 KİŞİ SEÇ", text: "Bu gece ilk kaybolacak kişi kim?", maxSelections: 1 },
  { id: 11, kind: "vote", category: "Oylama", icon: "✦", tag: "1 KİŞİ SEÇ", text: "Grupta en kötü sır saklayan kişi kim?", maxSelections: 1 },
  { id: 12, kind: "vote", category: "Oylama", icon: "✦", tag: "2 KİŞİ SEÇ", text: "Bir reality şov finaline kalacak iki kişiyi seç.", maxSelections: 2 },
  { id: 13, kind: "vote", category: "Oylama", icon: "✦", tag: "1 KİŞİ SEÇ", text: "Telefonunu bir haftalığına en son kime emanet ederdin?", maxSelections: 1 },
  { id: 14, kind: "vote", category: "Oylama", icon: "✦", tag: "1 KİŞİ SEÇ", text: "Grupta gizli bir dövmesi olma ihtimali en yüksek kişi kim?", maxSelections: 1 },
  { id: 15, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "Sana en az güven veren kişiyi seç. Seçilen kişi shot atsın." },
  { id: 16, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "Bu gece seni eve bırakmasını isteyeceğin kişiyi seç. Diğer herkes bir yudum alsın." },
  { id: 17, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "En son mesajlaştığın kişiye telefonunu ver. Gruptan birini seçsin." },
  { id: 18, kind: "duel", category: "Düello", icon: "⚔", tag: "2 OYUNCU", text: "Bir rakip seç. Taş-kâğıt-makas oynayın; kaybeden shot atsın." },
  { id: 19, kind: "duel", category: "Düello", icon: "⚔", tag: "2 OYUNCU", text: "Bir rakip seç. İlk gülen kaybeder ve shot atar." },
  { id: 20, kind: "duel", category: "Düello", icon: "⚔", tag: "2 OYUNCU", text: "Bir rakip seç. Beş saniyede üç şehir sayamayan shot atar." },
  { id: 21, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "Bir sonraki tur bitmeden bir oyuncuya ‘Neden?’ dedirt. Başaramazsan shot at." },
  { id: 22, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "İki tur içinde birini telefonuna baktır. Yakalanırsan shot at." },
  { id: 23, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "Bir sonraki karta kadar birine içten bir iltifat ettir." },
  { id: 24, kind: "condition", category: "Koşul", icon: "◎", tag: "3 TUR", text: "Üç tur boyunca isim söylemek yasak. Söyleyen shot atsın." },
  { id: 25, kind: "condition", category: "Koşul", icon: "◎", tag: "4 TUR", text: "Dört tur boyunca telefonu eline alan bir yudum içsin." },
  { id: 26, kind: "condition", category: "Koşul", icon: "◎", tag: "3 TUR", text: "Üç tur boyunca ‘evet’ ve ‘hayır’ demek yasak." },
  { id: 27, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "Son üç turda hiç shot atmayan herkes bu tur bir yudum alsın." },
  { id: 28, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "Şu ana kadar en çok shot atan kişi bir tur dokunulmazlık kazansın." },
  { id: 29, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "En uzun süredir shot atmayan oyuncu bu turdan muaftır." },
  { id: 30, kind: "condition", category: "Koşul", icon: "◎", tag: "UYGULA", text: "Bu oyunda en fazla oy alan kişi bir rakip seçsin; ikisi düello yapsın." },
];

const normalized = (text: string) => text.toLocaleLowerCase("tr-TR").replace(/[.!?]+$/, "");
const importedTexts = new Set(importedCards.map((card) => normalized(card.text)));
export const cards: Card[] = [...originalCards.filter((card) => !importedTexts.has(normalized(card.text))), ...importedCards];

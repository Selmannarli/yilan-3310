import { importedCards } from "./generatedCards";

export type CardKind = "condition" | "vote" | "duel" | "digital";
export type VoteOutcome = "highest" | "lowest" | "except_top" | "winner_chooses";
export type MiniGameKind = "reflex" | "rapid_tap" | "five_seconds" | "emoji_memory" | "odd_one" | "trust";
export type Card = { id: number; kind: CardKind; category: string; icon: string; text: string; tag: string; maxSelections?: number; outcome?: VoteOutcome; game?: MiniGameKind; instructions?: string };

export const categoryMeta: Record<CardKind, { label: string; color: string; icon: string }> = {
  condition: { label: "Koşul", color: "#a855f7", icon: "◎" },
  vote: { label: "Oylama", color: "#c084fc", icon: "✦" },
  duel: { label: "IRL Düello", color: "#ff5757", icon: "⚔" },
  digital: { label: "Dijital Oyun", color: "#38bdf8", icon: "⌁" },
};

export const cards: Card[] = importedCards;

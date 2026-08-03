"use client";

import { useId, type CSSProperties, type SVGProps } from "react";

export type IconName =
  | "logo" | "settings" | "players" | "close" | "back" | "forward" | "up" | "down"
  | "check" | "copy" | "plus" | "minus" | "play" | "pause" | "more" | "pass" | "redo"
  | "shuffle" | "share" | "edit" | "leave" | "kick" | "home" | "transfer" | "reorder"
  | "volume" | "soundOff" | "vibration" | "vibrationOff" | "language" | "warning" | "info"
  | "eye" | "eyeOff" | "crown" | "wifi" | "wifiWeak" | "wifiOff" | "spectator" | "lock"
  | "unlock" | "shot" | "timer" | "infinity" | "spark"
  | "condition" | "vote" | "duel" | "digital"
  | "odd_one" | "reflex" | "rapid_tap" | "five_seconds" | "emoji_memory" | "trust"
  | "quick_math" | "xox" | "bomb" | "common_answer"
  | "trustChoice" | "betrayChoice" | "xMark" | "oMark" | "oddNormal" | "oddDifferent"
  | "memoryCircle" | "memoryTriangle" | "memorySquare" | "memoryDiamond" | "memoryStar"
  | "memoryPlus" | "memoryWave" | "memoryMoon";

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const rawId = useId();
  const gradientId = `icon-gradient-${rawId.replace(/:/g, "")}`;
  const paint = `url(#${gradientId})`;
  const filled = { fill: paint, stroke: "currentColor" };
  let body: React.ReactNode;

  switch (name) {
    case "logo": body=<><path {...filled} d="M7 3h10l2 3-2 12-5 3-5-3L5 6l2-3Z"/><path d="M12 6v7M9.7 16h4.6"/></>; break;
    case "settings": body=<><path {...filled} d="m9.7 3-.5 2a8 8 0 0 0-1.5.9L5.8 5.3 3.4 9.5l1.5 1.4v2.2l-1.5 1.4 2.4 4.2 1.9-.6c.5.4 1 .7 1.5.9l.5 2h4.8l.5-2c.5-.2 1-.5 1.5-.9l1.9.6 2.4-4.2-1.5-1.4v-2.2l1.5-1.4-2.4-4.2-1.9.6A8 8 0 0 0 15 5l-.5-2H9.7Z"/><circle cx="12" cy="12" r="3"/> </>; break;
    case "players": body=<><circle {...filled} cx="9" cy="8" r="3"/><path {...filled} d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2H3.5Z"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2a4.5 4.5 0 0 1 4.5 4.5V20"/></>; break;
    case "close": body=<><rect {...filled} x="3" y="3" width="18" height="18" rx="5"/><path d="m8 8 8 8m0-8-8 8"/></>; break;
    case "back": body=<path {...filled} d="m14.5 5-7 7 7 7 1.8-1.8-5.2-5.2 5.2-5.2L14.5 5Z"/>; break;
    case "forward": body=<path {...filled} d="m9.5 5 7 7-7 7-1.8-1.8 5.2-5.2-5.2-5.2L9.5 5Z"/>; break;
    case "up": body=<path {...filled} d="m5 14.5 7-7 7 7-1.8 1.8-5.2-5.2-5.2 5.2L5 14.5Z"/>; break;
    case "down": body=<path {...filled} d="m5 9.5 7 7 7-7-1.8-1.8-5.2 5.2-5.2-5.2L5 9.5Z"/>; break;
    case "check": body=<><circle {...filled} cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-7"/></>; break;
    case "copy": body=<><rect {...filled} x="8" y="7" width="11" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2"/></>; break;
    case "plus": body=<><circle {...filled} cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></>; break;
    case "minus": body=<><circle {...filled} cx="12" cy="12" r="9"/><path d="M7 12h10"/></>; break;
    case "play": body=<path {...filled} d="m8 5 11 7-11 7V5Z"/>; break;
    case "pause": body=<><rect {...filled} x="5" y="4" width="5" height="16" rx="1.5"/><rect {...filled} x="14" y="4" width="5" height="16" rx="1.5"/></>; break;
    case "more": body=<><circle {...filled} cx="5" cy="12" r="2"/><circle {...filled} cx="12" cy="12" r="2"/><circle {...filled} cx="19" cy="12" r="2"/></>; break;
    case "pass": body=<><path {...filled} d="m3 11 7-6v4h4a7 7 0 0 1 7 7v3c-1.6-3.3-3.7-5-7-5h-4v4l-7-7Z"/></>; break;
    case "redo": body=<><path {...filled} d="M18.5 8A8 8 0 1 0 20 15h-3a5 5 0 1 1-.7-5L13 13h8V5l-2.5 3Z"/></>; break;
    case "shuffle": body=<><path {...filled} d="M4 6h3c5 0 5 12 10 12h3l-2.5-2.5M20 18l-2.5 2.5"/><path d="M4 18h3c2 0 3.3-2 4.5-4M14 8c1-1.3 1.8-2 3-2h3m0 0-2.5-2.5M20 6l-2.5 2.5"/></>; break;
    case "share": body=<><path {...filled} d="M5 10v10h14V10"/><path d="M12 15V3m0 0L8 7m4-4 4 4"/></>; break;
    case "edit": body=<><path {...filled} d="m4 17-1 4 4-1L19 8l-3-3L4 17Z"/><path d="m14 7 3 3"/></>; break;
    case "leave": body=<><path {...filled} d="M10 4H4v16h6"/><path d="M13 8l4 4-4 4m-5-4h9"/></>; break;
    case "kick": body=<><circle {...filled} cx="9" cy="8" r="3"/><path d="M3.5 20v-2a5.5 5.5 0 0 1 8-5M15 15l6 6m0-6-6 6"/></>; break;
    case "home": body=<><path {...filled} d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z"/></>; break;
    case "transfer": body=<><path {...filled} d="m4 5 2 5 6-7 6 7 2-5-1 12H5L4 5Z"/><path d="M7 21h10m1-3 3 2-3 2"/></>; break;
    case "reorder": body=<><path d="M8 6h12M8 12h12M8 18h12"/><path {...filled} d="m3 6 2-2 2 2-2 2-2-2Zm0 6 2-2 2 2-2 2-2-2Zm0 6 2-2 2 2-2 2-2-2Z"/></>; break;

    case "volume": body=<><path {...filled} d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="M16 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/></>; break;
    case "soundOff": body=<><path {...filled} d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="m16 9 5 5m0-5-5 5"/></>; break;
    case "vibration": body=<><rect {...filled} x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8m18-8v8M5 10v4m14-4v4"/></>; break;
    case "vibrationOff": body=<><rect {...filled} x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8m18-8v8M5 10v4m14-4v4M8 8l8 8m0-8-8 8"/></>; break;
    case "language": body=<><circle {...filled} cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18m0-18a14 14 0 0 0 0 18"/></>; break;
    case "warning": body=<><path {...filled} d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></>; break;
    case "info": body=<><circle {...filled} cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>; break;
    case "eye": body=<><path {...filled} d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>; break;
    case "eyeOff": body=<><path {...filled} d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><path d="m3 3 18 18"/></>; break;
    case "crown": body=<path {...filled} d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Z"/>; break;
    case "wifi": body=<><path {...filled} d="M4 10a11 11 0 0 1 16 0l-2 2a8 8 0 0 0-12 0l-2-2Z"/><path d="M8 14a6 6 0 0 1 8 0m-5 4a2 2 0 0 1 2 0"/></>; break;
    case "wifiWeak": body=<><path d="M4 10a11 11 0 0 1 16 0M8 14a6 6 0 0 1 8 0"/><circle {...filled} cx="12" cy="18" r="1.5"/></>; break;
    case "wifiOff": body=<><path d="M4 10a11 11 0 0 1 16 0M8 14a6 6 0 0 1 8 0m-5 4a2 2 0 0 1 2 0M3 3l18 18"/></>; break;
    case "spectator": body=<><circle {...filled} cx="12" cy="8" r="4"/><path {...filled} d="M5 21v-2a7 7 0 0 1 14 0v2H5Z"/></>; break;
    case "lock": body=<><rect {...filled} x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>; break;
    case "unlock": body=<><rect {...filled} x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.6M12 14v3"/></>; break;
    case "shot": body=<><path {...filled} d="M6 4h12l-2 16H8L6 4Z"/><path d="M7 9h10"/></>; break;
    case "timer": body=<><circle {...filled} cx="12" cy="13" r="8"/><path d="M9 2h6m-3 3V2m0 11 3-3m3-3 2-2"/></>; break;
    case "infinity": body=<path {...filled} d="M7.5 8C4 8 3 10.5 3 12s1 4 4.5 4c4 0 5-8 9-8 3.5 0 4.5 2.5 4.5 4s-1 4-4.5 4c-4 0-5-8-9-8Z"/>; break;
    case "spark": body=<><path {...filled} d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>; break;

    case "condition": body=<><rect {...filled} x="3" y="4" width="18" height="16" rx="4"/><circle cx="9" cy="10" r="2.5"/><path d="M5.5 17a3.5 3.5 0 0 1 7 0m3-7h3m-1.5-1.5v3"/></>; break;
    case "vote": body=<><rect {...filled} x="4" y="5" width="16" height="15" rx="3"/><path d="m8 3 4 4 5-5M8 12h8m-8 4h5"/></>; break;
    case "duel": body=<><path {...filled} d="m4 3 8 9-3 3-6-10 1-2Zm16 0-8 9 3 3 6-10-1-2Z"/><path d="m7 17-3 3m13-3 3 3"/></>; break;
    case "digital": body=<><rect {...filled} x="5" y="2" width="14" height="20" rx="3"/><path d="M8 10h8m-4-4v8m-4 4h.01M16 18h.01"/></>; break;

    case "odd_one": body=<><circle {...filled} cx="11" cy="11" r="8"/><path d="m16.5 16.5 4 4M8 11l2 2 4-5"/><path {...filled} d="m18 3 .7 2.3L21 6l-2.3.7L18 9l-.7-2.3L15 6l2.3-.7L18 3Z"/></>; break;
    case "reflex": body=<><circle {...filled} cx="12" cy="12" r="9"/><path d="m13 4-6 9h5l-1 7 6-9h-5l1-7Z"/></>; break;
    case "rapid_tap": body=<><circle {...filled} cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="3"/><path d="M12 17v5m0-5-3 3m3-3 3 3"/></>; break;
    case "five_seconds": body=<><circle {...filled} cx="12" cy="13" r="8"/><path d="M9 2h6m-3 3V2m3.5 6H10l-.5 4h3a2.5 2.5 0 1 1-2.5 3"/></>; break;
    case "emoji_memory": body=<><circle {...filled} cx="6" cy="9" r="3"/><circle {...filled} cx="12" cy="9" r="3"/><circle {...filled} cx="18" cy="9" r="3"/><path d="M4 16h4m2 0h4m2 0h4"/></>; break;
    case "trust": body=<><path {...filled} d="M3 8c3-4 6-4 9 0-3 5-6 5-9 0Zm9 0c3-4 6-4 9 0-3 5-6 5-9 0Z"/><path d="M8 17c2 3 6 3 8 0"/></>; break;
    case "quick_math": body=<><rect {...filled} x="3" y="3" width="18" height="18" rx="4"/><path d="M6 8h5M8.5 5.5v5M14 6l4 4m0-4-4 4M6 16h5m3 0h4"/></>; break;
    case "xox": body=<><rect {...filled} x="3" y="3" width="18" height="18" rx="4"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18M5 5l2 2m0-2L5 7"/><circle cx="18" cy="18" r="1.5"/></>; break;
    case "bomb": body=<><circle {...filled} cx="11" cy="14" r="7"/><path d="m15 8 2-2m0 0c1-3 4-2 4-5m-9 10v6m-3-3h6"/></>; break;
    case "common_answer": body=<><path {...filled} d="M3 5h12v9H9l-4 3v-3H3V5Z"/><path d="M12 9h9v8h-3v3l-4-3h-2"/></>; break;

    case "trustChoice": body=<><path {...filled} d="m3 12 5-4 4 3 4-3 5 4-8 7h-2l-8-7Z"/><path d="m8 8 3-3 3 3m-8 6 3 3m9-3-3 3"/></>; break;
    case "betrayChoice": body=<><path {...filled} d="M12 3 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6l-8-3Z"/><path d="M12 7v8m-3-5 3-3 3 3"/></>; break;
    case "xMark": body=<path {...filled} d="m5 3 7 6 7-6 2 2-6 7 6 7-2 2-7-6-7 6-2-2 6-7-6-7 2-2Z"/>; break;
    case "oMark": body=<circle {...filled} cx="12" cy="12" r="8"/>; break;
    case "oddNormal": body=<circle {...filled} cx="12" cy="12" r="7"/>; break;
    case "oddDifferent": body=<path {...filled} d="m12 2 2.5 6.8L22 9l-5.8 4.4L18 21l-6-4-6 4 1.8-7.6L2 9l7.5-.2L12 2Z"/>; break;
    case "memoryCircle": body=<circle {...filled} cx="12" cy="12" r="8"/>; break;
    case "memoryTriangle": body=<path {...filled} d="M12 3 22 20H2L12 3Z"/>; break;
    case "memorySquare": body=<rect {...filled} x="4" y="4" width="16" height="16" rx="3"/>; break;
    case "memoryDiamond": body=<path {...filled} d="m12 2 10 10-10 10L2 12 12 2Z"/>; break;
    case "memoryStar": body=<path {...filled} d="m12 2 2.8 6.3 6.8.7-5.1 4.6 1.5 6.8-6-3.5-6 3.5 1.5-6.8L2.4 9l6.8-.7L12 2Z"/>; break;
    case "memoryPlus": body=<path {...filled} d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>; break;
    case "memoryWave": body=<path {...filled} d="M2 10c3-5 6 5 10 0s7 5 10 0v5c-3 5-6-5-10 0s-7-5-10 0v-5Z"/>; break;
    case "memoryMoon": body=<path {...filled} d="M17 3a9 9 0 1 0 4 15 8 8 0 0 1-4-15Z"/>; break;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <defs><linearGradient id={gradientId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="currentColor" stopOpacity=".62"/><stop offset=".55" stopColor="currentColor" stopOpacity=".23"/><stop offset="1" stopColor="currentColor" stopOpacity=".08"/></linearGradient></defs>
    {body}
  </svg>;
}

export function Avatar({ seed = 0 }: { seed?: number|string }) {
  const numeric = typeof seed === "number" ? seed : Number(seed) || [...seed].reduce((sum,char)=>sum+char.charCodeAt(0),0);
  const index = Math.abs(numeric) % 12;
  const column = index % 4;
  const row = Math.floor(index / 4);
  const style = { backgroundPosition: `${column * 100 / 3}% ${row * 50}%` } as CSSProperties;
  return <span className="avatar-svg avatar-sprite" style={style} aria-hidden="true"/>;
}

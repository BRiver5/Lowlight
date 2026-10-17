// Палитра Lowlight — "сумерки": розовато-серая бумага, графит, сливовые
// чернила, тёплый янтарь экрана. Единственный файл с цветовыми значениями.
//
// Акцент #5D2852 — tools/palette-search.js, сектор 312°: ближайшие соседи
// SplitLease #804275 (ΔE 13.3), FairSplit #584064 (14.0), FocusJar #6B2F45
// (14.1); из последних десяти ближе всех Useby #52148F (баклажан, заметно
// синее и насыщеннее). Белый на акценте 11.1:1.
// "Экран" (янтарь) и "сон" (ночной синий) — два смысловых цвета графиков,
// качество сна — шкала от песочного к сливовому. Тема только светлая.

export const light = {
  background: "#F7F4F6",
  backgroundAlt: "#ECE6EA",
  surface: "#FFFFFF",
  surfaceAlt: "#F4F0F3",
  border: "#E2D9DF",
  ink: "#1E1520",
  inkMuted: "#5E5A66",
  inkFaint: "#A39AA4",
  onAccent: "#FFFFFF",
  accent: "#5D2852",
  accentInk: "#5D2852",
  accentSoft: "#F1E4EE",
  danger: "#B4362E",
  success: "#2E7D5B",
  signal: "#9C5F12",
  scrim: "rgba(30,21,32,0.45)",
  // background × 0.55 + ink × 0.45 — строка состояния, пока открыта шторка.
  statusDimmed: "#939093",
  screen: "#C27C2C", // экран — только для заливок и с подписью рядом
  screenInk: "#9C5F12",
  night: "#3E5C86",
  nightSoft: "#E3E9F2",
};

export const dark = light;
export type Palette = typeof light;

// Качество сна 1..5 → цвет (песочный → сливовый).
export function qualityColor(q: number): string {
  const stops = ["#E7C9A9", "#D9A88F", "#B9849A", "#8A4F7D", "#5D2852"];
  return stops[Math.max(0, Math.min(4, Math.round(q) - 1))];
}

export function heatColor(t: number): string {
  if (t <= 0) return light.backgroundAlt;
  const stops = ["#E2C8DA", "#C08FB2", "#8A4F7D", "#5D2852"];
  return stops[Math.min(stops.length - 1, Math.floor(t * stops.length - 1e-9))];
}

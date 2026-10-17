// Ночь = вечер (экран, когда отложил телефон, отбой) + утро (качество,
// засыпание, пробуждения). Ключ — дата вечера. Время отбоя считаем в минутах
// от полудня (23:30 → 690, 00:30 → 750), чтобы ночь после полуночи не
// "перескакивала" в начало суток.

import { addObs, emptyStats, features, posterior, predict, QUALITY_PRIOR, type Stats } from "./model.ts";
import { dayNumber } from "./time.ts";

export type Night = {
  date: string; // дата вечера YYYY-MM-DD
  screenMin: number | null; // экран за последние 2 часа до сна
  bedtime: number | null; // минуты от полудня
  wake: number | null; // минуты от полуночи следующего дня
  quality: number | null; // 1–5
  latency: number | null; // минуты до засыпания
  wakeups: number | null;
};

export const ANCHOR_FORGET = 0.9;

export function isFreeNight(date: string): boolean {
  // Вечер пятницы и субботы — следующего дня нет на работу.
  const wd = (new Date(dayNumber(date) * 86_400_000).getUTCDay() + 6) % 7;
  return wd === 4 || wd === 5;
}

export function complete(n: Night): boolean {
  return n.screenMin !== null && n.bedtime !== null && n.quality !== null;
}

export function sleepMinutes(n: Night): number | null {
  if (n.bedtime === null || n.wake === null) return null;
  // отбой: минуты от полудня вечера; подъём: от полуночи → от полудня вечера = wake + 720
  const m = n.wake + 720 - n.bedtime - (n.latency ?? 0);
  return m > 0 ? m : null;
}

export type ModelState = {
  quality: Stats;
  latency: Stats;
  anchor: number | null; // ваш обычный отбой (минуты от полудня), экспоненциальное среднее
  anchorW: number;
  lastDate: string | null;
};

export function emptyState(): ModelState {
  return { quality: emptyStats(), latency: emptyStats(), anchor: null, anchorW: 0, lastDate: null };
}

export function lateHours(s: ModelState, bedtime: number): number {
  return s.anchor === null ? 0 : (bedtime - s.anchor) / 60;
}

// Одна ночь — одно обновление накопленного состояния. Признак "поздний отбой"
// считается от якоря ДО этой ночи — так же, как будет при прогнозе.
export function addNight(s: ModelState, n: Night): ModelState {
  if (!complete(n)) return s;
  const x = features(n.screenMin!, lateHours(s, n.bedtime!), isFreeNight(n.date));
  const quality = addObs(s.quality, x, n.quality!);
  const latency = n.latency !== null ? addObs(s.latency, x, n.latency) : s.latency;
  const anchorW = s.anchorW * ANCHOR_FORGET + 1;
  const anchor = s.anchor === null ? n.bedtime! : (s.anchor * s.anchorW * ANCHOR_FORGET + n.bedtime!) / anchorW;
  return { quality, latency, anchor, anchorW, lastDate: n.date };
}

export function replay(nights: Night[]): ModelState {
  let s = emptyState();
  for (const n of [...nights].sort((a, b) => (a.date < b.date ? -1 : 1))) s = addNight(s, n);
  return s;
}

export function clockFromNoon(m: number): string {
  const t = ((Math.round(m) + 720) % 1440 + 1440) % 1440;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function clock(m: number): string {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

// Пересборка с "честным прогнозом" каждой ночи: модель на момент ДО этой ночи
// (по ней объясняем ночь и проверяем, насколько прогнозы сбываются).

export type NightFit = { date: string; predicted: number; lo: number; hi: number; parts: number[]; actual: number; late: number };

export function replayFits(nights: Night[]): { state: ModelState; fits: Record<string, NightFit> } {
  let s = emptyState();
  const fits: Record<string, NightFit> = {};
  for (const n of [...nights].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (complete(n)) {
      const late = lateHours(s, n.bedtime!);
      const pr = predict(posterior(s.quality, QUALITY_PRIOR), features(n.screenMin!, late, isFreeNight(n.date)));
      fits[n.date] = { date: n.date, predicted: pr.mean, lo: pr.nightLo, hi: pr.nightHi, parts: pr.parts, actual: n.quality!, late };
    }
    s = addNight(s, n);
  }
  return { state: s, fits };
}

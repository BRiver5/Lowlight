// План на вечер: когда отложить телефон и когда лечь, чтобы прогноз качества
// сна дотянул до цели, при ограничениях — подъём завтра в заданное время и
// не меньше заданных часов сна. Перебор сетки (экран 0–120 мин шагом 15 ×
// отбой ±2 ч шагом 15) — точный в пределах сетки; из подходящих выбираем
// БЛИЖАЙШИЙ к вашему обычному вечеру (меньше всего менять).
// Если цель недостижима — объяснение и ранжированные выходы, каждый
// проверен тем же прогнозом.

import { features, predict, screenEffect, type Posterior } from "./model.ts";
import { isFreeNight, type ModelState, lateHours } from "./nights.ts";

export type Constraints = {
  date: string; // вечер
  wake: number; // подъём завтра, минуты от полуночи
  minSleepMin: number;
  targetQuality: number;
  usualScreen: number; // ваш обычный экран, мин
};

export type Option = { screenMin: number; bedtime: number; mean: number; lo: number; hi: number; sleepMin: number; change: number };

export type AltKind = "noScreens" | "earlier" | "both" | "lowerTarget";
export type Alternative = { kind: AltKind; title: string; detail: string; option: Option; fixes: boolean; target?: number };

export type PlanResult = {
  status: "ok" | "conflict" | "learning";
  usual: Option;
  pick: Option | null; // ближайший к обычному вечер, дотягивающий до цели
  best: Option; // максимум прогноза в пределах ограничений
  screenMatters: boolean;
  reasons: string[];
  alternatives: Alternative[];
};

const SCREENS = [0, 15, 30, 45, 60, 75, 90, 105, 120];

export function evaluate(p: Posterior, s: ModelState, c: Constraints, screenMin: number, bedtime: number): Option {
  const x = features(screenMin, lateHours(s, bedtime), isFreeNight(c.date));
  const pr = predict(p, x);
  const sleepMin = c.wake + 720 - bedtime;
  const usualBed = s.anchor ?? bedtime;
  const change = Math.abs(screenMin - c.usualScreen) / 15 + Math.abs(bedtime - usualBed) / 15;
  return { screenMin, bedtime, mean: pr.mean, lo: pr.lo, hi: pr.hi, sleepMin, change };
}

export function makePlan(p: Posterior, s: ModelState, c: Constraints): PlanResult {
  const anchor = s.anchor ?? c.wake + 720 - c.minSleepMin - 30;
  const latest = c.wake + 720 - c.minSleepMin;
  const beds: number[] = [];
  for (let b = Math.round((anchor - 120) / 15) * 15; b <= anchor + 120; b += 15) if (b <= latest) beds.push(b);
  if (beds.length === 0) beds.push(latest);
  const usual = evaluate(p, s, c, c.usualScreen, Math.min(latest, Math.round(anchor / 15) * 15));
  const all: Option[] = [];
  for (const sc of SCREENS) for (const b of beds) all.push(evaluate(p, s, c, sc, b));
  const best = all.reduce((a, b) => (b.mean > a.mean ? b : a));
  const fitting = all.filter((o) => o.mean >= c.targetQuality).sort((a, b) => a.change - b.change || b.mean - a.mean);
  const eff = screenEffect(p, isFreeNight(c.date));
  const screenMatters = eff.clear && eff.mean < 0;
  if (p.n < 5) return { status: "learning", usual, pick: fitting[0] ?? null, best, screenMatters, reasons: ["Plans firm up after about a week of nights."], alternatives: [] };
  if (fitting.length) return { status: "ok", usual, pick: fitting[0], best, screenMatters, reasons: [], alternatives: [] };

  const reasons = [`Even the best evening within your limits predicts ${best.mean.toFixed(1)} of 5, below your target of ${c.targetQuality.toFixed(1)}.`];
  if (!screenMatters) reasons.push("Your nights don't show a clear screen effect yet, so cutting screens alone isn't predicted to help much.");
  const usualBed = usual.bedtime;
  const pickOf = (sc: number, b: number) => evaluate(p, s, c, sc, b);
  const earliest = Math.min(...beds);
  const alts: Alternative[] = [
    { kind: "noScreens", title: "Phone away for the last two hours", detail: "Same bedtime as usual.", option: pickOf(0, usualBed), fixes: false },
    { kind: "earlier", title: `Lights out at ${fmtNoon(earliest)}`, detail: "Your usual screen time, earlier bedtime.", option: pickOf(c.usualScreen, earliest), fixes: false },
    { kind: "both", title: "Both: no screens and the earlier bedtime", detail: "The best evening the model sees within your limits.", option: best, fixes: false },
  ];
  for (const a of alts) a.fixes = a.option.mean >= c.targetQuality;
  const reachable = Math.floor(best.mean * 10) / 10;
  alts.push({ kind: "lowerTarget", title: `Aim for ${reachable.toFixed(1)} tonight`, detail: "What your best evening is predicted to give.", option: best, fixes: true, target: reachable });
  const last = (a: Alternative) => (a.kind === "lowerTarget" ? 1 : 0);
  alts.sort((a, b) => last(a) - last(b) || Number(b.fixes) - Number(a.fixes) || b.option.mean - a.option.mean || a.option.change - b.option.change);
  return { status: "conflict", usual, pick: null, best, screenMatters, reasons, alternatives: alts };
}

function fmtNoon(m: number): string {
  const t = ((Math.round(m) + 720) % 1440 + 1440) % 1440;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

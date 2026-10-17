// Анализ: накопленные статистики → апостериоры, честные прогнозы прошлых
// ночей (пересборка) → план на сегодняшний вечер.

import type { NightRow, Settings } from "../data/repo";
import { posterior, LATENCY_PRIOR, QUALITY_PRIOR, screenEffect, coef, type Posterior } from "../lib/model.ts";
import { replayFits, type ModelState, type NightFit } from "../lib/nights.ts";
import { evaluate, makePlan, type Option, type PlanResult, type Constraints } from "../lib/plan.ts";
import { addDays, dayNumber, todayLocal } from "../lib/time.ts";

export type Analysis = {
  today: string;
  tonight: string; // дата вечера, к которому относится "сегодня" (до 5 утра — вчерашний)
  state: ModelState;
  quality: Posterior;
  latency: Posterior;
  fits: Record<string, NightFit>;
  constraints: Constraints;
  plan: PlanResult;
  weekdayEffect: ReturnType<typeof screenEffect>;
  freeEffect: ReturnType<typeof screenEffect>;
  lateEffect: ReturnType<typeof coef>;
  usualScreen: number;
  tonightPlan: Option; // что показываем на сегодня: выбранный вручную вечер или план
  chosen: boolean;
};

export function weekdayOf(date: string): number {
  return (new Date(dayNumber(date) * 86_400_000).getUTCDay() + 6) % 7;
}

export function analyze(nights: NightRow[], stored: ModelState, s: Settings): Analysis {
  const today = todayLocal();
  const h = new Date().getHours();
  const tonight = h < 5 ? addDays(today, -1) : today;
  const { fits } = replayFits(nights);
  const quality = posterior(stored.quality, QUALITY_PRIOR);
  const latency = posterior(stored.latency, LATENCY_PRIOR);
  const recent = nights.filter((n) => n.screenMin !== null).slice(-14).map((n) => n.screenMin!).sort((a, b) => a - b);
  const usualScreen = recent.length ? Math.round(recent[Math.floor(recent.length / 2)] / 15) * 15 : 60;
  const constraints: Constraints = {
    date: tonight,
    wake: s.wake[weekdayOf(addDays(tonight, 1))],
    minSleepMin: s.minSleepHours * 60,
    targetQuality: s.targetQuality,
    usualScreen,
  };
  const plan = makePlan(quality, stored, constraints);
  const ch = s.chosen && s.chosen.date === tonight ? s.chosen : null;
  const tonightPlan = ch ? evaluate(quality, stored, constraints, ch.screenMin, ch.bedtime) : plan.pick ?? plan.best;
  return {
    tonightPlan,
    chosen: !!ch,
    today,
    tonight,
    state: stored,
    quality,
    latency,
    fits,
    constraints,
    plan,
    weekdayEffect: screenEffect(quality, false),
    freeEffect: screenEffect(quality, true),
    lateEffect: coef(quality, 2),
    usualScreen,
  };
}

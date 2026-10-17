import { test } from "node:test";
import assert from "node:assert/strict";
import { addObs, coef, emptyStats, features, invert, posterior, predict, QUALITY_PRIOR, screenEffect, K } from "./model.ts";
import { isFreeNight, replay, replayFits, sleepMinutes, type Night } from "./nights.ts";
import { makePlan } from "./plan.ts";
import { accuracy, screenBuckets } from "./stats.ts";
import { addDays } from "./time.ts";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// Синтетика: качество = 4 − 0.6·экран(ч) − 0.4·поздний отбой(ч) + шум 0.4.
// Экран и поздний отбой СЦЕПЛЕНЫ (кто дольше в телефоне, тот позже ложится).
function nights(n: number, screenEff = -0.6, seed = 5): Night[] {
  const r = rng(seed);
  const out: Night[] = [];
  let date = "2026-08-03";
  for (let i = 0; i < n; i++) {
    const screen = Math.round(r() * 120);
    const late = (screen / 60) * 0.5 + gauss(r) * 0.5;
    const bedtime = 690 + late * 60;
    const q = 4 + screenEff * (screen / 60) - 0.4 * late + 0.4 * gauss(r);
    out.push({ date, screenMin: screen, bedtime, wake: 420, quality: Math.max(1, Math.min(5, q)), latency: 15 + screen / 6, wakeups: 1 });
    date = addDays(date, 1);
  }
  return out;
}

test("matrix inverse", () => {
  const m = [4, 1, 0, 0, 0, 1, 3, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0.5, 0, 0, 0, 0.5, 2];
  const inv = invert(m);
  for (let i = 0; i < K; i++)
    for (let j = 0; j < K; j++) {
      let s = 0;
      for (let k = 0; k < K; k++) s += m[i * K + k] * inv[k * K + j];
      assert.ok(Math.abs(s - (i === j ? 1 : 0)) < 1e-9);
    }
});

test("regression separates the screen effect from late bedtimes", () => {
  const s = replay(nights(90));
  const p = posterior(s.quality, QUALITY_PRIOR);
  const sc = coef(p, 1);
  const late = coef(p, 2);
  assert.ok(sc.clear && sc.hi < 0, `screen ${sc.mean}`);
  assert.ok(Math.abs(sc.mean - -0.6) < 0.25, `screen ${sc.mean}`);
  assert.ok(Math.abs(late.mean - -0.4) < 0.25, `late ${late.mean}`);
});

test("no real effect → interval covers zero", () => {
  const s = replay(nights(60, 0, 9));
  const p = posterior(s.quality, QUALITY_PRIOR);
  const e = screenEffect(p, false);
  assert.ok(e.lo < 0 && e.hi > 0, `${e.lo}..${e.hi}`);
});

test("few nights stay close to the prior; weekend effect is pooled", () => {
  const st = addObs(emptyStats(), features(60, 0, true), 2);
  const p = posterior(st, QUALITY_PRIOR);
  assert.ok(Math.abs(p.mean[4]) < 0.3);
  const pr = predict(p, features(0, 0, false));
  assert.ok(pr.mean > 2.5 && pr.mean < 4);
});

test("free nights: Friday and Saturday evenings", () => {
  assert.equal(isFreeNight("2026-10-16"), true); // пятница
  assert.equal(isFreeNight("2026-10-17"), true); // суббота
  assert.equal(isFreeNight("2026-10-18"), false); // воскресенье
  assert.equal(sleepMinutes({ date: "2026-10-18", screenMin: 0, bedtime: 690, wake: 420, quality: 3, latency: 20, wakeups: 0 }), 450 - 20);
});

test("plan: picks the smallest change that reaches the target; conflict lists verified ways out", () => {
  const ns = nights(60);
  const s = replay(ns);
  const p = posterior(s.quality, QUALITY_PRIOR);
  const c = { date: "2026-10-19", wake: 420, minSleepMin: 420, targetQuality: 3.6, usualScreen: 90 };
  const ok = makePlan(p, s, c);
  assert.equal(ok.status, "ok");
  assert.ok(ok.pick!.mean >= 3.6);
  assert.ok(ok.pick!.screenMin < 90);
  assert.ok(ok.pick!.sleepMin >= 420);
  const hard = makePlan(p, s, { ...c, targetQuality: 4.9 });
  assert.equal(hard.status, "conflict");
  assert.equal(hard.alternatives[hard.alternatives.length - 1].kind, "lowerTarget");
  for (const a of hard.alternatives) assert.ok(a.option.sleepMin >= 420);
  const both = hard.alternatives.find((a) => a.kind === "both")!;
  assert.ok(both.option.mean >= hard.alternatives.find((a) => a.kind === "noScreens")!.option.mean - 1e-9);
});

test("honest replay fits: predictions made before each night, calibrated coverage", () => {
  const ns = nights(80);
  const { fits } = replayFits(ns);
  const acc = accuracy(Object.values(fits));
  assert.ok(acc.mae !== null && acc.mae < 0.6, `mae ${acc.mae}`);
  assert.ok(acc.coverage! > 0.75, `coverage ${acc.coverage}`);
  const b = screenBuckets(ns);
  assert.ok(b[0].mean! > b[3].mean!);
});

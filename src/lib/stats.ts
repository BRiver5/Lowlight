// Агрегаты для Stats — чистые функции над ночами.

import { complete, isFreeNight, sleepMinutes, type Night, type NightFit } from "./nights.ts";

export type Point = { date: string; screen: number; quality: number; free: boolean };

export function points(nights: Night[]): Point[] {
  return nights.filter(complete).map((n) => ({ date: n.date, screen: n.screenMin!, quality: n.quality!, free: isFreeNight(n.date) }));
}

// Средняя ошибка прогноза (по ночам, где модель уже была) и доля ночей в 90% интервале.
export function accuracy(fits: NightFit[], skipFirst = 5): { n: number; mae: number | null; coverage: number | null } {
  const f = fits.slice(skipFirst);
  if (f.length === 0) return { n: 0, mae: null, coverage: null };
  const mae = f.reduce((s, x) => s + Math.abs(x.actual - x.predicted), 0) / f.length;
  const cov = f.filter((x) => x.actual >= x.lo && x.actual <= x.hi).length / f.length;
  return { n: f.length, mae, coverage: cov };
}

export function screenBuckets(nights: Night[]): { label: string; n: number; mean: number | null }[] {
  const b = [
    { label: "0–15", lo: 0, hi: 15 },
    { label: "15–45", lo: 15, hi: 45 },
    { label: "45–90", lo: 45, hi: 90 },
    { label: "90+", lo: 90, hi: 1e9 },
  ];
  const pts = nights.filter(complete);
  return b.map((x) => {
    const q = pts.filter((n) => n.screenMin! >= x.lo && n.screenMin! < x.hi).map((n) => n.quality!);
    return { label: x.label, n: q.length, mean: q.length ? q.reduce((a, c) => a + c, 0) / q.length : null };
  });
}

export function avgSleep(nights: Night[]): number | null {
  const m = nights.map(sleepMinutes).filter((x): x is number => x !== null);
  return m.length ? m.reduce((a, b) => a + b, 0) / m.length : null;
}

export function streak(dates: string[], today: string, prev: (d: string) => string): number {
  const set = new Set(dates);
  let d = set.has(today) ? today : prev(today);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = prev(d);
  }
  return n;
}

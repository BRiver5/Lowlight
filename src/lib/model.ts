// Накапливаемая байесовская регрессия "как прошла ночь" по вечеру перед ней.
//
// y (качество сна 1–5 или минуты до засыпания) = β·x + шум, где
//   x = [1, экран (часы за 2 ч до сна), поздний отбой (ч от вашего обычного),
//        выходной (0/1), выходной × экран].
// Последний член — отличие эффекта экрана в выходные: его априор узкий
// (частичное объединение), пока данных мало, выходные берут общий наклон.
// Поздний отбой в модели нарочно: кто дольше сидит в телефоне, тот и ложится
// позже — без этой поправки эффект экрана был бы приписан и отбою.
//
// Нормальный-обратно-гамма сопряжённый апостериор хранится ДОСТАТОЧНЫМИ
// статистиками (XᵀX, Xᵀy, yᵀy, n), которые копятся ночь за ночью и мягко
// забываются (FORGET) — привычки меняются. Правка/удаление ночи — пересборка.

export const K = 5;
export const FORGET = 0.985;
export const NAMES = ["Baseline", "Screens (per hour)", "Late bedtime (per hour)", "Fri/Sat night", "Extra screen effect, Fri/Sat"] as const;

export type Stats = { xtx: number[]; xty: number[]; yty: number; n: number };
export type Prior = { mean: number[]; prec: number[]; a0: number; b0: number };

export const QUALITY_PRIOR: Prior = { mean: [3.3, 0, 0, 0, 0], prec: [1 / 4, 1, 1, 1, 1 / 0.3 ** 2], a0: 2, b0: 2 * 0.8 ** 2 };
export const LATENCY_PRIOR: Prior = { mean: [20, 0, 0, 0, 0], prec: [1 / 400, 1 / 100, 1 / 100, 1 / 100, 1 / 25], a0: 2, b0: 2 * 12 ** 2 };

export function emptyStats(): Stats {
  return { xtx: new Array(K * K).fill(0), xty: new Array(K).fill(0), yty: 0, n: 0 };
}

export function features(screenMin: number, lateHours: number, weekend: boolean): number[] {
  const s = Math.max(0, screenMin) / 60;
  const w = weekend ? 1 : 0;
  return [1, s, lateHours, w, w * s];
}

export function addObs(st: Stats, x: number[], y: number): Stats {
  const xtx = st.xtx.map((v) => v * FORGET);
  const xty = st.xty.map((v) => v * FORGET);
  for (let i = 0; i < K; i++) {
    xty[i] += x[i] * y;
    for (let j = 0; j < K; j++) xtx[i * K + j] += x[i] * x[j];
  }
  return { xtx, xty, yty: st.yty * FORGET + y * y, n: st.n * FORGET + 1 };
}

export function invert(m: number[], n = K): number[] {
  const a = m.slice();
  const inv = new Array(n * n).fill(0);
  for (let i = 0; i < n; i++) inv[i * n + i] = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r * n + c]) > Math.abs(a[p * n + c])) p = r;
    if (p !== c) {
      for (let k = 0; k < n; k++) {
        [a[c * n + k], a[p * n + k]] = [a[p * n + k], a[c * n + k]];
        [inv[c * n + k], inv[p * n + k]] = [inv[p * n + k], inv[c * n + k]];
      }
    }
    const d = a[c * n + c];
    for (let k = 0; k < n; k++) {
      a[c * n + k] /= d;
      inv[c * n + k] /= d;
    }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r * n + c];
      if (f === 0) continue;
      for (let k = 0; k < n; k++) {
        a[r * n + k] -= f * a[c * n + k];
        inv[r * n + k] -= f * inv[c * n + k];
      }
    }
  }
  return inv;
}

export type Posterior = {
  mean: number[];
  cov: number[]; // ковариация коэффициентов (с учётом σ²)
  sigma2: number; // оценка дисперсии шума
  dof: number;
  n: number;
};

export function posterior(st: Stats, pr: Prior): Posterior {
  const lam = st.xtx.slice();
  for (let i = 0; i < K; i++) lam[i * K + i] += pr.prec[i];
  const rhs = st.xty.map((v, i) => v + pr.prec[i] * pr.mean[i]);
  const linv = invert(lam);
  const mean = new Array(K).fill(0);
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) mean[i] += linv[i * K + j] * rhs[j];
  let m0 = 0;
  for (let i = 0; i < K; i++) m0 += pr.prec[i] * pr.mean[i] * pr.mean[i];
  let mn = 0;
  for (let i = 0; i < K; i++) mn += mean[i] * rhs[i];
  const an = pr.a0 + st.n / 2;
  const bn = pr.b0 + 0.5 * Math.max(0, st.yty + m0 - mn);
  const sigma2 = bn / an;
  return { mean, cov: linv.map((v) => v * sigma2), sigma2, dof: 2 * an, n: st.n };
}

// Коэффициент j с 90% интервалом (t-распределение приближаем нормальным с
// поправкой на малое число степеней свободы).
export function coef(p: Posterior, j: number): { mean: number; lo: number; hi: number; sd: number; clear: boolean } {
  const sd = Math.sqrt(Math.max(0, p.cov[j * K + j]));
  const z = tq(p.dof);
  return { mean: p.mean[j], lo: p.mean[j] - z * sd, hi: p.mean[j] + z * sd, sd, clear: p.mean[j] - z * sd > 0 || p.mean[j] + z * sd < 0 };
}

// Квантиль 95% t-распределения (двусторонний 90%) — аппроксимация.
export function tq(dof: number): number {
  return 1.645 + 2.0 / Math.max(1, dof) + 3.0 / Math.max(1, dof) ** 2;
}

// Эффект экрана в конкретный тип дня: β_экран (+ β_взаимодействие в выходные).
export function screenEffect(p: Posterior, weekend: boolean): { mean: number; lo: number; hi: number; clear: boolean } {
  const v = weekend ? p.cov[1 * K + 1] + p.cov[4 * K + 4] + 2 * p.cov[1 * K + 4] : p.cov[1 * K + 1];
  const mean = p.mean[1] + (weekend ? p.mean[4] : 0);
  const sd = Math.sqrt(Math.max(0, v));
  const z = tq(p.dof);
  return { mean, lo: mean - z * sd, hi: mean + z * sd, clear: mean - z * sd > 0 || mean + z * sd < 0 };
}

// Прогноз для вечера x: среднее, 90% интервал среднего и 90% интервал ночи.
export function predict(p: Posterior, x: number[]): { mean: number; lo: number; hi: number; nightLo: number; nightHi: number; parts: number[] } {
  let mean = 0;
  const parts = x.map((xi, i) => xi * p.mean[i]);
  for (const v of parts) mean += v;
  let v = 0;
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) v += x[i] * p.cov[i * K + j] * x[j];
  const z = tq(p.dof);
  const sd = Math.sqrt(Math.max(0, v));
  const sdN = Math.sqrt(Math.max(0, v + p.sigma2));
  return { mean, lo: mean - z * sd, hi: mean + z * sd, nightLo: mean - z * sdN, nightHi: mean + z * sdN, parts };
}

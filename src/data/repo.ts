import { getDb } from "../db/client";
import { addNight, complete, emptyState, replay, type ModelState, type Night } from "../lib/nights.ts";

export const MODEL_VERSION = 1;

export type NightRow = Night & { note: string; updatedAt: number };

export type Settings = {
  wake: number[]; // подъём по дням недели (Пн..Вс), минуты от полуночи — для ночи ПЕРЕД этим днём
  minSleepHours: number;
  targetQuality: number;
  eveningReminder: boolean;
  morningReminder: boolean;
  haptics: boolean;
  chosen: { date: string; screenMin: number; bedtime: number } | null; // вечер, выбранный вручную на экране плана
};

export const DEFAULT_SETTINGS: Settings = {
  wake: [420, 420, 420, 420, 420, 540, 540],
  minSleepHours: 7,
  targetQuality: 3.8,
  eveningReminder: false,
  morningReminder: false,
  haptics: true,
  chosen: null,
};

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : (v as number));

function toNight(r: Row): NightRow {
  return {
    date: r.date as string,
    screenMin: num(r.screen_min),
    bedtime: num(r.bedtime),
    wake: num(r.wake),
    quality: num(r.quality),
    latency: num(r.latency),
    wakeups: num(r.wakeups),
    note: r.note as string,
    updatedAt: r.updated_at as number,
  };
}

export async function loadAll() {
  const db = await getDb();
  const mv = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'modelVersion'");
  if (!mv || JSON.parse(mv.value) !== MODEL_VERSION) {
    await rebuildModel();
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('modelVersion', ?)", [JSON.stringify(MODEL_VERSION)]);
  }
  const nights = (await db.getAllAsync<Row>("SELECT * FROM nights ORDER BY date")).map(toNight);
  const srows = await db.getAllAsync<{ key: string; value: string }>("SELECT * FROM settings");
  const settings: Settings = { ...DEFAULT_SETTINGS };
  let model: ModelState = emptyState();
  for (const r of srows) {
    if (r.key === "model") model = JSON.parse(r.value);
    else if (r.key in settings) (settings as Record<string, unknown>)[r.key] = JSON.parse(r.value);
  }
  return { nights, settings, model };
}

async function saveModel(m: ModelState): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('model', ?)", [JSON.stringify(m)]);
}

export async function rebuildModel(): Promise<void> {
  const db = await getDb();
  const nights = (await db.getAllAsync<Row>("SELECT * FROM nights")).map(toNight);
  await saveModel(replay(nights));
}

// Сохранение части ночи. Если ночь впервые стала полной и она после
// последней учтённой — одно накапливаемое обновление; иначе — пересборка.
export async function saveNight(date: string, patch: Partial<Omit<NightRow, "date" | "updatedAt">>): Promise<void> {
  const db = await getDb();
  const before = await db.getFirstAsync<Row>("SELECT * FROM nights WHERE date = ?", [date]);
  const prev = before ? toNight(before) : null;
  const next: NightRow = {
    date,
    screenMin: null,
    bedtime: null,
    wake: null,
    quality: null,
    latency: null,
    wakeups: null,
    note: "",
    ...(prev ?? {}),
    ...patch,
    updatedAt: Date.now(),
  } as NightRow;
  await db.runAsync(
    `INSERT OR REPLACE INTO nights (date, screen_min, bedtime, wake, quality, latency, wakeups, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [date, next.screenMin, next.bedtime, next.wake, next.quality, next.latency, next.wakeups, next.note, next.updatedAt],
  );
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'model'");
  const m: ModelState = row ? JSON.parse(row.value) : emptyState();
  const wasComplete = prev ? complete(prev) : false;
  if (complete(next) && !wasComplete && (m.lastDate === null || date > m.lastDate)) await saveModel(addNight(m, next));
  else if (complete(next) || wasComplete) await rebuildModel();
}

export async function deleteNight(date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM nights WHERE date = ?", [date]);
  await rebuildModel();
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
}

export async function resetAll(): Promise<void> {
  const db = await getDb();
  await db.execAsync("DELETE FROM nights; DELETE FROM settings;");
}

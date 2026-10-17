import type { SQLiteDatabase } from "expo-sqlite";

// Каждая миграция — одна ступень схемы. Не редактируй уже выпущенную миграцию.
// nights — одна строка на вечер (ключ — дата вечера), утренняя часть
// дописывается в ту же строку. settings.model — НАКОПЛЕННЫЕ достаточные
// статистики регрессии (JSON ModelState), modelVersion — для пересборки.
const migrations: string[] = [
  `
  CREATE TABLE IF NOT EXISTS nights (
    date TEXT PRIMARY KEY NOT NULL,
    screen_min INTEGER,
    bedtime INTEGER,
    wake INTEGER,
    quality REAL,
    latency INTEGER,
    wakeups INTEGER,
    note TEXT NOT NULL DEFAULT '',
    updated_at REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;
  for (let i = currentVersion; i < migrations.length; i++) {
    await db.execAsync(migrations[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}

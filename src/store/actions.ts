import * as repo from "../data/repo";
import { useApp } from "./appStore";

async function run<T>(fn: () => Promise<T>): Promise<T> {
  const r = await fn();
  await useApp.getState().refresh();
  return r;
}

export const actions = {
  saveNight: (date: string, patch: Parameters<typeof repo.saveNight>[1]) => run(() => repo.saveNight(date, patch)),
  deleteNight: (date: string) => run(() => repo.deleteNight(date)),
  setSetting: <K extends keyof repo.Settings>(key: K, value: repo.Settings[K]) => run(() => repo.setSetting(key, value)),
  resetAll: () => run(() => repo.resetAll()),
};

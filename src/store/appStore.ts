import { create } from "zustand";
import { loadAll, DEFAULT_SETTINGS, type NightRow, type Settings } from "../data/repo";
import { analyze, type Analysis } from "./analysis";
import { setHapticsEnabled } from "../services/haptics";
import { syncReminders } from "../services/reminders";

type State = {
  ready: boolean;
  nights: NightRow[];
  settings: Settings;
  analysis: Analysis | null;
  version: number;
  refresh: () => Promise<void>;
};

export const useApp = create<State>((set, get) => ({
  ready: false,
  nights: [],
  settings: DEFAULT_SETTINGS,
  analysis: null,
  version: 0,
  refresh: async () => {
    const { nights, settings, model } = await loadAll();
    setHapticsEnabled(settings.haptics);
    const analysis = analyze(nights, model, settings);
    set({ ready: true, nights, settings, analysis, version: get().version + 1 });
    syncReminders(analysis, settings).catch(() => {});
  },
}));

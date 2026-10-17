// Напоминания: вечером — "пора отложить телефон" во время из плана на сегодня
// (минус 2 часа экрана до отбоя), утром — "как спалось" через 15 минут после
// подъёма. Неточные триггеры на дату; разрешение — только по включению в
// Settings. В Expo Go модуль не грузится (см. notifications.ts шаблона).

import Constants, { ExecutionEnvironment } from "expo-constants";
import type { Analysis } from "../store/analysis";
import type { Settings } from "../data/repo";
import { clockFromNoon } from "../lib/nights.ts";

type NotificationsModule = typeof import("expo-notifications");

export const remindersAvailable = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let mod: NotificationsModule | null = null;
function load(): NotificationsModule | null {
  if (!remindersAvailable) return null;
  if (!mod) {
    mod = require("expo-notifications") as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  }
  return mod;
}

export async function requestReminderPermission(): Promise<boolean> {
  const N = load();
  if (!N) return false;
  if ((await N.getPermissionsAsync()).granted) return true;
  return (await N.requestPermissionsAsync()).granted;
}

const PREFIX = "lowlight-";

export async function syncReminders(a: Analysis, s: Settings): Promise<void> {
  const N = load();
  if (!N) return;
  for (const n of await N.getAllScheduledNotificationsAsync()) if (n.identifier.startsWith(PREFIX)) await N.cancelScheduledNotificationAsync(n.identifier);
  if (!(s.eveningReminder || s.morningReminder) || !(await N.getPermissionsAsync()).granted) return;
  const now = Date.now();
  const [y, m, d] = a.tonight.split("-").map(Number);
  const opt = a.tonightPlan;
  if (s.eveningReminder) {
    // За 2 часа до отбоя из плана — начало окна, в котором считается экран.
    const downAt = opt.bedtime - 120; // минуты от полудня
    const when = new Date(y, m - 1, d, 12, 0, 0);
    when.setMinutes(when.getMinutes() + downAt);
    if (when.getTime() > now) {
      await N.scheduleNotificationAsync({
        identifier: `${PREFIX}evening`,
        content: { title: "Two hours to lights out", body: `Tonight's plan: ${opt.screenMin === 0 ? "no screens" : `at most ${opt.screenMin} min of screens`} from now, lights out ${clockFromNoon(opt.bedtime)}.` },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
  }
  if (s.morningReminder) {
    const wake = a.constraints.wake;
    const when = new Date(y, m - 1, d + 1, Math.floor((wake + 15) / 60), (wake + 15) % 60, 0);
    if (when.getTime() > now) {
      await N.scheduleNotificationAsync({
        identifier: `${PREFIX}morning`,
        content: { title: "How did you sleep?", body: "Ten seconds now keeps the model honest." },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
  }
}

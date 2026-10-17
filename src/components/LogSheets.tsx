import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Moon } from "lucide-react-native";
import { useTheme } from "../theme";
import { qualityColor } from "../theme/colors";
import { Sheet, Field } from "./Sheet";
import { Chip, Stepper } from "./Bits";
import { PressableScale } from "./PressableScale";
import { PrimaryButton } from "./PrimaryButton";
import { SuccessBurst } from "./SuccessBurst";
import { useApp } from "../store/appStore";
import { actions } from "../store/actions";
import { haptics } from "../services/haptics";
import { clock, clockFromNoon } from "../lib/nights.ts";
import { dayLabel, weekdayLabel, addDays } from "../lib/time.ts";
import { weekdayOf } from "../store/analysis";

const SCREEN_PRESETS = [0, 15, 30, 45, 60, 90, 120];

// Вечер: сколько экрана за последние 2 часа до сна и во сколько погасил свет.
export function EveningSheet({ visible, onClose, date }: { visible: boolean; onClose: () => void; date: string }) {
  const t = useTheme();
  const { nights, analysis } = useApp();
  const existing = nights.find((n) => n.date === date);
  const plan = analysis?.tonight === date ? analysis.tonightPlan : null;
  const usualBed = analysis?.state.anchor != null ? Math.round(analysis.state.anchor / 15) * 15 : 690;
  const [screen, setScreen] = useState(60);
  const [bed, setBed] = useState(690);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setScreen(existing?.screenMin ?? analysis?.usualScreen ?? 60);
    setBed(existing?.bedtime ?? usualBed);
    setBurst(false);
  }, [visible, date]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Your evening"
      subtitle={`${weekdayLabel(date)}, ${dayLabel(date)} — phone, laptop and TV all count.`}
      footer={
        burst ? (
          <View style={{ alignItems: "center" }}>
            <SuccessBurst visible size={56} onDone={() => setTimeout(onClose, 250)} />
          </View>
        ) : (
          <PrimaryButton
            label="Save evening"
            onPress={async () => {
              haptics.success();
              setBurst(true);
              await actions.saveNight(date, { screenMin: screen, bedtime: bed });
            }}
          />
        )
      }
    >
      <Field label="Screens in the last 2 hours before sleep">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {SCREEN_PRESETS.map((m) => (
            <Chip key={m} label={m === 0 ? "None" : m === 120 ? "Whole time" : `${m} min`} active={screen === m} onPress={() => setScreen(m)} />
          ))}
        </View>
        <Stepper value={screen} onChange={setScreen} min={0} max={120} step={5} format={(v) => `${v} min`} />
      </Field>
      <Field label="Lights out" hint={plan ? `Tonight's plan says ${clockFromNoon(plan.bedtime)}.` : undefined}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            { l: `Usual · ${clockFromNoon(usualBed)}`, v: usualBed },
            ...(plan ? [{ l: `Plan · ${clockFromNoon(plan.bedtime)}`, v: plan.bedtime }] : []),
          ].map((o) => (
            <Chip key={o.l} label={o.l} active={bed === o.v} onPress={() => setBed(o.v)} />
          ))}
        </View>
        <Stepper value={bed} onChange={setBed} min={480} max={960} step={15} format={clockFromNoon} />
      </Field>
    </Sheet>
  );
}

const QUALITY = ["Awful", "Poor", "Okay", "Good", "Great"];

// Утро: оценка 1–5 одним тапом (крупные "луны"), засыпание, пробуждения, подъём.
export function MorningSheet({ visible, onClose, date }: { visible: boolean; onClose: () => void; date: string }) {
  const t = useTheme();
  const { nights, settings } = useApp();
  const existing = nights.find((n) => n.date === date);
  const defWake = settings.wake[weekdayOf(addDays(date, 1))];
  const [q, setQ] = useState<number | null>(null);
  const [lat, setLat] = useState(15);
  const [wakeups, setWakeups] = useState(0);
  const [wake, setWake] = useState(defWake);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setQ(existing?.quality ?? null);
    setLat(existing?.latency ?? 15);
    setWakeups(existing?.wakeups ?? 0);
    setWake(existing?.wake ?? defWake);
    setBurst(false);
  }, [visible, date]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="How did you sleep?"
      subtitle={`The night after ${weekdayLabel(date)}, ${dayLabel(date)}.`}
      footer={
        burst ? (
          <View style={{ alignItems: "center" }}>
            <SuccessBurst visible size={56} onDone={() => setTimeout(onClose, 250)} />
          </View>
        ) : (
          <PrimaryButton
            label={q === null ? "Rate the night first" : `Save · ${QUALITY[q - 1]}`}
            disabled={q === null}
            onPress={async () => {
              if (q === null) return;
              haptics.success();
              setBurst(true);
              await actions.saveNight(date, { quality: q, latency: lat, wakeups, wake });
            }}
          />
        )
      }
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((v) => (
          <PressableScale
            key={v}
            onPress={() => {
              haptics.tick();
              setQ(v);
            }}
            accessibilityLabel={`${v} of 5, ${QUALITY[v - 1]}`}
            scaleTo={0.92}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 6,
              paddingVertical: 12,
              borderRadius: t.radius.md,
              backgroundColor: q === v ? qualityColor(v) : t.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: q === v ? qualityColor(v) : t.colors.border,
            }}
          >
            <Moon size={18 + v * 2} color={q === v ? t.colors.onAccent : qualityColor(v)} fill={q === v ? t.colors.onAccent : "transparent"} />
            <Text numberOfLines={1} style={{ ...t.typography.label, fontSize: 12, color: q === v ? t.colors.onAccent : t.colors.inkMuted }}>
              {QUALITY[v - 1]}
            </Text>
          </PressableScale>
        ))}
      </View>
      <Field label="Time to fall asleep">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[5, 15, 30, 45, 60].map((m) => (
            <Chip key={m} label={m === 60 ? "An hour+" : `${m} min`} active={lat === m} onPress={() => setLat(m)} />
          ))}
        </View>
      </Field>
      <Field label="Woke up during the night">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[0, 1, 2, 3].map((m) => (
            <Chip key={m} label={m === 3 ? "3+" : m === 0 ? "Not once" : String(m)} active={wakeups === m} onPress={() => setWakeups(m)} />
          ))}
        </View>
      </Field>
      <Field label="Got up at">
        <Stepper value={wake} onChange={setWake} min={240} max={780} step={15} format={clock} />
      </Field>
    </Sheet>
  );
}

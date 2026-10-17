import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, ArrowLeft, CheckCircle2, Gauge, Moon, Smartphone, Sparkles } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { useApp } from "../src/store/appStore";
import { actions } from "../src/store/actions";
import { IconButton, SectionTitle, Stepper } from "../src/components/Bits";
import { Segmented } from "../src/components/Segmented";
import { EveningGrid, type GridCell } from "../src/components/EveningGrid";
import { PressableScale } from "../src/components/PressableScale";
import { evaluate, type Alternative, type Option } from "../src/lib/plan.ts";
import { features, predict } from "../src/lib/model.ts";
import { clockFromNoon, isFreeNight, lateHours } from "../src/lib/nights.ts";
import { haptics } from "../src/services/haptics";

const SCREENS = [0, 15, 30, 45, 60, 75, 90, 105, 120];
const ALT_ICON = { noScreens: Smartphone, earlier: Moon, both: Sparkles, lowerTarget: Gauge };

export default function PlanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { analysis: a, settings, version } = useApp();
  const [mode, setMode] = useState<"plan" | "whatif">("plan");
  const [pick, setPick] = useState<{ screenMin: number; bedtime: number } | null>(null);

  const grid = useMemo(() => {
    if (!a) return null;
    const c = a.constraints;
    const anchor = a.state.anchor ?? c.wake + 720 - c.minSleepMin - 30;
    const beds: number[] = [];
    for (let b = Math.round((anchor - 120) / 15) * 15; b <= anchor + 90; b += 15) beds.push(b);
    const latest = c.wake + 720 - c.minSleepMin;
    const cells: GridCell[] = [];
    for (const s of SCREENS) for (const b of beds) cells.push({ screenMin: s, bedtime: b, mean: evaluate(a.quality, a.state, c, s, b).mean, ok: b <= latest });
    return { beds, cells };
  }, [version]);

  if (!a || !grid) return null;
  const c = a.constraints;
  const p = a.plan;
  const usual = p.usual;
  const sel: Option = pick ? evaluate(a.quality, a.state, c, pick.screenMin, pick.bedtime) : a.tonightPlan;
  const lat = (o: Option) => predict(a.latency, features(o.screenMin, lateHours(a.state, o.bedtime), isFreeNight(c.date)));
  const choose = async (o: { screenMin: number; bedtime: number }) => {
    haptics.press();
    await actions.setSetting("chosen", { date: a.tonight, screenMin: o.screenMin, bedtime: o.bedtime });
  };
  const apply = async (alt: Alternative) => {
    if (alt.kind === "lowerTarget" && alt.target !== undefined) await actions.setSetting("targetQuality", alt.target);
    else await choose(alt.option);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.display, color: t.colors.ink }}>Tonight</Text>
      </View>
      <Segmented items={[{ key: "plan", label: "Plan", badge: p.status === "conflict" ? 1 : undefined }, { key: "whatif", label: "What if" }]} value={mode} onChange={setMode} />

      {mode === "plan" ? (
        <>
          <Animated.View entering={FadeInDown.duration(400)} style={card(t)}>
            <SectionTitle title="Your limits tonight" />
            <Row label="Target sleep quality">
              <Stepper value={settings.targetQuality} onChange={(v) => actions.setSetting("targetQuality", v)} min={2} max={5} step={0.1} format={(v) => `${v.toFixed(1)} / 5`} />
            </Row>
            <Row label="At least this much sleep">
              <Stepper value={settings.minSleepHours} onChange={(v) => actions.setSetting("minSleepHours", v)} min={5} max={10} step={0.5} format={(v) => `${v} h`} />
            </Row>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Up at {clockFromNoon(c.wake + 720)} tomorrow — change wake times per weekday in Settings.</Text>
          </Animated.View>

          <View style={card(t)}>
            <SectionTitle title={p.status === "conflict" ? "Out of reach tonight" : "The smallest change that gets there"} />
            {p.status === "conflict" ? (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={18} color={t.colors.danger} />
                  <Text style={{ ...t.typography.subtitle, color: t.colors.danger }}>Target {c.targetQuality.toFixed(1)} doesn't fit</Text>
                </View>
                {p.reasons.map((r) => (
                  <Text key={r} style={{ ...t.typography.body, color: t.colors.ink }}>
                    {r}
                  </Text>
                ))}
              </View>
            ) : (
              <Compare a={usual} b={p.pick ?? p.best} aLabel="Your usual" bLabel="Plan" />
            )}
            {p.status === "learning" ? <Text style={{ ...t.typography.caption, color: t.colors.signal }}>{p.reasons[0]}</Text> : null}
            {!p.screenMatters && p.status !== "learning" ? (
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Your nights don't show a clear screen effect yet — the plan leans on bedtime until they do.</Text>
            ) : null}
            {p.pick && p.status !== "conflict" ? (
              <PressableScale onPress={() => choose(p.pick!)} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}>
                <CheckCircle2 size={14} color={t.colors.onAccent} />
                <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.onAccent }}>
                  Use this tonight
                </Text>
              </PressableScale>
            ) : null}
          </View>

          {p.status === "conflict" ? (
            <View style={{ ...card(t), borderColor: t.colors.danger }}>
              <SectionTitle title="Ways out, best first" />
              {p.alternatives.map((alt, i) => {
                const Icon = ALT_ICON[alt.kind];
                return (
                  <View key={alt.kind} style={{ flexDirection: "row", gap: 10, padding: t.spacing.md, borderRadius: t.radius.md, backgroundColor: i === 0 && alt.fixes ? t.colors.accentSoft : t.colors.surfaceAlt }}>
                    <Icon size={18} color={alt.fixes ? t.colors.accent : t.colors.inkMuted} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{alt.title}</Text>
                      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{alt.detail}</Text>
                      <Text style={{ ...t.typography.caption, color: alt.fixes ? t.colors.success : t.colors.signal }}>
                        Predicted {alt.option.mean.toFixed(1)} · {alt.fixes ? "reaches the target" : "still short"}
                      </Text>
                    </View>
                    <PressableScale onPress={() => apply(alt)} accessibilityLabel={`Apply: ${alt.title}`} style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}>
                      <CheckCircle2 size={14} color={t.colors.onAccent} />
                      <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.onAccent }}>
                        Apply
                      </Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <View style={card(t)}>
            <SectionTitle title="Map of possible evenings" />
            <EveningGrid screens={SCREENS} beds={grid.beds} cells={grid.cells} selected={sel} usual={usual} target={c.targetQuality} onSelect={(x) => setPick({ screenMin: x.screenMin, bedtime: x.bedtime })} />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              Rows: screens in the last 2 hours. Columns: lights-out. Darker = better predicted sleep; faded = below your target; grey = less sleep than your minimum. Dashed = your usual evening. Drag to explore.
            </Text>
          </View>
          <Animated.View entering={FadeInDown.duration(350)} style={card(t)}>
            <Compare a={usual} b={sel} aLabel="Usual" bLabel="What if" latA={lat(usual).mean} latB={lat(sel).mean} />
            <PressableScale onPress={() => choose(sel)} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}>
              <CheckCircle2 size={14} color={t.colors.onAccent} />
              <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.onAccent }}>
                Use this tonight
              </Text>
            </PressableScale>
          </Animated.View>
        </>
      )}
    </ScrollView>
  );
}

function Compare({ a, b, aLabel, bLabel, latA, latB }: { a: Option; b: Option; aLabel: string; bLabel: string; latA?: number; latB?: number }) {
  const t = useTheme();
  const rows: [string, string, string, number][] = [
    ["Screens", a.screenMin === 0 ? "none" : `${a.screenMin} min`, b.screenMin === 0 ? "none" : `${b.screenMin} min`, 0],
    ["Lights out", clockFromNoon(a.bedtime), clockFromNoon(b.bedtime), 0],
    ["Sleep window", `${(a.sleepMin / 60).toFixed(1)} h`, `${(b.sleepMin / 60).toFixed(1)} h`, 0],
    ["Predicted quality", a.mean.toFixed(1), b.mean.toFixed(1), b.mean - a.mean],
    ["Likely range", `${Math.max(1, a.lo).toFixed(1)}–${Math.min(5, a.hi).toFixed(1)}`, `${Math.max(1, b.lo).toFixed(1)}–${Math.min(5, b.hi).toFixed(1)}`, 0],
  ];
  // Линейная модель может уйти ниже нуля на крайних вечерах — показываем "<5 min".
  const latTxt = (v: number) => (v < 5 ? "<5 min" : `~${v.toFixed(0)} min`);
  if (latA !== undefined && latB !== undefined) rows.push(["Falling asleep", latTxt(latA), latTxt(latB), latA - latB]);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row" }}>
        <Text style={{ flex: 1.3 }} />
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, flex: 1, textAlign: "right" }}>{aLabel}</Text>
        <Text style={{ ...t.typography.overline, color: t.colors.accent, flex: 1, textAlign: "right" }}>{bLabel}</Text>
      </View>
      {rows.map(([l, x, y, d]) => (
        <View key={l} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 2 }}>
          <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1.3 }}>{l}</Text>
          <Text style={{ ...t.typography.label, color: t.colors.inkMuted, flex: 1, textAlign: "right" }}>{x}</Text>
          <Text style={{ ...t.typography.label, color: d > 0.05 ? t.colors.success : d < -0.05 ? t.colors.danger : x !== y ? t.colors.accent : t.colors.ink, flex: 1, textAlign: "right" }}>{y}</Text>
        </View>
      ))}
    </View>
  );
}

function card(t: ReturnType<typeof useTheme>) {
  return { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md } as const;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

import { useMemo, useState } from "react";
import { ScrollView, Text, View, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { heatColor, qualityColor } from "../src/theme/colors";
import { useApp } from "../src/store/appStore";
import { IconButton, SectionTitle } from "../src/components/Bits";
import { Segmented } from "../src/components/Segmented";
import { Heatmap } from "../src/components/Heatmap";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { EmptyState } from "../src/components/EmptyState";
import { complete, isFreeNight } from "../src/lib/nights.ts";
import { avgSleep, points, screenBuckets, streak } from "../src/lib/stats.ts";
import { screenEffect } from "../src/lib/model.ts";
import { addDays } from "../src/lib/time.ts";

type Filter = "all" | "work" | "free";

export default function Stats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { nights, analysis: a } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(() => nights.filter((n) => (filter === "all" ? true : filter === "free" ? isFreeNight(n.date) : !isFreeNight(n.date))), [nights, filter]);

  if (!a || nights.filter(complete).length < 2) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, gap: t.spacing.xl }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <EmptyState title="A few nights first" description="Log an evening and the morning after for a couple of nights — the charts start here." />
      </View>
    );
  }

  const done = shown.filter(complete);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(a.tonight, i - 14));
  const byDate = Object.fromEntries(nights.map((n) => [n.date, n]));
  const avgQ = done.length ? done.reduce((s, n) => s + n.quality!, 0) / done.length : 0;
  const sl = avgSleep(shown);
  const buckets = screenBuckets(shown);
  const pts = points(shown);
  const eff = screenEffect(a.quality, filter === "free");
  const heat = Array.from({ length: 84 }, (_, i) => {
    const d = addDays(a.tonight, i - 83);
    const n = byDate[d];
    return n ? (n.quality != null ? 1 : 0.5) : 0;
  });
  const lat = shown.filter((n) => n.latency != null);
  let k = 0;
  const enter = () => FadeInDown.delay(staggerDelay(k++)).duration(400);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.display, color: t.colors.ink }}>Stats</Text>
      </View>
      <Segmented
        items={[
          { key: "all", label: "All nights" },
          { key: "work", label: "Work nights" },
          { key: "free", label: "Fri & Sat" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <Animated.View entering={enter()} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Tile label="Average sleep quality" value={avgQ} digits={1} suffix=" / 5" />
        <Tile label="Average time asleep" text={sl ? `${Math.floor(sl / 60)}h ${Math.round(sl % 60)}m` : "—"} />
        <Tile label="Nights logged" value={done.length} />
        <Tile label="Logging streak" value={streak(nights.filter((n) => n.quality != null).map((n) => n.date), addDays(a.tonight, -1), (d) => addDays(d, -1))} suffix=" nights" />
      </Animated.View>

      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Last 14 nights" />
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 4 }}>
          {last14.map((d) => {
            const n = byDate[d];
            const q = n?.quality ?? null;
            const s = n?.screenMin ?? null;
            const show = n && (filter === "all" || (filter === "free") === isFreeNight(d));
            return (
              <View key={d} style={{ flex: 1, alignItems: "center", gap: 3, opacity: show ? 1 : 0.25 }}>
                <View style={{ height: q ? (q / 5) * 80 : 2, width: "100%", borderRadius: 4, backgroundColor: q ? qualityColor(q) : t.colors.border }} />
                <View style={{ height: s != null ? Math.max(2, (s / 120) * 20) : 2, width: "60%", borderRadius: 2, backgroundColor: s != null ? t.colors.screen : t.colors.border }} />
                <Text style={{ fontSize: 9, color: t.colors.inkMuted }}>{Number(d.slice(8))}</Text>
              </View>
            );
          })}
        </View>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Tall bars: sleep quality. Amber stubs: screen minutes the evening before.</Text>
      </Animated.View>

      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Screens vs sleep" />
        <Scatter pts={pts.map((p) => ({ x: p.screen, y: p.quality, free: p.free }))} slope={eff.mean} intercept={a.quality.mean[0] + (filter === "free" ? a.quality.mean[3] : 0)} />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
          Each dot is a night. The line is the model's screen effect for {filter === "free" ? "Fri & Sat" : "work"} nights at your usual bedtime: {eff.mean >= 0 ? "+" : "−"}
          {Math.abs(eff.mean).toFixed(2)} per hour {eff.clear ? "(clear)" : "(not clear yet)"}.
        </Text>
      </Animated.View>

      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Average quality by screen time" />
        {buckets.map((b) => (
          <View key={b.label} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row" }}>
              <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>{b.label} min</Text>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{b.mean === null ? "no nights" : `${b.mean.toFixed(1)} · ${b.n} ${b.n === 1 ? "night" : "nights"}`}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.backgroundAlt }}>
              {b.mean !== null ? <View style={{ width: `${(b.mean / 5) * 100}%`, height: 8, borderRadius: 4, backgroundColor: qualityColor(b.mean) }} /> : null}
            </View>
          </View>
        ))}
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Raw averages — late bedtimes are mixed in here. Insights separates the two.</Text>
      </Animated.View>

      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Time to fall asleep" />
        <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end", height: 70 }}>
          {[5, 15, 30, 45, 60].map((m) => {
            const c = lat.filter((n) => n.latency === m).length;
            const max = Math.max(1, ...[5, 15, 30, 45, 60].map((x) => lat.filter((n) => n.latency === x).length));
            return (
              <View key={m} style={{ flex: 1, alignItems: "center", gap: 3 }}>
                <Text style={{ fontSize: 10, color: t.colors.inkMuted }}>{c || ""}</Text>
                <View style={{ height: (c / max) * 44, width: "100%", borderRadius: 4, backgroundColor: t.colors.night }} />
                <Text style={{ fontSize: 10, color: t.colors.inkMuted }}>{m === 60 ? "60+" : `${m}m`}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Animated.View entering={enter()} style={card(t)}>
        <SectionTitle title="Logging · 12 weeks" />
        <Heatmap cells={heat.map((v, i) => ({ key: String(i), intensity: v }))} colorForIntensity={heatColor} cellSize={16} gap={4} />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Dark: full night logged. Light: evening only.</Text>
      </Animated.View>
    </ScrollView>
  );
}

function Scatter({ pts, slope, intercept }: { pts: { x: number; y: number; free: boolean }[]; slope: number; intercept: number }) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const h = 170;
  const pad = 28;
  const X = (m: number) => pad + (m / 120) * (w - pad - 8);
  const Y = (q: number) => 8 + (1 - (q - 1) / 4) * (h - 30);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={h}>
        {[1, 3, 5].map((q) => (
          <SvgText key={q} x={pad - 8} y={Y(q) + 4} fontSize={10} fill={t.colors.inkMuted} textAnchor="end">
            {q}
          </SvgText>
        ))}
        {[0, 60, 120].map((m) => (
          <SvgText key={m} x={X(m)} y={h - 4} fontSize={10} fill={t.colors.inkMuted} textAnchor="middle">
            {m === 0 ? "0 min" : `${m}`}
          </SvgText>
        ))}
        <Line x1={X(0)} x2={X(120)} y1={Y(intercept)} y2={Y(intercept + slope * 2)} stroke={t.colors.accent} strokeWidth={2.5} />
        {pts.map((p, i) => (
          <Circle key={i} cx={X(p.x)} cy={Y(p.y)} r={5} fill={p.free ? t.colors.night : t.colors.screen} fillOpacity={0.75} />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <Key color={t.colors.screen} label="Work night" />
        <Key color={t.colors.night} label="Fri / Sat night" />
      </View>
    </View>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ ...t.typography.caption, color: t.colors.ink }}>{label}</Text>
    </View>
  );
}

function card(t: ReturnType<typeof useTheme>) {
  return { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md } as const;
}

function Tile({ label, value, text, digits = 0, suffix = "" }: { label: string; value?: number; text?: string; digits?: number; suffix?: string }) {
  const t = useTheme();
  return (
    <View style={{ width: "48%", flexGrow: 1, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.md, gap: 2 }}>
      {text !== undefined ? (
        <Text style={{ ...t.typography.title, color: t.colors.ink }}>{text}</Text>
      ) : (
        <AnimatedCounter
          value={value ?? 0}
          formatter={(v) => {
            "worklet";
            return v.toFixed(digits) + suffix;
          }}
          style={{ ...t.typography.title, color: t.colors.ink, padding: 0 }}
        />
      )}
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{label}</Text>
    </View>
  );
}

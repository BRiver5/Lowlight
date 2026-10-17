import { ScrollView, Text, View, type LayoutChangeEvent } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { IconButton, SectionTitle } from "../src/components/Bits";
import { coef, screenEffect, NAMES } from "../src/lib/model.ts";
import { accuracy } from "../src/lib/stats.ts";

// "Что показывают ваши ночи": коэффициенты модели с 90% интервалами
// (лесенка), словами — что надёжно, что пока нет; честность прогнозов.
export default function Insights() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const a = useApp((s) => s.analysis);
  if (!a) return null;
  const n = Math.round(a.quality.n);
  const wk = screenEffect(a.quality, false);
  const fr = screenEffect(a.quality, true);
  const late = coef(a.quality, 2);
  const latS = screenEffect(a.latency, false);
  const acc = accuracy(Object.values(a.fits).sort((x, y) => (x.date < y.date ? -1 : 1)));

  const sentence = (e: { mean: number; lo: number; hi: number; clear: boolean }, unit: string, what: string) =>
    e.clear
      ? `Each hour of ${what} goes with ${Math.abs(e.mean).toFixed(2)} ${unit} ${e.mean < 0 ? "lower" : "higher"} (likely ${Math.abs(e.hi < 0 ? e.hi : e.lo).toFixed(2)}–${Math.abs(e.hi < 0 ? e.lo : e.hi).toFixed(2)}).`
      : `No clear link yet — anywhere from ${e.lo.toFixed(2)} to +${e.hi.toFixed(2)} ${unit} per hour fits your nights.`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.display, color: t.colors.ink }}>What your nights say</Text>
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
        From {n} complete {n === 1 ? "night" : "nights"}; recent weeks count more. Screens and late bedtimes travel together, so each effect below is measured with the other held fixed.
      </Text>

      <Animated.View entering={FadeInDown.duration(400)} style={card(t)}>
        <SectionTitle title="Sleep quality — effect sizes" />
        <Forest
          rows={[1, 2, 3, 4].map((j) => {
            const c = coef(a.quality, j);
            return { label: NAMES[j], ...c };
          })}
        />
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Dots: best estimate in points of the 1–5 scale. Bars: 90% range. A bar crossing the line means "can't tell yet".</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={card(t)}>
        <SectionTitle title="Screens" />
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>Work nights: {sentence(wk, "points of sleep quality", "screens before bed")}</Text>
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>Fri & Sat nights: {sentence(fr, "points", "screens")}</Text>
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>Falling asleep: {sentence(latS, "min", "screens")}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={card(t)}>
        <SectionTitle title="Bedtime" />
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>{sentence(late, "points", "going to bed later than usual")}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(staggerDelay(3)).duration(400)} style={card(t)}>
        <SectionTitle title="How good are the predictions" />
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>
          {acc.mae === null
            ? "After a week of nights, Lowlight checks each evening's prediction against your morning rating."
            : `On ${acc.n} nights, predictions made the evening before were off by ${acc.mae.toFixed(2)} points on average, and ${Math.round((acc.coverage ?? 0) * 100)}% of ratings landed inside the predicted range (aiming for about 90%).`}
        </Text>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>This is about your own patterns, not medical advice. A clear link here is a correlation in your nights — the easiest way to test it is a week with and without screens.</Text>
      </Animated.View>
    </ScrollView>
  );
}

function Forest({ rows }: { rows: { label: string; mean: number; lo: number; hi: number; clear: boolean }[] }) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const lim = Math.max(0.5, ...rows.map((r) => Math.max(Math.abs(r.lo), Math.abs(r.hi))));
  const labelW = 120;
  const X = (v: number) => labelW + ((v + lim) / (2 * lim)) * (w - labelW - 8);
  const rh = 30;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={rows.length * rh + 18}>
        <Line x1={X(0)} x2={X(0)} y1={0} y2={rows.length * rh} stroke={t.colors.ink} strokeWidth={1} />
        {rows.map((r, i) => {
          const y = i * rh + rh / 2;
          const col = r.clear ? (r.mean < 0 ? t.colors.screen : t.colors.night) : t.colors.inkFaint;
          return [
            <SvgText key={`l${i}`} x={0} y={y + 4} fontSize={11} fill={t.colors.ink}>
              {r.label}
            </SvgText>,
            <Line key={`b${i}`} x1={X(r.lo)} x2={X(r.hi)} y1={y} y2={y} stroke={col} strokeWidth={4} strokeLinecap="round" />,
            <Circle key={`c${i}`} cx={X(r.mean)} cy={y} r={6} fill={col} stroke={t.colors.surface} strokeWidth={2} />,
          ];
        })}
        {[-lim, 0, lim].map((v) => (
          <SvgText key={v} x={X(v)} y={rows.length * rh + 14} fontSize={10} fill={t.colors.inkMuted} textAnchor={v < 0 ? "start" : v > 0 ? "end" : "middle"}>
            {v === 0 ? "0" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function card(t: ReturnType<typeof useTheme>) {
  return { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md } as const;
}

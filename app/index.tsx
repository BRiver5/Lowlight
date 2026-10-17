import { useMemo, useRef, useState } from "react";
import { FlatList, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, ChevronRight, Lightbulb, Moon, Settings2, SlidersHorizontal, Smartphone, Sun } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { qualityColor } from "../src/theme/colors";
import { useApp } from "../src/store/appStore";
import { EveningSheet, MorningSheet } from "../src/components/LogSheets";
import { AnimatedRing } from "../src/components/AnimatedRing";
import { IconButton } from "../src/components/Bits";
import { PressableScale } from "../src/components/PressableScale";
import { clockFromNoon, sleepMinutes } from "../src/lib/nights.ts";
import { addDays, dayLabel, weekdayLabel } from "../src/lib/time.ts";
import { haptics } from "../src/services/haptics";
import type { NightRow } from "../src/data/repo";

const PAST = 13;

// Focus Single-Card: одна ночь крупной карточкой, свайп влево/вправо — соседние
// ночи; последняя карточка — сегодняшний вечер с планом.
export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { analysis: a, nights } = useApp();
  const [evening, setEvening] = useState<string | null>(null);
  const [morning, setMorning] = useState<string | null>(null);
  const [page, setPage] = useState(PAST);
  const list = useRef<FlatList<string>>(null);

  const dates = useMemo(() => (a ? Array.from({ length: PAST + 1 }, (_, i) => addDays(a.tonight, i - PAST)) : []), [a?.tonight]);
  const byDate = useMemo(() => Object.fromEntries(nights.map((n) => [n.date, n])), [nights]);
  if (!a) return null;
  const cardW = width - t.spacing.lg * 2;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + t.spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: t.spacing.lg }}>
        <Text style={{ ...t.typography.title, color: t.colors.accent, flex: 1 }}>Lowlight</Text>
        <IconButton label="Tonight's plan" onPress={() => router.push("/plan")}>
          <SlidersHorizontal size={18} color={t.colors.ink} />
        </IconButton>
        <IconButton label="Insights" onPress={() => router.push("/insights")}>
          <Lightbulb size={18} color={t.colors.ink} />
        </IconButton>
        <IconButton label="Stats" onPress={() => router.push("/stats")}>
          <BarChart3 size={18} color={t.colors.ink} />
        </IconButton>
        <IconButton label="Settings" onPress={() => router.push("/settings")}>
          <Settings2 size={18} color={t.colors.ink} />
        </IconButton>
      </View>

      <FlatList
        ref={list}
        data={dates}
        keyExtractor={(d) => d}
        horizontal
        pagingEnabled={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={PAST}
        getItemLayout={(_, i) => ({ length: cardW + t.spacing.md, offset: (cardW + t.spacing.md) * i, index: i })} // смещение прокрутки, при котором карточка i стоит на месте
        snapToOffsets={dates.map((_, i) => (cardW + t.spacing.md) * i)}
        // Разделитель отдельным компонентом: `gap` в contentContainerStyle у
        // горизонтального FlatList не попадает в getItemLayout, и карточки
        // "уезжали" на ширину отступов (поймано на эмуляторе).
        ItemSeparatorComponent={() => <View style={{ width: t.spacing.md }} />}
        contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.lg }}
        onMomentumScrollEnd={(e) => {
          const p = Math.round(e.nativeEvent.contentOffset.x / (cardW + t.spacing.md));
          if (p !== page) haptics.tick();
          setPage(p);
        }}
        renderItem={({ item, index }) =>
          index === PAST ? (
            <TonightCard width={cardW} night={byDate[item]} onEvening={() => setEvening(item)} onMorning={() => setMorning(addDays(item, -1))} lastNight={byDate[addDays(item, -1)]} />
          ) : (
            <NightCard width={cardW} date={item} night={byDate[item]} onEvening={() => setEvening(item)} onMorning={() => setMorning(item)} />
          )
        }
      />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingBottom: insets.bottom + t.spacing.lg }}>
        {dates.map((d, i) => (
          <View key={d} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? t.colors.accent : byDate[d]?.quality != null ? t.colors.inkFaint : t.colors.border }} />
        ))}
      </View>
      <EveningSheet visible={evening !== null} onClose={() => setEvening(null)} date={evening ?? a.tonight} />
      <MorningSheet visible={morning !== null} onClose={() => setMorning(null)} date={morning ?? a.tonight} />
    </View>
  );
}

function TonightCard({ width, night, lastNight, onEvening, onMorning }: { width: number; night?: NightRow; lastNight?: NightRow; onEvening: () => void; onMorning: () => void }) {
  const t = useTheme();
  const a = useApp((s) => s.analysis)!;
  const p = a.plan;
  const opt = a.tonightPlan;
  const needMorning = !lastNight || lastNight.quality === null;
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ width, flex: 1, backgroundColor: t.colors.surface, borderRadius: 28, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.xl, gap: t.spacing.lg }}>
      <View>
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Tonight · {weekdayLabel(a.tonight)}, {dayLabel(a.tonight)}</Text>
        <Text style={{ ...t.typography.display, color: t.colors.ink }}>{a.chosen ? "Your chosen evening" : p.status === "conflict" ? "Best you can do tonight" : "Your evening plan"}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.lg }}>
        <AnimatedRing progress={Math.max(0, Math.min(1, (opt.mean - 1) / 4))} size={120} strokeWidth={10} color={qualityColor(opt.mean)} trackColor={t.colors.backgroundAlt}>
          <Text style={{ ...t.typography.display, color: t.colors.ink }}>{opt.mean.toFixed(1)}</Text>
          <Text style={{ fontSize: 11, color: t.colors.inkMuted }}>predicted</Text>
        </AnimatedRing>
        <View style={{ flex: 1, gap: 10 }}>
          <Row icon={<Smartphone size={16} color={t.colors.screenInk} />} text={opt.screenMin === 0 ? "No screens before bed" : `At most ${opt.screenMin} min of screens after ${clockFromNoon(opt.bedtime - 120)}`} />
          <Row icon={<Moon size={16} color={t.colors.night} />} text={`Lights out ${clockFromNoon(opt.bedtime)} · ${Math.floor(opt.sleepMin / 60)}h ${opt.sleepMin % 60 ? `${opt.sleepMin % 60}m` : ""} until ${clockFromNoon(a.constraints.wake + 720)}`} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {p.status === "learning"
              ? "Still learning — a week of nights makes this personal."
              : p.status === "conflict"
                ? `Target ${a.constraints.targetQuality.toFixed(1)} is out of reach tonight.`
                : `Likely ${opt.lo.toFixed(1)}–${opt.hi.toFixed(1)}; target ${a.constraints.targetQuality.toFixed(1)}.`}
          </Text>
        </View>
      </View>
      <PressableScale onPress={() => router.push("/plan")} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: t.spacing.md, borderRadius: t.radius.md, backgroundColor: t.colors.accentSoft }}>
        <Text style={{ ...t.typography.label, color: t.colors.accent, flex: 1 }}>
          {p.status === "conflict" ? "See why and the ways out" : "Why this plan · try other evenings"}
        </Text>
        <ChevronRight size={16} color={t.colors.accent} />
      </PressableScale>
      <WeekStrip />
      <View style={{ flex: 1 }} />
      <View style={{ gap: 10 }}>
        {needMorning ? (
          <PressableScale onPress={onMorning} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: t.radius.pill, backgroundColor: t.colors.accent }}>
            <Sun size={18} color={t.colors.onAccent} />
            <Text style={{ ...t.typography.subtitle, color: t.colors.onAccent }}>How did last night go?</Text>
          </PressableScale>
        ) : null}
        <PressableScale
          onPress={onEvening}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: t.radius.pill, backgroundColor: needMorning ? t.colors.surfaceAlt : t.colors.accent, borderWidth: needMorning ? 1 : 0, borderColor: t.colors.border }}
        >
          <Moon size={18} color={needMorning ? t.colors.accent : t.colors.onAccent} />
          <Text style={{ ...t.typography.subtitle, color: needMorning ? t.colors.accent : t.colors.onAccent }}>{night?.screenMin != null ? "Edit tonight's evening" : "Log tonight's evening"}</Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

function NightCard({ width, date, night, onEvening, onMorning }: { width: number; date: string; night?: NightRow; onEvening: () => void; onMorning: () => void }) {
  const t = useTheme();
  const fit = useApp((s) => s.analysis?.fits[date]);
  const sleep = night ? sleepMinutes(night) : null;
  return (
    <PressableScale onPress={() => (night ? router.push(`/night/${date}`) : onEvening())} scaleTo={0.99} style={{ width, flex: 1, backgroundColor: t.colors.surface, borderRadius: 28, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.xl, gap: t.spacing.lg }}>
      <View>
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Night after {weekdayLabel(date)}, {dayLabel(date)}</Text>
        <Text style={{ ...t.typography.display, color: night?.quality != null ? t.colors.ink : t.colors.inkFaint }}>{night?.quality != null ? ["Awful", "Poor", "Okay", "Good", "Great"][Math.round(night.quality) - 1] : "Not logged"}</Text>
      </View>
      {night?.quality != null ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.lg }}>
          <AnimatedRing progress={(night.quality - 1) / 4} size={110} strokeWidth={10} color={qualityColor(night.quality)} trackColor={t.colors.backgroundAlt}>
            <Text style={{ ...t.typography.display, color: t.colors.ink }}>{night.quality.toFixed(0)}</Text>
            <Text style={{ fontSize: 11, color: t.colors.inkMuted }}>of 5</Text>
          </AnimatedRing>
          <View style={{ flex: 1, gap: 8 }}>
            {night.screenMin != null ? <Row icon={<Smartphone size={16} color={t.colors.screenInk} />} text={`${night.screenMin} min of screens before bed`} /> : null}
            {night.bedtime != null ? <Row icon={<Moon size={16} color={t.colors.night} />} text={`Lights out ${clockFromNoon(night.bedtime)}${sleep ? ` · slept ~${Math.floor(sleep / 60)}h ${sleep % 60}m` : ""}`} /> : null}
            {fit ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Predicted {fit.predicted.toFixed(1)} that evening — {Math.abs(fit.actual - fit.predicted) < 0.5 ? "about right" : fit.actual > fit.predicted ? "you slept better" : "you slept worse"}.</Text> : null}
          </View>
        </View>
      ) : (
        <Text style={{ ...t.typography.body, color: t.colors.inkMuted }}>Missed nights are fine — log what you remember, or leave it blank.</Text>
      )}
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <PressableScale onPress={onEvening} style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border }}>
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>{night?.screenMin != null ? "Edit evening" : "Log evening"}</Text>
        </PressableScale>
        <PressableScale onPress={onMorning} style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border }}>
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>{night?.quality != null ? "Edit morning" : "Log morning"}</Text>
        </PressableScale>
      </View>
      {night ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Tap the card for the breakdown</Text> : null}
    </PressableScale>
  );
}

// Последние 7 ночей мини-столбцами: высота — качество, янтарь снизу — экран.
function WeekStrip() {
  const t = useTheme();
  const { nights, analysis: a } = useApp();
  if (!a) return null;
  const byDate = Object.fromEntries(nights.map((n) => [n.date, n]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(a.tonight, i - 7));
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Last 7 nights</Text>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-end", height: 86 }}>
        {days.map((d) => {
          const n = byDate[d];
          const q = n?.quality ?? null;
          return (
            <View key={d} style={{ flex: 1, alignItems: "center", gap: 3 }}>
              <View style={{ width: "100%", height: q ? (q / 5) * 52 : 3, borderRadius: 5, backgroundColor: q ? qualityColor(q) : t.colors.border }} />
              <View style={{ width: "55%", height: n?.screenMin != null ? Math.max(2, (n.screenMin / 120) * 12) : 2, borderRadius: 2, backgroundColor: n?.screenMin != null ? t.colors.screen : t.colors.border }} />
              <Text style={{ fontSize: 10, color: t.colors.inkMuted }}>{weekdayLabel(d).slice(0, 2)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {icon}
      <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{text}</Text>
    </View>
  );
}

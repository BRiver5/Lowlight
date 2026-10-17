import { useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { staggerDelay } from "../../src/theme/motion";
import { qualityColor } from "../../src/theme/colors";
import { useApp } from "../../src/store/appStore";
import { actions } from "../../src/store/actions";
import { Chip, IconButton, SectionTitle, Stepper } from "../../src/components/Bits";
import { EveningSheet, MorningSheet } from "../../src/components/LogSheets";
import { EmptyState } from "../../src/components/EmptyState";
import { clock, clockFromNoon, isFreeNight, sleepMinutes } from "../../src/lib/nights.ts";
import { dayLabel, weekdayLabel } from "../../src/lib/time.ts";

const LABELS = ["Your baseline", "Screens", "Late bedtime", "Free night", "Free-night screens"];

export default function NightScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { nights, analysis } = useApp();
  const n = nights.find((x) => x.date === date);
  const fit = analysis?.fits[date ?? ""];
  const [ev, setEv] = useState(false);
  const [mo, setMo] = useState(false);
  const [note, setNote] = useState(n?.note ?? "");

  if (!n || !analysis) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, gap: 16 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <EmptyState title="Nothing logged for this night" description="It may have been deleted." />
      </View>
    );
  }
  const sleep = sleepMinutes(n);
  const max = fit ? Math.max(0.3, ...fit.parts.slice(1).map((v) => Math.abs(v)), Math.abs(fit.actual - fit.predicted)) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IconButton label="Back" onPress={() => router.back()}>
            <ArrowLeft size={18} color={t.colors.ink} />
          </IconButton>
          <Text style={{ ...t.typography.title, color: t.colors.ink, flex: 1 }}>
            {weekdayLabel(date)}, {dayLabel(date)}
          </Text>
          {isFreeNight(date) ? <Chip label="Free night" active={false} onPress={() => {}} /> : null}
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={card(t)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: n.quality != null ? qualityColor(n.quality) : t.colors.backgroundAlt, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...t.typography.title, color: t.colors.onAccent }}>{n.quality ?? "–"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>
                {n.screenMin ?? "–"} min screens · lights out {n.bedtime != null ? clockFromNoon(n.bedtime) : "–"}
              </Text>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                {n.latency != null ? `${n.latency} min to fall asleep · ` : ""}
                {n.wakeups != null ? `woke ${n.wakeups === 0 ? "not once" : `${n.wakeups}×`} · ` : ""}
                {n.wake != null ? `up at ${clock(n.wake)}` : ""}
                {sleep ? ` · ~${Math.floor(sleep / 60)}h ${sleep % 60}m asleep` : ""}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Edit evening" active={false} onPress={() => setEv(true)} />
            <Chip label="Edit morning" active={false} onPress={() => setMo(true)} />
          </View>
        </Animated.View>

        {fit ? (
          <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={card(t)}>
            <SectionTitle title="Why this night went the way it did" />
            <Text style={{ ...t.typography.body, color: t.colors.ink }}>
              That evening the model expected {fit.predicted.toFixed(1)} (likely {Math.max(1, fit.lo).toFixed(1)}–{Math.min(5, fit.hi).toFixed(1)}); you rated it {fit.actual}.
            </Text>
            {fit.parts.map((v, i) =>
              i === 0 ? (
                <Bar key={i} label={`${LABELS[0]} · ${v.toFixed(2)}`} v={0} max={max} />
              ) : Math.abs(v) < 0.005 && i >= 3 ? null : (
                <Bar key={i} label={`${LABELS[i]} ${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}${i === 2 ? ` (${fit.late >= 0 ? "+" : "−"}${Math.abs(fit.late * 60).toFixed(0)} min vs usual)` : ""}`} v={v} max={max} />
              ),
            )}
            <Bar label={`Everything else ${fit.actual - fit.predicted >= 0 ? "+" : "−"}${Math.abs(fit.actual - fit.predicted).toFixed(2)}`} v={fit.actual - fit.predicted} max={max} muted />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              Contributions from the model as it stood that evening, before this night was added. "Everything else" is what screens and bedtime don't explain — stress, caffeine, noise, luck.
            </Text>
          </Animated.View>
        ) : (
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Log both the evening and the morning to see this night's breakdown.</Text>
        )}

        <View style={card(t)}>
          <SectionTitle title="Note" />
          <TextInput
            value={note}
            onChangeText={setNote}
            onEndEditing={() => note !== n.note && actions.saveNight(n.date, { note: note.trim() })}
            placeholder="Late coffee, noisy street, new pillow…"
            placeholderTextColor={t.colors.inkFaint}
            multiline
            style={{ ...t.typography.body, color: t.colors.ink, minHeight: 44 }}
          />
          {n.quality != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...t.typography.body, color: t.colors.ink }}>Rating</Text>
              <Stepper value={n.quality} onChange={(v) => actions.saveNight(n.date, { quality: v })} min={1} max={5} />
            </View>
          ) : null}
        </View>

        <Chip
          label="Delete this night"
          active={false}
          icon={<Trash2 size={14} color={t.colors.danger} />}
          onPress={() =>
            Alert.alert("Delete this night?", "Its evening and morning are removed and the model is rebuilt without it.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  router.back();
                  await actions.deleteNight(n.date);
                },
              },
            ])
          }
        />
      </ScrollView>
      <EveningSheet visible={ev} onClose={() => setEv(false)} date={n.date} />
      <MorningSheet visible={mo} onClose={() => setMo(false)} date={n.date} />
    </View>
  );
}

function Bar({ label, v, max, muted }: { label: string; v: number; max: number; muted?: boolean }) {
  const t = useTheme();
  const w = Math.min(50, (Math.abs(v) / max) * 50);
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ ...t.typography.caption, color: t.colors.ink }}>{label}</Text>
      <View style={{ height: 10, flexDirection: "row", backgroundColor: t.colors.backgroundAlt, borderRadius: 5 }}>
        <View style={{ width: "50%", alignItems: "flex-end" }}>{v < 0 ? <View style={{ width: `${w * 2}%`, height: 10, borderRadius: 5, backgroundColor: muted ? t.colors.inkFaint : t.colors.screen }} /> : null}</View>
        <View style={{ width: 2, backgroundColor: t.colors.ink }} />
        <View style={{ flex: 1 }}>{v > 0 ? <View style={{ width: `${w * 2}%`, height: 10, borderRadius: 5, backgroundColor: muted ? t.colors.inkFaint : t.colors.night }} /> : null}</View>
      </View>
    </View>
  );
}

function card(t: ReturnType<typeof useTheme>) {
  return { backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md } as const;
}

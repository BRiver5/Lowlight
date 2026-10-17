import { Alert, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { actions } from "../src/store/actions";
import { Chip, IconButton, SectionTitle, Stepper } from "../src/components/Bits";
import { Toggle } from "../src/components/Toggle";
import { remindersAvailable, requestReminderPermission } from "../src/services/reminders";
import { setHapticsEnabled } from "../src/services/haptics";
import { clock } from "../src/lib/nights.ts";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const s = useApp((x) => x.settings);

  const toggle = async (key: "eveningReminder" | "morningReminder", on: boolean) => {
    if (on && !(await requestReminderPermission())) {
      Alert.alert("Notifications are off", remindersAvailable ? "Allow notifications for Lowlight in system settings." : "Reminders work in the installed app, not in Expo Go.");
      return;
    }
    actions.setSetting(key, on);
  };
  const setWake = (i: number, v: number) => {
    const next = [...s.wake];
    next[i] = v;
    actions.setSetting("wake", next);
  };

  const groups: { title: string; body: React.ReactNode }[] = [
    {
      title: "Wake-up times",
      body: (
        <>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>When you get up on each day — the plan keeps your minimum sleep before it.</Text>
          {WD.map((d, i) => (
            <View key={d} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...t.typography.body, color: t.colors.ink }}>{d}</Text>
              <Stepper value={s.wake[i]} onChange={(v) => setWake(i, v)} min={240} max={780} step={15} format={clock} />
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Weekdays like Monday" active={false} onPress={() => actions.setSetting("wake", s.wake.map((v, i) => (i < 5 ? s.wake[0] : v)))} />
          </View>
        </>
      ),
    },
    {
      title: "Reminders",
      body: (
        <>
          <Row title="Two hours before lights out" hint={remindersAvailable ? "With tonight's screen allowance." : "Works in the installed app; Expo Go can't schedule them."}>
            <Toggle value={s.eveningReminder} onValueChange={(v) => toggle("eveningReminder", v)} />
          </Row>
          <Row title="Morning check-in" hint="15 minutes after your wake-up time.">
            <Toggle value={s.morningReminder} onValueChange={(v) => toggle("morningReminder", v)} />
          </Row>
        </>
      ),
    },
    {
      title: "Feel",
      body: (
        <Row title="Haptics" hint="Taps on ratings, steppers and the evening map">
          <Toggle
            value={s.haptics}
            onValueChange={(v) => {
              setHapticsEnabled(v);
              actions.setSetting("haptics", v);
            }}
          />
        </Row>
      ),
    },
    {
      title: "How Lowlight works",
      body: (
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, lineHeight: 19 }}>
          You log how much screen time you had in the two hours before bed and when you turned the light off, then how the night felt. Lowlight fits a small Bayesian model that weighs screens and late bedtimes at the same time, with Friday and Saturday nights allowed to differ, and updates it every night. It only calls an effect clear when the range rules out zero. Screen time is entered by hand — Lowlight has no access to your phone's usage data. Not medical advice.
        </Text>
      ),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingTop: insets.top + t.spacing.md, paddingHorizontal: t.spacing.lg, paddingBottom: insets.bottom + 40, gap: t.spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ArrowLeft size={18} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.display, color: t.colors.ink }}>Settings</Text>
      </View>
      {groups.map((g, i) => (
        <Animated.View key={g.title} entering={FadeInDown.delay(staggerDelay(i)).duration(400)} style={{ gap: 8 }}>
          <SectionTitle title={g.title} />
          <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.lg, gap: t.spacing.md }}>{g.body}</View>
        </Animated.View>
      ))}
      <Chip
        label="Erase everything"
        active={false}
        icon={<Trash2 size={14} color={t.colors.danger} />}
        onPress={() =>
          Alert.alert("Erase everything?", "All nights and everything Lowlight learned. This can't be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Erase", style: "destructive", onPress: () => actions.resetAll() },
          ])
        }
      />
      <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Everything stays on this phone. No account, no network.</Text>
    </ScrollView>
  );
}

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{title}</Text>
        {hint ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

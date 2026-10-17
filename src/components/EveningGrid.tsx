import { useRef, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useTheme } from "../theme";
import { qualityColor } from "../theme/colors";
import { clockFromNoon } from "../lib/nights.ts";
import { haptics } from "../services/haptics";

export type GridCell = { screenMin: number; bedtime: number; mean: number; ok: boolean };

// Карта вечеров: по горизонтали — время отбоя, по вертикали — экран за 2 ч до
// сна. Цвет — прогноз качества сна; серые клетки нарушают ваш минимум сна.
// Палец по карте выбирает вечер (с тиком на каждой клетке); обведены ваш
// обычный вечер (пунктир) и выбранный.
export function EveningGrid({
  screens,
  beds,
  cells,
  selected,
  usual,
  target,
  onSelect,
}: {
  screens: number[];
  beds: number[];
  cells: GridCell[];
  selected: { screenMin: number; bedtime: number } | null;
  usual: { screenMin: number; bedtime: number };
  target: number;
  onSelect: (c: GridCell) => void;
}) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const labelW = 46;
  const cw = (w - labelW) / beds.length;
  const ch = 26;
  const last = useRef<string | null>(null);
  const at = (x: number, y: number) => {
    const bi = Math.floor((x - labelW) / cw);
    const si = Math.floor(y / ch);
    if (bi < 0 || bi >= beds.length || si < 0 || si >= screens.length) return;
    const cell = cells.find((c) => c.bedtime === beds[bi] && c.screenMin === screens[si]);
    if (!cell) return;
    const key = `${cell.screenMin}-${cell.bedtime}`;
    if (key !== last.current) {
      last.current = key;
      haptics.tick();
      onSelect(cell);
    }
  };
  const reset = () => {
    last.current = null;
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(at)(e.x, e.y))
    .onUpdate((e) => runOnJS(at)(e.x, e.y))
    .onFinalize(() => runOnJS(reset)());
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ gap: 4 }}>
      <GestureDetector gesture={pan}>
        <View>
          {screens.map((s) => (
            <View key={s} style={{ flexDirection: "row", height: ch, alignItems: "center" }}>
              <Text style={{ width: labelW, fontSize: 10, color: t.colors.inkMuted }}>{s === 0 ? "none" : `${s}m`}</Text>
              {beds.map((b) => {
                const c = cells.find((x) => x.bedtime === b && x.screenMin === s);
                const sel = selected && selected.bedtime === b && selected.screenMin === s;
                const us = usual.bedtime === b && usual.screenMin === s;
                return (
                  <View
                    key={b}
                    style={{
                      width: cw - 2,
                      height: ch - 2,
                      margin: 1,
                      borderRadius: 4,
                      backgroundColor: c && c.ok ? qualityColor(c.mean) : t.colors.backgroundAlt,
                      opacity: c && c.ok ? (c.mean >= target ? 1 : 0.45) : 1,
                      borderWidth: sel ? 2.5 : us ? 1.5 : 0,
                      borderColor: sel ? t.colors.ink : t.colors.inkMuted,
                      borderStyle: us && !sel ? "dashed" : "solid",
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </GestureDetector>
      <View style={{ flexDirection: "row", marginLeft: labelW }}>
        {beds.map((b, i) => (
          <Text key={b} style={{ width: cw, fontSize: 9, color: t.colors.inkMuted, textAlign: "center" }}>
            {i % 2 === 0 ? clockFromNoon(b) : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

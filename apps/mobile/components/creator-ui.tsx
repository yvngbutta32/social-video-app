import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/use-colors";

export function Eyebrow({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.eyebrow, { color: colors.primary }]}>{children}</Text>;
}

export function CreatorCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.background }, style]}>{children}</View>;
}

export function StatusPill({ tone, children }: { tone: "ready" | "attention" | "muted" | "accent"; children: ReactNode }) {
  const colors = useColors();
  const palette = {
    ready: { background: `${colors.success}20`, foreground: colors.success },
    attention: { background: `${colors.warning}24`, foreground: colors.warning },
    muted: { background: `${colors.border}A0`, foreground: colors.muted },
    accent: { background: `${colors.primary}22`, foreground: colors.primary },
  }[tone];
  return <View style={[styles.pill, { backgroundColor: palette.background, borderColor: `${palette.foreground}32` }]}><Text style={[styles.pillText, { color: palette.foreground }]}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.45, textTransform: "uppercase" },
  card: { borderWidth: 1, borderRadius: 26, padding: 18, gap: 12, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 3 },
  pill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
});

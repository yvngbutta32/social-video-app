import { type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/use-colors";

export function Eyebrow({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.eyebrow, { color: colors.primary }]}>{children}</Text>;
}

export function CreatorCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

export function StatusPill({ tone, children }: { tone: "ready" | "attention" | "muted" | "accent"; children: ReactNode }) {
  const colors = useColors();
  const palette = {
    ready: { background: `${colors.success}20`, foreground: colors.success },
    attention: { background: `${colors.warning}24`, foreground: colors.warning },
    muted: { background: `${colors.border}A0`, foreground: colors.muted },
    accent: { background: `${colors.primary}22`, foreground: colors.primary },
  }[tone];
  return <View style={[styles.pill, { backgroundColor: palette.background }]}><Text style={[styles.pillText, { color: palette.foreground }]}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: "800" },
});

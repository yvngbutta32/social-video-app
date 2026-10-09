import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
import { useOfflineMode } from "@/lib/offline-mode";

export default function SettingsScreen() {
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();
  const { offlineMode, effectiveOffline, setOfflineMode } = useOfflineMode();
  const [privateReview, setPrivateReview] = useState(true);
  const [haptics, setHaptics] = useState(true);

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={({ pressed }) => [styles.back, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable>
          <View style={styles.headerCopy}><Eyebrow>Workspace controls</Eyebrow><Text style={[styles.title, { color: colors.foreground }]}>Settings</Text></View>
        </View>
        <Text style={[styles.copy, { color: colors.muted }]}>Shape how ViralBoost behaves on this device. These preferences do not publish, share, or change platform permissions.</Text>

        <CreatorCard style={styles.card}>
          <View style={styles.sectionHeading}><View style={[styles.sectionIcon, { backgroundColor: `${colors.warning}18` }]}><IconSymbol name="waveform" size={21} color={colors.warning} /></View><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Offline workspace</Text><Text style={[styles.cardCopy, { color: colors.muted }]}>{effectiveOffline ? "Local editing is active. Changes are saved on this device." : "Keep editing available when the private API is unreachable."}</Text></View></View>
          <View style={[styles.option, { borderColor: colors.border }]}><View style={styles.flex}><Text style={[styles.optionTitle, { color: colors.foreground }]}>Use offline mode</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Imports, recipes, platform targets, briefs, and caption edits stay local. Upload, sync, rendering, and publishing remain paused until you reconnect.</Text></View><Switch value={offlineMode} onValueChange={setOfflineMode} trackColor={{ false: colors.border, true: `${colors.warning}99` }} thumbColor={offlineMode ? colors.warning : colors.muted} /></View>
        </CreatorCard>

        <CreatorCard style={styles.card}>
          <View style={styles.sectionHeading}><View style={[styles.sectionIcon, { backgroundColor: `${colors.primary}18` }]}><IconSymbol name="gearshape.fill" size={21} color={colors.primary} /></View><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Appearance</Text><Text style={[styles.cardCopy, { color: colors.muted }]}>Choose the viewing mode for your private studio.</Text></View></View>
          <View style={[styles.option, { borderColor: colors.border }]}><View style={styles.flex}><Text style={[styles.optionTitle, { color: colors.foreground }]}>Dark interface</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Use the current dark workspace palette.</Text></View><Switch value={colorScheme === "dark"} onValueChange={(value) => setColorScheme(value ? "dark" : "light")} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={colorScheme === "dark" ? colors.primary : colors.muted} /></View>
        </CreatorCard>

        <CreatorCard style={styles.card}>
          <View style={styles.sectionHeading}><View style={[styles.sectionIcon, { backgroundColor: `${colors.success}18` }]}><IconSymbol name="lock.shield.fill" size={21} color={colors.success} /></View><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Privacy defaults</Text><Text style={[styles.cardCopy, { color: colors.muted }]}>Keep creator review and media handling explicit.</Text></View></View>
          <View style={[styles.option, { borderColor: colors.border }]}><View style={styles.flex}><Text style={[styles.optionTitle, { color: colors.foreground }]}>Private review by default</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Require an intentional action before loading a private artifact preview.</Text></View><Switch value={privateReview} onValueChange={setPrivateReview} trackColor={{ false: colors.border, true: `${colors.success}99` }} thumbColor={privateReview ? colors.success : colors.muted} /></View>
        </CreatorCard>

        <CreatorCard style={styles.card}>
          <View style={styles.sectionHeading}><View style={[styles.sectionIcon, { backgroundColor: `${colors.warning}18` }]}><IconSymbol name="waveform" size={21} color={colors.warning} /></View><View style={styles.flex}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Interaction</Text><Text style={[styles.cardCopy, { color: colors.muted }]}>Keep feedback helpful without adding noise.</Text></View></View>
          <View style={[styles.option, { borderColor: colors.border }]}><View style={styles.flex}><Text style={[styles.optionTitle, { color: colors.foreground }]}>Haptic feedback</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Use light feedback for important creator actions.</Text></View><Switch value={haptics} onValueChange={setHaptics} trackColor={{ false: colors.border, true: `${colors.warning}99` }} thumbColor={haptics ? colors.warning : colors.muted} /></View>
        </CreatorCard>

        <Text style={[styles.footer, { color: colors.muted }]}>Workspace authorization, connected platforms, and publishing approvals remain controlled by the authorized workspace—not by these local preferences.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingTop: 22, paddingBottom: 36 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerCopy: { gap: 3 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "900", letterSpacing: -0.9 },
  copy: { fontSize: 14, lineHeight: 22 },
  card: { gap: 15, padding: 18 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionIcon: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 17, fontWeight: "900" },
  cardCopy: { fontSize: 12, lineHeight: 18 },
  option: { minHeight: 70, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 12 },
  optionTitle: { fontSize: 14, fontWeight: "900" },
  optionNote: { fontSize: 12, lineHeight: 17 },
  footer: { fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});

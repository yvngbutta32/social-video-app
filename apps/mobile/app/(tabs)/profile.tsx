import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { isViralBoostApiConfigured } from "@/lib/viralboost-api";

export default function ProfileScreen() {
  const colors = useColors();
  const apiConfigured = isViralBoostApiConfigured();
  return (
    <ScreenContainer className="px-5" safeAreaClassName="pt-2">
      <View style={styles.content}>
        <Eyebrow>Private by design</Eyebrow>
        <Text style={[styles.title, { color: colors.foreground }]}>Your creator workspace</Text>
        <CreatorCard style={styles.card}>
          <View style={[styles.icon, { backgroundColor: `${colors.success}1E` }]}><IconSymbol name="lock.shield.fill" size={28} color={colors.success} /></View>
          <StatusPill tone="accent">INVITE-ONLY</StatusPill>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Creator control stays with you.</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>Original media, adaptations, approval decisions, and any connected platform permissions belong to your authorized workspace. A platform owner may have read-only oversight but cannot edit or publish for you.</Text>
        </CreatorCard>
        <CreatorCard>
          <Text style={[styles.itemTitle, { color: colors.foreground }]}>Mobile session</Text>
          <StatusPill tone={apiConfigured ? "ready" : "attention"}>{apiConfigured ? "API BUILD CONFIGURED" : "API BUILD NOT CONFIGURED"}</StatusPill>
          <Text style={[styles.copy, { color: colors.muted }]}>{apiConfigured ? "This build can request an invited workspace session and stores only small session credentials in the device Keychain or Android Keystore." : "This local build supports private media preparation, but a production ViralBoost API URL is required before it can connect to an invited workspace or upload media."}</Text>
          <Pressable onPress={() => router.push("/sign-in" as never)} style={({ pressed }) => [styles.connect, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.connectText, { color: colors.foreground }]}>{apiConfigured ? "Connect invited workspace" : "View connection requirements"}</Text></Pressable>
          {apiConfigured ? <Pressable onPress={() => router.push("/workspace-selector" as never)} style={({ pressed }) => [styles.connect, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.connectText, { color: colors.foreground }]}>Choose active workspace</Text></Pressable> : null}
        </CreatorCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { gap: 14, paddingTop: 18 }, title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 }, card: { gap: 12 }, icon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" }, cardTitle: { fontSize: 19, fontWeight: "800" }, itemTitle: { fontSize: 16, fontWeight: "800" }, copy: { fontSize: 14, lineHeight: 21 }, connect: { height: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, connectText: { fontSize: 14, fontWeight: "800" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

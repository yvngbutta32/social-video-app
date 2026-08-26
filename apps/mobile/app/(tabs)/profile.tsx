import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getWorkspaceActivity, isViralBoostApiConfigured } from "@/lib/viralboost-api";
import { type WorkspaceActivityEvent, workspaceActivityLabel } from "@/lib/workspace-activity-contract";

export default function ProfileScreen() {
  const colors = useColors();
  const apiConfigured = isViralBoostApiConfigured();
  const [activity, setActivity] = useState<WorkspaceActivityEvent[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const refreshActivity = useCallback(async () => {
    if (!apiConfigured) return;
    setActivityLoading(true); setActivityError(null);
    try { setActivity(await getWorkspaceActivity()); }
    catch (error) { setActivityError(error instanceof Error ? error.message : "Workspace activity could not be loaded."); }
    finally { setActivityLoading(false); }
  }, [apiConfigured]);
  useEffect(() => { void refreshActivity(); }, [refreshActivity]);
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
        <CreatorCard style={styles.card}>
          <View style={styles.activityHeader}><Text style={[styles.itemTitle, { color: colors.foreground }]}>Workspace activity</Text><Pressable onPress={() => void refreshActivity()} disabled={activityLoading} style={({ pressed }) => [styles.refresh, { borderColor: colors.border }, (pressed || activityLoading) && styles.pressed]}>{activityLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>}</Pressable></View>
          <Text style={[styles.copy, { color: colors.muted }]}>This timeline includes only authorized creator-relevant activity. It never exposes other members’ private session details.</Text>
          {activity.map((event) => <View key={`${event.action}-${event.createdAt}`} style={[styles.activityRow, { borderColor: colors.border }]}><View><Text style={[styles.activityTitle, { color: colors.foreground }]}>{workspaceActivityLabel(event.action)}</Text><Text style={[styles.activityMeta, { color: colors.muted }]}>{new Date(event.createdAt).toLocaleString()}</Text></View><StatusPill tone="muted">RECORDED</StatusPill></View>)}
          {!activityLoading && !activity.length && !activityError ? <Text style={[styles.copy, { color: colors.muted }]}>No creator-relevant activity has been recorded in this workspace yet.</Text> : null}
          {activityError ? <Text style={[styles.activityError, { color: colors.warning }]}>{activityError}</Text> : null}
        </CreatorCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { gap: 14, paddingTop: 18 }, title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 }, card: { gap: 12 }, icon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" }, cardTitle: { fontSize: 19, fontWeight: "800" }, itemTitle: { fontSize: 16, fontWeight: "800" }, copy: { fontSize: 14, lineHeight: 21 }, connect: { height: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, connectText: { fontSize: 14, fontWeight: "800" }, activityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, refresh: { minWidth: 72, height: 34, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" }, refreshText: { fontSize: 12, fontWeight: "800" }, activityRow: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, activityTitle: { fontSize: 14, fontWeight: "800" }, activityMeta: { marginTop: 3, fontSize: 11, fontWeight: "600" }, activityError: { fontSize: 12, lineHeight: 18, fontWeight: "700" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { type AuthorizedWorkspace } from "@/lib/mobile-auth-contract";
import { getAuthorizedWorkspaces, selectViralBoostWorkspace } from "@/lib/viralboost-api";

export default function WorkspaceSelectorScreen() {
  const colors = useColors();
  const [workspaces, setWorkspaces] = useState<AuthorizedWorkspace[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setNotice(null);
    try { setWorkspaces(await getAuthorizedWorkspaces()); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Your authorized workspaces could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const select = async (workspace: AuthorizedWorkspace) => {
    setBusyId(workspace.id); setNotice(null);
    try { await selectViralBoostWorkspace(workspace.id); router.back(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "This workspace could not be selected."); }
    finally { setBusyId(null); }
  };

  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><View style={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View><Eyebrow>Authorized workspaces</Eyebrow><Text style={[styles.title, { color: colors.foreground }]}>Choose your workspace</Text></View></View>
    <CreatorCard style={styles.card}><StatusPill tone="accent">EXPLICIT SELECTION</StatusPill><Text style={[styles.copy, { color: colors.muted }]}>Only workspaces returned by your private invited session appear here. Switching changes the workspace scope for sources, edits, previews, and outcome data; it does not alter or move any media.</Text></CreatorCard>
    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[styles.copy, { color: colors.muted }]}>Loading authorized workspaces…</Text></View> : null}
    {!loading && workspaces.map((workspace) => <Pressable key={workspace.id} onPress={() => void select(workspace)} disabled={Boolean(busyId)} style={({ pressed }) => [styles.workspace, { borderColor: colors.border, backgroundColor: colors.surface }, (pressed || busyId === workspace.id) && styles.pressed]}><View style={styles.workspaceText}><Text style={[styles.workspaceName, { color: colors.foreground }]}>{workspace.name}</Text><Text style={[styles.workspaceMeta, { color: colors.muted }]}>{workspace.slug ? `@${workspace.slug}` : "Authorized creator workspace"}</Text></View>{busyId === workspace.id ? <ActivityIndicator color={colors.primary} /> : <IconSymbol name="chevron.right" size={19} color={colors.primary} />}</Pressable>)}
    {notice ? <CreatorCard><Text style={[styles.notice, { color: colors.warning }]}>{notice}</Text><Pressable onPress={() => void load()} style={({ pressed }) => [styles.retry, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.retryText, { color: colors.foreground }]}>Refresh workspaces</Text></Pressable></CreatorCard> : null}
  </View></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 16, gap: 14 }, header: { flexDirection: "row", alignItems: "center", gap: 12 }, back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, title: { marginTop: 3, fontSize: 23, fontWeight: "800" }, card: { gap: 10 }, copy: { fontSize: 14, lineHeight: 21 }, loading: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 12 }, workspace: { minHeight: 68, borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, workspaceText: { flex: 1, paddingRight: 12 }, workspaceName: { fontSize: 16, fontWeight: "800" }, workspaceMeta: { marginTop: 3, fontSize: 12, fontWeight: "600" }, notice: { fontSize: 13, lineHeight: 19, fontWeight: "700" }, retry: { height: 44, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" }, retryText: { fontSize: 14, fontWeight: "800" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

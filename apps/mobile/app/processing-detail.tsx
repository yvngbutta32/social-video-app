import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCreatorWorkflow } from "@/lib/creator-workflow";
import { processingStateTitle, type ProcessingDiagnostic } from "@/lib/processing-contract";
import { getProcessingDiagnostic, retryProcessing } from "@/lib/viralboost-api";

export default function ProcessingDetailScreen() {
  const colors = useColors();
  const { selectedSourceId, sources, updateSource } = useCreatorWorkflow();
  const source = useMemo(() => sources.find((item) => item.id === selectedSourceId) ?? null, [selectedSourceId, sources]);
  const [diagnostic, setDiagnostic] = useState<ProcessingDiagnostic | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!source?.serverVideoId) return;
    setLoading(true);
    setNotice(null);
    try {
      const result = await getProcessingDiagnostic(source.serverVideoId);
      setDiagnostic(result.diagnostic);
      const sourceStatus = result.diagnostic.state === "ready"
        ? "ready"
        : result.diagnostic.state === "failed" || result.diagnostic.state === "dispatch_failed"
          ? "failed"
          : "processing";
      updateSource(source.id, { status: sourceStatus });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The processing status is not available right now.");
    } finally { setLoading(false); }
  }, [source, updateSource]);

  useEffect(() => { void refresh(); }, [refresh]);

  const retry = async () => {
    if (!source?.serverVideoId || !diagnostic?.retry.allowed) return;
    setRetrying(true);
    setNotice(null);
    try {
      await retryProcessing(source.serverVideoId);
      updateSource(source.id, { status: "processing", uploadError: undefined });
      setNotice("Processing was queued again. Your original source and saved edit recipe remain unchanged.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Processing could not be requeued right now.");
    } finally { setRetrying(false); }
  };

  if (!source?.serverVideoId) {
    return <ScreenContainer className="p-6" edges={["top", "bottom", "left", "right"]}><Text style={[styles.empty, { color: colors.foreground }]}>Upload this source to your private workspace before checking its processing status.</Text><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={{ color: colors.foreground, fontWeight: "800" }}>Back to Library</Text></Pressable></ScreenContainer>;
  }

  const tone = diagnostic?.state === "ready" ? "ready" : diagnostic?.state === "failed" || diagnostic?.state === "dispatch_failed" ? "attention" : "accent";
  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View><Eyebrow>Private processing</Eyebrow><Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>{source.name}</Text></View></View>
    <CreatorCard><StatusPill tone={tone}>{diagnostic ? diagnostic.state.toUpperCase().replace("_", " ") : "STATUS CHECK"}</StatusPill><Text style={[styles.cardTitle, { color: colors.foreground }]}>{diagnostic ? processingStateTitle(diagnostic.state) : "Checking your secure workspace"}</Text><Text style={[styles.copy, { color: colors.muted }]}>{diagnostic ? diagnostic.issue.message : "Processing details are loaded only from your authorized workspace."}</Text>{diagnostic?.percent !== null && diagnostic?.percent !== undefined ? <View style={[styles.progressTrack, { backgroundColor: colors.border }]}><View style={[styles.progressValue, { backgroundColor: colors.primary, width: `${Math.max(0, Math.min(100, diagnostic.percent))}%` }]} /></View> : null}</CreatorCard>
    {diagnostic ? <CreatorCard><Text style={[styles.itemTitle, { color: colors.foreground }]}>Safe next step</Text><Text style={[styles.copy, { color: colors.muted }]}>{diagnostic.retry.recommendedAction}</Text><Text style={[styles.retryMeta, { color: colors.muted }]}>{diagnostic.retry.remainingManualRetries} manual retry{diagnostic.retry.remainingManualRetries === 1 ? "" : "ies"} remaining</Text>{diagnostic.retry.allowed ? <Pressable onPress={() => void retry()} disabled={retrying} style={({ pressed }) => [styles.retryButton, { backgroundColor: colors.primary }, (pressed || retrying) && styles.pressed]}>{retrying ? <ActivityIndicator color={colors.background} /> : <><IconSymbol name="arrow.triangle.2.circlepath" size={19} color={colors.background} /><Text style={[styles.retryText, { color: colors.background }]}>Retry private processing</Text></>}</Pressable> : null}</CreatorCard> : null}
    {notice ? <Text style={[styles.notice, { color: colors.warning }]}>{notice}</Text> : null}
    <Pressable onPress={() => void refresh()} disabled={loading} style={({ pressed }) => [styles.refresh, { borderColor: colors.border }, (pressed || loading) && styles.pressed]}>{loading ? <ActivityIndicator color={colors.primary} /> : <><IconSymbol name="arrow.triangle.2.circlepath" size={19} color={colors.primary} /><Text style={[styles.refreshText, { color: colors.foreground }]}>Refresh status</Text></>}</Pressable>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { gap: 16, paddingTop: 22, paddingBottom: 32 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 }, iconButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, title: { marginTop: 4, fontSize: 19, fontWeight: "800", letterSpacing: -0.25, maxWidth: 260 }, cardTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.45 }, itemTitle: { fontSize: 16, fontWeight: "900" }, copy: { fontSize: 14, lineHeight: 22 }, progressTrack: { overflow: "hidden", height: 10, borderRadius: 999, borderWidth: 1, borderColor: "#284964" }, progressValue: { height: 8, borderRadius: 999 }, retryMeta: { fontSize: 12, fontWeight: "800" }, retryButton: { height: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#55E6FF", shadowOpacity: 0.2, shadowRadius: 11, elevation: 4 }, retryText: { fontSize: 15, fontWeight: "900" }, refresh: { height: 50, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#13273B" }, refreshText: { fontSize: 14, fontWeight: "900" }, notice: { fontSize: 13, lineHeight: 19, fontWeight: "700" }, empty: { fontSize: 20, lineHeight: 28, fontWeight: "800" }, back: { marginTop: 16, height: 50, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

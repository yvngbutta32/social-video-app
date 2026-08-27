import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatMetric, type SourceAnalytics } from "@/lib/analytics-contract";
import { useCreatorWorkflow } from "@/lib/creator-workflow";
import { getSourceAnalytics } from "@/lib/viralboost-api";

export default function LearnScreen() {
  const colors = useColors();
  const { selectedSourceId, sources } = useCreatorWorkflow();
  const source = useMemo(() => sources.find((item) => item.id === selectedSourceId && item.serverVideoId) ?? sources.find((item) => item.serverVideoId) ?? null, [selectedSourceId, sources]);
  const [analytics, setAnalytics] = useState<SourceAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!source?.serverVideoId) return;
    setLoading(true);
    setNotice(null);
    try { setAnalytics(await getSourceAnalytics(source.serverVideoId)); }
    catch (error) { setAnalytics(null); setNotice(error instanceof Error ? error.message : "Outcome data is not available right now."); }
    finally { setLoading(false); }
  }, [source?.serverVideoId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <ScreenContainer className="px-5" safeAreaClassName="pt-2">
      <View style={styles.content}>
        <Eyebrow>Evidence, not hype</Eyebrow>
        <Text style={[styles.title, { color: colors.foreground }]}>Learn from your own results.</Text>
        <Text style={[styles.copy, { color: colors.muted }]}>ViralBoost will compare approved adaptations with your own workspace baseline after authorized platform metrics arrive. It never treats a small sample as proof.</Text>
        <CreatorCard style={styles.card}>
          <View style={[styles.icon, { backgroundColor: `${colors.primary}1C` }]}><IconSymbol name="chart.line.uptrend.xyaxis" size={30} color={colors.primary} /></View>
          <StatusPill tone={analytics ? "ready" : "muted"}>{analytics ? "AUTHORIZED OUTCOMES AVAILABLE" : "WAITING FOR AUTHORIZED METRICS"}</StatusPill>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{analytics ? `Measured outcomes for ${source?.name ?? "your selected source"}` : "Your first evidence loop begins after an authorized platform reports outcomes."}</Text>
          {analytics ? <View style={styles.metrics}><Metric label="Views" value={formatMetric(analytics.totalViews)} colors={colors} /><Metric label="Shares" value={formatMetric(analytics.totalShares)} colors={colors} /><Metric label="Reach" value={formatMetric(analytics.totalReach)} colors={colors} /><Metric label="Saves" value={formatMetric(analytics.totalSaves)} colors={colors} /></View> : null}
          <Text style={[styles.cardCopy, { color: colors.muted }]}>{analytics ? "These are server-returned aggregates from connected platform records. They are observations, not a prediction or guarantee of future reach." : source?.serverVideoId ? (notice ?? "The selected source is connected, but the API has not returned complete outcome metrics yet.") : "Import and securely upload an original source, then connect authorized platform metrics to begin evidence-based comparison."}</Text>
          {source?.serverVideoId ? <Pressable onPress={() => void refresh()} disabled={loading} style={({ pressed }) => [styles.refresh, { borderColor: colors.border }, (pressed || loading) && styles.pressed]}>{loading ? <ActivityIndicator color={colors.primary} /> : <><IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} /><Text style={[styles.refreshText, { color: colors.foreground }]}>Refresh outcome data</Text></>}</Pressable> : null}
        </CreatorCard>
      </View>
    </ScreenContainer>
  );
}

function Metric({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return <View style={[styles.metric, { backgroundColor: `${colors.primary}10` }]}><Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text></View>;
}

const styles = StyleSheet.create({ content: { gap: 14, paddingTop: 22, paddingBottom: 26 }, title: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.95 }, copy: { fontSize: 14, lineHeight: 22 }, card: { marginTop: 8, gap: 14, padding: 20, backgroundColor: "#0C1B2D" }, icon: { width: 62, height: 62, borderRadius: 21, alignItems: "center", justifyContent: "center" }, cardTitle: { fontSize: 22, lineHeight: 29, fontWeight: "800", letterSpacing: -0.4 }, cardCopy: { fontSize: 14, lineHeight: 22 }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, metric: { minWidth: "46%", flexGrow: 1, borderRadius: 16, padding: 14, gap: 4, borderWidth: 1, borderColor: "#284964" }, metricValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 }, metricLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }, refresh: { height: 50, borderRadius: 15, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#13273B" }, refreshText: { fontSize: 14, fontWeight: "900" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

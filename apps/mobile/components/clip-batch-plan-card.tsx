import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { clipBatchSummary, type ClipBatchItem, type ClipBatchPlan } from "@/lib/clip-batch";

export type ClipBatchPlanCardProps = {
  plan: ClipBatchPlan | null;
  onRemove?: (item: ClipBatchItem) => void;
  onQueueRender?: () => void;
  isQueueing?: boolean;
};

function stateLabel(state: ClipBatchItem["renderState"]) {
  if (state === "not_queued") return "READY TO RENDER";
  if (state === "queued") return "QUEUED";
  if (state === "rendering") return "RENDERING";
  if (state === "ready") return "READY";
  return "FAILED";
}

export function ClipBatchPlanCard({ plan, onRemove, onQueueRender, isQueueing = false }: ClipBatchPlanCardProps) {
  const colors = useColors();
  if (!plan?.items.length) return null;
  const summary = clipBatchSummary(plan);
  return (
    <CreatorCard style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Eyebrow>Clip batch plan</Eyebrow>
          <Text style={[styles.title, { color: colors.foreground }]}>Independent cuts, one source.</Text>
        </View>
        <StatusPill tone="accent">{summary.total} RECIPES</StatusPill>
      </View>
      <Text style={[styles.copy, { color: colors.muted }]}>Each accepted moment keeps its own source range, destination, revision, and durable render state. Rendering creates private artifacts only; it never publishes automatically.</Text>
      {onQueueRender ? <Pressable accessibilityRole="button" accessibilityLabel="Queue all clips for private rendering" disabled={isQueueing} onPress={onQueueRender} style={({ pressed }) => [styles.queue, { backgroundColor: colors.primary }, (pressed || isQueueing) && styles.pressed]}><IconSymbol name="arrow.triangle.2.circlepath" size={16} color={colors.background} /><Text style={[styles.queueText, { color: colors.background }]}>{isQueueing ? "QUEUING PRIVATE RENDERS…" : "QUEUE PRIVATE RENDERS"}</Text></Pressable> : null}
      {summary.failed > 0 ? <Text style={[styles.warning, { color: colors.warning }]}>{summary.failed} clip{summary.failed === 1 ? "" : "s"} failed to queue. Retry the batch after checking the processor status.</Text> : null}
      <FlatList
        data={plan.items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item, index }) => (
          <View style={[styles.item, { borderColor: colors.border }]}>
            <View style={styles.itemTop}>
              <View style={[styles.index, { backgroundColor: `${colors.primary}18` }]}><Text style={[styles.indexText, { color: colors.primary }]}>0{index + 1}</Text></View>
              <View style={styles.itemCopy}><Text numberOfLines={2} style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.meta, { color: colors.muted }]}>{item.platform} · {item.range.trimStartSeconds.toFixed(1)}–{item.range.trimEndSeconds.toFixed(1)}s · rev {item.revision}</Text></View>
              <StatusPill tone={item.renderState === "failed" ? "attention" : item.renderState === "ready" ? "ready" : "muted"}>{stateLabel(item.renderState)}</StatusPill>
            </View>
            <View style={styles.itemActions}><Text style={[styles.lineage, { color: colors.primary }]}>Lineage: {item.candidateId}</Text>{onRemove ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove batch recipe ${index + 1}`} onPress={() => onRemove(item)} style={({ pressed }) => [styles.remove, { borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="xmark.circle" size={15} color={colors.warning} /><Text style={[styles.removeText, { color: colors.foreground }]}>Remove</Text></Pressable> : null}</View>
          </View>
        )}
      />
    </CreatorCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 13 },
  heading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1, gap: 5 },
  title: { fontSize: 19, fontWeight: "900", letterSpacing: -0.25 },
  copy: { fontSize: 13, lineHeight: 19 },
  item: { gap: 10, borderWidth: 1, borderRadius: 15, padding: 12 },
  itemTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  index: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  indexText: { fontSize: 12, fontWeight: "900" },
  itemCopy: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  meta: { fontSize: 11, lineHeight: 16, fontWeight: "700", textTransform: "capitalize" },
  itemActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lineage: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: "900" },
  remove: { minHeight: 32, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 10 },
  removeText: { fontSize: 11, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  queue: { minHeight: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14 },
  queueText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  warning: { fontSize: 12, lineHeight: 18, fontWeight: "800" },
});

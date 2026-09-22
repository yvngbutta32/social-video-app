import { Pressable, StyleSheet, Text, View } from "react-native";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { candidateEvidenceSummary, type ClipCandidate, type ClipSet } from "@/lib/clipping-contract";

export type ClipCandidateReviewCardProps = {
  clipSet: ClipSet | null;
  onAccept?: (candidate: ClipCandidate) => void;
  onReject?: (candidate: ClipCandidate) => void;
  onEdit?: (candidate: ClipCandidate) => void;
};

function durationLabel(candidate: ClipCandidate) {
  const duration = candidate.range.trimEndSeconds - candidate.range.trimStartSeconds;
  return `${duration.toFixed(1)}s`; 
}

export function ClipCandidateReviewCard({ clipSet, onAccept, onReject, onEdit }: ClipCandidateReviewCardProps) {
  const colors = useColors();

  if (!clipSet) {
    return (
      <CreatorCard style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Eyebrow>Clip discovery</Eyebrow>
            <Text style={[styles.title, { color: colors.foreground }]}>Waiting for a transcript</Text>
          </View>
          <StatusPill tone="muted">UNAVAILABLE</StatusPill>
        </View>
        <Text style={[styles.copy, { color: colors.muted }]}>ViralBoost will show explainable clip candidates here once this source has real word-level transcript cues. It will not invent highlights or imply that a selection guarantees reach.</Text>
        <View style={[styles.boundary, { borderColor: colors.border, backgroundColor: `${colors.warning}10` }]}>
          <IconSymbol name="doc.text.magnifyingglass" size={18} color={colors.warning} />
          <Text style={[styles.boundaryText, { color: colors.foreground }]}>Manual trimming remains available below. Connect transcript processing to unlock candidate review.</Text>
        </View>
      </CreatorCard>
    );
  }

  return (
    <CreatorCard style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Eyebrow>Clip discovery</Eyebrow>
          <Text style={[styles.title, { color: colors.foreground }]}>Review suggested moments</Text>
        </View>
        <StatusPill tone="accent">{clipSet.candidates.length} CANDIDATES</StatusPill>
      </View>
      <Text style={[styles.copy, { color: colors.muted }]}>Candidates are ranked review suggestions from transcript boundaries and recorded evidence. Accept, reject, or edit each one before any render request.</Text>
      {clipSet.candidates.map((candidate, index) => (
        <View key={candidate.id} style={[styles.candidate, { borderColor: colors.border }]}>
          <View style={styles.candidateTop}>
            <View style={styles.rank}><Text style={[styles.rankText, { color: colors.primary }]}>0{index + 1}</Text></View>
            <View style={styles.candidateCopy}>
              <Text numberOfLines={2} style={[styles.candidateTitle, { color: colors.foreground }]}>{candidate.title}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{durationLabel(candidate)} · {Math.round(candidate.confidence * 100)}% confidence · score {candidate.score}</Text>
            </View>
            <StatusPill tone={candidate.status === "accepted" ? "ready" : candidate.status === "rejected" ? "muted" : "attention"}>{candidate.status.toUpperCase()}</StatusPill>
          </View>
          <Text numberOfLines={3} style={[styles.summary, { color: colors.muted }]}>{candidate.summary}</Text>
          <Text style={[styles.evidence, { color: colors.primary }]}>{candidateEvidenceSummary(candidate)}</Text>
          {candidate.warnings.length ? <Text style={[styles.warning, { color: colors.warning }]}>{candidate.warnings[0]}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Accept clip candidate ${index + 1}`} onPress={() => onAccept?.(candidate)} disabled={!onAccept} style={({ pressed }) => [styles.action, { borderColor: colors.border, opacity: onAccept ? 1 : 0.55 }, pressed && styles.pressed]}><IconSymbol name="checkmark.circle" size={16} color={colors.success} /><Text style={[styles.actionText, { color: colors.foreground }]}>Accept</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit clip candidate ${index + 1}`} onPress={() => onEdit?.(candidate)} disabled={!onEdit} style={({ pressed }) => [styles.action, { borderColor: colors.border, opacity: onEdit ? 1 : 0.55 }, pressed && styles.pressed]}><IconSymbol name="slider.horizontal.3" size={16} color={colors.primary} /><Text style={[styles.actionText, { color: colors.foreground }]}>Edit</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Reject clip candidate ${index + 1}`} onPress={() => onReject?.(candidate)} disabled={!onReject} style={({ pressed }) => [styles.action, { borderColor: colors.border, opacity: onReject ? 1 : 0.55 }, pressed && styles.pressed]}><IconSymbol name="xmark.circle" size={16} color={colors.warning} /><Text style={[styles.actionText, { color: colors.foreground }]}>Reject</Text></Pressable>
          </View>
        </View>
      ))}
    </CreatorCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headingCopy: { flex: 1, gap: 5 },
  title: { fontSize: 19, fontWeight: "900", letterSpacing: -0.25 },
  copy: { fontSize: 13, lineHeight: 19 },
  boundary: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  boundaryText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  candidate: { gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  candidateTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rank: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF0D" },
  rankText: { fontSize: 12, fontWeight: "900" },
  candidateCopy: { flex: 1, gap: 4 },
  candidateTitle: { fontSize: 14, lineHeight: 19, fontWeight: "900" },
  meta: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  summary: { fontSize: 12, lineHeight: 18 },
  evidence: { fontSize: 11, lineHeight: 16, fontWeight: "800" },
  warning: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minHeight: 36, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 10 },
  actionText: { fontSize: 11, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});

import { StyleSheet, Text, View } from "react-native";

import { CreatorCard, StatusPill } from "@/components/creator-ui";
import type { ThemeColorPalette } from "@/constants/theme";
import type { TimedCaptionQualityReport } from "@/lib/timed-caption-contract";

type CaptionQualityCardProps = {
  report: TimedCaptionQualityReport;
  colors: ThemeColorPalette;
};

export function CaptionQualityCard({ report, colors }: CaptionQualityCardProps) {
  const ready = report.status === "ready";
  const diagnosticCount = report.diagnostics.length;

  return (
    <View
      accessible
      accessibilityLabel={`Caption readability check: ${ready ? "ready for review" : `${diagnosticCount} review ${diagnosticCount === 1 ? "note" : "notes"}`}.`}
    >
      <CreatorCard style={[styles.card, { borderColor: colors.border, backgroundColor: ready ? `${colors.success}10` : `${colors.warning}10` }]}>
        <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Caption readability check</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {report.cueCount} cues · {report.averageCharactersPerSecond.toFixed(1)} characters per second average
          </Text>
        </View>
        <StatusPill tone={ready ? "ready" : "attention"}>
          {ready ? "READY TO REVIEW" : `${diagnosticCount} NOTE${diagnosticCount === 1 ? "" : "S"}`}
        </StatusPill>
        </View>
        {report.diagnostics.slice(0, 3).map((diagnostic) => (
          <Text key={`${diagnostic.cueId ?? "track"}-${diagnostic.code}`} style={[styles.diagnostic, { color: colors.warning }]}>
            • {diagnostic.message}
          </Text>
        ))}
        <Text style={[styles.footnote, { color: colors.muted }]}>Editorial guidance only—not a platform-compliance certification. Confirm timing and wording in the private artifact.</Text>
      </CreatorCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 14, borderRadius: 17 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: "900" },
  meta: { fontSize: 12, lineHeight: 18 },
  diagnostic: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
  footnote: { fontSize: 11, lineHeight: 16 },
});

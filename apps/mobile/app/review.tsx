import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCreatorWorkflow } from "@/lib/creator-workflow";
import { formatDuration } from "@/lib/media-format";

const adaptationGuides = [
  { platform: "TikTok", format: "9:16 vertical", focus: "Immediate visual context and a concise first idea", status: "PROCESSING REQUIRED" },
  { platform: "Instagram Reels", format: "9:16 vertical", focus: "Strong cover-safe framing and a shareable takeaway", status: "PROCESSING REQUIRED" },
  { platform: "YouTube Shorts", format: "9:16 vertical", focus: "Clear hook, topic continuity, and end-screen-safe composition", status: "PROCESSING REQUIRED" },
  { platform: "LinkedIn", format: "9:16 or 1:1", focus: "A useful professional insight with readable visual hierarchy", status: "PROCESSING REQUIRED" },
] as const;

export default function ReviewScreen() {
  const colors = useColors();
  const { selectedSourceId, sources, recipeFor } = useCreatorWorkflow();
  const source = sources.find((item) => item.id === selectedSourceId) ?? null;

  if (!source) {
    return <ScreenContainer className="p-6" edges={["top", "bottom", "left", "right"]}><Text style={[styles.empty, { color: colors.foreground }]}>Choose a source before reviewing adaptations.</Text><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={{ color: colors.foreground, fontWeight: "800" }}>Back to Library</Text></Pressable></ScreenContainer>;
  }

  const recipe = recipeFor(source.id);
  const draftLength = Math.max(0, recipe.trimEndSeconds - recipe.trimStartSeconds);

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <FlatList
        data={adaptationGuides}
        keyExtractor={(item) => item.platform}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View style={styles.headerCopy}><Eyebrow>Adaptation review</Eyebrow><Text numberOfLines={1} style={[styles.sourceName, { color: colors.foreground }]}>{source.name}</Text></View></View>
          <CreatorCard style={[styles.sourceCard, { backgroundColor: "#123B57", borderColor: "#2A6586" }]}>
            <View style={styles.sourceCardTop}><IconSymbol name="wand.and.stars" size={25} color="#55E6FF" /><StatusPill tone="attention">PRIVATE QUEUE NOT CONNECTED</StatusPill></View>
            <Text style={styles.sourceCardTitle}>Your platform draft blueprint</Text>
            <Text style={styles.sourceCardCopy}>The current local recipe uses {formatDuration(draftLength * 1000)} from {recipe.trimStartSeconds}s to {recipe.trimEndSeconds}s with {recipe.composition.replace("_", " ")} composition. Server processing is required before any real artifact exists.</Text>
          </CreatorCard>
          <View style={styles.section}><Eyebrow>Planned adaptations</Eyebrow><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Review the intent, then refine.</Text></View>
        </>}
        renderItem={({ item }) => <CreatorCard style={styles.adaptationCard}>
          <View style={styles.cardHeader}><View style={[styles.platformGlyph, { backgroundColor: `${colors.primary}1C` }]}><IconSymbol name="sparkles" size={22} color={colors.primary} /></View><View style={styles.platformCopy}><Text style={[styles.platformName, { color: colors.foreground }]}>{item.platform}</Text><Text style={[styles.platformFormat, { color: colors.muted }]}>{item.format}</Text></View><StatusPill tone="muted">DRAFT</StatusPill></View>
          <Text style={[styles.focus, { color: colors.foreground }]}>{item.focus}</Text>
          <Text style={[styles.status, { color: colors.muted }]}>{item.status}: a secure workspace, private queue, and renderer must be configured before this becomes a viewable export.</Text>
          <Pressable onPress={() => router.push("/edit-lab" as never)} style={({ pressed }) => [styles.refine, { borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="slider.horizontal.3" size={19} color={colors.primary} /><Text style={[styles.refineText, { color: colors.foreground }]}>Refine this draft</Text></Pressable>
        </CreatorCard>}
        ListFooterComponent={<CreatorCard style={styles.evidence}><View style={[styles.evidenceIcon, { backgroundColor: `${colors.success}1D` }]}><IconSymbol name="lock.shield.fill" size={20} color={colors.success} /></View><View style={styles.evidenceCopy}><Text style={[styles.evidenceTitle, { color: colors.foreground }]}>Creator approval remains separate</Text><Text style={[styles.evidenceText, { color: colors.muted }]}>Reviewing or editing does not publish content. Publishing remains creator-controlled and requires an authorized platform connection.</Text></View></CreatorCard>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 16, paddingBottom: 20 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 }, iconButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, gap: 2 }, sourceName: { fontSize: 17, fontWeight: "800" }, sourceCard: { gap: 12, padding: 19 }, sourceCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sourceCardTitle: { color: "#F1FAFF", fontSize: 22, fontWeight: "800" }, sourceCardCopy: { color: "#B4D2E3", fontSize: 14, lineHeight: 21 }, section: { gap: 4, marginTop: 2 }, sectionTitle: { fontSize: 20, fontWeight: "800" }, adaptationCard: { gap: 12 }, cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, platformGlyph: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }, platformCopy: { flex: 1, gap: 3 }, platformName: { fontSize: 16, fontWeight: "800" }, platformFormat: { fontSize: 12, fontWeight: "700" }, focus: { fontSize: 15, lineHeight: 22, fontWeight: "700" }, status: { fontSize: 13, lineHeight: 19 }, refine: { height: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, refineText: { fontSize: 14, fontWeight: "800" }, evidence: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, evidenceIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" }, evidenceCopy: { flex: 1, gap: 3 }, evidenceTitle: { fontSize: 14, fontWeight: "800" }, evidenceText: { fontSize: 13, lineHeight: 19 }, empty: { fontSize: 20, lineHeight: 28, fontWeight: "800" }, back: { marginTop: 16, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});

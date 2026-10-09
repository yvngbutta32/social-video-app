import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { MediaIntakeSheet } from "@/components/media-intake-sheet";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCreatorWorkflow } from "@/lib/creator-workflow";
import { deriveCreatorFlowNextStep, sourceProgressLabel } from "@/lib/creator-flow-next-step";
import { formatBytes, formatDuration } from "@/lib/media-format";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const contentBottomInset = Math.max(insets.bottom + 72, 84);
  const { sources, selectedSourceId, selectSource, platformsFor } = useCreatorWorkflow();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const activeSource = sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null;
  const activeTargetCount = activeSource ? platformsFor(activeSource.id).length : 0;
  const nextStep = deriveCreatorFlowNextStep(activeSource, activeTargetCount);

  const continueCreatorFlow = () => {
    if (nextStep.action === "import") { router.push("/library" as never); return; }
    if (!activeSource) return;
    selectSource(activeSource.id);
    router.push((nextStep.action === "review" ? "/review" : nextStep.action === "processing" ? "/processing-detail" : "/library") as never);
  };

  return (
    <ScreenContainer className="px-5">
      <FlatList
        data={sources}
        keyExtractor={(source) => source.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomInset }]}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Eyebrow>ViralBoost Creator</Eyebrow>
                <Text style={[styles.title, { color: colors.foreground }]}>Make your next{`\n`}strongest cut.</Text>
              </View>
              <Pressable onPress={() => router.push("/settings" as never)} accessibilityRole="button" accessibilityLabel="Open settings" accessibilityHint="Manage appearance, privacy defaults, and interaction preferences." style={({ pressed }) => [styles.badge, { backgroundColor: `${colors.warning}20`, borderColor: `${colors.warning}40` }, pressed && styles.pressed]}><IconSymbol name="gearshape.fill" size={20} color={colors.warning} /></Pressable>
            </View>

            <CreatorCard style={[styles.heroCard, { backgroundColor: "#3A2426", borderColor: "#74433D" }]}>
              <View style={styles.heroTop}>
                <View style={styles.heroIcon}><IconSymbol name="photo.on.rectangle.angled" size={24} color="#FFB09B" /></View>
                <StatusPill tone="accent">PRIVATE WORKSPACE</StatusPill>
              </View>
              <Text style={styles.heroTitle}>Make one good idea travel.</Text>
              <Text style={styles.heroCopy}>Bring in media you own, shape platform-native drafts in private, and keep the creative decisions in your hands.</Text>
              <Pressable onPress={() => setIntakeOpen(true)} accessibilityRole="button" accessibilityLabel="Add a permitted media source" accessibilityHint="Opens private source import. Media is not uploaded until you choose private workspace processing." style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}>
                <IconSymbol name="plus.circle.fill" size={20} color="#3A2426" />
                <Text style={styles.heroActionText}>Bring in media</Text>
              </Pressable>
            </CreatorCard>

            <CreatorCard style={[styles.nextCard, { borderColor: `${colors.primary}55`, backgroundColor: colors.surface }]}> 
              <View style={styles.nextTop}><View><Eyebrow>{nextStep.eyebrow}</Eyebrow><Text style={[styles.nextTitle, { color: colors.foreground }]}>{nextStep.title}</Text></View><View style={[styles.nextStage, { backgroundColor: `${colors.primary}1C` }]}><IconSymbol name="arrow.triangle.branch" size={21} color={colors.primary} /></View></View>
              <Text style={[styles.nextDetail, { color: colors.muted }]}>{nextStep.detail}</Text>
              <Text style={[styles.journey, { color: colors.primary }]}>SOURCE  →  ADAPT  →  REFINE  →  REVIEW  →  LEARN</Text>
              <Pressable onPress={continueCreatorFlow} accessibilityRole="button" accessibilityLabel={nextStep.actionLabel} accessibilityHint={nextStep.detail} style={({ pressed }) => [styles.nextAction, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.nextActionText, { color: colors.background }]}>{nextStep.actionLabel}</Text><IconSymbol name="chevron.right" size={18} color={colors.background} /></Pressable>
            </CreatorCard>

            <View style={styles.sectionHeading}>
              <View><Eyebrow>Your studio</Eyebrow><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent sources</Text></View>
              <Text style={[styles.counter, { color: colors.muted }]}>{sources.length ? `${sources.length} imported` : "Private by default"}</Text>
            </View>
          </>
        }
        renderItem={({ item }) => {
          const progress = sourceProgressLabel(item, platformsFor(item.id).length);
          return (
            <Pressable
            onPress={() => { selectSource(item.id); router.push("/library" as never); }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name}. ${progress.label.toLowerCase()}.`}
            accessibilityHint="Opens the source library where you can upload, check processing, or review adaptations."
            style={({ pressed }) => [styles.sourcePressable, pressed && styles.pressed]}
          >
            <CreatorCard>
              <View style={styles.sourceTop}>
                <View style={[styles.videoGlyph, { backgroundColor: `${colors.primary}20` }]}><IconSymbol name="play.circle.fill" size={30} color={colors.primary} /></View>
                <View style={styles.sourceCopyWrap}>
                  <Text numberOfLines={1} style={[styles.sourceTitle, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.sourceMeta, { color: colors.muted }]}>{formatDuration(item.durationMs)} · {formatBytes(item.size)} · {item.origin === "library" ? "Camera roll" : "Files"}</Text>
                </View>
                <StatusPill tone={progress.tone}>{progress.label}</StatusPill>
              </View>
              <Text style={[styles.sourceHint, { color: colors.muted }]}>{item.status === "ready" ? platformsFor(item.id).length ? "Open targeted drafts to refine the non-destructive recipe." : "Choose platform targets to prepare adaptation drafts." : item.status === "failed" ? "Open this source to review safe recovery guidance." : "Open this source to continue the private creator workflow."}</Text>
            </CreatorCard>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <CreatorCard style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}16` }]}><IconSymbol name="photo.on.rectangle.angled" size={28} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your next source starts here</Text>
            <Text style={[styles.emptyCopy, { color: colors.muted }]}>Choose a video from your camera roll or Files. Nothing is uploaded until your private workspace is connected.</Text>
          </CreatorCard>
        }
      />
      <MediaIntakeSheet visible={intakeOpen} onClose={() => setIntakeOpen(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 22, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  title: { marginTop: 8, fontSize: 35, lineHeight: 40, fontWeight: "800", letterSpacing: -1.15 },
  badge: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#B4773240" },
  heroCard: { gap: 16, padding: 22, boxShadow: "0px 8px 22px #3A24263D", elevation: 7 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#54302F" },
  heroTitle: { color: "#FFF4E9", fontSize: 27, lineHeight: 33, fontWeight: "800", letterSpacing: -0.75 },
  heroCopy: { color: "#E9C9BC", fontSize: 15, lineHeight: 23 },
  heroAction: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFB09B", borderRadius: 15, boxShadow: "0px 6px 13px #FFB09B33", elevation: 4 },
  heroActionText: { color: "#3A2426", fontSize: 16, fontWeight: "800" },
  nextCard: { gap: 13, padding: 20 }, nextTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }, nextTitle: { marginTop: 6, fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.45, maxWidth: 255 }, nextStage: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }, nextDetail: { fontSize: 14, lineHeight: 21 }, journey: { fontSize: 10, letterSpacing: 0.85, fontWeight: "900", marginTop: 1 }, nextAction: { minHeight: 52, borderRadius: 15, paddingHorizontal: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7 }, nextActionText: { fontSize: 15, fontWeight: "900" },
  sectionHeading: { marginTop: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitle: { marginTop: 5, fontSize: 22, fontWeight: "800", letterSpacing: -0.35 },
  counter: { fontSize: 12, fontWeight: "800", paddingBottom: 3 },
  sourcePressable: { marginTop: 2 },
  sourceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  videoGlyph: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  sourceCopyWrap: { flex: 1, gap: 4 },
  sourceTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.15 },
  sourceMeta: { fontSize: 12, lineHeight: 17 },
  sourceHint: { fontSize: 13, lineHeight: 18 },
  emptyCard: { alignItems: "center", paddingVertical: 28, marginTop: 2 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 6, fontSize: 19, fontWeight: "800" },
  emptyCopy: { textAlign: "center", lineHeight: 21, fontSize: 14 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});

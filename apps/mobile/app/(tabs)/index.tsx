import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { MediaIntakeSheet } from "@/components/media-intake-sheet";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCreatorWorkflow } from "@/lib/creator-workflow";
import { formatBytes, formatDuration } from "@/lib/media-format";

export default function HomeScreen() {
  const colors = useColors();
  const { sources, selectSource } = useCreatorWorkflow();
  const [intakeOpen, setIntakeOpen] = useState(false);

  return (
    <ScreenContainer className="px-5" safeAreaClassName="pt-2">
      <FlatList
        data={sources}
        keyExtractor={(source) => source.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Eyebrow>ViralBoost Creator</Eyebrow>
                <Text style={[styles.title, { color: colors.foreground }]}>Make your next{`\n`}strongest cut.</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${colors.success}1C` }]}><IconSymbol name="lock.shield.fill" size={18} color={colors.success} /></View>
            </View>

            <CreatorCard style={[styles.heroCard, { backgroundColor: "#123B57", borderColor: "#2A6586" }]}>
              <View style={styles.heroTop}>
                <View style={styles.heroIcon}><IconSymbol name="sparkles" size={24} color="#55E6FF" /></View>
                <StatusPill tone="accent">INVITE-ONLY WORKSPACE</StatusPill>
              </View>
              <Text style={styles.heroTitle}>One source. Clear next steps.</Text>
              <Text style={styles.heroCopy}>Import media you own, let private processing prepare platform-native drafts, then refine only what you want to change.</Text>
              <Pressable onPress={() => setIntakeOpen(true)} style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}>
                <IconSymbol name="plus.circle.fill" size={20} color="#08111F" />
                <Text style={styles.heroActionText}>Add source</Text>
              </Pressable>
            </CreatorCard>

            <View style={styles.sectionHeading}>
              <View><Eyebrow>Your studio</Eyebrow><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent sources</Text></View>
              <Text style={[styles.counter, { color: colors.muted }]}>{sources.length ? `${sources.length} imported` : "Private by default"}</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => { selectSource(item.id); router.push("/library" as never); }}
            style={({ pressed }) => [styles.sourcePressable, pressed && styles.pressed]}
          >
            <CreatorCard>
              <View style={styles.sourceTop}>
                <View style={[styles.videoGlyph, { backgroundColor: `${colors.primary}20` }]}><IconSymbol name="play.circle.fill" size={30} color={colors.primary} /></View>
                <View style={styles.sourceCopyWrap}>
                  <Text numberOfLines={1} style={[styles.sourceTitle, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.sourceMeta, { color: colors.muted }]}>{formatDuration(item.durationMs)} · {formatBytes(item.size)} · {item.origin === "library" ? "Camera roll" : "Files"}</Text>
                </View>
                <StatusPill tone="attention">READY TO QUEUE</StatusPill>
              </View>
              <Text style={[styles.sourceHint, { color: colors.muted }]}>Secure connection is required before private server processing starts.</Text>
            </CreatorCard>
          </Pressable>
        )}
        ListEmptyComponent={
          <CreatorCard style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}16` }]}><IconSymbol name="wand.and.stars" size={28} color={colors.primary} /></View>
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
  content: { paddingTop: 18, paddingBottom: 32, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  title: { marginTop: 7, fontSize: 33, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
  badge: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroCard: { gap: 14, padding: 20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0B2A40" },
  heroTitle: { color: "#F1FAFF", fontSize: 25, lineHeight: 31, fontWeight: "800", letterSpacing: -0.5 },
  heroCopy: { color: "#B4D2E3", fontSize: 15, lineHeight: 22 },
  heroAction: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#55E6FF", borderRadius: 15 },
  heroActionText: { color: "#08111F", fontSize: 16, fontWeight: "800" },
  sectionHeading: { marginTop: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitle: { marginTop: 4, fontSize: 21, fontWeight: "800" },
  counter: { fontSize: 13, fontWeight: "700", paddingBottom: 2 },
  sourcePressable: { marginTop: 2 },
  sourceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  videoGlyph: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  sourceCopyWrap: { flex: 1, gap: 4 },
  sourceTitle: { fontSize: 16, fontWeight: "800" },
  sourceMeta: { fontSize: 12, lineHeight: 17 },
  sourceHint: { fontSize: 13, lineHeight: 18 },
  emptyCard: { alignItems: "center", paddingVertical: 28, marginTop: 2 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 6, fontSize: 19, fontWeight: "800" },
  emptyCopy: { textAlign: "center", lineHeight: 21, fontSize: 14 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});

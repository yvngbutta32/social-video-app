import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { MediaIntakeSheet } from "@/components/media-intake-sheet";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useCreatorWorkflow, type MobileSource } from "@/lib/creator-workflow";
import { ResumableUploadUnavailableError, uploadCreatorSource, uploadCreatorSourceResumable } from "@/lib/creator-upload";
import { formatBytes, formatDuration } from "@/lib/media-format";
import { getWorkspaceSources } from "@/lib/viralboost-api";
import { useOfflineMode } from "@/lib/offline-mode";

export default function LibraryScreen() {
  const colors = useColors();
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const contentBottomInset = Math.max(insets.bottom + 72, 84);
  const { sources, selectSource, updateSource, syncWorkspaceSources } = useCreatorWorkflow();
  const { effectiveOffline, markOffline, markOnline } = useOfflineMode();
  const [refreshing, setRefreshing] = useState(false);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const refreshWorkspace = useCallback(async () => {
    setRefreshing(true);
    setSyncNotice(null);
    if (effectiveOffline) {
      setSyncNotice("Offline workspace is active. Local sources and saved drafts are available; workspace sync is paused.");
      setRefreshing(false);
      return;
    }
    try {
      syncWorkspaceSources(await getWorkspaceSources());
      markOnline();
    } catch {
      markOffline();
      setSyncNotice("Private workspace sources could not be refreshed. Device imports and saved local drafts remain available.");
    } finally { setRefreshing(false); }
  }, [effectiveOffline, markOffline, markOnline, syncWorkspaceSources]);

  useEffect(() => { void refreshWorkspace(); }, [refreshWorkspace]);

  const upload = async (source: MobileSource) => {
    if (effectiveOffline) {
      updateSource(source.id, { status: "ready_to_queue", uploadError: "Offline mode: this source and its edits are saved locally. Reconnect to upload to private processing." });
      setSyncNotice("Saved locally. Reconnect to upload this source to private processing.");
      return;
    }
    updateSource(source.id, { status: "uploading", uploadError: undefined });
    try {
      let receipt;
      try {
        receipt = await uploadCreatorSourceResumable(source, (multipartUpload) => updateSource(source.id, { multipartUpload }));
      } catch (error) {
        if (!(error instanceof ResumableUploadUnavailableError)) throw error;
        receipt = await uploadCreatorSource(source);
      }
      updateSource(source.id, { serverVideoId: receipt.id, status: receipt.status === "uploading" ? "processing" : receipt.status, uploadError: undefined, multipartUpload: undefined });
    } catch (error) {
      markOffline();
      const detail = error instanceof Error ? error.message : "The private source could not be uploaded.";
      const safeMessage = /available on this device|sign in|API URL|workspace/i.test(detail)
        ? detail
        : "The private source could not be uploaded. Check your connection, then retry from this source.";
      updateSource(source.id, { status: "failed", uploadError: safeMessage });
    }
  };

  return (
    <ScreenContainer className="px-5">
      <FlatList
        key={layout.isWide ? "wide-grid" : "stacked-list"}
        data={sources}
        numColumns={layout.isWide ? 2 : 1}
        keyExtractor={(source) => source.id}
        contentContainerStyle={[styles.content, { paddingBottom: contentBottomInset }]}
        columnWrapperStyle={layout.isWide ? styles.gridRow : undefined}
        ListHeaderComponent={<View style={styles.heading}><Eyebrow>Creator library</Eyebrow><View style={styles.headingRow}><View style={styles.headingCopy}><Text style={[styles.title, { color: colors.foreground }]}>Your original media</Text><Text style={[styles.copy, { color: colors.muted }]}>Device imports and authorized workspace sources stay distinct. Edits create revisions; they never overwrite your original.</Text></View><Pressable onPress={() => void refreshWorkspace()} disabled={refreshing} style={({ pressed }) => [styles.refresh, { borderColor: colors.border, backgroundColor: colors.surface }, (pressed || refreshing) && styles.pressed]}>{refreshing ? <ActivityIndicator color={colors.primary} /> : <IconSymbol name="arrow.triangle.2.circlepath" size={19} color={colors.primary} />}</Pressable></View><Pressable onPress={() => setIntakeOpen(true)} accessibilityRole="button" accessibilityLabel="Import another source" accessibilityHint="Opens the private media picker from the Library workflow." style={({ pressed }) => [styles.importAction, { backgroundColor: colors.primary }, pressed && styles.pressed]}><IconSymbol name="plus.circle.fill" size={18} color={colors.background} /><Text style={[styles.importActionText, { color: colors.background }]}>Import another source</Text></Pressable>{syncNotice ? <Text style={[styles.syncNotice, { color: colors.warning }]}>{syncNotice}</Text> : null}</View>}
        renderItem={({ item }) => (
          <CreatorCard style={[styles.card, layout.isWide && styles.cardWide]}>
            <View style={styles.row}>
              <View style={[styles.play, { backgroundColor: `${colors.primary}1C` }]}><IconSymbol name="play.circle.fill" size={31} color={colors.primary} /></View>
              <View style={styles.flex}><Text numberOfLines={1} style={[styles.sourceTitle, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.meta, { color: colors.muted }]}>{formatDuration(item.durationMs)} · {formatBytes(item.size)}</Text></View>
              <StatusPill tone={item.status === "failed" ? "attention" : item.status === "ready" ? "ready" : item.status === "processing" || item.status === "uploading" ? "accent" : "muted"}>{item.status === "uploading" ? "UPLOADING" : item.status === "processing" ? "PROCESSING" : item.status === "ready" ? "READY" : item.status === "failed" ? "ACTION NEEDED" : item.status === "archived" ? "ARCHIVED" : item.origin === "workspace" ? "WORKSPACE" : "LOCAL"}</StatusPill>
            </View>
            <Text style={[styles.explainer, { color: item.status === "failed" ? colors.warning : colors.muted }]}>{item.status === "failed" ? (item.multipartUpload ? `Secure upload paused after ${item.multipartUpload.uploadedPartNumbers.length} of ${item.multipartUpload.partCount} confirmed parts. Retry to continue safely.` : item.uploadError ?? "This workspace source needs safe recovery review.") : item.status === "ready" ? (item.origin === "workspace" ? "This private source is synchronized from the authorized workspace and ready for adaptation review." : "Private processing completed for this device import.") : item.status === "processing" ? "The API confirmed private storage and queued this source for processing." : item.status === "uploading" ? (item.multipartUpload ? `Securely storing ${item.multipartUpload.uploadedPartNumbers.length} of ${item.multipartUpload.partCount} confirmed source parts.` : "Preparing a private source upload session.") : item.status === "archived" ? "This source is archived in the authorized workspace and cannot be edited or rendered." : "A secure workspace connection is required before this source enters private processing."}</Text>
            <Pressable onPress={() => { selectSource(item.id); router.push("/review" as never); }} style={({ pressed }) => [styles.action, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}>
              <IconSymbol name="arrow.triangle.branch" size={19} color={colors.primary} /><Text style={[styles.actionText, { color: colors.foreground }]}>Review adaptation plan</Text>
            </Pressable>
            {item.serverVideoId ? <Pressable onPress={() => { selectSource(item.id); router.push("/processing-detail" as never); }} style={({ pressed }) => [styles.action, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}><IconSymbol name="clock.arrow.circlepath" size={19} color={colors.primary} /><Text style={[styles.actionText, { color: colors.foreground }]}>View processing status</Text></Pressable> : null}
            {item.uri && (item.status === "ready_to_queue" || item.status === "failed") ? <Pressable onPress={() => void upload(item)} style={({ pressed }) => [styles.upload, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.uploadText, { color: colors.background }]}>{item.status === "failed" ? "Retry private upload" : "Upload to private processing"}</Text></Pressable> : null}
          </CreatorCard>
        )}
        ListEmptyComponent={<CreatorCard style={styles.empty}><IconSymbol name="rectangle.stack.fill" size={34} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No imported sources</Text><Text style={[styles.emptyCopy, { color: colors.muted }]}>Use Home to import permitted media from your device.</Text></CreatorCard>}
      />
      <MediaIntakeSheet visible={intakeOpen} onClose={() => setIntakeOpen(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingTop: 22 },
  heading: { gap: 7, marginBottom: 10 }, headingRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" }, headingCopy: { flex: 1, gap: 7 }, title: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.95 }, copy: { fontSize: 14, lineHeight: 22 }, refresh: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" }, syncNotice: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
  card: { gap: 14, padding: 19 }, cardWide: { flex: 1, minWidth: 0 }, gridRow: { gap: 14 }, row: { flexDirection: "row", alignItems: "center", gap: 13 }, flex: { flex: 1, gap: 5 }, play: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" }, sourceTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 }, meta: { fontSize: 12, fontWeight: "700" }, explainer: { fontSize: 13, lineHeight: 20 },
  action: { height: 48, borderWidth: 1, borderRadius: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }, actionText: { fontSize: 14, fontWeight: "800" }, importAction: { minHeight: 48, borderRadius: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 4 }, importActionText: { fontSize: 14, fontWeight: "900" }, upload: { height: 50, borderRadius: 16, justifyContent: "center", alignItems: "center", boxShadow: "0px 5px 10px rgba(0, 0, 0, 0.12)", elevation: 4 }, uploadText: { fontSize: 14, fontWeight: "900" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  empty: { alignItems: "center", paddingVertical: 34 }, emptyTitle: { marginTop: 8, fontSize: 18, fontWeight: "800" }, emptyCopy: { marginTop: 4, fontSize: 14 },
});

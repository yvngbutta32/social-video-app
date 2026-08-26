import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCreatorWorkflow, type MobileSource } from "@/lib/creator-workflow";
import { ResumableUploadUnavailableError, uploadCreatorSource, uploadCreatorSourceResumable } from "@/lib/creator-upload";
import { formatBytes, formatDuration } from "@/lib/media-format";
import { getWorkspaceSources } from "@/lib/viralboost-api";

export default function LibraryScreen() {
  const colors = useColors();
  const { sources, selectSource, updateSource, syncWorkspaceSources } = useCreatorWorkflow();
  const [refreshing, setRefreshing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const refreshWorkspace = useCallback(async () => {
    setRefreshing(true);
    setSyncNotice(null);
    try {
      syncWorkspaceSources(await getWorkspaceSources());
    } catch {
      setSyncNotice("Private workspace sources could not be refreshed. Device imports and saved local drafts remain available.");
    } finally { setRefreshing(false); }
  }, [syncWorkspaceSources]);

  useEffect(() => { void refreshWorkspace(); }, [refreshWorkspace]);

  const upload = async (source: MobileSource) => {
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
      const detail = error instanceof Error ? error.message : "The private source could not be uploaded.";
      const safeMessage = /available on this device|sign in|API URL|workspace/i.test(detail)
        ? detail
        : "The private source could not be uploaded. Check your connection, then retry from this source.";
      updateSource(source.id, { status: "failed", uploadError: safeMessage });
    }
  };

  return (
    <ScreenContainer className="px-5" safeAreaClassName="pt-2">
      <FlatList
        data={sources}
        keyExtractor={(source) => source.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.heading}><Eyebrow>Creator library</Eyebrow><View style={styles.headingRow}><View style={styles.headingCopy}><Text style={[styles.title, { color: colors.foreground }]}>Your original media</Text><Text style={[styles.copy, { color: colors.muted }]}>Device imports and authorized workspace sources stay distinct. Edits create revisions; they never overwrite your original.</Text></View><Pressable onPress={() => void refreshWorkspace()} disabled={refreshing} style={({ pressed }) => [styles.refresh, { borderColor: colors.border }, (pressed || refreshing) && styles.pressed]}>{refreshing ? <ActivityIndicator color={colors.primary} /> : <IconSymbol name="arrow.triangle.2.circlepath" size={19} color={colors.primary} />}</Pressable></View>{syncNotice ? <Text style={[styles.syncNotice, { color: colors.warning }]}>{syncNotice}</Text> : null}</View>}
        renderItem={({ item }) => (
          <CreatorCard style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.play, { backgroundColor: `${colors.primary}1C` }]}><IconSymbol name="play.circle.fill" size={31} color={colors.primary} /></View>
              <View style={styles.flex}><Text numberOfLines={1} style={[styles.sourceTitle, { color: colors.foreground }]}>{item.name}</Text><Text style={[styles.meta, { color: colors.muted }]}>{formatDuration(item.durationMs)} · {formatBytes(item.size)}</Text></View>
              <StatusPill tone={item.status === "failed" ? "attention" : item.status === "ready" ? "ready" : item.status === "processing" || item.status === "uploading" ? "accent" : "muted"}>{item.status === "uploading" ? "UPLOADING" : item.status === "processing" ? "PROCESSING" : item.status === "ready" ? "READY" : item.status === "failed" ? "ACTION NEEDED" : item.status === "archived" ? "ARCHIVED" : item.origin === "workspace" ? "WORKSPACE" : "LOCAL"}</StatusPill>
            </View>
            <Text style={[styles.explainer, { color: item.status === "failed" ? colors.warning : colors.muted }]}>{item.status === "failed" ? (item.multipartUpload ? `Secure upload paused after ${item.multipartUpload.uploadedPartNumbers.length} of ${item.multipartUpload.partCount} confirmed parts. Retry to continue safely.` : item.uploadError ?? "This workspace source needs safe recovery review.") : item.status === "ready" ? (item.origin === "workspace" ? "This private source is synchronized from the authorized workspace and ready for adaptation review." : "Private processing completed for this device import.") : item.status === "processing" ? "The API confirmed private storage and queued this source for processing." : item.status === "uploading" ? (item.multipartUpload ? `Securely storing ${item.multipartUpload.uploadedPartNumbers.length} of ${item.multipartUpload.partCount} confirmed source parts.` : "Preparing a private source upload session.") : item.status === "archived" ? "This source is archived in the authorized workspace and cannot be edited or rendered." : "A secure workspace connection is required before this source enters private processing."}</Text>
            <Pressable onPress={() => { selectSource(item.id); router.push("/review" as never); }} style={({ pressed }) => [styles.action, { borderColor: colors.border }, pressed && styles.pressed]}>
              <IconSymbol name="sparkles" size={19} color={colors.primary} /><Text style={[styles.actionText, { color: colors.foreground }]}>Review adaptation plan</Text>
            </Pressable>
            {item.serverVideoId ? <Pressable onPress={() => { selectSource(item.id); router.push("/processing-detail" as never); }} style={({ pressed }) => [styles.action, { borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="clock.arrow.circlepath" size={19} color={colors.primary} /><Text style={[styles.actionText, { color: colors.foreground }]}>View processing status</Text></Pressable> : null}
            {item.uri && (item.status === "ready_to_queue" || item.status === "failed") ? <Pressable onPress={() => void upload(item)} style={({ pressed }) => [styles.upload, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.uploadText, { color: colors.background }]}>{item.status === "failed" ? "Retry private upload" : "Upload to private processing"}</Text></Pressable> : null}
          </CreatorCard>
        )}
        ListEmptyComponent={<CreatorCard style={styles.empty}><IconSymbol name="rectangle.stack.fill" size={34} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No imported sources</Text><Text style={[styles.emptyCopy, { color: colors.muted }]}>Use Home to import permitted media from your device.</Text></CreatorCard>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 18, paddingBottom: 28 },
  heading: { gap: 6, marginBottom: 8 }, headingRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, headingCopy: { flex: 1, gap: 6 }, title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 }, copy: { fontSize: 15, lineHeight: 22 }, refresh: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, syncNotice: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
  card: { gap: 13 }, row: { flexDirection: "row", alignItems: "center", gap: 12 }, flex: { flex: 1, gap: 4 }, play: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" }, sourceTitle: { fontSize: 16, fontWeight: "800" }, meta: { fontSize: 13 }, explainer: { fontSize: 13, lineHeight: 19 },
  action: { height: 46, borderWidth: 1, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }, actionText: { fontSize: 14, fontWeight: "800" }, upload: { height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" }, uploadText: { fontSize: 14, fontWeight: "800" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  empty: { alignItems: "center", paddingVertical: 34 }, emptyTitle: { marginTop: 8, fontSize: 18, fontWeight: "800" }, emptyCopy: { marginTop: 4, fontSize: 14 },
});

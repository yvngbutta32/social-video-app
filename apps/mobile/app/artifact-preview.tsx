import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { artifactStateLabel, type AdaptationDetail, type PrivateArtifactPreview } from "@/lib/adaptation-contract";
import { getAdaptationDetail, getPrivateArtifactPreview } from "@/lib/viralboost-api";

export default function ArtifactPreviewScreen() {
  const colors = useColors();
  const { variantId } = useLocalSearchParams<{ variantId?: string }>();
  const [detail, setDetail] = useState<AdaptationDetail | null>(null);
  const [preview, setPreview] = useState<PrivateArtifactPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingPreview, setRequestingPreview] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const player = useVideoPlayer(preview?.url ?? null, (instance) => { instance.loop = false; });
  const { status: playerStatus } = useEvent(player, "statusChange", { status: player.status });

  const refresh = useCallback(async () => {
    if (!variantId) return;
    setLoading(true);
    setNotice(null);
    setPreview(null);
    try { setDetail(await getAdaptationDetail(variantId)); }
    catch { setDetail(null); setNotice("The adaptation status is not available from this private workspace right now."); }
    finally { setLoading(false); }
  }, [variantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const requestPreview = async () => {
    if (!variantId || !detail?.artifact) return;
    setRequestingPreview(true);
    setNotice(null);
    try { setPreview(await getPrivateArtifactPreview(variantId)); }
    catch { setPreview(null); setNotice("A workspace-authorized preview could not be created right now. It may be unavailable, expired, or unreachable from this device."); }
    finally { setRequestingPreview(false); }
  };

  if (!variantId) return <ScreenContainer className="p-6" edges={["top", "bottom", "left", "right"]}><Text style={[styles.empty, { color: colors.foreground }]}>Choose an adaptation before requesting a private artifact preview.</Text></ScreenContainer>;

  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><View style={styles.content}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View><Eyebrow>Private artifact</Eyebrow><Text style={[styles.title, { color: colors.foreground }]}>Creator review</Text></View></View>
    <CreatorCard style={styles.card}>{loading ? <ActivityIndicator color={colors.primary} /> : <><StatusPill tone={detail?.artifact ? "ready" : "muted"}>{detail?.artifact ? "ARTIFACT AVAILABLE" : "NO ARTIFACT YET"}</StatusPill><Text style={[styles.cardTitle, { color: colors.foreground }]}>{artifactStateLabel(detail?.artifact ?? null)}</Text><Text style={[styles.copy, { color: colors.muted }]}>{detail?.artifact ? "Request a short-lived, workspace-authorized preview only when you are ready to review it. The URL is held only in memory and is never saved to the device." : "The server has not confirmed a viewable artifact for this adaptation. Review its render state and refresh after processing completes."}</Text>{detail ? <Text style={[styles.renderState, { color: colors.muted }]}>Render state: {detail.renderState.replaceAll("_", " ")}</Text> : null}</>}</CreatorCard>
    {detail?.artifact && !preview ? <Pressable onPress={() => void requestPreview()} disabled={requestingPreview} style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary }, (pressed || requestingPreview) && styles.pressed]}>{requestingPreview ? <ActivityIndicator color={colors.background} /> : <><IconSymbol name="play.fill" size={18} color={colors.background} /><Text style={[styles.primaryText, { color: colors.background }]}>Load private preview</Text></>}</Pressable> : null}
    {preview ? <CreatorCard style={styles.card}><VideoView style={styles.video} player={player} nativeControls allowsFullscreen allowsPictureInPicture contentFit="contain" surfaceType="textureView" /><Text style={[styles.copy, { color: colors.muted }]}>{playerStatus === "loading" ? "Loading your authorized preview…" : `This signed preview expires at ${new Date(preview.expiresAt).toLocaleTimeString()}. Request a new one if it expires.`}</Text></CreatorCard> : null}
    {notice ? <Text style={[styles.notice, { color: colors.warning }]}>{notice}</Text> : null}
    <Pressable onPress={() => void refresh()} disabled={loading} style={({ pressed }) => [styles.refresh, { borderColor: colors.border }, (pressed || loading) && styles.pressed]}>{loading ? <ActivityIndicator color={colors.primary} /> : <><IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} /><Text style={[styles.refreshText, { color: colors.foreground }]}>Refresh artifact state</Text></>}</Pressable>
  </View></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { gap: 14, paddingTop: 16 }, header: { flexDirection: "row", gap: 12, alignItems: "center" }, iconButton: { height: 42, width: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, title: { marginTop: 3, fontSize: 18, fontWeight: "800" }, card: { gap: 12 }, cardTitle: { fontSize: 20, fontWeight: "800" }, copy: { fontSize: 14, lineHeight: 21 }, renderState: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" }, primary: { height: 50, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, primaryText: { fontSize: 15, fontWeight: "800" }, video: { width: "100%", aspectRatio: 9 / 16, backgroundColor: "#091520", borderRadius: 16 }, refresh: { height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, refreshText: { fontSize: 14, fontWeight: "800" }, notice: { fontSize: 13, lineHeight: 19, fontWeight: "700" }, empty: { fontSize: 20, fontWeight: "800", lineHeight: 28 }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

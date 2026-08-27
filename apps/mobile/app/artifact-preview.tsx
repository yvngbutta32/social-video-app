import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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

  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View><Eyebrow>Private artifact</Eyebrow><Text style={[styles.title, { color: colors.foreground }]}>Creator review</Text></View></View>
    <CreatorCard style={styles.card}>{loading ? <ActivityIndicator color={colors.primary} /> : <><StatusPill tone={detail?.artifact ? "ready" : "muted"}>{detail?.artifact ? "ARTIFACT AVAILABLE" : "NO ARTIFACT YET"}</StatusPill><Text style={[styles.cardTitle, { color: colors.foreground }]}>{artifactStateLabel(detail?.artifact ?? null)}</Text><Text style={[styles.copy, { color: colors.muted }]}>{detail?.artifact ? "Request a short-lived, workspace-authorized preview only when you are ready to review it. The URL is held only in memory and is never saved to the device." : "The server has not confirmed a viewable artifact for this adaptation. Review its render state and refresh after processing completes."}</Text>{detail ? <Text style={[styles.renderState, { color: colors.muted }]}>Render state: {detail.renderState.replaceAll("_", " ")}</Text> : null}</>}</CreatorCard>
    {detail?.artifact && !preview ? <Pressable onPress={() => void requestPreview()} disabled={requestingPreview} style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary }, (pressed || requestingPreview) && styles.pressed]}>{requestingPreview ? <ActivityIndicator color={colors.background} /> : <><IconSymbol name="play.fill" size={18} color={colors.background} /><Text style={[styles.primaryText, { color: colors.background }]}>Load private preview</Text></>}</Pressable> : null}
    {preview ? <CreatorCard style={styles.card}><VideoView style={styles.video} player={player} nativeControls allowsFullscreen allowsPictureInPicture contentFit="contain" surfaceType="textureView" /><Text style={[styles.copy, { color: colors.muted }]}>{playerStatus === "loading" ? "Loading your authorized preview…" : `This signed preview expires at ${new Date(preview.expiresAt).toLocaleTimeString()}. Request a new one if it expires.`}</Text></CreatorCard> : null}
    {notice ? <Text style={[styles.notice, { color: colors.warning }]}>{notice}</Text> : null}
    <Pressable onPress={() => void refresh()} disabled={loading} style={({ pressed }) => [styles.refresh, { borderColor: colors.border }, (pressed || loading) && styles.pressed]}>{loading ? <ActivityIndicator color={colors.primary} /> : <><IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} /><Text style={[styles.refreshText, { color: colors.foreground }]}>Refresh artifact state</Text></>}</Pressable>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { gap: 16, paddingTop: 22, paddingBottom: 32 }, header: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 2 }, iconButton: { height: 44, width: 44, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, title: { marginTop: 4, fontSize: 20, fontWeight: "800", letterSpacing: -0.25 }, card: { gap: 14, padding: 20 }, cardTitle: { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.45 }, copy: { fontSize: 14, lineHeight: 22 }, renderState: { fontSize: 11, fontWeight: "800", letterSpacing: 0.35, textTransform: "uppercase" }, primary: { height: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#55E6FF", shadowOpacity: 0.24, shadowRadius: 12, elevation: 5 }, primaryText: { fontSize: 15, fontWeight: "900" }, video: { width: "100%", aspectRatio: 9 / 16, backgroundColor: "#020B15", borderRadius: 20, borderWidth: 1, borderColor: "#284964" }, refresh: { height: 50, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: "#13273B" }, refreshText: { fontSize: 14, fontWeight: "900" }, notice: { fontSize: 13, lineHeight: 19, fontWeight: "700" }, empty: { fontSize: 20, fontWeight: "800", lineHeight: 28 }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

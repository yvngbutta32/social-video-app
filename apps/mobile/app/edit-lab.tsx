import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useEvent } from "expo";

import { CaptionQualityCard } from "@/components/caption-quality-card";
import { ClipCandidateReviewCard } from "@/components/clip-candidate-review-card";
import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { type AdaptationDetail, type PrivateArtifactPreview } from "@/lib/adaptation-contract";
import { creatorTargetPlatforms, useCreatorWorkflow, type CreatorTargetPlatform, type MobileEditRecipe } from "@/lib/creator-workflow";
import type { ClipCandidate, ClipSet } from "@/lib/clipping-contract";
import { localRecipeToManualEdit, serverRecipeToLocalRecipe } from "@/lib/edit-sync-contract";
import { adaptationRenderLifecycle } from "@/lib/render-lifecycle";
import { formatTimelineTime, normalizeTrimRange, nudgeTrimRange, trimDurationSeconds } from "@/lib/precision-timeline";
import { auditTimedCaptionTrack, formatCaptionTimestamp, normalizeTimedCaptionTrack, updateTimedCaptionCue } from "@/lib/timed-caption-contract";
import { getAdaptationDetail, getClipCandidates, getPrivateArtifactPreview, saveAdaptationEdit } from "@/lib/viralboost-api";

const compositionOptions: { value: MobileEditRecipe["composition"]; title: string; note: string }[] = [
  { value: "smart_crop", title: "Smart crop", note: "Focus the subject" },
  { value: "fit", title: "Fit", note: "Keep every edge" },
  { value: "blur_background", title: "Blur fill", note: "Keep the full frame" },
];

const headlinePlacementOptions: { value: MobileEditRecipe["headlinePlacement"]; title: string; note: string }[] = [
  { value: "upper_safe", title: "Upper safe", note: "Keeps the hook clear of top controls" },
  { value: "center_safe", title: "Center safe", note: "Places the hook through the visual center" },
  { value: "lower_safe", title: "Lower safe", note: "Reserves a measured lower margin" },
];

export default function EditLabScreen() {
  const colors = useColors();
  const { variantId } = useLocalSearchParams<{ variantId?: string }>();
  const serverVariantId = typeof variantId === "string" && variantId ? variantId : null;
  const { selectedSourceId, sources, recipeFor, saveRecipe, replaceRecipe, platformsFor } = useCreatorWorkflow();
  const source = useMemo(() => sources.find((item) => item.id === selectedSourceId) ?? null, [selectedSourceId, sources]);
  const initial = recipeFor(source?.id ?? "unselected");
  const [recipe, setRecipe] = useState(initial);
  const [advanced, setAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [adaptation, setAdaptation] = useState<AdaptationDetail | null>(null);
  const [loadingLifecycle, setLoadingLifecycle] = useState(false);
  const [lifecycleNotice, setLifecycleNotice] = useState<string | null>(null);
  const [privatePreview, setPrivatePreview] = useState<PrivateArtifactPreview | null>(null);
  const [requestingPreview, setRequestingPreview] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [clipSet, setClipSet] = useState<ClipSet | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const [clipNotice, setClipNotice] = useState<string | null>(null);
  const [clipPlatform, setClipPlatform] = useState<CreatorTargetPlatform>("tiktok");
  const player = useVideoPlayer(privatePreview?.url ?? null, (instance) => { instance.loop = false; });
  const { status: playerStatus } = useEvent(player, "statusChange", { status: player.status });

  useEffect(() => { setRecipe(recipeFor(source?.id ?? "unselected")); setSaved(false); setSyncNotice(null); }, [recipeFor, source?.id, serverVariantId]);

  const refreshLifecycle = useCallback(async () => {
    if (!serverVariantId) return;
    setLoadingLifecycle(true);
    setLifecycleNotice(null);
    try { setAdaptation(await getAdaptationDetail(serverVariantId)); }
    catch { setAdaptation(null); setLifecycleNotice("The current private render status is unavailable. Your local revision remains unchanged; refresh after the workspace is available."); }
    finally { setLoadingLifecycle(false); }
  }, [serverVariantId]);

  useEffect(() => { void refreshLifecycle(); }, [refreshLifecycle]);

  const sourceId = source?.id ?? null;
  const serverVideoId = source?.serverVideoId ?? null;
  useEffect(() => {
    setClipPlatform(sourceId ? platformsFor(sourceId)[0] ?? "tiktok" : "tiktok");
  }, [platformsFor, sourceId]);

  useEffect(() => {
    let active = true;
    if (!serverVideoId) {
      setClipSet(null);
      setClipNotice(null);
      return () => { active = false; };
    }
    setClipLoading(true);
    setClipNotice(null);
    void getClipCandidates(serverVideoId, clipPlatform).then((nextClipSet) => {
      if (active) setClipSet(nextClipSet);
    }).catch(() => {
      if (active) {
        setClipSet(null);
        setClipNotice("Server clip analysis is not available yet. Manual trimming remains ready below.");
      }
    }).finally(() => {
      if (active) setClipLoading(false);
    });
    return () => { active = false; };
  }, [clipPlatform, serverVideoId]);

  if (!source) {
    return <ScreenContainer className="p-6"><Text style={[styles.empty, { color: colors.foreground }]}>Choose a source from Library before opening Edit Lab.</Text><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}><Text style={{ color: colors.foreground, fontWeight: "800" }}>Back to Library</Text></Pressable></ScreenContainer>;
  }

  const update = <K extends keyof MobileEditRecipe>(key: K, value: MobileEditRecipe[K]) => setRecipe((current) => ({ ...current, [key]: value }));
  const currentTrim = normalizeTrimRange(recipe);
  const timelineMaximum = Math.max(30, Math.ceil(currentTrim.trimEndSeconds + 5));
  const timelineStartPercent = `${(currentTrim.trimStartSeconds / timelineMaximum) * 100}%` as `${number}%`;
  const timelineWidthPercent = `${Math.max((trimDurationSeconds(currentTrim) / timelineMaximum) * 100, 2)}%` as `${number}%`;
  const updateTrim = (range: typeof currentTrim) => setRecipe((current) => ({ ...current, ...normalizeTrimRange(range) }));
  const captionTrack = recipe.timedCaptionTrack ? normalizeTimedCaptionTrack(recipe.timedCaptionTrack) : null;
  const captionQuality = captionTrack ? auditTimedCaptionTrack(captionTrack) : null;
  const updateCaptionCue = (cueId: string, edit: Parameters<typeof updateTimedCaptionCue>[2]) => {
    if (!captionTrack) return;
    update("timedCaptionTrack", updateTimedCaptionCue(captionTrack, cueId, edit));
  };
  const loadPrivatePreview = async () => {
    if (!serverVariantId || !adaptation?.artifact) return;
    setRequestingPreview(true);
    setPreviewNotice(null);
    try {
      setPrivatePreview(await getPrivateArtifactPreview(serverVariantId));
    } catch {
      setPrivatePreview(null);
      setPreviewNotice("A private preview could not be created right now. It may be unavailable, expired, or unreachable from this device.");
    } finally {
      setRequestingPreview(false);
    }
  };
  const save = async () => {
    const recipeToSave = { ...recipe, ...normalizeTrimRange(recipe) };
    setRecipe(recipeToSave);
    setPrivatePreview(null);
    setPreviewNotice(null);
    saveRecipe({ ...recipeToSave, sourceId: source.id });
    setSaved(true);
    if (!serverVariantId) {
      setSyncNotice("Revision saved locally. This blueprint has no server adaptation yet, so no private render was requested.");
      return;
    }
    setSaving(true);
    setSyncNotice(null);
    try {
      const result = await saveAdaptationEdit(serverVariantId, localRecipeToManualEdit(recipeToSave));
      const synchronized = serverRecipeToLocalRecipe(source.id, result.recipe, recipeToSave);
      setRecipe(synchronized);
      replaceRecipe(synchronized);
      setSyncNotice(result.nextStep);
      void refreshLifecycle();
    } catch {
      setSyncNotice("This revision remains saved locally. The secure workspace could not confirm a render request yet; retry after the adaptation service is available.");
    } finally { setSaving(false); }
  };
  const lifecycle = adaptationRenderLifecycle(adaptation);

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View style={styles.headerCopy}><Eyebrow>Advanced edit lab</Eyebrow><Text numberOfLines={1} style={[styles.sourceName, { color: colors.foreground }]}>{source.name}</Text></View></View>
        <CreatorCard><StatusPill tone={serverVariantId ? "accent" : "muted"}>{serverVariantId ? "SERVER RECIPE" : "LOCAL RECIPE"} · REVISION {recipe.revision}</StatusPill><Text style={[styles.cardTitle, { color: colors.foreground }]}>Shape the draft before it renders.</Text><Text style={[styles.copy, { color: colors.muted }]}>{serverVariantId ? "These changes stay separate from your original. Saving requests a new private render; it does not publish anything." : "These changes stay separate from your original. A server adaptation is required before a private render can be queued."}</Text></CreatorCard>
        <ClipCandidateReviewCard clipSet={clipSet} loading={clipLoading} notice={clipNotice} platform={clipPlatform} platforms={creatorTargetPlatforms} selectedPlatform={clipPlatform} selectedCandidateId={recipe.selectedClipCandidateId} onPlatformChange={setClipPlatform} onAccept={(candidate: ClipCandidate) => { updateTrim(candidate.range); update("selectedClipCandidateId", candidate.id); setClipSet((current) => current ? { ...current, candidates: current.candidates.map((item) => item.id === candidate.id ? { ...item, status: "accepted" } : item) } : current); setSyncNotice("Clip range accepted locally. Save the revision to preserve this candidate’s lineage for private rendering."); }} onEdit={(candidate: ClipCandidate) => { updateTrim(candidate.range); update("selectedClipCandidateId", candidate.id); setSyncNotice("Clip range edited locally. Save the revision to preserve this candidate’s lineage for private rendering."); }} onReject={(candidate: ClipCandidate) => { update("selectedClipCandidateId", recipe.selectedClipCandidateId === candidate.id ? undefined : recipe.selectedClipCandidateId); setClipSet((current) => current ? { ...current, candidates: current.candidates.map((item) => item.id === candidate.id ? { ...item, status: "rejected" } : item) } : current); }} />
        {serverVariantId ? <CreatorCard style={styles.lifecycleCard}><View style={styles.lifecycleTop}><View><Eyebrow>Private render lifecycle</Eyebrow><Text style={[styles.lifecycleTitle, { color: colors.foreground }]}>{lifecycle.label}</Text></View><StatusPill tone={lifecycle.tone}>{adaptation?.status?.toUpperCase() ?? "CHECKING"}</StatusPill></View><Text style={[styles.copy, { color: colors.muted }]}>{lifecycle.detail}</Text>{lifecycleNotice ? <Text style={[styles.lifecycleNotice, { color: colors.warning }]}>{lifecycleNotice}</Text> : null}<View style={styles.lifecycleActions}><Pressable onPress={() => void refreshLifecycle()} disabled={loadingLifecycle} style={({ pressed }) => [styles.lifecycleButton, { borderColor: colors.border }, (pressed || loadingLifecycle) && styles.pressed]}>{loadingLifecycle ? <ActivityIndicator color={colors.primary} /> : <><IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} /><Text style={[styles.lifecycleButtonText, { color: colors.foreground }]}>Refresh status</Text></>}</Pressable>{lifecycle.canPreview ? <Pressable onPress={() => router.push({ pathname: "/artifact-preview", params: { variantId: serverVariantId } } as never)} style={({ pressed }) => [styles.lifecycleButton, { borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="play.fill" size={16} color={colors.primary} /><Text style={[styles.lifecycleButtonText, { color: colors.foreground }]}>Review artifact</Text></Pressable> : null}</View></CreatorCard> : null}
        {serverVariantId && lifecycle.canPreview ? <CreatorCard style={styles.previewCard}><View style={styles.previewHeading}><View><Eyebrow>Private inspection</Eyebrow><Text style={[styles.previewTitle, { color: colors.foreground }]}>Inspect this cut before you decide.</Text></View><StatusPill tone="ready">REVIEW READY</StatusPill></View><Text style={[styles.copy, { color: colors.muted }]}>Load the latest signed render here to check pacing and framing. This review stays private, expires automatically, and does not publish or share your draft.</Text>{privatePreview ? <><VideoView style={styles.previewVideo} player={player} nativeControls contentFit="contain" surfaceType="textureView" /><Text style={[styles.previewMeta, { color: colors.muted }]}>{playerStatus === "loading" ? "Loading the authorized preview…" : `Private preview expires at ${new Date(privatePreview.expiresAt).toLocaleTimeString()}.`}</Text></> : null}{previewNotice ? <Text style={[styles.previewNotice, { color: colors.warning }]}>{previewNotice}</Text> : null}<View style={styles.previewActions}><Pressable accessibilityRole="button" accessibilityLabel={privatePreview ? "Refresh private in-editor preview" : "Load private in-editor preview"} accessibilityHint="Uses a short-lived workspace-authorized URL and does not publish this draft." onPress={() => void loadPrivatePreview()} disabled={requestingPreview} style={({ pressed }) => [styles.previewPrimary, { backgroundColor: colors.primary }, (pressed || requestingPreview) && styles.pressed]}>{requestingPreview ? <ActivityIndicator color={colors.background} /> : <><IconSymbol name="play.fill" size={17} color={colors.background} /><Text style={[styles.previewPrimaryText, { color: colors.background }]}>{privatePreview ? "Refresh preview" : "Load preview"}</Text></>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open full private artifact review" accessibilityHint="Opens the same workspace-authorized artifact in a dedicated review screen; it does not publish." onPress={() => router.push({ pathname: "/artifact-preview", params: { variantId: serverVariantId } } as never)} style={({ pressed }) => [styles.previewSecondary, { borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="arrow.up.right.square" size={17} color={colors.primary} /><Text style={[styles.previewSecondaryText, { color: colors.foreground }]}>Full review</Text></Pressable></View></CreatorCard> : null}
        <CreatorCard style={styles.controls}>
          <Text style={[styles.label, { color: colors.foreground }]}>Trim range</Text>
          <View style={[styles.timeline, { borderColor: colors.border }]} accessibilityLabel={`Precision timeline. Trim starts at ${formatTimelineTime(currentTrim.trimStartSeconds)}, ends at ${formatTimelineTime(currentTrim.trimEndSeconds)}, duration ${formatTimelineTime(trimDurationSeconds(currentTrim))}.`}>
            <View style={styles.timelineTopline}><Eyebrow>Precision timeline</Eyebrow><Text style={[styles.timelineDuration, { color: colors.primary }]}>{formatTimelineTime(trimDurationSeconds(currentTrim))} cut</Text></View>
            <View style={[styles.timelineTrack, { backgroundColor: colors.border }]}>{Array.from({ length: 6 }).map((_, index) => <View key={index} style={[styles.timelineFrame, { borderColor: `${colors.primary}33`, backgroundColor: index % 2 === 0 ? "#16344C" : "#10283D" }]} />)}<View pointerEvents="none" style={[styles.timelineSelection, { left: timelineStartPercent, width: timelineWidthPercent, borderColor: colors.primary }]} /></View>
            <View style={styles.timelineMeta}><Text style={[styles.timelineTime, { color: colors.foreground }]}>{formatTimelineTime(currentTrim.trimStartSeconds)}</Text><Text style={[styles.timelineTime, { color: colors.foreground }]}>{formatTimelineTime(currentTrim.trimEndSeconds)}</Text></View>
            <View style={styles.trimNudges}><View style={styles.nudgeGroup}><Text style={[styles.nudgeLabel, { color: colors.muted }]}>Start</Text><View style={styles.nudgeButtons}><Pressable accessibilityRole="button" accessibilityLabel="Move trim start earlier by half a second" onPress={() => updateTrim(nudgeTrimRange(currentTrim, "start", -0.5))} style={({ pressed }) => [styles.nudgeButton, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.nudgeText, { color: colors.foreground }]}>−0.5</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Move trim start later by half a second" onPress={() => updateTrim(nudgeTrimRange(currentTrim, "start", 0.5))} style={({ pressed }) => [styles.nudgeButton, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.nudgeText, { color: colors.foreground }]}>+0.5</Text></Pressable></View></View><View style={styles.nudgeGroup}><Text style={[styles.nudgeLabel, { color: colors.muted }]}>End</Text><View style={styles.nudgeButtons}><Pressable accessibilityRole="button" accessibilityLabel="Move trim end earlier by half a second" onPress={() => updateTrim(nudgeTrimRange(currentTrim, "end", -0.5))} style={({ pressed }) => [styles.nudgeButton, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.nudgeText, { color: colors.foreground }]}>−0.5</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Move trim end later by half a second" onPress={() => updateTrim(nudgeTrimRange(currentTrim, "end", 0.5))} style={({ pressed }) => [styles.nudgeButton, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.nudgeText, { color: colors.foreground }]}>+0.5</Text></Pressable></View></View></View>
          </View>
          <View style={styles.fieldRow}><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>Start seconds</Text><TextInput value={String(recipe.trimStartSeconds)} onChangeText={(text) => updateTrim({ trimStartSeconds: Number(text.replace(/[^0-9.]/g, "")) || 0, trimEndSeconds: recipe.trimEndSeconds })} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>End seconds</Text><TextInput value={String(recipe.trimEndSeconds)} onChangeText={(text) => updateTrim({ trimStartSeconds: recipe.trimStartSeconds, trimEndSeconds: Number(text.replace(/[^0-9.]/g, "")) || 0 })} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View></View>
          <Text style={[styles.label, { color: colors.foreground }]}>Composition</Text>
          {compositionOptions.map((option) => <Pressable key={option.value} onPress={() => update("composition", option.value)} style={({ pressed }) => [styles.option, { borderColor: recipe.composition === option.value ? colors.primary : colors.border, backgroundColor: recipe.composition === option.value ? `${colors.primary}14` : "transparent" }, pressed && styles.pressed]}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>{option.title}</Text><Text style={[styles.optionNote, { color: colors.muted }]}>{option.note}</Text></View>{recipe.composition === option.value ? <IconSymbol name="checkmark.seal.fill" size={20} color={colors.primary} /> : null}</Pressable>)}
          <Pressable onPress={() => setAdvanced((value) => !value)} style={({ pressed }) => [styles.advancedButton, pressed && styles.pressed]}><IconSymbol name="scissors" size={20} color={colors.primary} /><Text style={[styles.advancedText, { color: colors.primary }]}>{advanced ? "Hide advanced controls" : "Show advanced controls"}</Text></Pressable>{advanced && captionQuality ? <CaptionQualityCard report={captionQuality} colors={colors} /> : null}
          {advanced ? <View style={styles.advanced}><Text style={[styles.label, { color: colors.foreground }]}>Focal framing</Text><View style={styles.fieldRow}><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>Horizontal (0–1)</Text><TextInput value={recipe.focalX.toFixed(2)} onChangeText={(text) => update("focalX", Math.max(0, Math.min(1, Number(text) || 0)))} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>Vertical (0–1)</Text><TextInput value={recipe.focalY.toFixed(2)} onChangeText={(text) => update("focalY", Math.max(0, Math.min(1, Number(text) || 0)))} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View></View><Text style={[styles.fieldLabel, { color: colors.muted }]}>Headline overlay</Text><TextInput value={recipe.headline} onChangeText={(text) => update("headline", text.slice(0, 96))} placeholder="Optional short headline" placeholderTextColor={colors.muted} returnKeyType="done" style={[styles.input, styles.fullInput, { color: colors.foreground, borderColor: colors.border }]} /><View style={styles.headlinePlacement}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>Headline placement</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Applied to the rendered headline overlay, not timed captions.</Text></View>{headlinePlacementOptions.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: recipe.headlinePlacement === option.value }} accessibilityLabel={`${option.title} headline placement${recipe.headlinePlacement === option.value ? ", selected" : ""}`} accessibilityHint={`${option.note}. This changes the next private render only.`} onPress={() => update("headlinePlacement", option.value)} style={({ pressed }) => [styles.placementOption, { borderColor: recipe.headlinePlacement === option.value ? colors.primary : colors.border, backgroundColor: recipe.headlinePlacement === option.value ? `${colors.primary}16` : "#13273B" }, pressed && styles.pressed]}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>{option.title}</Text><Text style={[styles.optionNote, { color: colors.muted }]}>{option.note}</Text></View>{recipe.headlinePlacement === option.value ? <IconSymbol name="sparkles" size={18} color={colors.primary} /> : null}</Pressable>)}</View><View style={styles.switchRow}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>Caption preference</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Timed captions require transcript cues.</Text></View><Switch value={recipe.captionsEnabled} onValueChange={(value) => update("captionsEnabled", value)} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={recipe.captionsEnabled ? colors.primary : colors.muted} /></View><View style={[styles.captionPanel, { borderColor: colors.border }]}><View style={styles.switchRow}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>Timed-caption track</Text><Text style={[styles.optionNote, { color: colors.muted }]}>{captionTrack ? `${captionTrack.language.toUpperCase()} · ${captionTrack.cues.length} cues · ${captionTrack.source.replace("_", " ")}` : "No transcript track is available for this source yet."}</Text></View><StatusPill tone={captionTrack ? "accent" : "muted"}>{captionTrack ? "REVIEW" : "UNAVAILABLE"}</StatusPill></View>{captionTrack?.cues.length ? captionTrack.cues.map((cue) => <View key={cue.id} style={[styles.captionCue, { borderColor: colors.border }]}><View style={styles.captionCueMeta}><Text style={[styles.fieldLabel, { color: colors.primary }]}>{formatCaptionTimestamp(cue.startMs)}–{formatCaptionTimestamp(cue.endMs)}</Text><Text style={[styles.fieldLabel, { color: cue.confidence === "verified" ? colors.success : colors.warning }]}>{cue.confidence.toUpperCase()}</Text></View><TextInput accessibilityLabel={`Caption text at ${formatCaptionTimestamp(cue.startMs)}`} value={cue.text} onChangeText={(text) => updateCaptionCue(cue.id, { text })} multiline style={[styles.captionInput, { color: colors.foreground, borderColor: colors.border }]} /></View>) : <Text style={[styles.optionNote, { color: colors.warning }]}>This control will not invent transcript text. Connect a transcript-producing source workflow before timed captions can be edited or rendered.</Text>}</View><View style={styles.switchRow}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>Normalize audio</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Apply during server rendering.</Text></View><Switch value={recipe.normalizeAudio} onValueChange={(value) => update("normalizeAudio", value)} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={recipe.normalizeAudio ? colors.primary : colors.muted} /></View></View> : null}
        </CreatorCard>
        {syncNotice ? <Text style={[styles.notice, { color: colors.muted }]}>{syncNotice}</Text> : null}
        <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, (pressed || saving) && styles.pressed]}>{saving ? <ActivityIndicator color={colors.background} /> : <IconSymbol name="wand.and.stars" size={20} color={colors.background} />}<Text style={[styles.saveText, { color: colors.background }]}>{saving ? "Saving secure revision" : saved ? (serverVariantId ? "Revision saved and queued" : "Revision saved locally") : "Save edit revision"}</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 22, paddingBottom: 32, gap: 16 }, captionPanel: { gap: 12, borderWidth: 1, borderRadius: 17, padding: 14, backgroundColor: "#091827" }, captionCue: { gap: 8, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: "#0C1B2D" }, captionCueMeta: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, captionInput: { minHeight: 54, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, fontSize: 15, lineHeight: 20, backgroundColor: "#102238" }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 }, iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, headerCopy: { flex: 1, gap: 3 }, sourceName: { fontSize: 18, fontWeight: "800", letterSpacing: -0.25 }, cardTitle: { fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4 }, copy: { fontSize: 14, lineHeight: 22 }, lifecycleCard: { gap: 12, backgroundColor: "#0C1B2D" }, lifecycleTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }, lifecycleTitle: { marginTop: 5, fontSize: 18, fontWeight: "800", letterSpacing: -0.25 }, lifecycleNotice: { fontSize: 12, lineHeight: 18, fontWeight: "700" }, lifecycleActions: { flexDirection: "row", gap: 9 }, lifecycleButton: { flex: 1, height: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: "#13273B" }, lifecycleButtonText: { fontSize: 12, fontWeight: "900" }, previewCard: { gap: 13, padding: 20, backgroundColor: "#0B2033" }, previewHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }, previewTitle: { marginTop: 5, maxWidth: 210, fontSize: 20, lineHeight: 25, fontWeight: "900", letterSpacing: -0.35 }, previewVideo: { width: "100%", aspectRatio: 9 / 16, backgroundColor: "#020B15", borderRadius: 20, borderWidth: 1, borderColor: "#284964" }, previewMeta: { fontSize: 12, fontWeight: "700", lineHeight: 18 }, previewNotice: { fontSize: 12, fontWeight: "800", lineHeight: 18 }, previewActions: { flexDirection: "row", gap: 9 }, previewPrimary: { flex: 1.2, minHeight: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }, previewPrimaryText: { fontSize: 13, fontWeight: "900" }, previewSecondary: { flex: 1, minHeight: 48, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: "#13273B" }, previewSecondaryText: { fontSize: 13, fontWeight: "900" }, controls: { gap: 15, padding: 20 }, label: { fontSize: 16, fontWeight: "900", letterSpacing: -0.15 }, timeline: { gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, backgroundColor: "#091827" }, timelineTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, timelineDuration: { fontSize: 12, fontWeight: "900", letterSpacing: 0.2 }, timelineTrack: { height: 54, overflow: "hidden", borderRadius: 13, flexDirection: "row", gap: 2, padding: 2 }, timelineFrame: { flex: 1, borderWidth: 1, borderRadius: 9 }, timelineSelection: { position: "absolute", top: 2, bottom: 2, borderWidth: 2, borderRadius: 10, backgroundColor: "#55E6FF22", minWidth: 12 }, timelineMeta: { flexDirection: "row", justifyContent: "space-between" }, timelineTime: { fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] }, trimNudges: { flexDirection: "row", gap: 10 }, nudgeGroup: { flex: 1, gap: 7 }, nudgeLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }, nudgeButtons: { flexDirection: "row", gap: 6 }, nudgeButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, nudgeText: { fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }, fieldRow: { flexDirection: "row", gap: 10 }, field: { flex: 1, gap: 7 }, fieldLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.15 }, input: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 16, fontWeight: "700", backgroundColor: "#0C1B2D" }, fullInput: { marginTop: 5 }, option: { borderWidth: 1, borderRadius: 17, padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#13273B" }, optionTitle: { fontSize: 14, fontWeight: "900" }, optionNote: { marginTop: 4, fontSize: 12, lineHeight: 17 }, headlinePlacement: { gap: 9, marginTop: 4 }, placementOption: { minHeight: 58, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, advancedButton: { minHeight: 44, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 8 }, advancedText: { fontSize: 14, fontWeight: "900" }, advanced: { gap: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#36526C", paddingTop: 15 }, switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, save: { height: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#55E6FF", shadowOpacity: 0.24, shadowRadius: 13, elevation: 6 }, saveText: { fontSize: 16, fontWeight: "900" }, notice: { fontSize: 13, lineHeight: 19, fontWeight: "700" }, empty: { fontSize: 20, lineHeight: 28, fontWeight: "800" }, back: { marginTop: 16, height: 50, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});

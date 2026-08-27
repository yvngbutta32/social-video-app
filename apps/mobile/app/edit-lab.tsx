import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { type AdaptationDetail } from "@/lib/adaptation-contract";
import { useCreatorWorkflow, type MobileEditRecipe } from "@/lib/creator-workflow";
import { localRecipeToManualEdit, serverRecipeToLocalRecipe } from "@/lib/edit-sync-contract";
import { adaptationRenderLifecycle } from "@/lib/render-lifecycle";
import { formatTimelineTime, normalizeTrimRange, nudgeTrimRange, trimDurationSeconds } from "@/lib/precision-timeline";
import { getAdaptationDetail, saveAdaptationEdit } from "@/lib/viralboost-api";

const compositionOptions: { value: MobileEditRecipe["composition"]; title: string; note: string }[] = [
  { value: "smart_crop", title: "Smart crop", note: "Focus the subject" },
  { value: "fit", title: "Fit", note: "Keep every edge" },
  { value: "blur_background", title: "Blur fill", note: "Keep the full frame" },
];

export default function EditLabScreen() {
  const colors = useColors();
  const { variantId } = useLocalSearchParams<{ variantId?: string }>();
  const serverVariantId = typeof variantId === "string" && variantId ? variantId : null;
  const { selectedSourceId, sources, recipeFor, saveRecipe, replaceRecipe } = useCreatorWorkflow();
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

  if (!source) {
    return <ScreenContainer className="p-6"><Text style={[styles.empty, { color: colors.foreground }]}>Choose a source from Library before opening Edit Lab.</Text><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={{ color: colors.foreground, fontWeight: "800" }}>Back to Library</Text></Pressable></ScreenContainer>;
  }

  const update = <K extends keyof MobileEditRecipe>(key: K, value: MobileEditRecipe[K]) => setRecipe((current) => ({ ...current, [key]: value }));
  const currentTrim = normalizeTrimRange(recipe);
  const timelineMaximum = Math.max(30, Math.ceil(currentTrim.trimEndSeconds + 5));
  const timelineStartPercent = `${(currentTrim.trimStartSeconds / timelineMaximum) * 100}%` as `${number}%`;
  const timelineWidthPercent = `${Math.max((trimDurationSeconds(currentTrim) / timelineMaximum) * 100, 2)}%` as `${number}%`;
  const updateTrim = (range: typeof currentTrim) => setRecipe((current) => ({ ...current, ...normalizeTrimRange(range) }));
  const save = async () => {
    const recipeToSave = { ...recipe, ...normalizeTrimRange(recipe) };
    setRecipe(recipeToSave);
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
        {serverVariantId ? <CreatorCard style={styles.lifecycleCard}><View style={styles.lifecycleTop}><View><Eyebrow>Private render lifecycle</Eyebrow><Text style={[styles.lifecycleTitle, { color: colors.foreground }]}>{lifecycle.label}</Text></View><StatusPill tone={lifecycle.tone}>{adaptation?.status?.toUpperCase() ?? "CHECKING"}</StatusPill></View><Text style={[styles.copy, { color: colors.muted }]}>{lifecycle.detail}</Text>{lifecycleNotice ? <Text style={[styles.lifecycleNotice, { color: colors.warning }]}>{lifecycleNotice}</Text> : null}<View style={styles.lifecycleActions}><Pressable onPress={() => void refreshLifecycle()} disabled={loadingLifecycle} style={({ pressed }) => [styles.lifecycleButton, { borderColor: colors.border }, (pressed || loadingLifecycle) && styles.pressed]}>{loadingLifecycle ? <ActivityIndicator color={colors.primary} /> : <><IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} /><Text style={[styles.lifecycleButtonText, { color: colors.foreground }]}>Refresh status</Text></>}</Pressable>{lifecycle.canPreview ? <Pressable onPress={() => router.push({ pathname: "/artifact-preview", params: { variantId: serverVariantId } } as never)} style={({ pressed }) => [styles.lifecycleButton, { borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="play.fill" size={16} color={colors.primary} /><Text style={[styles.lifecycleButtonText, { color: colors.foreground }]}>Review artifact</Text></Pressable> : null}</View></CreatorCard> : null}
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
          {compositionOptions.map((option) => <Pressable key={option.value} onPress={() => update("composition", option.value)} style={({ pressed }) => [styles.option, { borderColor: recipe.composition === option.value ? colors.primary : colors.border, backgroundColor: recipe.composition === option.value ? `${colors.primary}14` : "transparent" }, pressed && styles.pressed]}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>{option.title}</Text><Text style={[styles.optionNote, { color: colors.muted }]}>{option.note}</Text></View>{recipe.composition === option.value ? <IconSymbol name="sparkles" size={20} color={colors.primary} /> : null}</Pressable>)}
          <Pressable onPress={() => setAdvanced((value) => !value)} style={({ pressed }) => [styles.advancedButton, pressed && styles.pressed]}><IconSymbol name="slider.horizontal.3" size={20} color={colors.primary} /><Text style={[styles.advancedText, { color: colors.primary }]}>{advanced ? "Hide advanced controls" : "Show advanced controls"}</Text></Pressable>
          {advanced ? <View style={styles.advanced}><Text style={[styles.label, { color: colors.foreground }]}>Focal framing</Text><View style={styles.fieldRow}><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>Horizontal (0–1)</Text><TextInput value={recipe.focalX.toFixed(2)} onChangeText={(text) => update("focalX", Math.max(0, Math.min(1, Number(text) || 0)))} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>Vertical (0–1)</Text><TextInput value={recipe.focalY.toFixed(2)} onChangeText={(text) => update("focalY", Math.max(0, Math.min(1, Number(text) || 0)))} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View></View><Text style={[styles.fieldLabel, { color: colors.muted }]}>Headline overlay</Text><TextInput value={recipe.headline} onChangeText={(text) => update("headline", text.slice(0, 96))} placeholder="Optional short headline" placeholderTextColor={colors.muted} returnKeyType="done" style={[styles.input, styles.fullInput, { color: colors.foreground, borderColor: colors.border }]} /><View style={styles.switchRow}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>Caption preference</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Timed captions require transcript cues.</Text></View><Switch value={recipe.captionsEnabled} onValueChange={(value) => update("captionsEnabled", value)} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={recipe.captionsEnabled ? colors.primary : colors.muted} /></View><View style={styles.switchRow}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>Normalize audio</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Apply during server rendering.</Text></View><Switch value={recipe.normalizeAudio} onValueChange={(value) => update("normalizeAudio", value)} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={recipe.normalizeAudio ? colors.primary : colors.muted} /></View></View> : null}
        </CreatorCard>
        {syncNotice ? <Text style={[styles.notice, { color: colors.muted }]}>{syncNotice}</Text> : null}
        <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, (pressed || saving) && styles.pressed]}>{saving ? <ActivityIndicator color={colors.background} /> : <IconSymbol name="wand.and.stars" size={20} color={colors.background} />}<Text style={[styles.saveText, { color: colors.background }]}>{saving ? "Saving secure revision" : saved ? (serverVariantId ? "Revision saved and queued" : "Revision saved locally") : "Save edit revision"}</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 22, paddingBottom: 32, gap: 16 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 }, iconButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, headerCopy: { flex: 1, gap: 3 }, sourceName: { fontSize: 18, fontWeight: "800", letterSpacing: -0.25 }, cardTitle: { fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4 }, copy: { fontSize: 14, lineHeight: 22 }, lifecycleCard: { gap: 12, backgroundColor: "#0C1B2D" }, lifecycleTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }, lifecycleTitle: { marginTop: 5, fontSize: 18, fontWeight: "800", letterSpacing: -0.25 }, lifecycleNotice: { fontSize: 12, lineHeight: 18, fontWeight: "700" }, lifecycleActions: { flexDirection: "row", gap: 9 }, lifecycleButton: { flex: 1, height: 46, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: "#13273B" }, lifecycleButtonText: { fontSize: 12, fontWeight: "900" }, controls: { gap: 15, padding: 20 }, label: { fontSize: 16, fontWeight: "900", letterSpacing: -0.15 }, timeline: { gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, backgroundColor: "#091827" }, timelineTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, timelineDuration: { fontSize: 12, fontWeight: "900", letterSpacing: 0.2 }, timelineTrack: { height: 54, overflow: "hidden", borderRadius: 13, flexDirection: "row", gap: 2, padding: 2 }, timelineFrame: { flex: 1, borderWidth: 1, borderRadius: 9 }, timelineSelection: { position: "absolute", top: 2, bottom: 2, borderWidth: 2, borderRadius: 10, backgroundColor: "#55E6FF22", minWidth: 12 }, timelineMeta: { flexDirection: "row", justifyContent: "space-between" }, timelineTime: { fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] }, trimNudges: { flexDirection: "row", gap: 10 }, nudgeGroup: { flex: 1, gap: 7 }, nudgeLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }, nudgeButtons: { flexDirection: "row", gap: 6 }, nudgeButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, nudgeText: { fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }, fieldRow: { flexDirection: "row", gap: 10 }, field: { flex: 1, gap: 7 }, fieldLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.15 }, input: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 16, fontWeight: "700", backgroundColor: "#0C1B2D" }, fullInput: { marginTop: 5 }, option: { borderWidth: 1, borderRadius: 17, padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#13273B" }, optionTitle: { fontSize: 14, fontWeight: "900" }, optionNote: { marginTop: 4, fontSize: 12, lineHeight: 17 }, advancedButton: { minHeight: 44, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 8 }, advancedText: { fontSize: 14, fontWeight: "900" }, advanced: { gap: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#36526C", paddingTop: 15 }, switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, save: { height: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#55E6FF", shadowOpacity: 0.24, shadowRadius: 13, elevation: 6 }, saveText: { fontSize: 16, fontWeight: "900" }, notice: { fontSize: 13, lineHeight: 19, fontWeight: "700" }, empty: { fontSize: 20, lineHeight: 28, fontWeight: "800" }, back: { marginTop: 16, height: 50, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#13273B" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});

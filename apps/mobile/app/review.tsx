import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { type AdaptationPlan } from "@/lib/adaptation-contract";
import { type PlatformTargetConnectionState } from "@/lib/platform-target-capabilities";
import { creatorTargetPlatforms, type CreatorTargetPlatform, useCreatorWorkflow } from "@/lib/creator-workflow";
import { formatDuration } from "@/lib/media-format";
import { getPlatformTargetConnectionStates, isViralBoostApiConfigured, prepareAdaptationPlan } from "@/lib/viralboost-api";

type ReviewDraft = { key: string; platform: string; format: string; focus: string; status: string; variantId?: string; caption?: string };

const localBlueprints: ReviewDraft[] = [
  { key: "tiktok", platform: "TikTok", format: "9:16 vertical", focus: "Immediate visual context and a concise first idea", status: "LOCAL BLUEPRINT" },
  { key: "instagram", platform: "Instagram Reels", format: "9:16 vertical", focus: "Strong cover-safe framing and a shareable takeaway", status: "LOCAL BLUEPRINT" },
  { key: "youtube", platform: "YouTube Shorts", format: "9:16 vertical", focus: "Clear hook, topic continuity, and end-screen-safe composition", status: "LOCAL BLUEPRINT" },
  { key: "linkedin", platform: "LinkedIn", format: "9:16 or 1:1", focus: "A useful professional insight with readable visual hierarchy", status: "LOCAL BLUEPRINT" },
];

function formatPlatform(platform: string) {
  return ({ tiktok: "TikTok", instagram: "Instagram Reels", youtube: "YouTube Shorts", linkedin: "LinkedIn" } as Record<string, string>)[platform] ?? platform;
}

function statusTone(state: PlatformTargetConnectionState["state"]) {
  return state === "action_ready" || state === "connected" ? "#A7F3D0" : state === "official_connector_unavailable" ? "#FBD38D" : state === "connection_required" ? "#B9E6FF" : "#B4D2E3";
}

export default function ReviewScreen() {
  const colors = useColors();
  const { selectedSourceId, sources, recipeFor, platformsFor, setPlatformTargets } = useCreatorWorkflow();
  const source = sources.find((item) => item.id === selectedSourceId) ?? null;
  const selectedPlatforms = platformsFor(source?.id ?? "");
  const [plan, setPlan] = useState<AdaptationPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [targetConnectionStates, setTargetConnectionStates] = useState<PlatformTargetConnectionState[] | null>(null);
  const [loadingTargetConnections, setLoadingTargetConnections] = useState(false);
  const [targetConnectionNotice, setTargetConnectionNotice] = useState<string | null>(null);

  const refreshPlan = useCallback(async () => {
    if (!source?.serverVideoId || source.status !== "ready" || !selectedPlatforms.length) return;
    setLoadingPlan(true);
    setNotice(null);
    try { setPlan(await prepareAdaptationPlan(source.serverVideoId, selectedPlatforms)); }
    catch { setPlan(null); setNotice("A verified adaptation plan is not available from this private workspace yet. Check processing status, then refresh this review."); }
    finally { setLoadingPlan(false); }
  }, [selectedPlatforms, source?.serverVideoId, source?.status]);

  useEffect(() => { void refreshPlan(); }, [refreshPlan]);

  const refreshTargetConnections = useCallback(async () => {
    if (!isViralBoostApiConfigured()) {
      setTargetConnectionStates(null);
      setTargetConnectionNotice("Connection status appears after this app is connected to an invited private workspace.");
      return;
    }
    setLoadingTargetConnections(true);
    setTargetConnectionNotice(null);
    try {
      setTargetConnectionStates(await getPlatformTargetConnectionStates());
    } catch {
      setTargetConnectionStates(null);
      setTargetConnectionNotice("Verified account status is temporarily unavailable. You can still prepare editable drafts; no publishing action is enabled here.");
    } finally {
      setLoadingTargetConnections(false);
    }
  }, []);

  useEffect(() => { void refreshTargetConnections(); }, [refreshTargetConnections]);

  const drafts = useMemo<ReviewDraft[]>(() => plan?.experiments.map((experiment) => ({ key: experiment.variantId, variantId: experiment.variantId, platform: formatPlatform(experiment.platform), format: experiment.aspectRatio, focus: experiment.hook, caption: experiment.caption, status: experiment.availability.replaceAll("_", " ") })) ?? localBlueprints.filter((draft) => selectedPlatforms.includes(draft.key as CreatorTargetPlatform)), [plan, selectedPlatforms]);
  const selectedTargetStates = useMemo(() => selectedPlatforms.map((platform) => targetConnectionStates?.find((item) => item.platform === platform) ?? null), [selectedPlatforms, targetConnectionStates]);

  if (!source) {
    return <ScreenContainer className="p-6" edges={["top", "bottom", "left", "right"]}><Text style={[styles.empty, { color: colors.foreground }]}>Choose a source before reviewing adaptations.</Text><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={{ color: colors.foreground, fontWeight: "800" }}>Back to Library</Text></Pressable></ScreenContainer>;
  }

  const recipe = recipeFor(source.id);
  const draftLength = Math.max(0, recipe.trimEndSeconds - recipe.trimStartSeconds);
  const sourceReadyForPlan = Boolean(source.serverVideoId && source.status === "ready");
  const togglePlatform = (platform: CreatorTargetPlatform) => {
    setPlan(null);
    setPlatformTargets(source.id, selectedPlatforms.includes(platform) ? selectedPlatforms.filter((item) => item !== platform) : [...selectedPlatforms, platform]);
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <FlatList
        data={drafts}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View style={styles.headerCopy}><Eyebrow>Adaptation review</Eyebrow><Text numberOfLines={1} style={[styles.sourceName, { color: colors.foreground }]}>{source.name}</Text></View></View>
          <CreatorCard style={[styles.sourceCard, { backgroundColor: "#123B57", borderColor: "#2A6586" }]}>
            <View style={styles.sourceCardTop}><IconSymbol name="wand.and.stars" size={25} color="#55E6FF" /><StatusPill tone={plan ? "ready" : selectedPlatforms.length ? sourceReadyForPlan ? "accent" : "attention" : "muted"}>{plan ? "VERIFIED PLAN READY" : selectedPlatforms.length ? sourceReadyForPlan ? "PREPARING PLAN" : source.serverVideoId ? "PROCESSING REQUIRED" : "PRIVATE QUEUE NOT CONNECTED" : "CHOOSE TARGETS"}</StatusPill></View>
            <Text style={styles.sourceCardTitle}>{plan ? "Your server-verified adaptation plan" : selectedPlatforms.length ? "Your platform draft blueprint" : "Choose where to adapt this source"}</Text>
            <Text style={styles.sourceCardCopy}>{plan ? plan.nextStep : selectedPlatforms.length ? `The current local recipe uses ${formatDuration(draftLength * 1000)} from ${recipe.trimStartSeconds}s to ${recipe.trimEndSeconds}s with ${recipe.composition.replace("_", " ")} composition. Private processing is required before an adaptation plan or artifact exists.` : "Select only the platforms you want to prepare for. This creates editable content drafts; it does not connect accounts, publish, or guarantee reach."}</Text>
            <View style={styles.targetRow}>{creatorTargetPlatforms.map((platform) => {
              const selected = selectedPlatforms.includes(platform);
              return <Pressable key={platform} onPress={() => togglePlatform(platform)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${formatPlatform(platform)} target${selected ? ", selected" : ", not selected"}`} accessibilityHint="Selects or removes this target for a private editable draft. It does not connect an account or publish content." style={({ pressed }) => [styles.targetChip, { borderColor: selected ? "#55E6FF" : "#6E9AB3", backgroundColor: selected ? "#55E6FF24" : "#0D2D43" }, pressed && styles.pressed]}><Text style={styles.targetChipText}>{formatPlatform(platform)}</Text></Pressable>;
            })}</View>
            {selectedPlatforms.length ? <View style={styles.connectionPanel}>
              <View style={styles.connectionPanelHeader}><Text style={styles.connectionEyebrow}>AUTHORIZED CONNECTION STATUS</Text><Pressable onPress={() => void refreshTargetConnections()} disabled={loadingTargetConnections} accessibilityRole="button" accessibilityLabel="Refresh official connection status" accessibilityHint="Checks the private workspace for creator-authorized account and connector status." style={({ pressed }) => [styles.connectionRefresh, (pressed || loadingTargetConnections) && styles.pressed]}><Text style={styles.connectionRefreshText}>{loadingTargetConnections ? "Checking…" : "Refresh"}</Text></Pressable></View>
              {targetConnectionNotice ? <Text accessibilityLiveRegion="polite" style={styles.connectionUnavailable}>{targetConnectionNotice}</Text> : selectedTargetStates.map((state, index) => <View key={selectedPlatforms[index]} accessible accessibilityLabel={state ? `${formatPlatform(selectedPlatforms[index])}: ${state.label}. ${state.detail}` : `${formatPlatform(selectedPlatforms[index])}: checking verified connection status.`} style={styles.connectionRow}><Text style={styles.connectionPlatform}>{formatPlatform(selectedPlatforms[index])}</Text>{state ? <View style={styles.connectionCopy}><Text style={[styles.connectionLabel, { color: statusTone(state.state) }]}>{state.label}{state.accountName ? ` · ${state.accountName}` : ""}</Text><Text style={styles.connectionDetail}>{state.detail}</Text>{state.actionRequirements.length ? <View style={styles.requirementsBlock}><Text style={styles.requirementsEyebrow}>OFFICIAL ACTION REQUIREMENTS</Text>{state.actionRequirements.map((requirement) => <Text key={`${state.platform}-${requirement.label}`} style={styles.requirementText}>• {requirement.label}</Text>)}</View> : null}</View> : <Text accessibilityLiveRegion="polite" style={styles.connectionUnavailable}>Checking verified status…</Text>}</View>)}
            </View> : null}
            {sourceReadyForPlan && selectedPlatforms.length ? <Pressable onPress={() => void refreshPlan()} disabled={loadingPlan} accessibilityRole="button" accessibilityLabel="Refresh verified adaptation plan" accessibilityHint="Prepares or refreshes private editable drafts for the selected targets. It does not publish content." style={({ pressed }) => [styles.planButton, { backgroundColor: "#55E6FF" }, (pressed || loadingPlan) && styles.pressed]}>{loadingPlan ? <ActivityIndicator color="#123B57" /> : <><IconSymbol name="arrow.triangle.2.circlepath" size={18} color="#123B57" /><Text style={styles.planButtonText}>Refresh verified plan</Text></>}</Pressable> : null}
          </CreatorCard>
          {notice ? <Text style={[styles.notice, { color: colors.warning }]}>{notice}</Text> : null}
          <View style={styles.section}><Eyebrow>{plan ? "Verified adaptations" : selectedPlatforms.length ? "Planned adaptations" : "Platform targets"}</Eyebrow><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{plan ? "Review server-recorded drafts." : selectedPlatforms.length ? "Review local intent, then refine." : "Select one or more creator platforms to prepare targeted drafts."}</Text></View>
        </>}
        renderItem={({ item }) => <CreatorCard style={styles.adaptationCard}>
          <View style={styles.cardHeader}><View style={[styles.platformGlyph, { backgroundColor: `${colors.primary}1C` }]}><IconSymbol name="sparkles" size={22} color={colors.primary} /></View><View style={styles.platformCopy}><Text style={[styles.platformName, { color: colors.foreground }]}>{item.platform}</Text><Text style={[styles.platformFormat, { color: colors.muted }]}>{item.format}</Text></View><StatusPill tone={item.variantId ? "accent" : "muted"}>{item.variantId ? "SERVER DRAFT" : "LOCAL DRAFT"}</StatusPill></View>
          <Text style={[styles.focus, { color: colors.foreground }]}>{item.focus}</Text>
          {item.caption ? <Text style={[styles.caption, { color: colors.muted }]}>{item.caption}</Text> : null}
          <Text style={[styles.status, { color: colors.muted }]}>{item.status}: {item.variantId ? "review its private artifact only after the processor reports it available." : "this is an editable local blueprint, not a rendered export."}</Text>
          <Pressable onPress={() => router.push(item.variantId ? { pathname: "/edit-lab", params: { variantId: item.variantId } } as never : "/edit-lab" as never)} style={({ pressed }) => [styles.refine, { borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="slider.horizontal.3" size={19} color={colors.primary} /><Text style={[styles.refineText, { color: colors.foreground }]}>{item.variantId ? "Refine server recipe" : "Refine local recipe"}</Text></Pressable>
          {item.variantId ? <Pressable onPress={() => router.push({ pathname: "/artifact-preview", params: { variantId: item.variantId } } as never)} style={({ pressed }) => [styles.preview, { backgroundColor: colors.primary }, pressed && styles.pressed]}><IconSymbol name="play.fill" size={17} color={colors.background} /><Text style={[styles.previewText, { color: colors.background }]}>Review private artifact</Text></Pressable> : null}
        </CreatorCard>}
        ListFooterComponent={<CreatorCard style={styles.evidence}><View style={[styles.evidenceIcon, { backgroundColor: `${colors.success}1D` }]}><IconSymbol name="lock.shield.fill" size={20} color={colors.success} /></View><View style={styles.evidenceCopy}><Text style={[styles.evidenceTitle, { color: colors.foreground }]}>Creator approval remains separate</Text><Text style={[styles.evidenceText, { color: colors.muted }]}>Reviewing, editing, or loading a preview does not publish content. Publishing remains creator-controlled and requires an authorized platform connection.</Text></View></CreatorCard>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { gap: 14, paddingTop: 16, paddingBottom: 20 }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 2 }, iconButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, gap: 2 }, sourceName: { fontSize: 17, fontWeight: "800" }, sourceCard: { gap: 12, padding: 19 }, sourceCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sourceCardTitle: { color: "#F1FAFF", fontSize: 22, fontWeight: "800" }, sourceCardCopy: { color: "#B4D2E3", fontSize: 14, lineHeight: 21 }, targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, targetChip: { minHeight: 36, borderRadius: 12, borderWidth: 1, paddingHorizontal: 11, justifyContent: "center" }, targetChipText: { color: "#F1FAFF", fontSize: 12, fontWeight: "800" }, connectionPanel: { gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#2A6586", paddingTop: 12 }, connectionPanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, connectionEyebrow: { color: "#89B8D0", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, connectionRefresh: { minHeight: 28, justifyContent: "center" }, connectionRefreshText: { color: "#55E6FF", fontSize: 12, fontWeight: "800" }, connectionRow: { gap: 3 }, connectionPlatform: { color: "#F1FAFF", fontSize: 13, fontWeight: "800" }, connectionCopy: { gap: 2 }, connectionLabel: { fontSize: 12, fontWeight: "800" }, connectionDetail: { color: "#B4D2E3", fontSize: 12, lineHeight: 17 }, requirementsBlock: { gap: 3, marginTop: 6, borderLeftWidth: 2, borderLeftColor: "#2A6586", paddingLeft: 8 }, requirementsEyebrow: { color: "#89B8D0", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, requirementText: { color: "#D4E8F3", fontSize: 12, lineHeight: 17 }, connectionUnavailable: { color: "#B4D2E3", fontSize: 12, lineHeight: 17 }, planButton: { height: 44, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, planButtonText: { color: "#123B57", fontSize: 14, fontWeight: "800" }, notice: { fontSize: 13, fontWeight: "700", lineHeight: 19 }, section: { gap: 4, marginTop: 2 }, sectionTitle: { fontSize: 20, fontWeight: "800" }, adaptationCard: { gap: 12 }, cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, platformGlyph: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }, platformCopy: { flex: 1, gap: 3 }, platformName: { fontSize: 16, fontWeight: "800" }, platformFormat: { fontSize: 12, fontWeight: "700" }, focus: { fontSize: 15, lineHeight: 22, fontWeight: "700" }, caption: { fontSize: 13, lineHeight: 19 }, status: { fontSize: 13, lineHeight: 19 }, refine: { height: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, refineText: { fontSize: 14, fontWeight: "800" }, preview: { height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, previewText: { fontSize: 14, fontWeight: "800" }, evidence: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, evidenceIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" }, evidenceCopy: { flex: 1, gap: 3 }, evidenceTitle: { fontSize: 14, fontWeight: "800" }, evidenceText: { fontSize: 13, lineHeight: 19 }, empty: { fontSize: 20, lineHeight: 28, fontWeight: "800" }, back: { marginTop: 16, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

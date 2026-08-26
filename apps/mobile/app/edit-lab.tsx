import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useCreatorWorkflow, type MobileEditRecipe } from "@/lib/creator-workflow";

const compositionOptions: { value: MobileEditRecipe["composition"]; title: string; note: string }[] = [
  { value: "smart_crop", title: "Smart crop", note: "Focus the subject" },
  { value: "fit", title: "Fit", note: "Keep every edge" },
  { value: "blur_background", title: "Blur fill", note: "Keep the full frame" },
];

export default function EditLabScreen() {
  const colors = useColors();
  const { selectedSourceId, sources, recipeFor, saveRecipe } = useCreatorWorkflow();
  const source = useMemo(() => sources.find((item) => item.id === selectedSourceId) ?? null, [selectedSourceId, sources]);
  const initial = recipeFor(source?.id ?? "unselected");
  const [recipe, setRecipe] = useState(initial);
  const [advanced, setAdvanced] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setRecipe(recipeFor(source?.id ?? "unselected")); setSaved(false); }, [recipeFor, source?.id]);

  if (!source) {
    return <ScreenContainer className="p-6"><Text style={[styles.empty, { color: colors.foreground }]}>Choose a source from Library before opening Edit Lab.</Text><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={{ color: colors.foreground, fontWeight: "800" }}>Back to Library</Text></Pressable></ScreenContainer>;
  }

  const update = <K extends keyof MobileEditRecipe>(key: K, value: MobileEditRecipe[K]) => setRecipe((current) => ({ ...current, [key]: value }));
  const save = () => { saveRecipe({ ...recipe, sourceId: source.id }); setSaved(true); };

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View style={styles.headerCopy}><Eyebrow>Advanced edit lab</Eyebrow><Text numberOfLines={1} style={[styles.sourceName, { color: colors.foreground }]}>{source.name}</Text></View></View>
        <CreatorCard>
          <StatusPill tone="accent">NON-DESTRUCTIVE REVISION {recipe.revision}</StatusPill>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Shape the draft before it renders.</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>These changes stay separate from your original. A secure workspace connection is required before a private render can be queued.</Text>
        </CreatorCard>
        <CreatorCard style={styles.controls}>
          <Text style={[styles.label, { color: colors.foreground }]}>Trim range</Text>
          <View style={styles.fieldRow}><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>Start seconds</Text><TextInput value={String(recipe.trimStartSeconds)} onChangeText={(text) => update("trimStartSeconds", Number(text.replace(/[^0-9.]/g, "")) || 0)} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>End seconds</Text><TextInput value={String(recipe.trimEndSeconds)} onChangeText={(text) => update("trimEndSeconds", Number(text.replace(/[^0-9.]/g, "")) || 0)} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View></View>
          <Text style={[styles.label, { color: colors.foreground }]}>Composition</Text>
          {compositionOptions.map((option) => <Pressable key={option.value} onPress={() => update("composition", option.value)} style={({ pressed }) => [styles.option, { borderColor: recipe.composition === option.value ? colors.primary : colors.border, backgroundColor: recipe.composition === option.value ? `${colors.primary}14` : "transparent" }, pressed && styles.pressed]}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>{option.title}</Text><Text style={[styles.optionNote, { color: colors.muted }]}>{option.note}</Text></View>{recipe.composition === option.value ? <IconSymbol name="sparkles" size={20} color={colors.primary} /> : null}</Pressable>)}
          <Pressable onPress={() => setAdvanced((value) => !value)} style={({ pressed }) => [styles.advancedButton, pressed && styles.pressed]}><IconSymbol name="slider.horizontal.3" size={20} color={colors.primary} /><Text style={[styles.advancedText, { color: colors.primary }]}>{advanced ? "Hide advanced controls" : "Show advanced controls"}</Text></Pressable>
          {advanced ? <View style={styles.advanced}>
            <Text style={[styles.label, { color: colors.foreground }]}>Focal framing</Text>
            <View style={styles.fieldRow}><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>Horizontal (0–1)</Text><TextInput value={recipe.focalX.toFixed(2)} onChangeText={(text) => update("focalX", Math.max(0, Math.min(1, Number(text) || 0)))} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View><View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.muted }]}>Vertical (0–1)</Text><TextInput value={recipe.focalY.toFixed(2)} onChangeText={(text) => update("focalY", Math.max(0, Math.min(1, Number(text) || 0)))} keyboardType="decimal-pad" returnKeyType="done" style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /></View></View>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Headline overlay</Text><TextInput value={recipe.headline} onChangeText={(text) => update("headline", text.slice(0, 96))} placeholder="Optional short headline" placeholderTextColor={colors.muted} returnKeyType="done" style={[styles.input, styles.fullInput, { color: colors.foreground, borderColor: colors.border }]} />
            <View style={styles.switchRow}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>Caption preference</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Timed captions require transcript cues.</Text></View><Switch value={recipe.captionsEnabled} onValueChange={(value) => update("captionsEnabled", value)} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={recipe.captionsEnabled ? colors.primary : colors.muted} /></View>
            <View style={styles.switchRow}><View><Text style={[styles.optionTitle, { color: colors.foreground }]}>Normalize audio</Text><Text style={[styles.optionNote, { color: colors.muted }]}>Apply during server rendering.</Text></View><Switch value={recipe.normalizeAudio} onValueChange={(value) => update("normalizeAudio", value)} trackColor={{ false: colors.border, true: `${colors.primary}99` }} thumbColor={recipe.normalizeAudio ? colors.primary : colors.muted} /></View>
          </View> : null}
        </CreatorCard>
        <Pressable onPress={save} style={({ pressed }) => [styles.save, { backgroundColor: colors.primary }, pressed && styles.pressed]}><IconSymbol name="wand.and.stars" size={20} color={colors.background} /><Text style={[styles.saveText, { color: colors.background }]}>{saved ? "Revision saved locally" : "Save edit revision"}</Text></Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 12, gap: 13 }, header: { flexDirection: "row", alignItems: "center", gap: 12 }, iconButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, gap: 2 }, sourceName: { fontSize: 17, fontWeight: "800" }, cardTitle: { fontSize: 18, fontWeight: "800" }, copy: { fontSize: 14, lineHeight: 21 }, controls: { gap: 13 }, label: { fontSize: 15, fontWeight: "800" }, fieldRow: { flexDirection: "row", gap: 10 }, field: { flex: 1, gap: 6 }, fieldLabel: { fontSize: 12, fontWeight: "700" }, input: { height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, fontSize: 16, fontWeight: "700" }, fullInput: { marginTop: 5 }, option: { borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, optionTitle: { fontSize: 14, fontWeight: "800" }, optionNote: { marginTop: 3, fontSize: 12, lineHeight: 17 }, advancedButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8 }, advancedText: { fontSize: 14, fontWeight: "800" }, advanced: { gap: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#5B6C8420", paddingTop: 13 }, switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, save: { height: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, saveText: { fontSize: 16, fontWeight: "800" }, empty: { fontSize: 20, lineHeight: 28, fontWeight: "800" }, back: { marginTop: 16, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});

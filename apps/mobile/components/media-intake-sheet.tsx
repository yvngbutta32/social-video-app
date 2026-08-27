import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { selectVideoFromFiles, selectVideoFromLibrary } from "@/lib/media-import";
import { useCreatorWorkflow } from "@/lib/creator-workflow";

type Props = { visible: boolean; onClose: () => void };

export function MediaIntakeSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const { addLocalSource } = useCreatorWorkflow();
  const [busy, setBusy] = useState<"library" | "files" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (origin: "library" | "files") => {
    setBusy(origin);
    setError(null);
    try {
      const media = origin === "library" ? await selectVideoFromLibrary() : await selectVideoFromFiles();
      if (media) {
        addLocalSource(media);
        onClose();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That video could not be prepared on this device.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: "#000000" }]}>
          <View style={[styles.handle, { backgroundColor: `${colors.muted}88` }]} />
          <Text style={[styles.eyebrow, { color: colors.primary }]}>Creator source</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Start with media you own.</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>Choose original media you have permission to use. The app prepares it locally first; a server queue begins only after your secure workspace connection is configured.</Text>
          <Pressable onPress={() => choose("library")} disabled={Boolean(busy)} accessibilityRole="button" accessibilityLabel="Choose a video from camera roll" accessibilityHint="Imports a permitted source locally before any private workspace upload." style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, (pressed || busy) && styles.pressed]}>
            {busy === "library" ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.actionText, { color: colors.background }]}>Choose from camera roll</Text>}
          </Pressable>
          <Pressable onPress={() => choose("files")} disabled={Boolean(busy)} accessibilityRole="button" accessibilityLabel="Import a video from Files" accessibilityHint="Imports a permitted source locally before any private workspace upload." style={({ pressed }) => [styles.secondary, { borderColor: colors.border }, (pressed || busy) && styles.pressed]}>
            {busy === "files" ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.secondaryText, { color: colors.foreground }]}>Import from Files</Text>}
          </Pressable>
          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
          <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={[styles.cancelText, { color: colors.muted }]}>Not now</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#020914CC" },
  sheet: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 36, borderTopLeftRadius: 34, borderTopRightRadius: 34, borderWidth: 1, gap: 14, shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: -12 }, elevation: 16 },
  handle: { alignSelf: "center", height: 5, width: 44, borderRadius: 99, marginBottom: 7 },
  eyebrow: { fontSize: 10, letterSpacing: 1.3, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 27, lineHeight: 34, fontWeight: "800", letterSpacing: -0.65 },
  copy: { fontSize: 15, lineHeight: 23 },
  action: { height: 56, alignItems: "center", justifyContent: "center", borderRadius: 18, shadowColor: "#55E6FF", shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  actionText: { fontSize: 16, fontWeight: "800" },
  secondary: { height: 54, alignItems: "center", justifyContent: "center", borderRadius: 17, borderWidth: 1, backgroundColor: "#13273B" },
  secondaryText: { fontSize: 16, fontWeight: "800" },
  cancel: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontWeight: "700" },
  error: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});

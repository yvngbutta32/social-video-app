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
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>Add a private source</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>Choose original media you have permission to use. The app prepares it locally first; a server queue begins only after your secure workspace connection is configured.</Text>
          <Pressable onPress={() => choose("library")} disabled={Boolean(busy)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary }, (pressed || busy) && styles.pressed]}>
            {busy === "library" ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.actionText, { color: colors.background }]}>Choose from camera roll</Text>}
          </Pressable>
          <Pressable onPress={() => choose("files")} disabled={Boolean(busy)} style={({ pressed }) => [styles.secondary, { borderColor: colors.border }, (pressed || busy) && styles.pressed]}>
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
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000088" },
  sheet: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 34, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, gap: 14 },
  handle: { alignSelf: "center", height: 5, width: 42, borderRadius: 99, marginBottom: 4 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: "800" },
  copy: { fontSize: 15, lineHeight: 22 },
  action: { height: 54, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  actionText: { fontSize: 16, fontWeight: "800" },
  secondary: { height: 54, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1 },
  secondaryText: { fontSize: 16, fontWeight: "800" },
  cancel: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontWeight: "700" },
  error: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});

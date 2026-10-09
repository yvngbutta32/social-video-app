import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { useOfflineMode } from "@/lib/offline-mode";

export function OfflineBanner() {
  const colors = useColors();
  const { effectiveOffline } = useOfflineMode();
  if (!effectiveOffline) return null;

  return (
    <View accessible accessibilityRole="text" accessibilityLabel="Offline workspace. Local drafts and edits are saved on this device. Backend actions are paused." style={[styles.banner, { backgroundColor: `${colors.warning}18`, borderColor: `${colors.warning}55` }]}>
      <View style={[styles.dot, { backgroundColor: colors.warning }]} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>Offline workspace</Text>
        <Text style={[styles.detail, { color: colors.muted }]}>Local drafts and edits are saved on this device. Uploading, sync, rendering, and publishing wait until a backend is connected.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 12, fontWeight: "900", letterSpacing: 0.2 },
  detail: { fontSize: 11, lineHeight: 16 },
});

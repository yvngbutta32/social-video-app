import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { CreatorCard, Eyebrow, StatusPill } from "@/components/creator-ui";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { isViralBoostApiConfigured, signInToViralBoost } from "@/lib/viralboost-api";

export default function SignInScreen() {
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const apiConfigured = isViralBoostApiConfigured();

  const signIn = async () => {
    if (!apiConfigured) {
      setNotice("This build is not connected to a production ViralBoost API yet. Your local media preparation stays available on this device.");
      return;
    }
    if (!email.trim() || !password) {
      setNotice("Enter the email and password issued for your invited creator account.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await signInToViralBoost(email, password);
      router.back();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The invited workspace could not be connected.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.header}><Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={22} color={colors.foreground} /></Pressable><View><Eyebrow>Invite-only access</Eyebrow><Text style={[styles.title, { color: colors.foreground }]}>Connect your workspace</Text></View></View>
        <CreatorCard style={styles.card}>
          <StatusPill tone={apiConfigured ? "ready" : "attention"}>{apiConfigured ? "SECURE API CONFIGURED" : "API CONFIGURATION REQUIRED"}</StatusPill>
          <Text style={[styles.copy, { color: colors.muted }]}>Sign in only with an approved ViralBoost creator invitation. On a native device, the access and rotated refresh credentials are stored in protected device storage; your original media remains separate until you explicitly upload it.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Email</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" returnKeyType="next" placeholder="creator@example.com" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
          <Text style={[styles.label, { color: colors.foreground }]}>Password</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" returnKeyType="done" onSubmitEditing={signIn} placeholder="Your private password" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
          {notice ? <Text style={[styles.notice, { color: colors.warning }]}>{notice}</Text> : null}
          <Pressable onPress={signIn} disabled={busy} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, (pressed || busy) && styles.pressed]}>{busy ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.buttonText, { color: colors.background }]}>Connect private workspace</Text>}</Pressable>
        </CreatorCard>
        <Text style={[styles.footer, { color: colors.muted }]}>Need access? A developer can issue or revoke pilot invitations, but cannot edit, approve, or publish your media.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { paddingTop: 16, gap: 16 }, header: { flexDirection: "row", alignItems: "center", gap: 12 }, back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" }, title: { marginTop: 4, fontSize: 23, fontWeight: "800" }, card: { gap: 10 }, copy: { fontSize: 14, lineHeight: 21 }, label: { marginTop: 2, fontSize: 14, fontWeight: "800" }, input: { height: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 16 }, notice: { fontSize: 13, lineHeight: 19, fontWeight: "700" }, button: { height: 53, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 5 }, buttonText: { fontSize: 16, fontWeight: "800" }, footer: { fontSize: 13, lineHeight: 19, paddingHorizontal: 4 }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] } });

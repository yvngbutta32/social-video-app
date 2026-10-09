import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/lib/_core/nativewind-pressable";
import { CreatorWorkflowProvider } from "@/lib/creator-workflow";
import { OfflineModeProvider } from "@/lib/offline-mode";
import { ThemeProvider, useThemeContext } from "@/lib/theme-provider";

export const unstable_settings = { anchor: "(tabs)" };

function ThemedStatusBar() {
  const { colorScheme } = useThemeContext();
  return <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <OfflineModeProvider>
            <CreatorWorkflowProvider>
              <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 220 }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="sign-in" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                <Stack.Screen name="workspace-selector" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                <Stack.Screen name="processing-detail" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                <Stack.Screen name="artifact-preview" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                <Stack.Screen name="review" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                <Stack.Screen name="edit-lab" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              </Stack>
              <ThemedStatusBar />
            </CreatorWorkflowProvider>
          </OfflineModeProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

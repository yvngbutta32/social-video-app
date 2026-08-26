import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/lib/_core/nativewind-pressable";
import { CreatorWorkflowProvider } from "@/lib/creator-workflow";
import { ThemeProvider } from "@/lib/theme-provider";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SafeAreaProvider>
          <CreatorWorkflowProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="sign-in" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="processing-detail" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="artifact-preview" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="review" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="edit-lab" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
            </Stack>
            <StatusBar style="auto" />
          </CreatorWorkflowProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

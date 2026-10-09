import { type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";

import type { ResponsiveLayout } from "@/hooks/use-responsive-layout";

type ScreenTransitionProps = {
  children: ReactNode;
  layout: ResponsiveLayout;
};

export function ScreenTransition({ children, layout }: ScreenTransitionProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
      style={[
        styles.frame,
        {
          maxWidth: layout.contentMaxWidth,
          paddingHorizontal: layout.contentSidePadding,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, width: "100%", alignSelf: "center" },
});

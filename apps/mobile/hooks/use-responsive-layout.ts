import { useWindowDimensions } from "react-native";

import { responsiveLayoutForDimensions, type ResponsiveLayout } from "@/lib/responsive-layout";

export type { ResponsiveLayout } from "@/lib/responsive-layout";

/** Shared breakpoints keep tablet and landscape layouts intentional instead of accidental. */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();
  return responsiveLayoutForDimensions(width, height);
}

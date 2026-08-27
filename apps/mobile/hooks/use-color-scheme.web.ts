import { useThemeContext } from "@/lib/theme-provider";

/**
 * Web must use the same explicit creator-studio preference as native so palette tokens,
 * inline color styles, and the document theme never disagree after hydration.
 */
export function useColorScheme() {
  return useThemeContext().colorScheme;
}

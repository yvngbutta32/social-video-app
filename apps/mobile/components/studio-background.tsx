import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Path } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";

/** A quiet, theme-aware line motif that adds craft without competing with creator content. */
export function StudioBackground() {
  const colors = useColors();
  const line = `${colors.primary}30`;
  const warm = `${colors.warning}25`;
  const cool = `${colors.success}20`;

  return (
    <View style={[StyleSheet.absoluteFill, styles.decorativeLayer]}>
      <Svg width="100%" height="100%" viewBox="0 0 1000 1200" preserveAspectRatio="none">
        <G fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M-40 230 C180 80 290 120 410 250 S700 450 1040 210" stroke={line} strokeWidth="2" />
          <Path d="M-30 270 C170 135 280 170 395 285 S700 500 1035 265" stroke={warm} strokeWidth="1" />
          <Path d="M720 -30 C680 130 740 205 880 260 S1050 430 930 610" stroke={cool} strokeWidth="2" />
          <Path d="M760 -30 C725 125 780 185 910 245 S1080 420 965 590" stroke={line} strokeWidth="1" />
          <Path d="M-60 1030 C180 900 325 925 440 1035 S760 1200 1060 1010" stroke={warm} strokeWidth="2" />
          <Path d="M-35 1080 C185 970 320 990 450 1090 S775 1250 1040 1065" stroke={line} strokeWidth="1" />
          <Line x1="84" y1="720" x2="240" y2="620" stroke={cool} strokeWidth="1" />
          <Line x1="240" y1="620" x2="350" y2="690" stroke={line} strokeWidth="1" />
          <Line x1="350" y1="690" x2="500" y2="585" stroke={warm} strokeWidth="1" />
          <Line x1="500" y1="585" x2="640" y2="650" stroke={line} strokeWidth="1" />
          <Circle cx="84" cy="720" r="5" fill={colors.primary} fillOpacity="0.22" stroke={colors.primary} strokeWidth="1" />
          <Circle cx="240" cy="620" r="4" fill={colors.success} fillOpacity="0.18" stroke={colors.success} strokeWidth="1" />
          <Circle cx="350" cy="690" r="5" fill={colors.warning} fillOpacity="0.18" stroke={colors.warning} strokeWidth="1" />
          <Circle cx="500" cy="585" r="4" fill={colors.primary} fillOpacity="0.2" stroke={colors.primary} strokeWidth="1" />
          <Circle cx="640" cy="650" r="5" fill={colors.success} fillOpacity="0.16" stroke={colors.success} strokeWidth="1" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ decorativeLayer: { pointerEvents: "none" } });

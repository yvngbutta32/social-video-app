export type ResponsiveLayout = {
  width: number;
  height: number;
  isLandscape: boolean;
  isTablet: boolean;
  isWide: boolean;
  contentMaxWidth: number;
  contentSidePadding: number;
  columnGap: number;
};

export function responsiveLayoutForDimensions(width: number, height: number): ResponsiveLayout {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const isLandscape = safeWidth > safeHeight;
  const isTablet = Math.min(safeWidth, safeHeight) >= 600;
  const isWide = isTablet || (isLandscape && safeWidth >= 700);

  return {
    width: safeWidth,
    height: safeHeight,
    isLandscape,
    isTablet,
    isWide,
    contentMaxWidth: isTablet ? 1120 : isLandscape ? 960 : 720,
    contentSidePadding: isTablet ? 12 : isLandscape ? 4 : 0,
    columnGap: isTablet ? 20 : 14,
  };
}

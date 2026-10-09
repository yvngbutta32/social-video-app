import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function projectSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("premium native visual system", () => {
  it("starts the creator studio in the deliberate dark appearance and retains elevated shared surfaces", () => {
    const themeProvider = projectSource("lib/theme-provider.tsx");
    const webScheme = projectSource("hooks/use-color-scheme.web.ts");
    const creatorUi = projectSource("components/creator-ui.tsx");
    expect(themeProvider).toContain('useState<ColorScheme>("dark")');
    expect(webScheme).toContain("useThemeContext().colorScheme");
    expect(webScheme).not.toContain('return "light"');
    expect(creatorUi).toContain("boxShadow: `0px 8px 16px ${colors.background}1A`");
    expect(creatorUi).not.toMatch(/shadow(?:Color|Opacity|Radius|Offset)/);
    expect(creatorUi).toContain("borderWidth: 1");
  });

  it("keeps the creator journey prominent and the advanced editor scroll-safe on compact portrait devices", () => {
    const home = projectSource("app/(tabs)/index.tsx");
    const editLab = projectSource("app/edit-lab.tsx");
    const review = projectSource("app/review.tsx");
    const processing = projectSource("app/processing-detail.tsx");
    const artifactPreview = projectSource("app/artifact-preview.tsx");
    const intake = projectSource("components/media-intake-sheet.tsx");
    const rootLayout = projectSource("app/_layout.tsx");
    expect(home).toContain("SOURCE  →  ADAPT  →  REFINE  →  REVIEW  →  LEARN");
    expect(home).toContain("deriveCreatorFlowNextStep");
    expect(editLab).toContain("<ScrollView");
    expect(editLab).toContain('keyboardShouldPersistTaps="handled"');
    expect(review).toContain("backgroundColor: `${colors.primary}10`");
    expect(processing).toContain("<ScrollView");
    expect(artifactPreview).toContain("<ScrollView");
    expect(intake).toContain("Start with media you own.");
    expect(rootLayout).toContain("<ThemedStatusBar />");
  });

  it("keeps surfaces and system chrome aligned with the active color scheme", () => {
    const home = projectSource("app/(tabs)/index.tsx");
    const tabs = projectSource("app/(tabs)/_layout.tsx");
    const rootLayout = projectSource("app/_layout.tsx");
    const library = projectSource("app/(tabs)/library.tsx");
    const learn = projectSource("app/(tabs)/learn.tsx");
    const profile = projectSource("app/(tabs)/profile.tsx");
    const globalStyles = projectSource("global.css");
    expect(home).toContain("backgroundColor: colors.surface");
    expect(home).not.toContain('backgroundColor: "#EEE6D9"');
    expect(tabs).toContain("tabBarInactiveTintColor: colors.muted");
    expect(rootLayout).toContain('colorScheme === "dark" ? "light" : "dark"');
    expect(library).not.toContain('backgroundColor: "#13273B"');
    expect(learn).not.toContain('backgroundColor: "#0C1B2D"');
    expect(home).toContain("contentBottomInset");
    expect(library).toContain("contentBottomInset");
    expect(learn).toContain("contentBottomInset");
    expect(profile).toContain("contentBottomInset");
    expect(tabs).toContain('marginBottom: 0');
    expect(tabs).toContain('marginHorizontal: Platform.OS === "web" ? 0 : 12');
    expect(globalStyles).toContain("background-color: var(--color-background");
  });

  it("uses category-specific iconography instead of reusing one clip-art metaphor", () => {
    const mapping = projectSource("components/ui/icon-symbol.tsx");
    const home = projectSource("app/(tabs)/index.tsx");
    const review = projectSource("app/review.tsx");
    const editLab = projectSource("app/edit-lab.tsx");
    expect(mapping).toContain('"photo.on.rectangle.angled"');
    expect(mapping).toContain('"arrow.triangle.branch"');
    expect(mapping).toContain('"film.stack"');
    expect(mapping).toContain('"checkmark.seal.fill"');
    expect(mapping).toContain('"scissors"');
    expect(home).toContain('name="photo.on.rectangle.angled"');
    expect(home).toContain('name="arrow.triangle.branch"');
    expect(review).toContain('name="film.stack"');
    expect(review).toContain('name="checkmark.seal.fill"');
    expect(editLab).toContain('name="scissors"');
  });

  it("protects the status-bar inset without adding redundant top padding or fixed-height clipping", () => {
    const screenContainer = projectSource("components/screen-container.tsx");
    const home = projectSource("app/(tabs)/index.tsx");
    const library = projectSource("app/(tabs)/library.tsx");
    const learn = projectSource("app/(tabs)/learn.tsx");
    const profile = projectSource("app/(tabs)/profile.tsx");
    const signIn = projectSource("app/sign-in.tsx");
    const workspaceSelector = projectSource("app/workspace-selector.tsx");
    expect(screenContainer).toContain('edges = ["top", "left", "right"]');
    expect(home).not.toContain('safeAreaClassName="pt-2"');
    expect(library).not.toContain('safeAreaClassName="pt-2"');
    expect(learn).not.toContain('safeAreaClassName="pt-2"');
    expect(profile).not.toContain('safeAreaClassName="pt-2"');
    expect(learn).toContain("<ScrollView");
    expect(profile).toContain("<ScrollView");
    expect(signIn).toContain("<ScrollView");
    expect(workspaceSelector).toContain("<ScrollView");
  });

  it("uses a shared reduced-motion-safe transition and responsive tablet grid", () => {
    const screenContainer = projectSource("components/screen-container.tsx");
    const transition = projectSource("components/screen-transition.tsx");
    const responsive = projectSource("lib/responsive-layout.ts");
    const library = projectSource("app/(tabs)/library.tsx");
    const rootLayout = projectSource("app/_layout.tsx");
    expect(screenContainer).toContain("useResponsiveLayout");
    expect(screenContainer).toContain("<ScreenTransition layout={layout}>");
    expect(transition).toContain("FadeInDown.duration(220)");
    expect(transition).toContain("ReduceMotion.System");
    expect(rootLayout).toContain('animation: "fade"');
    expect(rootLayout).toContain("animationDuration: 220");
    expect(responsive).toContain("isTablet");
    expect(responsive).toContain("isLandscape");
    expect(library).toContain('numColumns={layout.isWide ? 2 : 1}');
    expect(library).toContain('key={layout.isWide ? "wide-grid" : "stacked-list"}');
  });

  it("uses a shared, theme-aware studio signal background without obscuring content", () => {
    const screenContainer = projectSource("components/screen-container.tsx");
    const background = projectSource("components/studio-background.tsx");
    expect(screenContainer).toContain("<StudioBackground />");
    expect(background).toContain('pointerEvents: "none"');
    expect(background).toContain("colors.primary");
    expect(background).toContain("colors.warning");
    expect(background).toContain("colors.success");
    expect(background).toContain("<Path");
    expect(background).toContain("<Circle");
  });

  it("keeps settings discoverable and separates source entry points", () => {
    const home = projectSource("app/(tabs)/index.tsx");
    const library = projectSource("app/(tabs)/library.tsx");
    const settings = projectSource("app/settings.tsx");
    expect(home).toContain('router.push("/settings"');
    expect(home).toContain('router.push("/library"');
    expect(home).toContain('accessibilityLabel="Open settings"');
    expect(library).toContain("Import another source");
    expect(library).toContain("MediaIntakeSheet");
    expect(settings).toContain("Privacy defaults");
    expect(settings).toContain("Dark interface");
  });

  it("keeps offline editing functional without implying backend completion", () => {
    const offlineMode = projectSource("lib/offline-mode.tsx");
    const banner = projectSource("components/offline-banner.tsx");
    const screenContainer = projectSource("components/screen-container.tsx");
    const settings = projectSource("app/settings.tsx");
    const library = projectSource("app/(tabs)/library.tsx");
    const storage = projectSource("lib/creator-storage.ts");
    expect(offlineMode).toContain('viralboost.offline-mode.v1');
    expect(offlineMode).toContain("!apiConfigured");
    expect(offlineMode).toContain("markOffline");
    expect(offlineMode).toContain("markOnline");
    expect(banner).toContain("Local drafts and edits are saved on this device");
    expect(screenContainer).toContain("<OfflineBanner />");
    expect(settings).toContain("Use offline mode");
    expect(library).toContain("Saved locally. Reconnect to upload this source");
    expect(library).toContain("markOffline()");
    expect(storage).toContain("viralboost.creator.local-state.v1");
  });
});

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
    expect(creatorUi).toContain("shadowOpacity: 0.18");
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
    expect(review).toContain('backgroundColor: "#0B2741"');
    expect(processing).toContain("<ScrollView");
    expect(artifactPreview).toContain("<ScrollView");
    expect(intake).toContain("Start with media you own.");
    expect(rootLayout).toContain('<StatusBar style="light"');
  });
});

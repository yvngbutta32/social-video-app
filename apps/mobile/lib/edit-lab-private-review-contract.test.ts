import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editLab = readFileSync(resolve(process.cwd(), "app/edit-lab.tsx"), "utf8");

describe("Edit Lab private review contract", () => {
  it("keeps preview URLs on demand, in memory, and separate from publishing", () => {
    expect(editLab).toContain("const [privatePreview, setPrivatePreview]");
    expect(editLab).toContain("getPrivateArtifactPreview(serverVariantId)");
    expect(editLab).toContain("Load the latest signed render here to check pacing and framing.");
    expect(editLab).toContain("does not publish or share your draft");
    expect(editLab).toContain('pathname: "/artifact-preview"');
    expect(editLab).toContain("setPrivatePreview(null);");
  });
});

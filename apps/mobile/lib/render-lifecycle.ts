import type { AdaptationDetail } from "@/lib/adaptation-contract";

export type RenderLifecycle = { tone: "ready" | "attention" | "accent"; label: string; detail: string; canPreview: boolean };

export function adaptationRenderLifecycle(adaptation: AdaptationDetail | null): RenderLifecycle {
  if (!adaptation) return { tone: "accent", label: "STATUS PENDING", detail: "Request a fresh workspace status before relying on a render or artifact.", canPreview: false };
  const renderState = adaptation.renderState.toLowerCase();
  if (adaptation.status === "failed" || renderState.includes("failed") || adaptation.errorMessage) return { tone: "attention", label: "RENDER NEEDS ATTENTION", detail: "The saved recipe remains separate from the original. Refresh after the rendering service is available.", canPreview: false };
  if (adaptation.status === "ready" && adaptation.artifact?.state === "current_recipe_rendered") return { tone: "ready", label: "CURRENT RENDER READY", detail: "A workspace-authorized artifact is available to review before any creator approval action.", canPreview: true };
  if (adaptation.artifact?.state === "previous_recipe_artifact_available") return { tone: "accent", label: "UPDATED RENDER IN PROGRESS", detail: "A prior artifact remains available while the latest non-destructive recipe is rendered.", canPreview: true };
  if (adaptation.status === "processing" || renderState.includes("processing")) return { tone: "accent", label: "PRIVATE RENDERING", detail: "The processor is working on the saved recipe. This does not publish content.", canPreview: false };
  return { tone: "accent", label: "RENDER QUEUED", detail: "The saved recipe is queued for private rendering. Refresh for the server-confirmed artifact state.", canPreview: false };
}

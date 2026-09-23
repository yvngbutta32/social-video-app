import type { MobileEditRecipe } from "@/lib/creator-workflow";
import type { ServerAdaptationRecipe } from "@/lib/adaptation-contract";

export function localRecipeToManualEdit(recipe: MobileEditRecipe) {
  return {
    sourceRange: { startSeconds: recipe.trimStartSeconds, endSeconds: recipe.trimEndSeconds },
    ...(recipe.selectedClipCandidateId ? { clipCandidateId: recipe.selectedClipCandidateId } : {}),
    composition: {
      mode: recipe.composition === "blur_background" ? "blur_bg" : recipe.composition,
      focalPoint: { x: recipe.focalX, y: recipe.focalY },
      showSafeZones: true,
    },
    captions: { enabled: recipe.captionsEnabled, style: recipe.captionsEnabled ? "clean" : "off" },
    headline: recipe.headline.trim() || null,
    headlinePlacement: recipe.headlinePlacement,
    audio: { normalize: recipe.normalizeAudio },
  };
}

export function serverRecipeToLocalRecipe(sourceId: string, server: ServerAdaptationRecipe, prior: MobileEditRecipe): MobileEditRecipe {
  return {
    ...prior,
    sourceId,
    trimStartSeconds: server.sourceRange.startSeconds,
    trimEndSeconds: server.sourceRange.endSeconds,
    composition: server.composition.mode === "blur_bg" ? "blur_background" : server.composition.mode === "smart_fill" || server.composition.mode === "crop" ? "smart_crop" : server.composition.mode,
    focalX: server.composition.focalPoint?.x ?? prior.focalX,
    focalY: server.composition.focalPoint?.y ?? prior.focalY,
    headline: server.headline ?? "",
    headlinePlacement: server.headlinePlacement,
    captionsEnabled: server.captions.enabled,
    normalizeAudio: server.audio.normalize,
    revision: server.provenance.revision,
  };
}

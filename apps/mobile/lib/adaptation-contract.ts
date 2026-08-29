export type AdaptationExperiment = {
  variantId: string;
  platform: string;
  hook: string;
  caption: string;
  aspectRatio: string;
  availability: string;
  destination: { username?: string | null; displayName?: string | null } | null;
};

export type AdaptationPlan = {
  sourceVideoId: string;
  objective: string;
  creatorBrief: string;
  experiments: AdaptationExperiment[];
  missingPlatforms: string[];
  nextStep: string;
  safeguards: string[];
};

export type ServerAdaptationRecipe = {
  sourceRange: { startSeconds: number; endSeconds: number };
  composition: { mode: "fit" | "crop" | "blur_bg" | "smart_crop" | "smart_fill"; focalPoint: { x: number; y: number } | null };
  captions: { enabled: boolean; style: "off" | "clean" | "high_contrast" };
  headline: string | null;
  headlinePlacement: "upper_safe" | "center_safe" | "lower_safe";
  audio: { normalize: boolean };
  provenance: { revision: number };
};

export type AdaptationDetail = {
  variantId: string;
  platform: string;
  status: string;
  artifact: { state: "current_recipe_rendered" | "previous_recipe_artifact_available"; completedAt: string | null } | null;
  renderState: string;
  errorMessage: string | null;
  recipe: ServerAdaptationRecipe | null;
  safeguards: string[];
};

export type AdaptationSave = { variantId: string; status: string; recipe: ServerAdaptationRecipe; renderState: string; nextStep: string };

export type PrivateArtifactPreview = { kind: "video" | "thumbnail"; url: string; expiresAt: string; safeguards: string[] };

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function recipe(value: unknown): ServerAdaptationRecipe | null {
  const input = object(value);
  const sourceRange = object(input?.sourceRange);
  const composition = object(input?.composition);
  const focalPoint = object(composition?.focalPoint);
  const captions = object(input?.captions);
  const audio = object(input?.audio);
  const provenance = object(input?.provenance);
  const startSeconds = number(sourceRange?.startSeconds);
  const endSeconds = number(sourceRange?.endSeconds);
  const mode = string(composition?.mode);
  const enabled = captions?.enabled;
  const style = string(captions?.style);
  const normalize = audio?.normalize;
  const revision = number(provenance?.revision);
  const headlinePlacement = string(input?.headlinePlacement);
  if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds || !mode || !["fit", "crop", "blur_bg", "smart_crop", "smart_fill"].includes(mode) || typeof enabled !== "boolean" || (style !== "off" && style !== "clean" && style !== "high_contrast") || typeof normalize !== "boolean" || revision === null || !Number.isInteger(revision) || revision < 1) return null;
  if (input?.headlinePlacement !== undefined && headlinePlacement !== "upper_safe" && headlinePlacement !== "center_safe" && headlinePlacement !== "lower_safe") return null;
  const x = number(focalPoint?.x);
  const y = number(focalPoint?.y);
  if ((x === null) !== (y === null) || (x !== null && (x < 0 || x > 1 || y === null || y < 0 || y > 1))) return null;
  const headline = input?.headline === null ? null : string(input?.headline);
  if (input?.headline !== null && input?.headline !== undefined && headline === null) return null;
  const resolvedHeadlinePlacement = (headlinePlacement ?? "upper_safe") as ServerAdaptationRecipe["headlinePlacement"];
  return { sourceRange: { startSeconds, endSeconds }, composition: { mode: mode as ServerAdaptationRecipe["composition"]["mode"], focalPoint: x === null ? null : { x, y: y as number } }, captions: { enabled, style }, headline, headlinePlacement: resolvedHeadlinePlacement, audio: { normalize }, provenance: { revision } };
}

export function parseAdaptationPlan(payload: unknown): AdaptationPlan {
  const data = object(object(payload)?.data);
  const sourceVideoId = string(data?.sourceVideoId);
  const objective = string(data?.objective);
  const experiments = Array.isArray(data?.experiments) ? data.experiments.map((entry) => {
    const item = object(entry);
    const variantId = string(item?.variantId);
    const platform = string(item?.platform);
    const hook = string(item?.hook);
    const caption = string(item?.caption);
    const aspectRatio = string(item?.aspectRatio);
    const availability = string(item?.availability);
    if (!variantId || !platform || !hook || !caption || !aspectRatio || !availability) throw new Error("The adaptation plan was incomplete. Refresh after private processing finishes.");
    const destination = object(item?.destination);
    return { variantId, platform, hook, caption, aspectRatio, availability, destination: destination ? { username: string(destination.username), displayName: string(destination.displayName) } : null };
  }) : null;
  const nextStep = string(data?.nextStep);
  if (!sourceVideoId || !objective || !experiments || !nextStep) throw new Error("The adaptation plan was incomplete. Refresh after private processing finishes.");
  return { sourceVideoId, objective, creatorBrief: string(data?.creatorBrief) ?? "", experiments, missingPlatforms: strings(data?.missingPlatforms), nextStep, safeguards: strings(data?.safeguards) };
}

export function parseAdaptationDetail(payload: unknown): AdaptationDetail {
  const data = object(object(payload)?.data);
  const variantId = string(data?.variantId);
  const platform = string(data?.platform);
  const status = string(data?.status);
  const renderState = string(data?.renderState);
  if (!variantId || !platform || !status || !renderState) throw new Error("The adaptation status was incomplete. Refresh it before reviewing an artifact.");
  const artifactData = object(data?.artifact);
  const artifactState = string(artifactData?.state);
  const artifact = artifactData && (artifactState === "current_recipe_rendered" || artifactState === "previous_recipe_artifact_available") ? { state: artifactState as "current_recipe_rendered" | "previous_recipe_artifact_available", completedAt: string(artifactData.completedAt) } : null;
  return { variantId, platform, status, artifact, renderState, errorMessage: string(data?.errorMessage), recipe: recipe(data?.recipe), safeguards: strings(data?.safeguards) };
}

export function parseAdaptationSave(payload: unknown): AdaptationSave {
  const data = object(object(payload)?.data);
  const variantId = string(data?.variantId);
  const status = string(data?.status);
  const renderState = string(data?.renderState);
  const nextStep = string(data?.nextStep);
  const parsedRecipe = recipe(data?.recipe);
  if (!variantId || !status || !renderState || !nextStep || !parsedRecipe) throw new Error("The saved edit response was incomplete. Your local draft remains available.");
  return { variantId, status, recipe: parsedRecipe, renderState, nextStep };
}

export function parsePrivateArtifactPreview(payload: unknown): PrivateArtifactPreview {
  const data = object(object(payload)?.data);
  const kind = string(data?.kind);
  const url = string(data?.url);
  const expiresAt = string(data?.expiresAt);
  if ((kind !== "video" && kind !== "thumbnail") || !url || !expiresAt) throw new Error("The private artifact preview was incomplete. Request a new preview from this workspace.");
  return { kind, url, expiresAt, safeguards: strings(data?.safeguards) };
}

export function artifactStateLabel(artifact: AdaptationDetail["artifact"]) {
  if (!artifact) return "No private artifact is available yet";
  return artifact.state === "current_recipe_rendered" ? "Current recipe artifact is ready" : "A prior recipe artifact is available";
}

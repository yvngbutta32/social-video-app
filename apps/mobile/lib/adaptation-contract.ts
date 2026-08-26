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
  experiments: AdaptationExperiment[];
  missingPlatforms: string[];
  nextStep: string;
  safeguards: string[];
};

export type AdaptationDetail = {
  variantId: string;
  platform: string;
  status: string;
  artifact: { state: "current_recipe_rendered" | "previous_recipe_artifact_available"; completedAt: string | null } | null;
  renderState: string;
  errorMessage: string | null;
  safeguards: string[];
};

export type PrivateArtifactPreview = {
  kind: "video" | "thumbnail";
  url: string;
  expiresAt: string;
  safeguards: string[];
};

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
  return { sourceVideoId, objective, experiments, missingPlatforms: strings(data?.missingPlatforms), nextStep, safeguards: strings(data?.safeguards) };
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
  const artifact = artifactData && (artifactState === "current_recipe_rendered" || artifactState === "previous_recipe_artifact_available")
    ? { state: artifactState as "current_recipe_rendered" | "previous_recipe_artifact_available", completedAt: string(artifactData.completedAt) }
    : null;
  return { variantId, platform, status, artifact, renderState, errorMessage: string(data?.errorMessage), safeguards: strings(data?.safeguards) };
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

import AsyncStorage from "@react-native-async-storage/async-storage";

import { creatorTargetPlatforms, type CreatorTargetPlatform, type MobileEditRecipe, type MobileSource } from "./creator-workflow";

const CREATOR_STATE_KEY = "viralboost.creator.local-state.v1";

export type PersistedCreatorState = {
  sources: MobileSource[];
  recipes: Record<string, MobileEditRecipe>;
  selectedSourceId: string | null;
  platformTargets: Record<string, CreatorTargetPlatform[]>;
};

export function serializeCreatorState(state: PersistedCreatorState) {
  return JSON.stringify(state);
}

export function parseCreatorState(raw: string | null): PersistedCreatorState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedCreatorState;
    if (!Array.isArray(parsed.sources) || typeof parsed.recipes !== "object" || parsed.recipes === null) return null;
    const rawTargets = parsed.platformTargets && typeof parsed.platformTargets === "object" ? parsed.platformTargets : {};
    const platformTargets = Object.fromEntries(Object.entries(rawTargets).map(([sourceId, targets]) => [sourceId, Array.isArray(targets) ? targets.filter((target): target is CreatorTargetPlatform => typeof target === "string" && creatorTargetPlatforms.includes(target as CreatorTargetPlatform)) : []]));
    return {
      sources: parsed.sources,
      recipes: parsed.recipes,
      selectedSourceId: typeof parsed.selectedSourceId === "string" ? parsed.selectedSourceId : null,
      platformTargets,
    };
  } catch {
    return null;
  }
}

export async function loadCreatorState() {
  return parseCreatorState(await AsyncStorage.getItem(CREATOR_STATE_KEY));
}

export async function saveCreatorState(state: PersistedCreatorState) {
  await AsyncStorage.setItem(CREATOR_STATE_KEY, serializeCreatorState(state));
}

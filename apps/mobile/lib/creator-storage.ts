import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MobileEditRecipe, MobileSource } from "./creator-workflow";

const CREATOR_STATE_KEY = "viralboost.creator.local-state.v1";

export type PersistedCreatorState = {
  sources: MobileSource[];
  recipes: Record<string, MobileEditRecipe>;
  selectedSourceId: string | null;
};

export function serializeCreatorState(state: PersistedCreatorState) {
  return JSON.stringify(state);
}

export function parseCreatorState(raw: string | null): PersistedCreatorState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedCreatorState;
    if (!Array.isArray(parsed.sources) || typeof parsed.recipes !== "object" || parsed.recipes === null) return null;
    return {
      sources: parsed.sources,
      recipes: parsed.recipes,
      selectedSourceId: typeof parsed.selectedSourceId === "string" ? parsed.selectedSourceId : null,
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

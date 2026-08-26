import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import type { LocalCreatorMedia } from "./media-import";
import { loadCreatorState, saveCreatorState } from "./creator-storage";
import { reconcileWorkspaceSources, type WorkspaceSourceSummary } from "./source-sync-contract";

export type SourceStatus = "ready_to_queue" | "uploading" | "processing" | "ready" | "failed" | "archived";

export type MultipartUploadRecovery = {
  videoId: string;
  partSizeBytes: number;
  partCount: number;
  uploadedPartNumbers: number[];
};

export type MobileSource = Omit<LocalCreatorMedia, "uri" | "origin"> & {
  uri: string | null;
  origin: LocalCreatorMedia["origin"] | "workspace";
  id: string;
  importedAt: string;
  status: SourceStatus;
  serverVideoId?: string;
  uploadError?: string;
  multipartUpload?: MultipartUploadRecovery;
};

export type MobileEditRecipe = {
  sourceId: string;
  trimStartSeconds: number;
  trimEndSeconds: number;
  composition: "smart_crop" | "fit" | "blur_background";
  focalX: number;
  focalY: number;
  headline: string;
  captionsEnabled: boolean;
  normalizeAudio: boolean;
  revision: number;
};

type CreatorWorkflowContextValue = {
  sources: MobileSource[];
  selectedSourceId: string | null;
  selectSource: (sourceId: string) => void;
  addLocalSource: (media: LocalCreatorMedia) => void;
  updateSource: (sourceId: string, update: Partial<Pick<MobileSource, "status" | "serverVideoId" | "uploadError" | "multipartUpload">>) => void;
  recipeFor: (sourceId: string) => MobileEditRecipe;
  saveRecipe: (recipe: Omit<MobileEditRecipe, "revision">) => void;
  replaceRecipe: (recipe: MobileEditRecipe) => void;
  syncWorkspaceSources: (sources: WorkspaceSourceSummary[]) => void;
};

const CreatorWorkflowContext = createContext<CreatorWorkflowContextValue | null>(null);

export const createDefaultRecipe = (sourceId: string): MobileEditRecipe => ({
  sourceId,
  trimStartSeconds: 0,
  trimEndSeconds: 30,
  composition: "smart_crop",
  focalX: 0.5,
  focalY: 0.42,
  headline: "",
  captionsEnabled: false,
  normalizeAudio: true,
  revision: 1,
});

export function CreatorWorkflowProvider({ children }: PropsWithChildren) {
  const [sources, setSources] = useState<MobileSource[]>([]);
  const [recipes, setRecipes] = useState<Record<string, MobileEditRecipe>>({});
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void loadCreatorState().then((persisted) => {
      if (persisted) {
        setSources(persisted.sources);
        setRecipes(persisted.recipes);
        setSelectedSourceId(persisted.selectedSourceId);
      }
    }).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveCreatorState({ sources, recipes, selectedSourceId });
  }, [hydrated, recipes, selectedSourceId, sources]);

  const addLocalSource = useCallback((media: LocalCreatorMedia) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const source: MobileSource = { ...media, id, importedAt: new Date().toISOString(), status: "ready_to_queue" };
    setSources((current) => [source, ...current]);
    setSelectedSourceId(id);
    setRecipes((current) => ({ ...current, [id]: createDefaultRecipe(id) }));
  }, []);

  const updateSource = useCallback((sourceId: string, update: Partial<Pick<MobileSource, "status" | "serverVideoId" | "uploadError" | "multipartUpload">>) => {
    setSources((current) => current.map((source) => source.id === sourceId ? { ...source, ...update } : source));
  }, []);

  const recipeFor = useCallback((sourceId: string) => recipes[sourceId] ?? createDefaultRecipe(sourceId), [recipes]);

  const saveRecipe = useCallback((recipe: Omit<MobileEditRecipe, "revision">) => {
    setRecipes((current) => {
      const prior = current[recipe.sourceId];
      return { ...current, [recipe.sourceId]: { ...recipe, revision: (prior?.revision ?? 0) + 1 } };
    });
  }, []);

  const replaceRecipe = useCallback((recipe: MobileEditRecipe) => {
    setRecipes((current) => ({ ...current, [recipe.sourceId]: recipe }));
  }, []);

  const syncWorkspaceSources = useCallback((incoming: WorkspaceSourceSummary[]) => {
    setSources((current) => reconcileWorkspaceSources(current, incoming));
    setRecipes((current) => {
      const next = { ...current };
      for (const source of incoming) {
        const existing = sources.find((item) => item.serverVideoId === source.id);
        const sourceId = existing?.id ?? `server-${source.id}`;
        if (!next[sourceId]) next[sourceId] = createDefaultRecipe(sourceId);
      }
      return next;
    });
  }, [sources]);

  const value = useMemo(() => ({
    sources,
    selectedSourceId,
    selectSource: setSelectedSourceId,
    addLocalSource,
    updateSource,
    recipeFor,
    saveRecipe,
    replaceRecipe,
    syncWorkspaceSources,
  }), [addLocalSource, recipeFor, replaceRecipe, saveRecipe, selectedSourceId, sources, syncWorkspaceSources, updateSource]);

  return <CreatorWorkflowContext.Provider value={value}>{children}</CreatorWorkflowContext.Provider>;
}

export function useCreatorWorkflow() {
  const context = useContext(CreatorWorkflowContext);
  if (!context) throw new Error("useCreatorWorkflow must be used inside CreatorWorkflowProvider");
  return context;
}

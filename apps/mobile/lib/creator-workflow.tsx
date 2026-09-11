import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import type { LocalCreatorMedia } from "./media-import";
import { normalizeAdaptationBrief } from "./adaptation-brief";
import { loadCreatorState, saveCreatorState } from "./creator-storage";
import { reconcileWorkspaceSources, type WorkspaceSourceSummary } from "./source-sync-contract";
import type { TimedCaptionTrack } from "./timed-caption-contract";

export type SourceStatus = "ready_to_queue" | "uploading" | "processing" | "ready" | "failed" | "archived";
export const creatorTargetPlatforms = ["tiktok", "instagram", "youtube", "linkedin"] as const;
export type CreatorTargetPlatform = (typeof creatorTargetPlatforms)[number];

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
  adaptationBrief?: string;
};

export type MobileEditRecipe = {
  sourceId: string;
  trimStartSeconds: number;
  trimEndSeconds: number;
  composition: "smart_crop" | "fit" | "blur_background";
  focalX: number;
  focalY: number;
  headline: string;
  headlinePlacement: "upper_safe" | "center_safe" | "lower_safe";
  captionsEnabled: boolean;
  timedCaptionTrack?: TimedCaptionTrack;
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
  platformsFor: (sourceId: string) => CreatorTargetPlatform[];
  setPlatformTargets: (sourceId: string, platforms: CreatorTargetPlatform[]) => void;
  briefFor: (sourceId: string) => string;
  setAdaptationBrief: (sourceId: string, brief: string) => void;
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
  headlinePlacement: "upper_safe",
  captionsEnabled: false,
  timedCaptionTrack: undefined,
  normalizeAudio: true,
  revision: 1,
});

export function CreatorWorkflowProvider({ children }: PropsWithChildren) {
  const [sources, setSources] = useState<MobileSource[]>([]);
  const [recipes, setRecipes] = useState<Record<string, MobileEditRecipe>>({});
  const [platformTargets, setPlatformTargetsState] = useState<Record<string, CreatorTargetPlatform[]>>({});
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void loadCreatorState().then((persisted) => {
      if (persisted) {
        setSources(persisted.sources);
        setRecipes(persisted.recipes);
        setSelectedSourceId(persisted.selectedSourceId);
        setPlatformTargetsState(persisted.platformTargets);
      }
    }).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveCreatorState({ sources, recipes, selectedSourceId, platformTargets });
  }, [hydrated, platformTargets, recipes, selectedSourceId, sources]);

  const addLocalSource = useCallback((media: LocalCreatorMedia) => {
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const source: MobileSource = { ...media, id, importedAt: new Date().toISOString(), status: "ready_to_queue", adaptationBrief: "" };
    setSources((current) => [source, ...current]);
    setSelectedSourceId(id);
    setRecipes((current) => ({ ...current, [id]: createDefaultRecipe(id) }));
    setPlatformTargetsState((current) => ({ ...current, [id]: [] }));
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

  const platformsFor = useCallback((sourceId: string) => platformTargets[sourceId] ?? [], [platformTargets]);

  const setPlatformTargets = useCallback((sourceId: string, platforms: CreatorTargetPlatform[]) => {
    const unique = [...new Set(platforms)].filter((platform): platform is CreatorTargetPlatform => creatorTargetPlatforms.includes(platform as CreatorTargetPlatform));
    setPlatformTargetsState((current) => ({ ...current, [sourceId]: unique }));
  }, []);

  const briefFor = useCallback((sourceId: string) => sources.find((source) => source.id === sourceId)?.adaptationBrief ?? "", [sources]);

  const setAdaptationBrief = useCallback((sourceId: string, brief: string) => {
    const adaptationBrief = normalizeAdaptationBrief(brief);
    setSources((current) => current.map((source) => source.id === sourceId ? { ...source, adaptationBrief } : source));
  }, []);

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
    platformsFor,
    setPlatformTargets,
    briefFor,
    setAdaptationBrief,
  }), [addLocalSource, briefFor, platformsFor, recipeFor, replaceRecipe, saveRecipe, selectedSourceId, setAdaptationBrief, setPlatformTargets, sources, syncWorkspaceSources, updateSource]);

  return <CreatorWorkflowContext.Provider value={value}>{children}</CreatorWorkflowContext.Provider>;
}

export function useCreatorWorkflow() {
  const context = useContext(CreatorWorkflowContext);
  if (!context) throw new Error("useCreatorWorkflow must be used inside CreatorWorkflowProvider");
  return context;
}

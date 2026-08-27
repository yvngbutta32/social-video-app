import type { MobileSource } from "./creator-workflow";

export type CreatorFlowAction = "import" | "library" | "processing" | "review";

export type CreatorFlowNextStep = {
  stage: "import" | "upload" | "processing" | "adapt" | "review" | "recover";
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
  action: CreatorFlowAction;
};

export function deriveCreatorFlowNextStep(source: Pick<MobileSource, "status" | "serverVideoId"> | null, targetCount: number): CreatorFlowNextStep {
  if (!source) return { stage: "import", eyebrow: "Start a creator workflow", title: "Add a source you are permitted to use", detail: "Import a video from your device. It stays local until you choose private workspace processing.", actionLabel: "Add source", action: "import" };
  if (source.status === "failed") return { stage: "recover", eyebrow: "Source recovery", title: "Resume this private source", detail: "Review the safe recovery detail, then retry the source upload or processing step that failed.", actionLabel: "Recover source", action: "library" };
  if (source.status === "ready_to_queue") return { stage: "upload", eyebrow: "Private processing", title: "Upload this source when you are ready", detail: "Private processing creates the server-backed source required for verified adaptations and artifacts.", actionLabel: "Open source", action: "library" };
  if (source.status === "uploading" || source.status === "processing") return { stage: "processing", eyebrow: "Private processing", title: "Your source is being prepared", detail: "Check the confirmed processing state. Adaptations and private artifacts remain unavailable until it is ready.", actionLabel: "View processing", action: source.serverVideoId ? "processing" : "library" };
  if (source.status === "archived") return { stage: "recover", eyebrow: "Archived source", title: "This source is no longer editable", detail: "Archived sources stay in your authorized workspace but cannot be processed or rendered.", actionLabel: "Open library", action: "library" };
  if (targetCount === 0) return { stage: "adapt", eyebrow: "Choose your targets", title: "Prepare only the platforms you want", detail: "Select TikTok, Instagram Reels, YouTube Shorts, and/or LinkedIn to create editable adaptation drafts. Selection does not publish content.", actionLabel: "Choose platforms", action: "review" };
  return { stage: "review", eyebrow: "Adapt and refine", title: "Your targeted drafts are ready to review", detail: `${targetCount} selected ${targetCount === 1 ? "target is" : "targets are"} ready for planning and non-destructive refinement. Creator review remains required before any future action.`, actionLabel: "Review adaptations", action: "review" };
}

export function sourceProgressLabel(source: Pick<MobileSource, "status">, targetCount: number) {
  if (source.status === "failed") return { label: "ACTION NEEDED", tone: "attention" as const };
  if (source.status === "uploading") return { label: "UPLOADING", tone: "accent" as const };
  if (source.status === "processing") return { label: "PROCESSING", tone: "accent" as const };
  if (source.status === "archived") return { label: "ARCHIVED", tone: "muted" as const };
  if (source.status === "ready") return targetCount ? { label: `${targetCount} TARGET${targetCount === 1 ? "" : "S"} SET`, tone: "ready" as const } : { label: "READY TO ADAPT", tone: "ready" as const };
  return { label: "UPLOAD REQUIRED", tone: "muted" as const };
}

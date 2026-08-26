export type WorkspaceActivityEvent = {
  action: "workspace_selected" | "creator_publish_intent_created" | "creator_publish_intent_approved";
  resourceType: string | null;
  createdAt: string;
};

const validActions = new Set<WorkspaceActivityEvent["action"]>(["workspace_selected", "creator_publish_intent_created", "creator_publish_intent_approved"]);

export function parseWorkspaceActivity(payload: unknown): WorkspaceActivityEvent[] {
  const events = (payload as { data?: { events?: unknown } })?.data?.events;
  if (!Array.isArray(events)) throw new Error("Workspace activity is not available right now.");
  return events.map((event) => {
    const value = event as Partial<WorkspaceActivityEvent>;
    if (!value.action || !validActions.has(value.action) || typeof value.createdAt !== "string") throw new Error("Workspace activity contained an unsupported event.");
    return { action: value.action, resourceType: typeof value.resourceType === "string" ? value.resourceType : null, createdAt: value.createdAt };
  });
}

export function workspaceActivityLabel(action: WorkspaceActivityEvent["action"]) {
  return ({ workspace_selected: "Workspace selected", creator_publish_intent_created: "Creator publish draft prepared", creator_publish_intent_approved: "Creator approval recorded" })[action];
}

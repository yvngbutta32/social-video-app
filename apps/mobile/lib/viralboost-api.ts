import Constants from "expo-constants";

import { parseAdaptationDetail, parseAdaptationPlan, parseAdaptationSave, parsePrivateArtifactPreview } from "@/lib/adaptation-contract";
import { assertAuthorizedWorkspace, listAuthorizedWorkspaces, parseNativeAuthData, selectWorkspaceId, type AuthorizedWorkspace, type MobileAuthData } from "@/lib/mobile-auth-contract";
import { parseSourceAnalytics } from "@/lib/analytics-contract";
import { parseProcessingDiagnostic } from "@/lib/processing-contract";
import { parseWorkspaceSources } from "@/lib/source-sync-contract";
import { clearSecureSession, getSecureSession, saveSecureSession } from "@/lib/secure-session";

function apiBaseUrl() {
  const configured = Constants.expoConfig?.extra?.viralBoostApiUrl;
  return typeof configured === "string" ? configured.replace(/\/$/, "") : "";
}

export function isViralBoostApiConfigured() {
  return Boolean(apiBaseUrl());
}

async function parseApiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  return body?.error || body?.message || "The secure workspace could not complete that request.";
}

async function nativePublicRequest(path: string, body: Record<string, unknown>) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error("A secure ViralBoost API URL has not been configured for this app build.");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-viralboost-client": "native" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<unknown>;
}

type NativeMeResponse = { data?: { workspaces?: { workspace?: { id?: string; name?: string | null; slug?: string | null } }[] } };
export type PendingNativeSession = { auth: MobileAuthData; workspaces: AuthorizedWorkspace[] };

async function nativeMe(accessToken: string): Promise<NativeMeResponse> {
  const baseUrl = apiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<NativeMeResponse>;
}

export async function beginViralBoostSignIn(email: string, password: string): Promise<PendingNativeSession> {
  const payload = await nativePublicRequest("/api/v1/auth/login", { email: email.trim().toLowerCase(), password, rememberMe: true });
  const auth = parseNativeAuthData(payload);
  const me = await nativeMe(auth.accessToken);
  return { auth, workspaces: listAuthorizedWorkspaces(me.data?.workspaces ?? []) };
}

export async function completeViralBoostSignIn(candidate: PendingNativeSession, workspaceId: string) {
  assertAuthorizedWorkspace(candidate.workspaces, workspaceId);
  await saveSecureSession(candidate.auth.accessToken, candidate.auth.refreshToken, workspaceId);
  return { user: candidate.auth.user, workspaceId };
}

export async function signInToViralBoost(email: string, password: string) {
  const candidate = await beginViralBoostSignIn(email, password);
  return completeViralBoostSignIn(candidate, selectWorkspaceId(candidate.workspaces.map((workspace) => ({ workspace }))));
}

export async function refreshViralBoostSession() {
  const session = await getSecureSession();
  if (!session.refreshToken) throw new Error("Your secure session has expired. Sign in again to continue.");
  const payload = await nativePublicRequest("/api/v1/auth/refresh", { refreshToken: session.refreshToken });
  const auth = parseNativeAuthData(payload);
  const me = await nativeMe(auth.accessToken);
  const workspaces = listAuthorizedWorkspaces(me.data?.workspaces ?? []);
  const workspaceId = session.workspaceId ? assertAuthorizedWorkspace(workspaces, session.workspaceId).id : selectWorkspaceId(workspaces.map((workspace) => ({ workspace })));
  await saveSecureSession(auth.accessToken, auth.refreshToken, workspaceId);
  return { user: auth.user, workspaceId };
}

export async function getAuthorizedWorkspaces() {
  const session = await getSecureSession();
  if (!session.accessToken) throw new Error("Connect an invited creator session before choosing a workspace.");
  const me = await nativeMe(session.accessToken);
  return listAuthorizedWorkspaces(me.data?.workspaces ?? []);
}

export async function selectViralBoostWorkspace(workspaceId: string) {
  const session = await getSecureSession();
  if (!session.accessToken || !session.refreshToken) throw new Error("Connect an invited creator session before choosing a workspace.");
  assertAuthorizedWorkspace(await getAuthorizedWorkspaces(), workspaceId);
  await saveSecureSession(session.accessToken, session.refreshToken, workspaceId);
}

export async function signOutOfViralBoost() {
  await clearSecureSession();
}

export async function getProcessingDiagnostic(videoId: string) {
  const response = await viralBoostRequest(`/api/v1/videos/${videoId}/processing-diagnostics`);
  if (!response.ok) throw new Error(await parseApiError(response));
  return parseProcessingDiagnostic(await response.json());
}

export async function retryProcessing(videoId: string) {
  const response = await viralBoostRequest(`/api/v1/videos/${videoId}/retry-processing`, { method: "POST" });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<{ data?: { manualRetryCount?: number; nextStep?: string } }>;
}

export async function getSourceAnalytics(videoId: string) {
  const response = await viralBoostRequest(`/api/v1/videos/${videoId}/analytics`);
  if (!response.ok) throw new Error(await parseApiError(response));
  return parseSourceAnalytics(await response.json());
}

export async function getWorkspaceSources() {
  const response = await viralBoostRequest("/api/v1/videos?limit=50&sortBy=updatedAt&sortOrder=desc");
  if (!response.ok) throw new Error(await parseApiError(response));
  return parseWorkspaceSources(await response.json());
}

export async function prepareAdaptationPlan(videoId: string) {
  const response = await viralBoostRequest("/api/v1/growth/experiment-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoId, platforms: ["tiktok", "instagram", "youtube", "linkedin"], objective: "retention" }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return parseAdaptationPlan(await response.json());
}

export async function getAdaptationDetail(variantId: string) {
  const response = await viralBoostRequest(`/api/v1/growth/adaptations/${variantId}`);
  if (!response.ok) throw new Error(await parseApiError(response));
  return parseAdaptationDetail(await response.json());
}

export async function saveAdaptationEdit(variantId: string, edit: Record<string, unknown>) {
  const response = await viralBoostRequest(`/api/v1/growth/adaptations/${variantId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(edit),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return parseAdaptationSave(await response.json());
}

export async function getPrivateArtifactPreview(variantId: string) {
  const response = await viralBoostRequest(`/api/v1/growth/adaptations/${variantId}/preview?kind=video`);
  if (!response.ok) throw new Error(await parseApiError(response));
  return parsePrivateArtifactPreview(await response.json());
}

export async function viralBoostRequest(path: string, init: RequestInit = {}) {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error("A secure ViralBoost API URL has not been configured for this app build.");
  }
  const session = await getSecureSession();
  if (!session.accessToken || !session.workspaceId) {
    throw new Error("Connect an invited creator workspace before requesting private ViralBoost data.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  headers.set("x-workspace-id", session.workspaceId);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

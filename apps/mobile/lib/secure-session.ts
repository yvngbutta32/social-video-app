import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "viralboost.access-token";
const REFRESH_TOKEN_KEY = "viralboost.refresh-token";
const WORKSPACE_ID_KEY = "viralboost.workspace-id";

async function getWebStorage() {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

export async function saveSecureSession(accessToken: string, refreshToken: string, workspaceId: string) {
  if (Platform.OS === "web") {
    const storage = await getWebStorage();
    storage?.setItem(ACCESS_TOKEN_KEY, accessToken);
    storage?.setItem(REFRESH_TOKEN_KEY, refreshToken);
    storage?.setItem(WORKSPACE_ID_KEY, workspaceId);
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  await SecureStore.setItemAsync(WORKSPACE_ID_KEY, workspaceId);
}

export async function getSecureSession() {
  if (Platform.OS === "web") {
    const storage = await getWebStorage();
    return {
      accessToken: storage?.getItem(ACCESS_TOKEN_KEY) ?? null,
      refreshToken: storage?.getItem(REFRESH_TOKEN_KEY) ?? null,
      workspaceId: storage?.getItem(WORKSPACE_ID_KEY) ?? null,
    };
  }
  const [accessToken, refreshToken, workspaceId] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(WORKSPACE_ID_KEY),
  ]);
  return { accessToken, refreshToken, workspaceId };
}

export async function clearSecureSession() {
  if (Platform.OS === "web") {
    const storage = await getWebStorage();
    storage?.removeItem(ACCESS_TOKEN_KEY);
    storage?.removeItem(REFRESH_TOKEN_KEY);
    storage?.removeItem(WORKSPACE_ID_KEY);
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(WORKSPACE_ID_KEY),
  ]);
}

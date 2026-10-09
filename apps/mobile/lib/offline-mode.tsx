import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { isViralBoostApiConfigured } from "./viralboost-api";

const OFFLINE_MODE_KEY = "viralboost.offline-mode.v1";

type OfflineModeContextValue = {
  offlineMode: boolean;
  effectiveOffline: boolean;
  setOfflineMode: (enabled: boolean) => void;
  markOffline: () => void;
  markOnline: () => void;
};

const OfflineModeContext = createContext<OfflineModeContextValue | null>(null);

export function OfflineModeProvider({ children }: PropsWithChildren) {
  const [offlineMode, setOfflineModeState] = useState(false);
  const [runtimeOffline, setRuntimeOffline] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const apiConfigured = isViralBoostApiConfigured();

  useEffect(() => {
    void AsyncStorage.getItem(OFFLINE_MODE_KEY).then((value) => {
      setOfflineModeState(value === "true");
    }).finally(() => setHydrated(true));
  }, []);

  const setOfflineMode = (enabled: boolean) => {
    setOfflineModeState(enabled);
    if (!enabled) setRuntimeOffline(false);
    void AsyncStorage.setItem(OFFLINE_MODE_KEY, String(enabled));
  };

  const markOffline = () => setRuntimeOffline(true);
  const markOnline = () => setRuntimeOffline(false);

  const value = useMemo(() => ({
    offlineMode,
    effectiveOffline: hydrated && (offlineMode || !apiConfigured || runtimeOffline),
    setOfflineMode,
    markOffline,
    markOnline,
  }), [apiConfigured, hydrated, offlineMode, runtimeOffline]);

  return <OfflineModeContext.Provider value={value}>{children}</OfflineModeContext.Provider>;
}

export function useOfflineMode() {
  const context = useContext(OfflineModeContext);
  if (!context) throw new Error("useOfflineMode must be used inside OfflineModeProvider");
  return context;
}

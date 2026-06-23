import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, type AppTheme } from "./theme";
import { useAsyncStorageState } from "./useAsyncStorageState";

export type ThemeMode = "light" | "dark" | "system";

interface ThemePreferenceValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: AppTheme;
  isDark: boolean;
}

const STORAGE_KEY = "@splitbill/theme-mode";

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function deserializeThemeMode(raw: string): ThemeMode {
  return isThemeMode(raw) ? raw : "system";
}

export function ThemePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();
  const { value: mode, setValue: setModeState } =
    useAsyncStorageState<ThemeMode>({
      key: STORAGE_KEY,
      initialValue: "system",
      deserialize: deserializeThemeMode,
    });

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, [setModeState]);

  const isDark =
    mode === "system" ? systemScheme === "dark" : mode === "dark";
  const theme = isDark ? darkTheme : lightTheme;
  const value = useMemo(
    () => ({ mode, setMode, theme, isDark }),
    [isDark, mode, setMode, theme]
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) {
    throw new Error(
      "useThemePreference must be used within a ThemePreferenceProvider"
    );
  }
  return ctx;
}

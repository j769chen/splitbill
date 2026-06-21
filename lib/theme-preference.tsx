import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkTheme, lightTheme, type AppTheme } from "./theme";

export type ThemeMode = "light" | "dark" | "system";

interface ThemePreferenceValue {
  /** The user's chosen mode, including "system". */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** The resolved Paper theme for the active appearance. */
  theme: AppTheme;
  isDark: boolean;
}

const STORAGE_KEY = "@splitbill/theme-mode";

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (mounted && isThemeMode(raw)) {
        setModeState(raw);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark =
    mode === "system" ? systemScheme === "dark" : mode === "dark";
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemePreferenceContext.Provider value={{ mode, setMode, theme, isDark }}>
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

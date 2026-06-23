import { Stack } from "expo-router";
import { type ComponentProps, useEffect } from "react";
import { Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AuthProvider } from "@/lib/auth";
import { SnackbarProvider } from "@/lib/snackbar";
import { ConfirmProvider } from "@/lib/confirm";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@/lib/theme-preference";
import { StatusBar } from "expo-status-bar";

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

function ThemedApp() {
  const { theme, isDark } = useThemePreference();

  // On web, Chrome/Safari paint autofilled inputs (email, password) with their
  // own near-white background and dark text via `!important`, ignoring the Paper
  // theme. Override it with a theme-aware inset box-shadow so inputs follow the
  // active light/dark theme instead of showing a white box.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const id = "autofill-theme-override";
    let styleEl = document.getElementById(id) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = id;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active,
      textarea:-webkit-autofill,
      select:-webkit-autofill {
        -webkit-text-fill-color: ${theme.colors.onSurface} !important;
        -webkit-box-shadow: 0 0 0 1000px ${theme.colors.background} inset !important;
        box-shadow: 0 0 0 1000px ${theme.colors.background} inset !important;
        caret-color: ${theme.colors.onSurface} !important;
        transition: background-color 9999s ease-in-out 0s;
      }
    `;
  }, [theme]);

  return (
    <PaperProvider
      theme={theme}
      settings={{
        icon: ({ name, ...props }) => (
          <MaterialCommunityIcons name={name as MaterialIconName} {...props} />
        ),
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SnackbarProvider>
            <ConfirmProvider>
              <StatusBar style={isDark ? "light" : "dark"} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: theme.colors.background },
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="contacts" />
              </Stack>
            </ConfirmProvider>
          </SnackbarProvider>
        </AuthProvider>
      </QueryClientProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <ThemedApp />
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

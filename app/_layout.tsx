import "../global.css";
import { Stack } from "expo-router";
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

  return (
    <PaperProvider
      theme={theme}
      settings={{
        icon: (props) => <MaterialCommunityIcons {...(props as any)} />,
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

import "../global.css";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AuthProvider } from "@/lib/auth";
import { SnackbarProvider } from "@/lib/snackbar";
import { ConfirmProvider } from "@/lib/confirm";
import { usePaperTheme } from "@/lib/theme";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const theme = usePaperTheme();
  const scheme = useColorScheme();

  return (
    <SafeAreaProvider>
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
                <StatusBar style={scheme === "dark" ? "light" : "dark"} />
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
    </SafeAreaProvider>
  );
}

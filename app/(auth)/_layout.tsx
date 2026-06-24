import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useAppTheme } from "@/lib/theme";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function AuthLayout() {
  const theme = useAppTheme();
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

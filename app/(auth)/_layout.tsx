import { Stack, Redirect } from "expo-router";
import { View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useAuth } from "@/lib/auth";
import { useAppTheme } from "@/lib/theme";

export default function AuthLayout() {
  const theme = useAppTheme();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
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

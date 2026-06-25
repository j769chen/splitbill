import { Stack } from "expo-router";
import { useAppTheme } from "@/lib/theme";

// Anchor the stack at the Groups list so deep-linking straight to a group
// ([id]) still leaves the list beneath it — the native back button returns to
// the Groups list. Navigations that should return to the dashboard instead use
// the Home tab's own group detail route (app/(tabs)/(home)/group/[id]).
export const unstable_settings = {
  initialRouteName: "index",
};

export default function GroupsLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.brand },
        headerTintColor: theme.colors.onBrand,
        headerTitleStyle: { fontWeight: "bold" },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Groups" }} />
      <Stack.Screen name="[id]" options={{ title: "Group" }} />
    </Stack>
  );
}

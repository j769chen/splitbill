import { Stack } from "expo-router";
import { useAppTheme } from "@/lib/theme";

// Anchor the Activity stack at the feed so transactions opened from it (group /
// contact detail, contact edits) keep the feed beneath them — back returns here
// instead of jumping to the Home tab where these screens also live.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function ActivityLayout() {
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
      <Stack.Screen name="index" options={{ title: "Activity" }} />
      <Stack.Screen name="group/[id]" options={{ title: "Group" }} />
      <Stack.Screen name="contacts/[id]" options={{ title: "Contact" }} />
      <Stack.Screen
        name="contacts/add-expense"
        options={{ title: "Add Expense", presentation: "modal" }}
      />
      <Stack.Screen
        name="contacts/settle-up"
        options={{ title: "Settle Up", presentation: "modal" }}
      />
    </Stack>
  );
}

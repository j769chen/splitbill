import { Stack } from "expo-router";
import { useAppTheme } from "@/lib/theme";

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
      <Stack.Screen
        name="create"
        options={{
          title: "Create Group",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="manage"
        options={{
          title: "Group Settings",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="add-expense"
        options={{
          title: "Add Expense",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="settle-up"
        options={{
          title: "Settle Up",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="edit-payment"
        options={{
          title: "Edit Payment",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}

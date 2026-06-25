import { Stack } from "expo-router";
import { useAppTheme } from "@/lib/theme";

// Anchor the Home stack at the dashboard so deep-links into pushed routes
// (contact / group detail) keep the dashboard beneath them — back returns here.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function HomeLayout() {
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
      <Stack.Screen name="index" options={{ title: "Dashboard" }} />
      <Stack.Screen name="group/[id]" options={{ title: "Group" }} />
      <Stack.Screen name="contacts/[id]" options={{ title: "Contact" }} />
      <Stack.Screen
        name="contacts/add"
        options={{
          title: "Send Contact Request",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="contacts/requests"
        options={{ title: "Contact Requests" }}
      />
      <Stack.Screen
        name="contacts/add-expense"
        options={{
          title: "Add Expense",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="contacts/settle-up"
        options={{
          title: "Settle Up",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}

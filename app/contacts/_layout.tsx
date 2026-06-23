import { Stack } from "expo-router";
import { useAppTheme } from "@/lib/theme";

export default function ContactsLayout() {
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
      <Stack.Screen name="[id]" options={{ title: "Contact" }} />
      <Stack.Screen
        name="add"
        options={{
          title: "Add Contact",
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
    </Stack>
  );
}

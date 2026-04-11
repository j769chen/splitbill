import { Stack } from "expo-router";

export default function GroupsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1B998B" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "bold" },
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
    </Stack>
  );
}

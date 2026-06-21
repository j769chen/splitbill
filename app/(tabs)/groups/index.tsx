import { View, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Avatar,
  Card,
  FAB,
  Text,
} from "react-native-paper";
import { useGroups } from "@/lib/queries/useGroups";
import { useAppTheme } from "@/lib/theme";
import { useState, useCallback } from "react";

export default function GroupsList() {
  const theme = useAppTheme();
  const { data: groups, isLoading, refetch } = useGroups();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <FlatList
        data={groups ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={64}
              color={theme.colors.onSurfaceDisabled}
            />
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}
            >
              No groups yet
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
            >
              Tap + to create your first group
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            mode="elevated"
            style={{ marginBottom: 12 }}
            onPress={() => router.push(`/(tabs)/groups/${item.id}`)}
          >
            <Card.Content
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Avatar.Text
                size={52}
                label={item.name.charAt(0).toUpperCase()}
                style={{ backgroundColor: theme.colors.primaryContainer }}
                labelStyle={{ color: theme.colors.onPrimaryContainer }}
              />
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                  {item.name}
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {item.group_members.length} member
                  {item.group_members.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.onSurfaceVariant}
              />
            </Card.Content>
          </Card>
        )}
      />

      <FAB
        icon="plus"
        style={{ position: "absolute", right: 16, bottom: 24 }}
        onPress={() => router.push("/(tabs)/groups/create")}
      />
    </View>
  );
}

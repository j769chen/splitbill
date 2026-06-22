import { View, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";
import { ActivityIndicator, FAB } from "react-native-paper";
import { useGroups } from "@/lib/queries/useGroups";
import { useAppTheme } from "@/lib/theme";
import { EmptyState, GroupListItem } from "@/components/groups";
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
          <EmptyState
            icon="account-group-outline"
            title="No groups yet"
            subtitle="Tap + to create your first group"
          />
        }
        renderItem={({ item }) => (
          <GroupListItem
            group={item}
            onPress={() => router.push(`/(tabs)/groups/${item.id}`)}
          />
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

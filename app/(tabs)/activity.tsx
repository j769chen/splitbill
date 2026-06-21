import { View, FlatList, RefreshControl } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useRecentActivity,
  type ActivityExpense,
} from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import { useState, useCallback } from "react";

export default function Activity() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { data: activity, refetch, isLoading } = useRecentActivity();
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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={activity ?? []}
        keyExtractor={(item: ActivityExpense) => item.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
            <MaterialCommunityIcons
              name="history"
              size={64}
              color={theme.colors.onSurfaceDisabled}
            />
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}
            >
              No recent activity
            </Text>
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Add expenses to groups to see activity here
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const payerName =
            item.paid_by === user?.id
              ? "You"
              : item.payer?.full_name ?? "Someone";
          return (
            <Card mode="elevated" style={{ marginBottom: 12 }}>
              <Card.Content>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                      {item.description}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant }}
                    >
                      {payerName} paid in {item.groups?.name ?? "a group"}
                    </Text>
                  </View>
                  <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
                >
                  {new Date(item.date).toLocaleDateString()}
                </Text>
              </Card.Content>
            </Card>
          );
        }}
      />
    </View>
  );
}

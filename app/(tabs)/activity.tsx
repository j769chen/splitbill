import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useRecentActivity, type ActivityExpense } from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";

export default function Activity() {
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
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1B998B" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={activity ?? []}
        keyExtractor={(item: ActivityExpense) => item.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="time-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-400 text-lg mt-4 text-center">
              No recent activity
            </Text>
            <Text className="text-gray-400 text-sm mt-1 text-center">
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
            <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    {item.description}
                  </Text>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {payerName} paid in {item.groups?.name ?? "a group"}
                  </Text>
                </View>
                <Text className="text-base font-bold text-gray-900">
                  {formatCurrency(item.amount)}
                </Text>
              </View>
              <Text className="text-xs text-gray-400 mt-2">
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

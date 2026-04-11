import { View, Text, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useGroups } from "@/lib/queries/useGroups";
import { useExpenses } from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { useState, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";

interface ActivityItem {
  id: string;
  type: "expense";
  description: string;
  amount: number;
  payerName: string;
  groupName: string;
  date: string;
}

export default function Activity() {
  const { user } = useAuth();
  const { data: groups, refetch, isLoading } = useGroups();
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
        data={[]}
        keyExtractor={(item: ActivityItem) => item.id}
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
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">
                  {item.description}
                </Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                  {item.payerName} paid in {item.groupName}
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
        )}
      />
    </View>
  );
}

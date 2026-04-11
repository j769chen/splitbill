import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Link, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGroups } from "@/lib/queries/useGroups";
import { useState, useCallback } from "react";

export default function GroupsList() {
  const { data: groups, isLoading, refetch } = useGroups();
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
        data={groups ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-400 text-lg mt-4 text-center">
              No groups yet
            </Text>
            <Text className="text-gray-400 text-sm mt-1 text-center">
              Tap + to create your first group
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/(tabs)/groups/${item.id}`} asChild>
            <TouchableOpacity className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm">
              <View className="w-14 h-14 rounded-full bg-primary-100 items-center justify-center">
                <Text className="text-primary-600 text-xl font-bold">
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-base font-semibold text-gray-900">
                  {item.name}
                </Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                  {item.group_members.length} member
                  {item.group_members.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </Link>
        )}
      />

      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-primary-500 rounded-full items-center justify-center shadow-lg"
        onPress={() => router.push("/(tabs)/groups/create")}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

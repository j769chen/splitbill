import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/lib/auth";
import { useUserTotalBalance } from "@/lib/queries/useBalances";
import { useGroups } from "@/lib/queries/useGroups";
import { formatCurrency } from "@/lib/utils";
import { Link } from "expo-router";
import { Pressable } from "react-native";
import { useState, useCallback } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: balance, refetch: refetchBalance } = useUserTotalBalance();
  const { data: groups, refetch: refetchGroups } = useGroups();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchGroups()]);
    setRefreshing(false);
  }, [refetchBalance, refetchGroups]);

  const net = balance?.net ?? 0;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="bg-primary-500 px-6 pt-4 pb-8 rounded-b-3xl">
        <Text className="text-white/80 text-sm font-medium">
          Overall Balance
        </Text>
        <Text
          className={`text-3xl font-bold mt-1 ${
            net >= 0 ? "text-white" : "text-red-200"
          }`}
        >
          {net >= 0 ? "+" : ""}
          {formatCurrency(net)}
        </Text>

        <View className="flex-row mt-6 gap-4">
          <View className="flex-1 bg-white/20 rounded-2xl p-4">
            <Text className="text-white/70 text-xs font-medium">You are owed</Text>
            <Text className="text-white text-xl font-bold mt-1">
              {formatCurrency(balance?.totalOwed ?? 0)}
            </Text>
          </View>
          <View className="flex-1 bg-white/20 rounded-2xl p-4">
            <Text className="text-white/70 text-xs font-medium">You owe</Text>
            <Text className="text-white text-xl font-bold mt-1">
              {formatCurrency(balance?.totalOwing ?? 0)}
            </Text>
          </View>
        </View>
      </View>

      <View className="px-6 mt-6">
        <Text className="text-lg font-bold text-gray-900 mb-4">
          Your Groups
        </Text>
        {!groups || groups.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center">
            <Text className="text-gray-400 text-base text-center">
              No groups yet. Create one to start splitting expenses!
            </Text>
            <Link href="/(tabs)/groups" asChild>
              <Pressable
                role="button"
                className="bg-primary-500 rounded-xl px-6 py-3 mt-4 active:bg-primary-600"
              >
                <Text className="text-white font-semibold">Create Group</Text>
              </Pressable>
            </Link>
          </View>
        ) : (
          <View className="gap-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/(tabs)/groups/${group.id}`}
                asChild
              >
                <Pressable
                  role="button"
                  className="bg-white rounded-2xl p-4 flex-row items-center active:bg-gray-50"
                >
                  <View className="w-12 h-12 rounded-full bg-primary-100 items-center justify-center">
                    <Text className="text-primary-600 text-lg font-bold">
                      {group.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="ml-4 flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {group.name}
                    </Text>
                    <Text className="text-sm text-gray-500 mt-0.5">
                      {group.group_members.length} member
                      {group.group_members.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </View>

      <View className="h-8" />
    </ScrollView>
  );
}

import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGroup } from "@/lib/queries/useGroups";
import { useExpenses, useDeleteExpense } from "@/lib/queries/useExpenses";
import { useGroupBalances } from "@/lib/queries/useBalances";
import { useAuth } from "@/lib/auth";
import { formatCurrency, simplifyDebts } from "@/lib/utils";
import { useRealtimeSubscription } from "@/lib/realtime";

type TabType = "expenses" | "balances";

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: group, refetch: refetchGroup } = useGroup(id!);
  const { data: expenses, refetch: refetchExpenses } = useExpenses(id!);
  const { data: balances, refetch: refetchBalances } = useGroupBalances(id!);
  const deleteExpense = useDeleteExpense();
  const [activeTab, setActiveTab] = useState<TabType>("expenses");
  const [refreshing, setRefreshing] = useState(false);

  useRealtimeSubscription(id);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchGroup(), refetchExpenses(), refetchBalances()]);
    setRefreshing(false);
  }, [refetchGroup, refetchExpenses, refetchBalances]);

  const handleDeleteExpense = (expenseId: string) => {
    Alert.alert("Delete Expense", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteExpense.mutate({ expenseId, groupId: id! }),
      },
    ]);
  };

  const debts = balances ? simplifyDebts(balances) : [];

  return (
    <>
      <Stack.Screen options={{ title: group?.name ?? "Group" }} />
      <View className="flex-1 bg-gray-50">
        <View className="flex-row bg-white border-b border-gray-200">
          <TouchableOpacity
            className={`flex-1 py-3 ${
              activeTab === "expenses" ? "border-b-2 border-primary-500" : ""
            }`}
            onPress={() => setActiveTab("expenses")}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === "expenses"
                  ? "text-primary-500"
                  : "text-gray-400"
              }`}
            >
              Expenses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 ${
              activeTab === "balances" ? "border-b-2 border-primary-500" : ""
            }`}
            onPress={() => setActiveTab("balances")}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === "balances"
                  ? "text-primary-500"
                  : "text-gray-400"
              }`}
            >
              Balances
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ padding: 16 }}
        >
          {activeTab === "expenses" ? (
            <>
              {!expenses || expenses.length === 0 ? (
                <View className="items-center py-20">
                  <Ionicons
                    name="receipt-outline"
                    size={64}
                    color="#D1D5DB"
                  />
                  <Text className="text-gray-400 text-lg mt-4">
                    No expenses yet
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {expenses.map((expense) => (
                    <TouchableOpacity
                      key={expense.id}
                      className="bg-white rounded-2xl p-4 shadow-sm"
                      onLongPress={() => handleDeleteExpense(expense.id)}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-gray-900">
                            {expense.description}
                          </Text>
                          <Text className="text-sm text-gray-500 mt-0.5">
                            Paid by{" "}
                            {expense.payer?.full_name ??
                              (expense.paid_by === user?.id
                                ? "you"
                                : "someone")}
                          </Text>
                        </View>
                        <Text className="text-lg font-bold text-gray-900">
                          {formatCurrency(expense.amount)}
                        </Text>
                      </View>
                      {expense.expense_splits &&
                        expense.expense_splits.length > 0 && (
                          <View className="mt-3 pt-3 border-t border-gray-100">
                            {expense.expense_splits.map((split) => (
                              <View
                                key={split.id}
                                className="flex-row justify-between py-0.5"
                              >
                                <Text className="text-sm text-gray-600">
                                  {split.profiles?.full_name ?? "Unknown"}
                                </Text>
                                <Text className="text-sm text-gray-600">
                                  {formatCurrency(split.amount)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      <Text className="text-xs text-gray-400 mt-2">
                        {new Date(expense.date).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              {balances && balances.length > 0 && (
                <View className="bg-white rounded-2xl p-4 mb-4">
                  <Text className="text-base font-bold text-gray-900 mb-3">
                    Member Balances
                  </Text>
                  {balances.map((b) => (
                    <View
                      key={b.user_id}
                      className="flex-row justify-between py-2 border-b border-gray-50"
                    >
                      <Text className="text-sm text-gray-700">
                        {b.full_name}
                      </Text>
                      <Text
                        className={`text-sm font-semibold ${
                          b.balance > 0
                            ? "text-green-600"
                            : b.balance < 0
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        {b.balance > 0 ? "+" : ""}
                        {formatCurrency(b.balance)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {debts.length > 0 && (
                <View className="bg-white rounded-2xl p-4">
                  <Text className="text-base font-bold text-gray-900 mb-3">
                    Suggested Payments
                  </Text>
                  {debts.map((debt, idx) => (
                    <View
                      key={idx}
                      className="flex-row items-center py-2 border-b border-gray-50"
                    >
                      <View className="flex-1">
                        <Text className="text-sm text-gray-700">
                          <Text className="font-semibold">
                            {debt.from_name}
                          </Text>{" "}
                          owes{" "}
                          <Text className="font-semibold">
                            {debt.to_name}
                          </Text>
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-primary-500">
                        {formatCurrency(debt.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {(!balances || balances.length === 0) && (
                <View className="items-center py-20">
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={64}
                    color="#D1D5DB"
                  />
                  <Text className="text-gray-400 text-lg mt-4">
                    All settled up!
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View className="flex-row px-4 pb-6 pt-2 gap-3">
          <TouchableOpacity
            className="flex-1 bg-primary-500 rounded-xl py-3.5"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/groups/add-expense",
                params: { groupId: id },
              })
            }
            activeOpacity={0.8}
          >
            <Text className="text-white text-center font-semibold">
              Add Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-accent-500 rounded-xl py-3.5"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/groups/settle-up",
                params: { groupId: id },
              })
            }
            activeOpacity={0.8}
          >
            <Text className="text-white text-center font-semibold">
              Settle Up
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

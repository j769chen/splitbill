import { useState, useCallback, useEffect, useRef } from "react";
import { View, ScrollView, RefreshControl, Pressable } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  Divider,
  IconButton,
  SegmentedButtons,
  Text,
} from "react-native-paper";
import { useGroup, useLeaveGroup } from "@/lib/queries/useGroups";
import { useExpenses, useDeleteExpense } from "@/lib/queries/useExpenses";
import { useGroupBalances } from "@/lib/queries/useBalances";
import { useAuth } from "@/lib/auth";
import { formatCurrency, simplifyDebts } from "@/lib/utils";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useSnackbar } from "@/lib/snackbar";
import { useConfirm } from "@/lib/confirm";
import { useAppTheme } from "@/lib/theme";

type TabType = "expenses" | "balances";

export default function GroupDetail() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: group, refetch: refetchGroup } = useGroup(id!);
  const { data: expenses, refetch: refetchExpenses } = useExpenses(id!);
  const { data: balances, refetch: refetchBalances } = useGroupBalances(id!);
  const deleteExpense = useDeleteExpense();
  const leaveGroup = useLeaveGroup();
  const { showError, showInfo } = useSnackbar();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>("expenses");
  const [refreshing, setRefreshing] = useState(false);
  // Expenses pending deletion are hidden optimistically and only removed on
  // the server after the Undo window elapses.
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const deleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  useRealtimeSubscription(id);

  const myBalance = balances?.find((b) => b.user_id === user?.id)?.balance ?? 0;

  const handleLeaveGroup = () => {
    if (Math.abs(myBalance) >= 0.01) {
      showInfo(
        "You have an outstanding balance in this group. Settle up before leaving."
      );
      return;
    }
    confirm({
      title: "Leave Group",
      message: `Are you sure you want to leave "${group?.name ?? "this group"}"?`,
      confirmText: "Leave",
      destructive: true,
      onConfirm: async () => {
        try {
          await leaveGroup.mutateAsync(id!);
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)/groups");
          }
        } catch (error: any) {
          showError(
            error?.message ?? "Couldn't leave the group. Please try again."
          );
        }
      },
    });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchGroup(), refetchExpenses(), refetchBalances()]);
    setRefreshing(false);
  }, [refetchGroup, refetchExpenses, refetchBalances]);

  const commitDeleteExpense = useCallback(
    (expenseId: string) => {
      delete deleteTimers.current[expenseId];
      deleteExpense.mutate(
        { expenseId, groupId: id! },
        {
          onError: (error: any) => {
            setPendingDeleteIds((prev) => prev.filter((x) => x !== expenseId));
            showError(
              error?.message ?? "Couldn't delete the expense. Please try again."
            );
          },
        }
      );
    },
    [deleteExpense, id, showError]
  );

  // Always have the latest commit fn available to flush on unmount.
  const commitRef = useRef(commitDeleteExpense);
  commitRef.current = commitDeleteExpense;

  useEffect(() => {
    return () => {
      Object.keys(deleteTimers.current).forEach((expenseId) => {
        clearTimeout(deleteTimers.current[expenseId]);
        commitRef.current(expenseId);
      });
      deleteTimers.current = {};
    };
  }, []);

  const handleDeleteExpense = (expenseId: string) => {
    if (deleteTimers.current[expenseId]) return;
    setPendingDeleteIds((prev) => [...prev, expenseId]);
    deleteTimers.current[expenseId] = setTimeout(
      () => commitDeleteExpense(expenseId),
      5000
    );
    showInfo("Expense deleted", {
      duration: 5000,
      action: {
        label: "Undo",
        onPress: () => {
          const timer = deleteTimers.current[expenseId];
          if (timer) {
            clearTimeout(timer);
            delete deleteTimers.current[expenseId];
          }
          setPendingDeleteIds((prev) => prev.filter((x) => x !== expenseId));
        },
      },
    });
  };

  const visibleExpenses = expenses?.filter(
    (e) => !pendingDeleteIds.includes(e.id)
  );

  const debts = balances ? simplifyDebts(balances) : [];

  const balanceColor = (value: number) =>
    value > 0
      ? theme.colors.success
      : value < 0
      ? theme.colors.error
      : theme.colors.onSurfaceVariant;

  return (
    <>
      <Stack.Screen
        options={{
          title: group?.name ?? "Group",
          headerRight: () => (
            <Pressable
              role="button"
              onPress={handleLeaveGroup}
              hitSlop={8}
              className="px-2"
            >
              <Ionicons name="exit-outline" size={22} color="#FFFFFF" />
            </Pressable>
          ),
        }}
      />
      <View
        className="flex-1"
        style={{ backgroundColor: theme.colors.background }}
      >
        <View className="px-4 pt-3 pb-1">
          <SegmentedButtons
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabType)}
            buttons={[
              { value: "expenses", label: "Expenses", icon: "receipt" },
              { value: "balances", label: "Balances", icon: "scale-balance" },
            ]}
          />
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
              {!visibleExpenses || visibleExpenses.length === 0 ? (
                <View className="items-center py-20">
                  <Ionicons
                    name="receipt-outline"
                    size={64}
                    color={theme.colors.onSurfaceDisabled}
                  />
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginTop: 16,
                    }}
                  >
                    No expenses yet
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {visibleExpenses.map((expense) => (
                    <Card
                      key={expense.id}
                      mode="elevated"
                      onLongPress={() => handleDeleteExpense(expense.id)}
                    >
                      <Card.Content>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-1">
                            <Text
                              variant="titleMedium"
                              style={{ fontWeight: "600" }}
                            >
                              {expense.description}
                            </Text>
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.onSurfaceVariant }}
                            >
                              Paid by{" "}
                              {expense.payer?.full_name ??
                                (expense.paid_by === user?.id
                                  ? "you"
                                  : "someone")}
                            </Text>
                          </View>
                          <View className="flex-row items-center">
                            <Text
                              variant="titleMedium"
                              style={{ fontWeight: "bold" }}
                            >
                              {formatCurrency(expense.amount)}
                            </Text>
                            {expense.paid_by === user?.id && (
                              <IconButton
                                icon="trash-can-outline"
                                size={18}
                                iconColor={theme.colors.error}
                                onPress={() => handleDeleteExpense(expense.id)}
                                style={{ margin: 0, marginLeft: 4 }}
                              />
                            )}
                          </View>
                        </View>
                        {expense.expense_splits &&
                          expense.expense_splits.length > 0 && (
                            <View className="mt-3 pt-3">
                              <Divider style={{ marginBottom: 8 }} />
                              {expense.expense_splits.map((split) => (
                                <View
                                  key={split.id}
                                  className="flex-row justify-between py-0.5"
                                >
                                  <Text
                                    variant="bodySmall"
                                    style={{
                                      color: theme.colors.onSurfaceVariant,
                                    }}
                                  >
                                    {split.profiles?.full_name ?? "Unknown"}
                                  </Text>
                                  <Text
                                    variant="bodySmall"
                                    style={{
                                      color: theme.colors.onSurfaceVariant,
                                    }}
                                  >
                                    {formatCurrency(split.amount)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        <Text
                          variant="labelSmall"
                          style={{
                            color: theme.colors.onSurfaceVariant,
                            marginTop: 8,
                          }}
                        >
                          {new Date(expense.date).toLocaleDateString()}
                        </Text>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              {balances && balances.length > 0 && (
                <Card mode="elevated" style={{ marginBottom: 16 }}>
                  <Card.Content>
                    <Text
                      variant="titleMedium"
                      style={{ fontWeight: "bold", marginBottom: 12 }}
                    >
                      Member Balances
                    </Text>
                    {balances.map((b) => (
                      <View
                        key={b.user_id}
                        className="flex-row justify-between py-2"
                      >
                        <Text
                          variant="bodyMedium"
                          style={{ color: theme.colors.onSurface }}
                        >
                          {b.full_name}
                        </Text>
                        <Text
                          variant="bodyMedium"
                          style={{
                            fontWeight: "600",
                            color: balanceColor(b.balance),
                          }}
                        >
                          {b.balance > 0 ? "+" : ""}
                          {formatCurrency(b.balance)}
                        </Text>
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              )}

              {debts.length > 0 && (
                <Card mode="elevated">
                  <Card.Content>
                    <Text
                      variant="titleMedium"
                      style={{ fontWeight: "bold", marginBottom: 12 }}
                    >
                      Suggested Payments
                    </Text>
                    {debts.map((debt, idx) => (
                      <View
                        key={idx}
                        className="flex-row items-center py-2"
                      >
                        <View className="flex-1">
                          <Text
                            variant="bodyMedium"
                            style={{ color: theme.colors.onSurface }}
                          >
                            <Text style={{ fontWeight: "600" }}>
                              {debt.from_name}
                            </Text>{" "}
                            owes{" "}
                            <Text style={{ fontWeight: "600" }}>
                              {debt.to_name}
                            </Text>
                          </Text>
                        </View>
                        <Text
                          variant="bodyMedium"
                          style={{
                            fontWeight: "bold",
                            color: theme.colors.primary,
                          }}
                        >
                          {formatCurrency(debt.amount)}
                        </Text>
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              )}

              {(!balances || balances.length === 0) && (
                <View className="items-center py-20">
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={64}
                    color={theme.colors.onSurfaceDisabled}
                  />
                  <Text
                    variant="titleMedium"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginTop: 16,
                    }}
                  >
                    All settled up!
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View className="flex-row px-4 pb-6 pt-2 gap-3">
          <Button
            mode="contained"
            style={{ flex: 1 }}
            contentStyle={{ paddingVertical: 4 }}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/groups/add-expense",
                params: { groupId: id },
              })
            }
          >
            Add Expense
          </Button>
          <Button
            mode="contained"
            buttonColor={theme.colors.secondary}
            textColor={theme.colors.onSecondary}
            style={{ flex: 1 }}
            contentStyle={{ paddingVertical: 4 }}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/groups/settle-up",
                params: { groupId: id },
              })
            }
          >
            Settle Up
          </Button>
        </View>
      </View>
    </>
  );
}

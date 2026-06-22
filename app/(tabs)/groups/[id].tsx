import { useState, useCallback, useEffect, useRef } from "react";
import { View, ScrollView, RefreshControl, Pressable } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, SegmentedButtons } from "react-native-paper";
import { useGroup, useLeaveGroup } from "@/lib/queries/useGroups";
import { useExpenses, useDeleteExpense } from "@/lib/queries/useExpenses";
import { useGroupBalances } from "@/lib/queries/useBalances";
import { useAuth } from "@/lib/auth";
import { getErrorMessage, simplifyDebts } from "@/lib/utils";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useSnackbar } from "@/lib/snackbar";
import { useConfirm } from "@/lib/confirm";
import { useAppTheme } from "@/lib/theme";
import { EmptyState } from "@/components/groups/EmptyState";
import { ExpenseCard } from "@/components/groups/ExpenseCard";
import { MemberBalanceCard } from "@/components/groups/MemberBalanceCard";

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
        } catch (error) {
          showError(
            getErrorMessage(error, "Couldn't leave the group. Please try again.")
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
          onError: (error) => {
            setPendingDeleteIds((prev) => prev.filter((x) => x !== expenseId));
            showError(
              getErrorMessage(
                error,
                "Couldn't delete the expense. Please try again."
              )
            );
          },
        }
      );
    },
    [deleteExpense, id, showError]
  );

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

  const memberBreakdown = (userId: string) => [
    ...debts
      .filter((d) => d.from === userId)
      .map((d) => ({ direction: "owes" as const, name: d.to_name, amount: d.amount })),
    ...debts
      .filter((d) => d.to === userId)
      .map((d) => ({ direction: "owed" as const, name: d.from_name, amount: d.amount })),
  ];

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
              style={{ paddingHorizontal: 8 }}
            >
              <MaterialCommunityIcons
                name="logout"
                size={22}
                color={theme.colors.onPrimary}
              />
            </Pressable>
          ),
        }}
      />
      <View
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <SegmentedButtons
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabType)}
            theme={{
              colors: {
                secondaryContainer: theme.colors.secondaryContainer,
                onSecondaryContainer: theme.colors.onSecondaryContainer,
              },
            }}
            buttons={[
              { value: "expenses", label: "Expenses", icon: "receipt" },
              { value: "balances", label: "Balances", icon: "scale-balance" },
            ]}
          />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ padding: 16 }}
        >
          {activeTab === "expenses" ? (
            <>
              {!visibleExpenses || visibleExpenses.length === 0 ? (
                <EmptyState
                  icon="receipt-text-outline"
                  title="No expenses yet"
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {visibleExpenses.map((expense) => (
                    <ExpenseCard
                      key={expense.id}
                      expense={expense}
                      currentUserId={user?.id}
                      onDelete={handleDeleteExpense}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              {balances && balances.length > 0 && (
                <View style={{ gap: 12 }}>
                  {balances.map((b) => (
                    <MemberBalanceCard
                      key={b.user_id}
                      balance={b}
                      breakdown={memberBreakdown(b.user_id)}
                      accentColor={balanceColor(b.balance)}
                    />
                  ))}
                </View>
              )}

              {(!balances || balances.length === 0) && (
                <EmptyState
                  icon="check-circle-outline"
                  title="All settled up!"
                />
              )}
            </>
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, gap: 12 }}>
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

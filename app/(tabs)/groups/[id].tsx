import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl, Pressable } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Card, SegmentedButtons, Text } from "react-native-paper";
import { useGroup, useLeaveGroup } from "@/lib/queries/useGroups";
import { useExpenses, useDeleteExpense } from "@/lib/queries/useExpenses";
import { useGroupPayments, useDeletePayment } from "@/lib/queries/usePayments";
import {
  useGroupBalances,
  useMyGroupPairwiseBalances,
} from "@/lib/queries/useBalances";
import { useAuth } from "@/lib/auth";
import { getErrorMessage, simplifyDebts } from "@/lib/utils";
import { useRealtimeSubscription } from "@/lib/realtime";
import { useSnackbar } from "@/lib/snackbar";
import { useConfirm } from "@/lib/confirm";
import { useAppTheme } from "@/lib/theme";
import { EmptyState } from "@/components/groups/EmptyState";
import { ExpenseCard } from "@/components/groups/ExpenseCard";
import { PaymentCard } from "@/components/groups/PaymentCard";
import { MemberBalanceCard } from "@/components/groups/MemberBalanceCard";
import { GroupMemberRow } from "@/components/groups/GroupMemberRow";
import type { ExpenseWithSplits, PaymentWithProfiles } from "@/lib/types";

type TabType = "activity" | "balances";

type ActivityItem =
  | { kind: "expense"; ts: string; expense: ExpenseWithSplits }
  | { kind: "payment"; ts: string; payment: PaymentWithProfiles };

export default function GroupDetail() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: group, refetch: refetchGroup } = useGroup(id!);
  const { data: expenses, refetch: refetchExpenses } = useExpenses(id!);
  const { data: payments, refetch: refetchPayments } = useGroupPayments(id!);
  const { data: balances, refetch: refetchBalances } = useGroupBalances(id!);
  const { data: pairwise, refetch: refetchPairwise } =
    useMyGroupPairwiseBalances(id!);
  const deleteExpense = useDeleteExpense();
  const deletePayment = useDeletePayment();
  const leaveGroup = useLeaveGroup();
  const { showError, showInfo } = useSnackbar();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>("activity");
  const [refreshing, setRefreshing] = useState(false);

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
    await Promise.all([
      refetchGroup(),
      refetchExpenses(),
      refetchPayments(),
      refetchBalances(),
      refetchPairwise(),
    ]);
    setRefreshing(false);
  }, [
    refetchGroup,
    refetchExpenses,
    refetchPayments,
    refetchBalances,
    refetchPairwise,
  ]);

  const handleDeleteExpense = (expenseId: string) => {
    confirm({
      title: "Delete Expense",
      message: "Are you sure you want to delete this expense? This will remove it for ALL people involved.",
      confirmText: "Delete",
      destructive: true,
      onConfirm: () => {
        deleteExpense.mutate(
          { expenseId, groupId: id! },
          {
            onError: (error) =>
              showError(
                getErrorMessage(
                  error,
                  "Couldn't delete the expense. Please try again."
                )
              ),
          }
        );
      },
    });
  };

  const handleDeletePayment = (paymentId: string) => {
    confirm({
      title: "Delete Payment",
      message: "Are you sure you want to delete this payment? This will remove it for ALL people involved.",
      confirmText: "Delete",
      destructive: true,
      onConfirm: () => {
        deletePayment.mutate(
          { paymentId, groupId: id! },
          {
            onError: (error) =>
              showError(
                getErrorMessage(
                  error,
                  "Couldn't delete the payment. Please try again."
                )
              ),
          }
        );
      },
    });
  };

  const activityItems: ActivityItem[] = [
    ...(expenses ?? []).map(
      (expense): ActivityItem => ({
        kind: "expense",
        ts: expense.date,
        expense,
      })
    ),
    ...(payments ?? []).map(
      (payment): ActivityItem => ({
        kind: "payment",
        ts: payment.created_at,
        payment,
      })
    ),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

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

  const groupCurrency = group?.currency ?? "USD";
  const pairwiseByUser = new Map(pairwise?.map((p) => [p.user_id, p.balance]));
  const members = [...(group?.group_members ?? [])].sort((a, b) => {
    if (a.user_id === user?.id) return -1;
    if (b.user_id === user?.id) return 1;
    return (a.profiles?.full_name ?? "").localeCompare(
      b.profiles?.full_name ?? ""
    );
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: group?.name ?? "Group",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                role="button"
                accessibilityLabel="Group settings"
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/groups/manage",
                    params: { groupId: id },
                  })
                }
                hitSlop={8}
                style={{ paddingHorizontal: 8 }}
              >
                <MaterialCommunityIcons
                  name="cog-outline"
                  size={22}
                  color={theme.colors.onPrimary}
                />
              </Pressable>
              <Pressable
                role="button"
                accessibilityLabel="Leave group"
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
            </View>
          ),
        }}
      />
      <View
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        {members.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Card mode="contained">
              <Card.Content style={{ paddingVertical: 4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 8,
                  }}
                >
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Members ({members.length})
                  </Text>
                  <Button
                    mode="text"
                    compact
                    icon="account-plus"
                    onPress={() =>
                      router.push({
                        pathname: "/(tabs)/groups/add-members",
                        params: { groupId: id },
                      })
                    }
                  >
                    Add
                  </Button>
                </View>
                {members.map((member) => (
                  <GroupMemberRow
                    key={member.user_id}
                    name={member.profiles?.full_name ?? "Unknown"}
                    isSelf={member.user_id === user?.id}
                    balance={
                      member.user_id === user?.id
                        ? undefined
                        : pairwiseByUser.get(member.user_id) ?? 0
                    }
                    currency={groupCurrency}
                  />
                ))}
              </Card.Content>
            </Card>
          </View>
        )}

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
              {
                value: "activity",
                label: "Activity",
                icon: "format-list-bulleted",
              },
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
          {activeTab === "activity" ? (
            <>
              {activityItems.length === 0 ? (
                <EmptyState
                  icon="timeline-text-outline"
                  title="No activity yet"
                />
              ) : (
                <View style={{ gap: 12 }}>
                  {activityItems.map((item) =>
                    item.kind === "expense" ? (
                      <ExpenseCard
                        key={`expense-${item.expense.id}`}
                        expense={item.expense}
                        currentUserId={user?.id}
                        onDelete={handleDeleteExpense}
                        onEdit={(expenseId) =>
                          router.push({
                            pathname: "/(tabs)/groups/add-expense",
                            params: { groupId: id, expenseId },
                          })
                        }
                      />
                    ) : (
                      <PaymentCard
                        key={`payment-${item.payment.id}`}
                        payment={item.payment}
                        currentUserId={user?.id}
                        onDelete={handleDeletePayment}
                        onEdit={(paymentId) =>
                          router.push({
                            pathname: "/(tabs)/groups/edit-payment",
                            params: { groupId: id, paymentId },
                          })
                        }
                      />
                    )
                  )}
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
                      currency={groupCurrency}
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

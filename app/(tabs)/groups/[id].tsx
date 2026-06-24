import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { SegmentedButtons } from "react-native-paper";
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
import { GroupActionBar } from "@/components/groups/GroupActionBar";
import {
  GroupActivityList,
  type GroupActivityItem,
} from "@/components/groups/GroupActivityList";
import { GroupBalancesList } from "@/components/groups/GroupBalancesList";
import { GroupHeaderActions } from "@/components/groups/GroupHeaderActions";
import { GroupMembersCard } from "@/components/groups/GroupMembersCard";

type TabType = "activity" | "balances";

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

  const activityItems: GroupActivityItem[] = [
    ...(expenses ?? []).map(
      (expense): GroupActivityItem => ({
        kind: "expense",
        ts: expense.date,
        expense,
      })
    ),
    ...(payments ?? []).map(
      (payment): GroupActivityItem => ({
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
            <GroupHeaderActions
              onSettings={() =>
                router.push({
                  pathname: "/(tabs)/groups/manage",
                  params: { groupId: id },
                })
              }
              onLeave={handleLeaveGroup}
            />
          ),
        }}
      />
      <View
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <GroupMembersCard
          members={members}
          currentUserId={user?.id}
          pairwiseByUser={pairwiseByUser}
          currency={groupCurrency}
          onAddMembers={() =>
            router.push({
              pathname: "/(tabs)/groups/add-members",
              params: { groupId: id },
            })
          }
        />

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
            <GroupActivityList
              items={activityItems}
              currentUserId={user?.id}
              onDeleteExpense={handleDeleteExpense}
              onEditExpense={(expenseId) =>
                router.push({
                  pathname: "/(tabs)/groups/add-expense",
                  params: { groupId: id, expenseId },
                })
              }
              onDeletePayment={handleDeletePayment}
              onEditPayment={(paymentId) =>
                router.push({
                  pathname: "/(tabs)/groups/edit-payment",
                  params: { groupId: id, paymentId },
                })
              }
            />
          ) : (
            <GroupBalancesList
              balances={balances}
              currency={groupCurrency}
              getBreakdown={memberBreakdown}
              getAccentColor={balanceColor}
            />
          )}
        </ScrollView>

        <GroupActionBar
          onAddExpense={() =>
            router.push({
              pathname: "/(tabs)/groups/add-expense",
              params: { groupId: id },
            })
          }
          onSettleUp={() =>
            router.push({
              pathname: "/(tabs)/groups/settle-up",
              params: { groupId: id },
            })
          }
        />
      </View>
    </>
  );
}

import { View, FlatList, RefreshControl } from "react-native";
import { useRecentActivity } from "@/lib/queries/useExpenses";
import { useRecentPayments } from "@/lib/queries/usePayments";
import {
  useRecentContactActivity,
  useRecentContactPayments,
} from "@/lib/queries/useContacts";
import { useRecentGroupSettingChanges } from "@/lib/queries/useGroups";
import { useAuth } from "@/lib/auth";
import { useAppTheme } from "@/lib/theme";
import {
  ActivityFeedItemCard,
  isInvolvedInExpense,
} from "@/components/activity/ActivityFeedItem";
import { buildActivityFeed } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useState, useCallback } from "react";

export default function Activity() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const {
    data: expenses,
    refetch: refetchExpenses,
    isLoading: expensesLoading,
  } = useRecentActivity();
  const {
    data: payments,
    refetch: refetchPayments,
    isLoading: paymentsLoading,
  } = useRecentPayments();
  const {
    data: contactExpenses,
    refetch: refetchContactExpenses,
    isLoading: contactExpensesLoading,
  } = useRecentContactActivity();
  const {
    data: contactPayments,
    refetch: refetchContactPayments,
    isLoading: contactPaymentsLoading,
  } = useRecentContactPayments();
  const {
    data: simplifyEvents,
    refetch: refetchSimplifyEvents,
    isLoading: simplifyEventsLoading,
  } = useRecentGroupSettingChanges();
  const [refreshing, setRefreshing] = useState(false);

  const isLoading =
    expensesLoading ||
    paymentsLoading ||
    contactExpensesLoading ||
    contactPaymentsLoading ||
    simplifyEventsLoading;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchExpenses(),
      refetchPayments(),
      refetchContactExpenses(),
      refetchContactPayments(),
      refetchSimplifyEvents(),
    ]);
    setRefreshing(false);
  }, [
    refetchExpenses,
    refetchPayments,
    refetchContactExpenses,
    refetchContactPayments,
    refetchSimplifyEvents,
  ]);

  // Contact expenses are still filtered here: RLS scopes them to the two
  // participants, but a zero-share expense is not the caller's activity.
  const feed = buildActivityFeed({
    expenses,
    payments,
    contactExpenses: (contactExpenses ?? []).filter((contactExpense) =>
      isInvolvedInExpense(contactExpense, user?.id)
    ),
    contactPayments,
    simplifyEvents,
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={feed}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="history"
            title="No recent activity"
            subtitle="Add expenses or settle up to see activity here"
          />
        }
        renderItem={({ item }) => (
          <ActivityFeedItemCard item={item} currentUserId={user?.id} />
        )}
      />
    </View>
  );
}

import { View, FlatList, RefreshControl } from "react-native";
import { useRecentActivity } from "@/lib/queries/useExpenses";
import { useRecentPayments } from "@/lib/queries/usePayments";
import { useRecentContactActivity } from "@/lib/queries/useContacts";
import { useAuth } from "@/lib/auth";
import { useAppTheme } from "@/lib/theme";
import {
  ActivityFeedItemCard,
  type ActivityFeedItem,
} from "@/components/activity/ActivityFeedItem";
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
  const [refreshing, setRefreshing] = useState(false);

  const isLoading =
    expensesLoading || paymentsLoading || contactExpensesLoading;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchExpenses(),
      refetchPayments(),
      refetchContactExpenses(),
    ]);
    setRefreshing(false);
  }, [refetchExpenses, refetchPayments, refetchContactExpenses]);

  const feed: ActivityFeedItem[] = [
    ...(expenses ?? []).map(
      (expense): ActivityFeedItem => ({
        kind: "expense",
        ts: expense.date,
        expense,
      })
    ),
    ...(payments ?? []).map(
      (payment): ActivityFeedItem => ({
        kind: "payment",
        ts: payment.created_at,
        payment,
      })
    ),
    ...(contactExpenses ?? []).map(
      (contactExpense): ActivityFeedItem => ({
        kind: "contact-expense",
        ts: contactExpense.date,
        contactExpense,
      })
    ),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={feed}
        keyExtractor={(item) => {
          switch (item.kind) {
            case "expense":
              return `expense-${item.expense.id}`;
            case "payment":
              return `payment-${item.payment.id}`;
            case "contact-expense":
              return `contact-expense-${item.contactExpense.id}`;
          }
        }}
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

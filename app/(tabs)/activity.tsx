import { View, FlatList, RefreshControl } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useRecentActivity,
  type ActivityExpense,
} from "@/lib/queries/useExpenses";
import {
  useRecentPayments,
  type ActivityPayment,
} from "@/lib/queries/usePayments";
import {
  useRecentContactActivity,
  type ActivityContactExpense,
} from "@/lib/queries/useContacts";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import { useState, useCallback } from "react";

type ActivityFeedItem =
  | { kind: "expense"; ts: string; expense: ActivityExpense }
  | { kind: "payment"; ts: string; payment: ActivityPayment }
  | {
      kind: "contact-expense";
      ts: string;
      contactExpense: ActivityContactExpense;
    };

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
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
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
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
            <MaterialCommunityIcons
              name="history"
              size={64}
              color={theme.colors.onSurfaceDisabled}
            />
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}
            >
              No recent activity
            </Text>
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Add expenses or settle up to see activity here
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          switch (item.kind) {
            case "expense":
              return <ExpenseRow item={item.expense} currentUserId={user?.id} />;
            case "payment":
              return (
                <PaymentRow item={item.payment} currentUserId={user?.id} />
              );
            case "contact-expense":
              return (
                <ContactExpenseRow
                  item={item.contactExpense}
                  currentUserId={user?.id}
                />
              );
          }
        }}
      />
    </View>
  );
}

function ExpenseRow({
  item,
  currentUserId,
}: {
  item: ActivityExpense;
  currentUserId?: string;
}) {
  const theme = useAppTheme();
  const payerName =
    item.paid_by === currentUserId
      ? "You"
      : item.payer?.full_name ?? "Someone";

  return (
    <Card mode="elevated" style={{ marginBottom: 12 }}>
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <MaterialCommunityIcons
              name="receipt"
              size={22}
              color={theme.colors.onSurfaceVariant}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                {item.description}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {payerName} paid in {item.groups?.name ?? "a group"}
              </Text>
            </View>
          </View>
          <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
            {formatCurrency(item.amount, item.currency)}
          </Text>
        </View>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
        >
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}

function ContactExpenseRow({
  item,
  currentUserId,
}: {
  item: ActivityContactExpense;
  currentUserId?: string;
}) {
  const theme = useAppTheme();
  const payerName =
    item.paid_by === currentUserId
      ? "You"
      : item.payer?.full_name ?? "Someone";
  const otherProfile =
    item.paid_by === item.user_lo
      ? item.user_hi_profile
      : item.user_lo_profile;
  const otherName =
    otherProfile?.id === currentUserId
      ? "you"
      : otherProfile?.full_name ?? "someone";

  return (
    <Card mode="elevated" style={{ marginBottom: 12 }}>
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <MaterialCommunityIcons
              name="account-cash"
              size={22}
              color={theme.colors.onSurfaceVariant}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                {item.description}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {payerName} paid · with {otherName}
              </Text>
            </View>
          </View>
          <Text variant="titleMedium" style={{ fontWeight: "bold" }}>
            {formatCurrency(item.amount, item.currency)}
          </Text>
        </View>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
        >
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}

function PaymentRow({
  item,
  currentUserId,
}: {
  item: ActivityPayment;
  currentUserId?: string;
}) {
  const theme = useAppTheme();
  const payerName =
    item.paid_by === currentUserId
      ? "You"
      : item.payer?.full_name ?? "Someone";
  const payeeName =
    item.paid_to === currentUserId
      ? "you"
      : item.payee?.full_name ?? "someone";

  return (
    <Card
      mode="contained"
      style={{
        marginBottom: 12,
        backgroundColor: theme.colors.secondaryContainer,
      }}
    >
      <Card.Content>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <MaterialCommunityIcons
              name="cash-fast"
              size={22}
              color={theme.colors.onSecondaryContainer}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                variant="titleMedium"
                style={{
                  fontWeight: "600",
                  color: theme.colors.onSecondaryContainer,
                }}
              >
                {payerName} paid {payeeName}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSecondaryContainer }}
              >
                in {item.groups?.name ?? "a group"}
              </Text>
            </View>
          </View>
          <Text
            variant="titleMedium"
            style={{ fontWeight: "bold", color: theme.colors.onSecondaryContainer }}
          >
            {formatCurrency(item.amount, item.currency)}
          </Text>
        </View>
        {item.note ? (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSecondaryContainer, marginTop: 8 }}
          >
            {item.note}
          </Text>
        ) : null}
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSecondaryContainer, marginTop: 8 }}
        >
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </Card.Content>
    </Card>
  );
}

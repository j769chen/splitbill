import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Avatar, Button, Card, Text } from "react-native-paper";
import {
  useContacts,
  useContactBalance,
  useContactCurrency,
  useContactExpenses,
  useContactGroupBreakdown,
  useContactPayments,
  useDeleteContactExpense,
  useDeleteContactPayment,
  useSetContactCurrency,
} from "@/lib/queries/useContacts";
import { useAuth } from "@/lib/auth";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import { useDisplayCurrency } from "@/lib/display-currency";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { useSnackbar } from "@/lib/snackbar";
import { useConfirm } from "@/lib/confirm";
import { useAppTheme } from "@/lib/theme";
import { EmptyState } from "@/components/groups/EmptyState";
import { ExpenseCard } from "@/components/groups/ExpenseCard";
import { PaymentCard } from "@/components/groups/PaymentCard";
import type {
  ContactExpenseWithSplits,
  ContactPaymentWithProfiles,
} from "@/lib/types";

type ContactActivityItem =
  | { kind: "expense"; ts: string; expense: ContactExpenseWithSplits }
  | { kind: "payment"; ts: string; payment: ContactPaymentWithProfiles };

export default function ContactDetail() {
  const theme = useAppTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const { currency: displayCurrency } = useDisplayCurrency();
  const { data: contacts } = useContacts();
  const { data: balance = 0, refetch: refetchBalance } = useContactBalance(id!);
  const { data: expenses, refetch: refetchExpenses } = useContactExpenses(id!);
  const { data: payments, refetch: refetchPayments } = useContactPayments(id!);
  const { data: groupBreakdown, refetch: refetchGroupBreakdown } =
    useContactGroupBreakdown(id!);
  const { data: pairCurrency = "USD" } = useContactCurrency(id!);
  const setContactCurrency = useSetContactCurrency();
  const deleteContactExpense = useDeleteContactExpense();
  const deleteContactPayment = useDeleteContactPayment();
  const { showError } = useSnackbar();

  const hasOneOnOneActivity =
    (expenses?.length ?? 0) > 0 || (payments?.length ?? 0) > 0;
  const confirm = useConfirm();
  const [refreshing, setRefreshing] = useState(false);

  const contact = contacts?.find((c) => c.contact_user_id === id);
  const contactName = contact?.full_name ?? name ?? "Contact";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchBalance(),
      refetchExpenses(),
      refetchPayments(),
      refetchGroupBreakdown(),
    ]);
    setRefreshing(false);
  }, [refetchBalance, refetchExpenses, refetchPayments, refetchGroupBreakdown]);

  const groups = groupBreakdown ?? [];
  const hasGroups = groups.length > 0;

  const activityItems: ContactActivityItem[] = [
    ...(expenses ?? []).map(
      (expense): ContactActivityItem => ({
        kind: "expense",
        ts: expense.date,
        expense,
      })
    ),
    ...(payments ?? []).map(
      (payment): ContactActivityItem => ({
        kind: "payment",
        ts: payment.created_at,
        payment,
      })
    ),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  const hasActivity = activityItems.length > 0;

  const handleDeleteExpense = (expenseId: string) => {
    confirm({
      title: "Delete Expense",
      message:
        "Are you sure you want to delete this expense? This will remove it for both people involved.",
      confirmText: "Delete",
      destructive: true,
      onConfirm: () => {
        deleteContactExpense.mutate(
          { expenseId, contactUserId: id! },
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
      message:
        "Are you sure you want to delete this payment? This will remove it for both people involved.",
      confirmText: "Delete",
      destructive: true,
      onConfirm: () => {
        deleteContactPayment.mutate(
          { paymentId, contactUserId: id! },
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

  const owed = balance > 0.01;
  const owing = balance < -0.01;
  const summaryColor = owed
    ? theme.colors.success
    : owing
      ? theme.colors.error
      : theme.colors.onSurfaceVariant;
  const summaryLabel = owed
    ? `${contactName} owes you`
    : owing
      ? `You owe ${contactName}`
      : "You're all settled up";

  return (
    <>
      <Stack.Screen options={{ title: contactName }} />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ padding: 16 }}
        >
          <Card mode="contained" style={{ marginBottom: 16 }}>
            <Card.Content style={{ alignItems: "center", paddingVertical: 20 }}>
              <Text
                variant="labelLarge"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {summaryLabel}
              </Text>
              {(owed || owing) && (
                <Text
                  variant="headlineMedium"
                  style={{
                    color: summaryColor,
                    fontWeight: "bold",
                    marginTop: 4,
                  }}
                >
                  {formatCurrency(Math.abs(balance), displayCurrency)}
                </Text>
              )}
              <View style={{ marginTop: 16, alignItems: "center" }}>
                <CurrencyPicker
                  value={pairCurrency}
                  disabled={hasOneOnOneActivity || setContactCurrency.isPending}
                  onChange={(code) =>
                    setContactCurrency.mutate(
                      { contactUserId: id!, currency: code },
                      {
                        onError: (error) =>
                          showError(
                            getErrorMessage(
                              error,
                              "Couldn't update the currency. Please try again."
                            )
                          ),
                      }
                    )
                  }
                />
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  {hasOneOnOneActivity
                    ? `One-on-one balances are tracked in ${pairCurrency}.`
                    : `Set the base currency for one-on-one expenses.`}
                </Text>
              </View>
            </Card.Content>
          </Card>

          {hasGroups && (
            <View style={{ marginBottom: 16 }}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: "bold", marginBottom: 12 }}
              >
                In shared groups
              </Text>
              <View style={{ gap: 12 }}>
                {groups.map((group) => {
                  const groupOwed = group.balance > 0.01;
                  const groupOwing = group.balance < -0.01;
                  const groupColor = groupOwed
                    ? theme.colors.success
                    : groupOwing
                      ? theme.colors.error
                      : theme.colors.onSurfaceVariant;
                  const groupLabel = groupOwed
                    ? `${contactName} owes you ${formatCurrency(group.balance, group.currency)}`
                    : groupOwing
                      ? `You owe ${formatCurrency(Math.abs(group.balance), group.currency)}`
                      : "Settled up";

                  return (
                    <Card
                      key={group.group_id}
                      mode="elevated"
                      onPress={() =>
                        router.push(`/(tabs)/groups/${group.group_id}`)
                      }
                    >
                      <Card.Content
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Avatar.Text
                          size={40}
                          label={group.group_name.charAt(0).toUpperCase()}
                          style={{
                            backgroundColor: theme.colors.primaryContainer,
                          }}
                          labelStyle={{
                            color: theme.colors.onPrimaryContainer,
                          }}
                        />
                        <View style={{ marginLeft: 16, flex: 1 }}>
                          <Text
                            variant="titleMedium"
                            style={{ fontWeight: "600" }}
                          >
                            {group.group_name}
                          </Text>
                          <Text variant="bodySmall" style={{ color: groupColor }}>
                            {groupLabel}
                          </Text>
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })}
              </View>
            </View>
          )}

          {hasActivity && (
            <View>
              {hasGroups && (
                <Text
                  variant="titleMedium"
                  style={{ fontWeight: "bold", marginBottom: 12 }}
                >
                  One-on-one
                </Text>
              )}
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
                          pathname: "/contacts/add-expense",
                          params: { contactUserId: id, expenseId },
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
                          pathname: "/contacts/settle-up",
                          params: { contactUserId: id, paymentId },
                        })
                      }
                    />
                  )
                )}
              </View>
            </View>
          )}

          {!hasGroups && !hasActivity && (
            <EmptyState
              icon="timeline-text-outline"
              title="No activity yet"
              subtitle="Add an expense to start tracking"
            />
          )}
        </ScrollView>

        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 8,
            gap: 12,
          }}
        >
          <Button
            mode="contained"
            style={{ flex: 1 }}
            contentStyle={{ paddingVertical: 4 }}
            onPress={() =>
              router.push({
                pathname: "/contacts/add-expense",
                params: { contactUserId: id },
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
                pathname: "/contacts/settle-up",
                params: { contactUserId: id },
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

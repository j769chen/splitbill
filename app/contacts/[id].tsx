import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Avatar, Button, Card, Text } from "react-native-paper";
import {
  useContacts,
  useContactBalance,
  useContactExpenses,
  useContactGroupBreakdown,
  useDeleteContactExpense,
} from "@/lib/queries/useContacts";
import { useAuth } from "@/lib/auth";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import { useSnackbar } from "@/lib/snackbar";
import { useConfirm } from "@/lib/confirm";
import { useAppTheme } from "@/lib/theme";
import { EmptyState } from "@/components/groups/EmptyState";
import { ExpenseCard } from "@/components/groups/ExpenseCard";
import type { ExpenseWithSplits } from "@/lib/types";

export default function ContactDetail() {
  const theme = useAppTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { user } = useAuth();
  const { data: contacts } = useContacts();
  const { data: balance = 0, refetch: refetchBalance } = useContactBalance(id!);
  const { data: expenses, refetch: refetchExpenses } = useContactExpenses(id!);
  const { data: groupBreakdown, refetch: refetchGroupBreakdown } =
    useContactGroupBreakdown(id!);
  const deleteContactExpense = useDeleteContactExpense();
  const { showError } = useSnackbar();
  const confirm = useConfirm();
  const [refreshing, setRefreshing] = useState(false);

  const contact = contacts?.find((c) => c.contact_user_id === id);
  const contactName = contact?.full_name ?? name ?? "Contact";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchBalance(),
      refetchExpenses(),
      refetchGroupBreakdown(),
    ]);
    setRefreshing(false);
  }, [refetchBalance, refetchExpenses, refetchGroupBreakdown]);

  const groups = groupBreakdown ?? [];
  const hasGroups = groups.length > 0;
  const hasExpenses = (expenses?.length ?? 0) > 0;

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
                  {formatCurrency(Math.abs(balance))}
                </Text>
              )}
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
                    ? `${contactName} owes you ${formatCurrency(group.balance)}`
                    : groupOwing
                      ? `You owe ${formatCurrency(Math.abs(group.balance))}`
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

          {hasExpenses && (
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
                {expenses!.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense as unknown as ExpenseWithSplits}
                    currentUserId={user?.id}
                    onDelete={handleDeleteExpense}
                  />
                ))}
              </View>
            </View>
          )}

          {!hasGroups && !hasExpenses && (
            <EmptyState
              icon="timeline-text-outline"
              title="No activity yet"
              subtitle="Add an expense to start tracking"
            />
          )}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 8,
          }}
        >
          <Button
            mode="contained"
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
        </View>
      </View>
    </>
  );
}

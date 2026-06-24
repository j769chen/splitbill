import { useState, useCallback } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
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
import { getErrorMessage } from "@/lib/utils";
import { useDisplayCurrency } from "@/lib/display-currency";
import { useSnackbar } from "@/lib/snackbar";
import { useConfirm } from "@/lib/confirm";
import { useAppTheme } from "@/lib/theme";
import { ContactActionBar } from "@/components/contacts/ContactActionBar";
import {
  ContactActivityList,
  type ContactActivityItem,
} from "@/components/contacts/ContactActivityList";
import { ContactGroupBreakdownList } from "@/components/contacts/ContactGroupBreakdownList";
import { ContactSummaryCard } from "@/components/contacts/ContactSummaryCard";
import { EmptyState } from "@/components/groups/EmptyState";

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
          <ContactSummaryCard
            summaryLabel={summaryLabel}
            showAmount={owed || owing}
            balance={balance}
            displayCurrency={displayCurrency}
            summaryColor={summaryColor}
            pairCurrency={pairCurrency}
            hasOneOnOneActivity={hasOneOnOneActivity}
            currencyPending={setContactCurrency.isPending}
            onChangeCurrency={(currency, onError) =>
              setContactCurrency.mutate(
                { contactUserId: id!, currency },
                { onError }
              )
            }
            onCurrencyError={showError}
          />

          <ContactGroupBreakdownList
            groups={groups}
            contactName={contactName}
            onOpenGroup={(groupId) => router.push(`/(tabs)/groups/${groupId}`)}
          />

          <ContactActivityList
            items={activityItems}
            showTitle={hasGroups}
            currentUserId={user?.id}
            onDeleteExpense={handleDeleteExpense}
            onEditExpense={(expenseId) =>
              router.push({
                pathname: "/contacts/add-expense",
                params: { contactUserId: id, expenseId },
              })
            }
            onDeletePayment={handleDeletePayment}
            onEditPayment={(paymentId) =>
              router.push({
                pathname: "/contacts/settle-up",
                params: { contactUserId: id, paymentId },
              })
            }
          />

          {!hasGroups && !hasActivity && (
            <EmptyState
              icon="timeline-text-outline"
              title="No activity yet"
              subtitle="Add an expense to start tracking"
            />
          )}
        </ScrollView>

        <ContactActionBar
          onAddExpense={() =>
            router.push({
              pathname: "/contacts/add-expense",
              params: { contactUserId: id },
            })
          }
          onSettleUp={() =>
            router.push({
              pathname: "/contacts/settle-up",
              params: { contactUserId: id },
            })
          }
        />
      </View>
    </>
  );
}

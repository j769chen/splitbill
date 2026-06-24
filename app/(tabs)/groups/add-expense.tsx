import { useEffect, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button, TextInput } from "react-native-paper";
import { useGroup } from "@/lib/queries/useGroups";
import { useCreateExpense, useExpenses, useUpdateExpense } from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { computeSplits, getErrorMessage } from "@/lib/utils";
import { canConvert, getRate } from "@/lib/currency";
import { useExchangeRates } from "@/lib/exchange-rates";
import { useSnackbar } from "@/lib/snackbar";
import { FormScreen } from "@/components/FormScreen";
import { ExpenseAmountCurrencyInput } from "@/components/groups/ExpenseAmountCurrencyInput";
import { PaidByPicker } from "@/components/groups/PaidByPicker";
import { SplitMembersSection } from "@/components/groups/SplitMembersSection";
import { SplitTypeSelector } from "@/components/groups/SplitTypeSelector";
import type { SplitType } from "@/lib/types";

export default function AddExpense() {
  const { groupId, expenseId } = useLocalSearchParams<{
    groupId: string;
    expenseId?: string;
  }>();
  const isEdit = !!expenseId;
  const { user } = useAuth();
  const { data: group } = useGroup(groupId!);
  const { data: expenses } = useExpenses(groupId!);
  const { data: rates } = useExchangeRates();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const { showError } = useSnackbar();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(user?.id ?? "");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const baseCurrency = group?.currency ?? "USD";
  const entryCurrency = currency ?? baseCurrency;
  const members = group?.group_members ?? [];
  const existingExpense = isEdit
    ? expenses?.find((e) => e.id === expenseId)
    : undefined;

  useEffect(() => {
    if (!isEdit || hydrated || !existingExpense || members.length === 0) return;

    setDescription(existingExpense.description);
    setAmount(String(existingExpense.amount));
    setPaidBy(existingExpense.paid_by);
    setSplitType(existingExpense.split_type);
    setCurrency(existingExpense.currency);

    const splits = existingExpense.expense_splits ?? [];
    const splitUserIds = splits.map((s) => s.user_id);
    setExcludedMemberIds(
      members
        .map((m) => m.user_id)
        .filter((id) => !splitUserIds.includes(id))
    );

    const total = existingExpense.amount;
    const custom: Record<string, string> = {};
    if (existingExpense.split_type === "exact") {
      for (const s of splits) custom[s.user_id] = s.amount.toFixed(2);
    } else if (existingExpense.split_type === "percentage") {
      for (const s of splits) {
        custom[s.user_id] =
          total > 0 ? ((s.amount / total) * 100).toFixed(2) : "";
      }
    }
    setCustomSplits(custom);
    setHydrated(true);
  }, [isEdit, hydrated, existingExpense, members]);
  const selectedMembers = members
    .map((member) => member.user_id)
    .filter((userId) => !excludedMemberIds.includes(userId));
  const effectivePaidBy = paidBy || user?.id || "";
  const totalAmount = parseFloat(amount) || 0;
  const isForeignCurrency = entryCurrency !== baseCurrency;
  const hasExchangeRate = canConvert(entryCurrency, baseCurrency, rates);
  const exchangeRate = isForeignCurrency
    ? getRate(entryCurrency, baseCurrency, rates)
    : 1;
  const convertedBase = Math.round(totalAmount * exchangeRate * 100) / 100;

  const memberName = (member: { user_id: string; profiles?: { full_name?: string | null } | null }) =>
    member.profiles?.full_name ??
    (member.user_id === user?.id ? "You" : "Unknown");

  const toggleMember = (userId: string) => {
    setExcludedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showError("Please enter a description");
      return;
    }
    if (!totalAmount || totalAmount <= 0) {
      showError("Please enter a valid amount");
      return;
    }
    if (selectedMembers.length === 0) {
      showError("Please select at least one member");
      return;
    }
    if (!effectivePaidBy) {
      showError("Please select who paid");
      return;
    }
    if (isForeignCurrency && !hasExchangeRate) {
      showError(
        "Exchange rates aren't available for this currency pair. Try again when rates are cached."
      );
      return;
    }

    const result = computeSplits(
      splitType,
      totalAmount,
      selectedMembers,
      customSplits,
      entryCurrency
    );
    if (!result.ok) {
      showError(result.error);
      return;
    }
    const splits = result.splits;

    try {
      if (isEdit && expenseId) {
        await updateExpense.mutateAsync({
          expenseId,
          groupId: groupId!,
          paidBy: effectivePaidBy,
          amount: totalAmount,
          description: description.trim(),
          splitType,
          splits,
          currency: entryCurrency,
          exchangeRate,
        });
      } else {
        await createExpense.mutateAsync({
          groupId: groupId!,
          paidBy: effectivePaidBy,
          amount: totalAmount,
          description: description.trim(),
          splitType,
          splits,
          currency: entryCurrency,
          exchangeRate,
        });
      }
      router.back();
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          isEdit
            ? "Couldn't save the expense. Please try again."
            : "Couldn't add the expense. Please try again."
        )
      );
    }
  };

  const isPending = isEdit ? updateExpense.isPending : createExpense.isPending;

  return (
    <FormScreen
      header={
        <Stack.Screen
          options={{ title: isEdit ? "Edit Expense" : "Add Expense" }}
        />
      }
    >
      <TextInput
        mode="outlined"
        label="Description"
        placeholder="What was this expense for?"
        value={description}
        onChangeText={setDescription}
        autoFocus
      />

      <ExpenseAmountCurrencyInput
        amount={amount}
        onAmountChange={setAmount}
        entryCurrency={entryCurrency}
        onCurrencyChange={setCurrency}
        baseCurrency={baseCurrency}
        totalAmount={totalAmount}
        convertedBase={convertedBase}
        isForeignCurrency={isForeignCurrency}
        hasExchangeRate={hasExchangeRate}
        baseCurrencyLabel="group currency"
      />

      <PaidByPicker
        members={members}
        paidBy={effectivePaidBy}
        onSelect={setPaidBy}
        getMemberName={memberName}
      />

      <SplitTypeSelector value={splitType} onChange={setSplitType} />

      <SplitMembersSection
        members={members}
        selectedMemberIds={selectedMembers}
        splitType={splitType}
        totalAmount={totalAmount}
        customSplits={customSplits}
        currencyCode={entryCurrency}
        getMemberName={memberName}
        onToggleMember={toggleMember}
        onChangeCustom={(userId, val) =>
          setCustomSplits((prev) => ({ ...prev, [userId]: val }))
        }
      />

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={isPending}
        disabled={isPending}
        contentStyle={{ paddingVertical: 6 }}
        style={{ marginTop: 32, marginBottom: 32 }}
      >
        {isEdit ? "Save Changes" : "Add Expense"}
      </Button>
    </FormScreen>
  );
}

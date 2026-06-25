import { useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button, TextInput } from "react-native-paper";
import {
  useContacts,
  useContactCurrency,
  useContactExpenses,
  useCreateContactExpense,
  useUpdateContactExpense,
} from "@/lib/queries/useContacts";
import { useAuth } from "@/lib/auth";
import { useHydrateOnce } from "@/lib/useHydrateOnce";
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

export default function AddContactExpense() {
  const { contactUserId, expenseId } = useLocalSearchParams<{
    contactUserId: string;
    expenseId?: string;
  }>();
  const isEdit = !!expenseId;
  const { user } = useAuth();
  const { data: contacts } = useContacts();
  const { data: contactExpenses } = useContactExpenses(contactUserId!);
  const { data: pairCurrency } = useContactCurrency(contactUserId!);
  const { data: rates } = useExchangeRates();
  const createContactExpense = useCreateContactExpense();
  const updateContactExpense = useUpdateContactExpense();
  const { showError } = useSnackbar();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(user?.id ?? "");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);

  const baseCurrency = pairCurrency ?? "USD";
  const entryCurrency = currency ?? baseCurrency;
  const contact = contacts?.find((c) => c.contact_user_id === contactUserId);
  const contactName = contact?.full_name ?? "Contact";
  const existingExpense = isEdit
    ? contactExpenses?.find((e) => e.id === expenseId)
    : undefined;

  useHydrateOnce(isEdit && !!existingExpense, () => {
    if (!existingExpense) return;

    setDescription(existingExpense.description);
    setAmount(String(existingExpense.amount));
    setPaidBy(existingExpense.paid_by);
    setSplitType(existingExpense.split_type);
    setCurrency(existingExpense.currency);

    const splits = existingExpense.expense_splits ?? [];
    const splitUserIds = splits.map((s) => s.user_id);
    setExcludedMemberIds(
      [existingExpense.user_lo, existingExpense.user_hi].filter(
        (id) => !splitUserIds.includes(id)
      )
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
  });

  const members = [
    {
      user_id: user?.id ?? "",
      profiles: { full_name: "You" },
    },
    {
      user_id: contactUserId ?? "",
      profiles: { full_name: contactName },
    },
  ];

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

  const memberName = (member: {
    user_id: string;
    profiles?: { full_name?: string | null } | null;
  }) =>
    member.user_id === user?.id
      ? "You"
      : (member.profiles?.full_name ?? contactName);

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
      showError("Please select at least one person");
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

    try {
      if (isEdit && expenseId) {
        await updateContactExpense.mutateAsync({
          expenseId,
          contactUserId: contactUserId!,
          paidBy: effectivePaidBy,
          amount: totalAmount,
          description: description.trim(),
          splitType,
          splits: result.splits,
          currency: entryCurrency,
          exchangeRate,
        });
      } else {
        await createContactExpense.mutateAsync({
          contactUserId: contactUserId!,
          paidBy: effectivePaidBy,
          amount: totalAmount,
          description: description.trim(),
          splitType,
          splits: result.splits,
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

  const isPending = isEdit
    ? updateContactExpense.isPending
    : createContactExpense.isPending;

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

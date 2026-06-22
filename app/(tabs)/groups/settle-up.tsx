import { useState } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text, TextInput } from "react-native-paper";
import { useGroupBalances } from "@/lib/queries/useBalances";
import { useCreatePayment } from "@/lib/queries/usePayments";
import { useAuth } from "@/lib/auth";
import { getErrorMessage, simplifyDebts } from "@/lib/utils";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { DebtCard, EmptyState } from "@/components/groups";

export default function SettleUp() {
  const theme = useAppTheme();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const { data: balances } = useGroupBalances(groupId!);
  const createPayment = useCreatePayment();
  const { showError, showSuccess } = useSnackbar();

  const [selectedDebt, setSelectedDebt] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const debts = balances ? simplifyDebts(balances) : [];
  const userDebts = debts.filter(
    (d) => d.from === user?.id || d.to === user?.id
  );

  const handleSettle = async () => {
    if (selectedDebt === null) {
      showError("Please select a payment to settle");
      return;
    }

    const debt = userDebts[selectedDebt];
    const settleAmount = parseFloat(amount) || debt.amount;

    if (settleAmount <= 0) {
      showError("Please enter a valid amount");
      return;
    }

    try {
      await createPayment.mutateAsync({
        groupId: groupId!,
        paidBy: debt.from,
        paidTo: debt.to,
        amount: settleAmount,
        note: note.trim() || undefined,
      });
      showSuccess("Payment recorded!");
      router.back();
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't record payment. Please try again.")
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        {userDebts.length === 0 ? (
          <EmptyState title="You're all settled up in this group!" />
        ) : (
          <>
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
            >
              Select a payment to settle
            </Text>
            <View style={{ gap: 8 }}>
              {userDebts.map((debt, idx) => (
                <DebtCard
                  key={idx}
                  debt={debt}
                  index={idx}
                  isFrom={debt.from === user?.id}
                  selected={selectedDebt === idx}
                  onSelect={() => {
                    setSelectedDebt(idx);
                    setAmount(debt.amount.toFixed(2));
                  }}
                />
              ))}
            </View>

            {selectedDebt !== null && (
              <>
                <View style={{ marginTop: 24 }}>
                  <TextInput
                    mode="outlined"
                    label="Amount"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>

                <View style={{ marginTop: 16 }}>
                  <TextInput
                    mode="outlined"
                    label="Note (optional)"
                    value={note}
                    onChangeText={setNote}
                    placeholder="e.g., Venmo payment"
                  />
                </View>

                <Button
                  mode="contained"
                  buttonColor={theme.colors.secondary}
                  textColor={theme.colors.onSecondary}
                  onPress={handleSettle}
                  loading={createPayment.isPending}
                  disabled={createPayment.isPending}
                  contentStyle={{ paddingVertical: 6 }}
                  style={{ marginTop: 32 }}
                >
                  Record Payment
                </Button>
              </>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

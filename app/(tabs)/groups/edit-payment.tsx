import { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text, TextInput } from "react-native-paper";
import { useGroup } from "@/lib/queries/useGroups";
import { useGroupPayments, useUpdatePayment } from "@/lib/queries/usePayments";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { PaidByPicker } from "@/components/groups/PaidByPicker";

export default function EditPayment() {
  const theme = useAppTheme();
  const { groupId, paymentId } = useLocalSearchParams<{
    groupId: string;
    paymentId: string;
  }>();
  const { user } = useAuth();
  const { data: group } = useGroup(groupId!);
  const { data: payments } = useGroupPayments(groupId!);
  const updatePayment = useUpdatePayment();
  const { showError, showSuccess } = useSnackbar();

  const [paidBy, setPaidBy] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const members = group?.group_members ?? [];
  const payment = payments?.find((p) => p.id === paymentId);

  useEffect(() => {
    if (hydrated || !payment) return;
    setPaidBy(payment.paid_by);
    setPaidTo(payment.paid_to);
    setAmount(payment.amount.toFixed(2));
    setNote(payment.note ?? "");
    setHydrated(true);
  }, [hydrated, payment]);

  const memberName = (member: {
    user_id: string;
    profiles?: { full_name?: string } | null;
  }) =>
    member.profiles?.full_name ??
    (member.user_id === user?.id ? "You" : "Unknown");

  const handleSave = async () => {
    const totalAmount = parseFloat(amount) || 0;
    if (!paidBy || !paidTo) {
      showError("Please select who paid whom");
      return;
    }
    if (paidBy === paidTo) {
      showError("Payer and recipient must be different people");
      return;
    }
    if (totalAmount <= 0) {
      showError("Please enter a valid amount");
      return;
    }

    try {
      await updatePayment.mutateAsync({
        paymentId: paymentId!,
        groupId: groupId!,
        paidBy,
        paidTo,
        amount: totalAmount,
        note: note.trim() || undefined,
      });
      showSuccess("Payment updated!");
      router.back();
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't update payment. Please try again.")
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <PaidByPicker
          label="Paid by"
          members={members}
          paidBy={paidBy}
          onSelect={setPaidBy}
          getMemberName={memberName}
        />

        <PaidByPicker
          label="Paid to"
          members={members}
          paidBy={paidTo}
          onSelect={setPaidTo}
          getMemberName={memberName}
        />

        <View style={{ marginTop: 24 }}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
          >
            Amount
          </Text>
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
          onPress={handleSave}
          loading={updatePayment.isPending}
          disabled={updatePayment.isPending}
          contentStyle={{ paddingVertical: 6 }}
          style={{ marginTop: 32, marginBottom: 32 }}
        >
          Save Changes
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

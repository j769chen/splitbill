import { useEffect, useState } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  useContacts,
  useContactCurrency,
  useContactPairBalance,
  useContactPayments,
  useCreateContactPayment,
  useUpdateContactPayment,
} from "@/lib/queries/useContacts";
import { useAuth } from "@/lib/auth";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import {
  ContactPaymentForm,
  type ContactPaymentDirection,
} from "@/components/contacts/ContactPaymentForm";

export default function ContactSettleUp() {
  const theme = useAppTheme();
  const { contactUserId, paymentId, name } = useLocalSearchParams<{
    contactUserId: string;
    paymentId?: string;
    name?: string;
  }>();
  const isEdit = !!paymentId;
  const { user } = useAuth();
  const { data: contacts } = useContacts();
  const { data: pairBalance = 0 } = useContactPairBalance(contactUserId!);
  const { data: pairCurrency = "USD" } = useContactCurrency(contactUserId!);
  const { data: payments } = useContactPayments(contactUserId!);
  const createPayment = useCreateContactPayment();
  const updatePayment = useUpdateContactPayment();
  const { showError, showSuccess } = useSnackbar();

  const contact = contacts?.find((c) => c.contact_user_id === contactUserId);
  const contactName = contact?.full_name ?? name ?? "Contact";

  const [direction, setDirection] =
    useState<ContactPaymentDirection>("you_paid");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const existingPayment = isEdit
    ? payments?.find((p) => p.id === paymentId)
    : undefined;

  useEffect(() => {
    if (hydrated) return;

    if (isEdit) {
      if (!existingPayment) return;
      setDirection(
        existingPayment.paid_by === user?.id ? "you_paid" : "they_paid"
      );
      setAmount(existingPayment.amount.toFixed(2));
      setNote(existingPayment.note ?? "");
      setHydrated(true);
      return;
    }

    // Create mode: default direction + amount from the current balance.
    // balance > 0 => contact owes you => they pay you to settle.
    setDirection(pairBalance > 0.01 ? "they_paid" : "you_paid");
    if (Math.abs(pairBalance) > 0.01) {
      setAmount(Math.abs(pairBalance).toFixed(2));
    }
    setHydrated(true);
  }, [hydrated, isEdit, existingPayment, pairBalance, user?.id]);

  const handleSubmit = async () => {
    const totalAmount = parseFloat(amount) || 0;
    if (totalAmount <= 0) {
      showError("Please enter a valid amount");
      return;
    }
    if (!user?.id || !contactUserId) {
      showError("Something went wrong. Please try again.");
      return;
    }

    const paidBy = direction === "you_paid" ? user.id : contactUserId;
    const paidTo = direction === "you_paid" ? contactUserId : user.id;

    try {
      if (isEdit && paymentId) {
        await updatePayment.mutateAsync({
          paymentId,
          contactUserId,
          paidBy,
          paidTo,
          amount: totalAmount,
          note: note.trim() || undefined,
          currency: pairCurrency,
        });
        showSuccess("Payment updated!");
      } else {
        await createPayment.mutateAsync({
          contactUserId,
          paidBy,
          paidTo,
          amount: totalAmount,
          note: note.trim() || undefined,
          currency: pairCurrency,
        });
        showSuccess("Payment recorded!");
      }
      router.back();
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't record payment. Please try again.")
      );
    }
  };

  const isPending = isEdit ? updatePayment.isPending : createPayment.isPending;

  const owed = pairBalance > 0.01;
  const owing = pairBalance < -0.01;
  const balanceLabel = owed
    ? `${contactName} owes you ${formatCurrency(pairBalance, pairCurrency)}`
    : owing
      ? `You owe ${contactName} ${formatCurrency(Math.abs(pairBalance), pairCurrency)}`
      : `You're all settled up with ${contactName}`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <Stack.Screen
        options={{ title: isEdit ? "Edit Payment" : "Settle Up" }}
      />
      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <ContactPaymentForm
          isEdit={isEdit}
          contactName={contactName}
          balanceLabel={balanceLabel}
          direction={direction}
          onDirectionChange={setDirection}
          amount={amount}
          onAmountChange={setAmount}
          note={note}
          onNoteChange={setNote}
          pairCurrency={pairCurrency}
          isPending={isPending}
          onSubmit={handleSubmit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

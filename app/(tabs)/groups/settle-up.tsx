import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useGroupBalances } from "@/lib/queries/useBalances";
import { useCreatePayment } from "@/lib/queries/usePayments";
import { useAuth } from "@/lib/auth";
import { simplifyDebts, formatCurrency } from "@/lib/utils";
import { useSnackbar } from "@/lib/snackbar";

export default function SettleUp() {
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
    } catch (error: any) {
      showError(error?.message ?? "Couldn't record payment. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1 px-6 pt-6">
        {userDebts.length === 0 ? (
          <View className="items-center py-20">
            <Text className="text-gray-400 text-lg text-center">
              You're all settled up in this group!
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Select a payment to settle
            </Text>
            <View className="gap-2">
              {userDebts.map((debt, idx) => {
                const isFrom = debt.from === user?.id;
                return (
                  <Pressable
                    key={idx}
                    role="button"
                    className={`p-4 rounded-xl border ${
                      selectedDebt === idx
                        ? "bg-primary-50 border-primary-300"
                        : "bg-white border-gray-200"
                    }`}
                    onPress={() => {
                      setSelectedDebt(idx);
                      setAmount(debt.amount.toFixed(2));
                    }}
                  >
                    <Text className="text-sm text-gray-700">
                      {isFrom ? (
                        <>
                          You pay{" "}
                          <Text className="font-semibold">{debt.to_name}</Text>
                        </>
                      ) : (
                        <>
                          <Text className="font-semibold">
                            {debt.from_name}
                          </Text>{" "}
                          pays you
                        </>
                      )}
                    </Text>
                    <Text className="text-lg font-bold text-primary-500 mt-1">
                      {formatCurrency(debt.amount)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedDebt !== null && (
              <>
                <View className="mt-6">
                  <Text className="text-sm font-medium text-gray-700 mb-1.5">
                    Amount
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-xl font-bold text-gray-900"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View className="mt-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1.5">
                    Note (optional)
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900"
                    value={note}
                    onChangeText={setNote}
                    placeholder="e.g., Venmo payment"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <Pressable
                  role="button"
                  className="bg-accent-500 rounded-xl py-4 mt-8 active:bg-accent-600"
                  onPress={handleSettle}
                  disabled={createPayment.isPending}
                >
                  {createPayment.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-center font-semibold text-base">
                      Record Payment
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

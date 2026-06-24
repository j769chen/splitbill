import { View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { getCurrencySymbol } from "@/lib/currency";
import { useAppTheme } from "@/lib/theme";

type PaymentAmountNoteFieldsProps = {
  amount: string;
  onAmountChange: (amount: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
  currency?: string;
  amountLabel?: string;
  amountSectionLabel?: string;
};

export function PaymentAmountNoteFields({
  amount,
  onAmountChange,
  note,
  onNoteChange,
  currency,
  amountLabel,
  amountSectionLabel,
}: PaymentAmountNoteFieldsProps) {
  const theme = useAppTheme();
  const resolvedAmountLabel =
    amountLabel ?? (currency ? `Amount (${getCurrencySymbol(currency)})` : "Amount");

  return (
    <>
      <View style={{ marginTop: 24 }}>
        {amountSectionLabel ? (
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
          >
            {amountSectionLabel}
          </Text>
        ) : null}
        <TextInput
          mode="outlined"
          label={resolvedAmountLabel}
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <TextInput
          mode="outlined"
          label="Note (optional)"
          value={note}
          onChangeText={onNoteChange}
          placeholder="e.g., Venmo payment"
        />
      </View>
    </>
  );
}

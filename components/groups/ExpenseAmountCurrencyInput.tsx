import { View } from "react-native";
import { Text, TextInput } from "react-native-paper";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { getCurrencySymbol } from "@/lib/currency";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";

type ExpenseAmountCurrencyInputProps = {
  amount: string;
  onAmountChange: (amount: string) => void;
  entryCurrency: string;
  onCurrencyChange: (currency: string) => void;
  baseCurrency: string;
  totalAmount: number;
  convertedBase: number;
  isForeignCurrency: boolean;
  hasExchangeRate: boolean;
};

export function ExpenseAmountCurrencyInput({
  amount,
  onAmountChange,
  entryCurrency,
  onCurrencyChange,
  baseCurrency,
  totalAmount,
  convertedBase,
  isForeignCurrency,
  hasExchangeRate,
}: ExpenseAmountCurrencyInputProps) {
  const theme = useAppTheme();

  return (
    <>
      <View style={{ marginTop: 16, flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TextInput
            mode="outlined"
            label={`Amount (${getCurrencySymbol(entryCurrency).trim()})`}
            placeholder="0.00"
            value={amount}
            onChangeText={onAmountChange}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ justifyContent: "center" }}>
          <CurrencyPicker value={entryCurrency} onChange={onCurrencyChange} />
        </View>
      </View>

      {isForeignCurrency && totalAmount > 0 && hasExchangeRate ? (
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
        >
          {`= ${formatCurrency(convertedBase, baseCurrency)} in ${baseCurrency} (group currency)`}
        </Text>
      ) : null}
      {isForeignCurrency && !hasExchangeRate ? (
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.error, marginTop: 8 }}
        >
          Exchange rates unavailable for {entryCurrency} to {baseCurrency}.
        </Text>
      ) : null}
    </>
  );
}

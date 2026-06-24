import { View } from "react-native";
import { Card, Text } from "react-native-paper";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";

type ContactSummaryCardProps = {
  summaryLabel: string;
  showAmount: boolean;
  balance: number;
  displayCurrency: string;
  summaryColor: string;
  pairCurrency: string;
  hasOneOnOneActivity: boolean;
  currencyPending: boolean;
  onChangeCurrency: (currency: string, onError: (error: unknown) => void) => void;
  onCurrencyError: (message: string) => void;
};

export function ContactSummaryCard({
  summaryLabel,
  showAmount,
  balance,
  displayCurrency,
  summaryColor,
  pairCurrency,
  hasOneOnOneActivity,
  currencyPending,
  onChangeCurrency,
  onCurrencyError,
}: ContactSummaryCardProps) {
  const theme = useAppTheme();

  return (
    <Card mode="contained" style={{ marginBottom: 16 }}>
      <Card.Content style={{ alignItems: "center", paddingVertical: 20 }}>
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {summaryLabel}
        </Text>
        {showAmount && (
          <Text
            variant="headlineMedium"
            style={{
              color: summaryColor,
              fontWeight: "bold",
              marginTop: 4,
            }}
          >
            {formatCurrency(Math.abs(balance), displayCurrency)}
          </Text>
        )}
        <View style={{ marginTop: 16, alignItems: "center" }}>
          <CurrencyPicker
            value={pairCurrency}
            disabled={hasOneOnOneActivity || currencyPending}
            onChange={(code) =>
              onChangeCurrency(code, (error) =>
                onCurrencyError(
                  getErrorMessage(
                    error,
                    "Couldn't update the currency. Please try again."
                  )
                )
              )
            }
          />
          <Text
            variant="bodySmall"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            {hasOneOnOneActivity
              ? `One-on-one balances are tracked in ${pairCurrency}.`
              : "Set the base currency for one-on-one expenses."}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

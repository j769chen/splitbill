import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Divider, Menu, Text } from "react-native-paper";
import { CURRENCIES, getCurrencyInfo } from "@/lib/currency";
import { useAppTheme } from "@/lib/theme";

type CurrencyPickerProps = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  disabled?: boolean;
};

// A compact dropdown for selecting a currency code, backed by the supported
// CURRENCIES list. Renders the code + symbol on the trigger button.
export function CurrencyPicker({
  value,
  onChange,
  label,
  disabled,
}: CurrencyPickerProps) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  const info = getCurrencyInfo(value);

  return (
    <View>
      {label ? (
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
        >
          {label}
        </Text>
      ) : null}
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <Button
            mode="outlined"
            disabled={disabled}
            icon="chevron-down"
            contentStyle={{ flexDirection: "row-reverse" }}
            onPress={() => setVisible(true)}
            accessibilityLabel="Select currency"
          >
            {`${info.code} (${info.symbol.trim()})`}
          </Button>
        }
      >
        <ScrollView style={{ maxHeight: 320 }}>
          {CURRENCIES.map((currency, idx) => (
            <View key={currency.code}>
              {idx > 0 ? <Divider /> : null}
              <Menu.Item
                onPress={() => {
                  onChange(currency.code);
                  setVisible(false);
                }}
                title={`${currency.code} · ${currency.name}`}
                leadingIcon={value === currency.code ? "check" : undefined}
              />
            </View>
          ))}
        </ScrollView>
      </Menu>
    </View>
  );
}

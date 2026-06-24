import { View } from "react-native";
import { Checkbox, Text, TextInput, TouchableRipple } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import { getCurrencySymbol } from "@/lib/currency";
import type { SplitType } from "@/lib/types";

type MemberSplitRowProps = {
  userId: string;
  name: string;
  isSelected: boolean;
  splitType: SplitType;
  perPerson: number;
  totalAmount: number;
  customValue: string;
  currencyCode?: string;
  onToggle: (userId: string) => void;
  onChangeCustom: (userId: string, value: string) => void;
};

export function MemberSplitRow({
  userId,
  name,
  isSelected,
  splitType,
  perPerson,
  totalAmount,
  customValue,
  currencyCode = "USD",
  onToggle,
  onChangeCustom,
}: MemberSplitRowProps) {
  const theme = useAppTheme();
  const symbol = getCurrencySymbol(currencyCode);

  return (
    <View>
      <TouchableRipple
        onPress={() => onToggle(userId)}
        borderless
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isSelected ? theme.colors.primary : theme.colors.outline,
          backgroundColor: isSelected
            ? theme.colors.primaryContainer
            : theme.colors.surface,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", padding: 12 }}
        >
          <Checkbox
            status={isSelected ? "checked" : "unchecked"}
            onPress={() => onToggle(userId)}
          />
          <Text
            variant="bodyMedium"
            style={{
              flex: 1,
              marginLeft: 8,
              fontWeight: "500",
              color: isSelected
                ? theme.colors.onPrimaryContainer
                : theme.colors.onSurface,
            }}
          >
            {name}
          </Text>
          {splitType === "equal" && isSelected && totalAmount > 0 && (
            <Text
              variant="bodyMedium"
              style={{ fontWeight: "600", color: theme.colors.primary }}
            >
              {`${symbol}${perPerson.toFixed(2)}`}
            </Text>
          )}
        </View>
      </TouchableRipple>

      {isSelected && splitType !== "equal" && (
        <TextInput
          mode="outlined"
          dense
          style={{ marginTop: 4, marginLeft: 32 }}
          placeholder={splitType === "percentage" ? "%" : `${symbol}0.00`}
          value={customValue}
          onChangeText={(val) => onChangeCustom(userId, val)}
          keyboardType="decimal-pad"
        />
      )}
    </View>
  );
}

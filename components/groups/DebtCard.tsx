import { View } from "react-native";
import { Card, RadioButton, Text } from "react-native-paper";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";
import type { DebtEdge } from "@/lib/types";

type DebtCardProps = {
  debt: DebtEdge;
  index: number;
  isFrom: boolean;
  selected: boolean;
  onSelect: () => void;
};

export function DebtCard({
  debt,
  index,
  isFrom,
  selected,
  onSelect,
}: DebtCardProps) {
  const theme = useAppTheme();

  return (
    <Card
      mode={selected ? "contained" : "outlined"}
      style={
        selected
          ? { backgroundColor: theme.colors.primaryContainer }
          : undefined
      }
      onPress={onSelect}
    >
      <Card.Content style={{ flexDirection: "row", alignItems: "center" }}>
        <RadioButton
          value={String(index)}
          status={selected ? "checked" : "unchecked"}
          onPress={onSelect}
        />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            {isFrom ? (
              <>
                You pay{" "}
                <Text style={{ fontWeight: "600" }}>{debt.to_name}</Text>
              </>
            ) : (
              <>
                <Text style={{ fontWeight: "600" }}>{debt.from_name}</Text>{" "}
                pays you
              </>
            )}
          </Text>
          <Text
            variant="titleMedium"
            style={{
              fontWeight: "bold",
              color: theme.colors.primary,
              marginTop: 2,
            }}
          >
            {formatCurrency(debt.amount)}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

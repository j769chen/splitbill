import { View } from "react-native";
import { Button } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

type ContactActionBarProps = {
  onAddExpense: () => void;
  onSettleUp: () => void;
};

export function ContactActionBar({
  onAddExpense,
  onSettleUp,
}: ContactActionBarProps) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingBottom: 24,
        paddingTop: 8,
        gap: 12,
      }}
    >
      <Button
        mode="contained"
        style={{ flex: 1 }}
        contentStyle={{ paddingVertical: 4 }}
        onPress={onAddExpense}
      >
        Add Expense
      </Button>
      <Button
        mode="contained"
        buttonColor={theme.colors.secondary}
        textColor={theme.colors.onSecondary}
        style={{ flex: 1 }}
        contentStyle={{ paddingVertical: 4 }}
        onPress={onSettleUp}
      >
        Settle Up
      </Button>
    </View>
  );
}

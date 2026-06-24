import { View } from "react-native";
import { Button } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

type DualActionBarProps = {
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
};

export function DualActionBar({
  primaryLabel = "Add Expense",
  secondaryLabel = "Settle Up",
  onPrimary,
  onSecondary,
}: DualActionBarProps) {
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
        onPress={onPrimary}
      >
        {primaryLabel}
      </Button>
      <Button
        mode="contained"
        buttonColor={theme.colors.secondary}
        textColor={theme.colors.onSecondary}
        style={{ flex: 1 }}
        contentStyle={{ paddingVertical: 4 }}
        onPress={onSecondary}
      >
        {secondaryLabel}
      </Button>
    </View>
  );
}

import { View } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import type { SplitType } from "@/lib/types";

type SplitTypeSelectorProps = {
  value: SplitType;
  onChange: (value: SplitType) => void;
};

export function SplitTypeSelector({ value, onChange }: SplitTypeSelectorProps) {
  const theme = useAppTheme();

  return (
    <View style={{ marginTop: 24 }}>
      <Text
        variant="labelLarge"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
      >
        Split Type
      </Text>
      <SegmentedButtons
        value={value}
        onValueChange={(next) => onChange(next as SplitType)}
        buttons={[
          { value: "equal", label: "Equal" },
          { value: "exact", label: "Exact" },
          { value: "percentage", label: "%" },
        ]}
      />
    </View>
  );
}

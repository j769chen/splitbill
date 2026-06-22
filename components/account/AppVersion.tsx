import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

type AppVersionProps = {
  style?: StyleProp<TextStyle>;
};

export function AppVersion({ style }: AppVersionProps) {
  const theme = useAppTheme();
  return (
    <Text
      variant="labelSmall"
      style={[
        { textAlign: "center", color: theme.colors.onSurfaceVariant },
        style,
      ]}
    >
      SplitBill v1.0.0
    </Text>
  );
}

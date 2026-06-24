import { View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

export function LoadingScreen() {
  const theme = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.background,
      }}
    >
      <ActivityIndicator size="large" />
    </View>
  );
}

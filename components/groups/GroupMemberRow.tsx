import { View } from "react-native";
import { Text } from "react-native-paper";
import { formatCurrency } from "@/lib/utils";
import { useAppTheme } from "@/lib/theme";

type GroupMemberRowProps = {
  name: string;
  isSelf: boolean;
  // Pairwise balance between the current user and this member (positive = this
  // member owes you). Undefined for the current user's own row.
  balance?: number;
  currency?: string;
};

export function GroupMemberRow({
  name,
  isSelf,
  balance,
  currency,
}: GroupMemberRowProps) {
  const theme = useAppTheme();

  const owed = balance !== undefined && balance > 0.01;
  const owing = balance !== undefined && balance < -0.01;
  const balanceColor = owed
    ? theme.colors.success
    : owing
      ? theme.colors.error
      : theme.colors.onSurfaceVariant;

  const label = owed
    ? `owes you ${formatCurrency(balance!, currency)}`
    : owing
      ? `you owe ${formatCurrency(Math.abs(balance!), currency)}`
      : "settled up";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.secondaryContainer,
        }}
      >
        <Text
          style={{ color: theme.colors.onSecondaryContainer, fontWeight: "700" }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text
        variant="bodyLarge"
        style={{ marginLeft: 12, flex: 1, color: theme.colors.onSurface }}
        numberOfLines={1}
      >
        {name}
        {isSelf ? " (You)" : ""}
      </Text>
      {!isSelf && (
        <Text
          variant="bodySmall"
          style={{ color: balanceColor, fontWeight: "600" }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

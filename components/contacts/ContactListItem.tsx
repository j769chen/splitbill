import { View } from "react-native";
import { Avatar, Card, Text } from "react-native-paper";
import {
  formatCompactPeerBalance,
  getBalanceColor,
} from "@/lib/balance-display";
import { useAppTheme } from "@/lib/theme";
import type { ContactWithBalance } from "@/lib/types";

type ContactListItemProps = {
  contact: ContactWithBalance;
  currency: string;
  onPress: () => void;
};

export function ContactListItem({
  contact,
  currency,
  onPress,
}: ContactListItemProps) {
  const theme = useAppTheme();
  const balanceColor = getBalanceColor(contact.balance, theme.colors);
  const balanceLabel = formatCompactPeerBalance(contact.balance, currency);

  return (
    <Card mode="elevated" onPress={onPress}>
      <Card.Content style={{ flexDirection: "row", alignItems: "center" }}>
        <Avatar.Text
          size={48}
          label={contact.full_name.charAt(0).toUpperCase()}
          style={{ backgroundColor: theme.colors.secondaryContainer }}
          labelStyle={{ color: theme.colors.onSecondaryContainer }}
        />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: "600" }}>
            {contact.full_name}
          </Text>
          <Text variant="bodySmall" style={{ color: balanceColor }}>
            {balanceLabel}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

import { View } from "react-native";
import { Avatar, Card, Text } from "react-native-paper";
import {
  formatSharedGroupBalance,
  getBalanceColor,
} from "@/lib/balance-display";
import { useAppTheme } from "@/lib/theme";
import type { ContactGroupBreakdown } from "@/lib/types";

type ContactGroupBreakdownListProps = {
  groups: ContactGroupBreakdown[];
  contactName: string;
  onOpenGroup: (groupId: string) => void;
};

export function ContactGroupBreakdownList({
  groups,
  contactName,
  onOpenGroup,
}: ContactGroupBreakdownListProps) {
  const theme = useAppTheme();

  if (groups.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text variant="titleMedium" style={{ fontWeight: "bold", marginBottom: 12 }}>
        In shared groups
      </Text>
      <View style={{ gap: 12 }}>
        {groups.map((group) => {
          const groupColor = getBalanceColor(group.balance, theme.colors);
          const groupLabel = formatSharedGroupBalance(
            group.balance,
            group.currency,
            contactName
          );

          return (
            <Card
              key={group.group_id}
              mode="elevated"
              onPress={() => onOpenGroup(group.group_id)}
            >
              <Card.Content style={{ flexDirection: "row", alignItems: "center" }}>
                <Avatar.Text
                  size={40}
                  label={group.group_name.charAt(0).toUpperCase()}
                  style={{ backgroundColor: theme.colors.primaryContainer }}
                  labelStyle={{ color: theme.colors.onPrimaryContainer }}
                />
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text variant="titleMedium" style={{ fontWeight: "600" }}>
                    {group.group_name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: groupColor }}>
                    {groupLabel}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

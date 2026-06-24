import { View } from "react-native";
import { Avatar, Card, Text } from "react-native-paper";
import { formatCurrency } from "@/lib/utils";
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
          const groupOwed = group.balance > 0.01;
          const groupOwing = group.balance < -0.01;
          const groupColor = groupOwed
            ? theme.colors.success
            : groupOwing
              ? theme.colors.error
              : theme.colors.onSurfaceVariant;
          const groupLabel = groupOwed
            ? `${contactName} owes you ${formatCurrency(group.balance, group.currency)}`
            : groupOwing
              ? `You owe ${formatCurrency(Math.abs(group.balance), group.currency)}`
              : "Settled up";

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

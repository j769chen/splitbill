import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Avatar, Card, Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import type { GroupWithMembers } from "@/lib/types";

type GroupListItemProps = {
  group: GroupWithMembers;
  onPress: () => void;
};

export function GroupListItem({ group, onPress }: GroupListItemProps) {
  const theme = useAppTheme();
  const memberCount = group.group_members.length;

  return (
    <Card mode="elevated" style={{ marginBottom: 12 }} onPress={onPress}>
      <Card.Content style={{ flexDirection: "row", alignItems: "center" }}>
        <Avatar.Text
          size={52}
          label={group.name.charAt(0).toUpperCase()}
          style={{ backgroundColor: theme.colors.primaryContainer }}
          labelStyle={{ color: theme.colors.onPrimaryContainer }}
        />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text variant="titleMedium" style={{ fontWeight: "600" }}>
            {group.name}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.colors.onSurfaceVariant}
        />
      </Card.Content>
    </Card>
  );
}

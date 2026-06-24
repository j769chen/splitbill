import { View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import type { GroupWithMembers } from "@/lib/types";
import { GroupMemberRow } from "./GroupMemberRow";

type GroupMember = GroupWithMembers["group_members"][number];

type GroupMembersCardProps = {
  members: GroupMember[];
  currentUserId?: string;
  pairwiseByUser: Map<string, number>;
  currency: string;
  onAddMembers: () => void;
};

export function GroupMembersCard({
  members,
  currentUserId,
  pairwiseByUser,
  currency,
  onAddMembers,
}: GroupMembersCardProps) {
  const theme = useAppTheme();

  if (members.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      <Card mode="contained">
        <Card.Content style={{ paddingVertical: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 8,
            }}
          >
            <Text
              variant="labelLarge"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Members ({members.length})
            </Text>
            <Button
              mode="text"
              compact
              icon="account-plus"
              onPress={onAddMembers}
            >
              Add
            </Button>
          </View>
          {members.map((member) => (
            <GroupMemberRow
              key={member.user_id}
              name={member.profiles?.full_name ?? "Unknown"}
              isSelf={member.user_id === currentUserId}
              balance={
                member.user_id === currentUserId
                  ? undefined
                  : pairwiseByUser.get(member.user_id) ?? 0
              }
              currency={currency}
            />
          ))}
        </Card.Content>
      </Card>
    </View>
  );
}

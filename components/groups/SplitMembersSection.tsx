import { View } from "react-native";
import { Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import type { GroupWithMembers, SplitType } from "@/lib/types";
import { MemberSplitRow } from "./MemberSplitRow";

type SplitMember = GroupWithMembers["group_members"][number];

type SplitMembersSectionProps = {
  members: SplitMember[];
  selectedMemberIds: string[];
  splitType: SplitType;
  totalAmount: number;
  customSplits: Record<string, string>;
  currencyCode: string;
  getMemberName: (member: SplitMember) => string;
  onToggleMember: (userId: string) => void;
  onChangeCustom: (userId: string, value: string) => void;
};

export function SplitMembersSection({
  members,
  selectedMemberIds,
  splitType,
  totalAmount,
  customSplits,
  currencyCode,
  getMemberName,
  onToggleMember,
  onChangeCustom,
}: SplitMembersSectionProps) {
  const theme = useAppTheme();

  return (
    <View style={{ marginTop: 24 }}>
      <Text
        variant="labelLarge"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
      >
        Split between
      </Text>
      <View style={{ gap: 8 }}>
        {members.map((member) => {
          const isSelected = selectedMemberIds.includes(member.user_id);
          const perPerson =
            splitType === "equal" && isSelected && selectedMemberIds.length > 0
              ? totalAmount / selectedMemberIds.length
              : 0;

          return (
            <MemberSplitRow
              key={member.user_id}
              userId={member.user_id}
              name={getMemberName(member)}
              isSelected={isSelected}
              splitType={splitType}
              perPerson={perPerson}
              totalAmount={totalAmount}
              customValue={customSplits[member.user_id] || ""}
              currencyCode={currencyCode}
              onToggle={onToggleMember}
              onChangeCustom={onChangeCustom}
            />
          );
        })}
      </View>
    </View>
  );
}

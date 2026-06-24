import { useState } from "react";
import { View } from "react-native";
import { Menu, Text, TextInput, TouchableRipple } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

export type PaidByMember = {
  user_id: string;
  profiles?: { full_name?: string | null } | null;
};

type PaidByPickerProps = {
  members: PaidByMember[];
  paidBy: string;
  onSelect: (userId: string) => void;
  getMemberName: (member: PaidByMember) => string;
  label?: string;
};

export function PaidByPicker({
  members,
  paidBy,
  onSelect,
  getMemberName,
  label: fieldLabel = "Paid by",
}: PaidByPickerProps) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  const paidByMember = members.find((m) => m.user_id === paidBy);
  const label = paidByMember ? getMemberName(paidByMember) : "Select a person";

  return (
    <View style={{ marginTop: 24 }}>
      <Text
        variant="labelLarge"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
      >
        {fieldLabel}
      </Text>
      <Menu
        visible={visible}
        onDismiss={() => setVisible(false)}
        anchor={
          <TouchableRipple onPress={() => setVisible(true)}>
            <View pointerEvents="none">
              <TextInput
                mode="outlined"
                editable={false}
                value={label}
                right={<TextInput.Icon icon="menu-down" />}
              />
            </View>
          </TouchableRipple>
        }
      >
        {members.map((member) => (
          <Menu.Item
            key={member.user_id}
            title={getMemberName(member)}
            trailingIcon={paidBy === member.user_id ? "check" : undefined}
            onPress={() => {
              onSelect(member.user_id);
              setVisible(false);
            }}
          />
        ))}
      </Menu>
    </View>
  );
}

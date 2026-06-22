import { View } from "react-native";
import {
  ActivityIndicator,
  Chip,
  IconButton,
  TextInput,
} from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

type MemberEmailInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
  emails: string[];
  isPending: boolean;
};

export function MemberEmailInput({
  value,
  onChangeText,
  onAdd,
  onRemove,
  emails,
  isPending,
}: MemberEmailInputProps) {
  const theme = useAppTheme();

  return (
    <>
      <View style={{ marginTop: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            mode="outlined"
            label="Add Members by Email"
            placeholder="friend@example.com"
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="none"
            keyboardType="email-address"
            onSubmitEditing={onAdd}
            returnKeyType="done"
            editable={!isPending}
            style={{ flex: 1 }}
          />
          {isPending ? (
            <View
              style={{
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : (
            <IconButton
              mode="contained"
              icon="plus"
              size={24}
              onPress={onAdd}
              containerColor={theme.colors.primary}
              iconColor={theme.colors.onPrimary}
            />
          )}
        </View>
      </View>

      {emails.length > 0 && (
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {emails.map((email) => (
            <Chip key={email} icon="account" onClose={() => onRemove(email)}>
              {email}
            </Chip>
          ))}
        </View>
      )}
    </>
  );
}

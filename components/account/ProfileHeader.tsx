import { View } from "react-native";
import { Text } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import { ProfileAvatar } from "./ProfileAvatar";

type ProfileHeaderProps = {
  name: string;
  email?: string;
};

export function ProfileHeader({ name, email }: ProfileHeaderProps) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        paddingHorizontal: 24,
        paddingVertical: 32,
        alignItems: "center",
        backgroundColor: theme.colors.surface,
      }}
    >
      <ProfileAvatar size={80} />
      <Text variant="titleLarge" style={{ fontWeight: "bold", marginTop: 16 }}>
        {name}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
      >
        {email}
      </Text>
    </View>
  );
}

import { Avatar } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";

type ProfileAvatarProps = {
  size?: number;
};

export function ProfileAvatar({ size = 80 }: ProfileAvatarProps) {
  const theme = useAppTheme();
  return (
    <Avatar.Icon
      size={size}
      icon="account"
      style={{ backgroundColor: theme.colors.primaryContainer }}
      color={theme.colors.onPrimaryContainer}
    />
  );
}

import { Avatar } from "react-native-paper";
import { useAppTheme } from "@/lib/theme";
import type { ContactRequest } from "@/lib/types";

type ContactRequestAvatarProps = {
  profile: ContactRequest["profile"];
};

export function ContactRequestAvatar({ profile }: ContactRequestAvatarProps) {
  const theme = useAppTheme();

  if (profile.avatar_url) {
    return <Avatar.Image size={44} source={{ uri: profile.avatar_url }} />;
  }

  return (
    <Avatar.Text
      size={44}
      label={(profile.full_name || "?").charAt(0).toUpperCase()}
      style={{ backgroundColor: theme.colors.secondaryContainer }}
      labelStyle={{ color: theme.colors.onSecondaryContainer }}
    />
  );
}

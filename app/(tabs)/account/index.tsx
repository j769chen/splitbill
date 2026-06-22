import { View, ScrollView } from "react-native";
import { Card, Divider, List, SegmentedButtons } from "react-native-paper";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/lib/confirm";
import { useAppTheme } from "@/lib/theme";
import { useThemePreference } from "@/lib/theme-preference";
import {
  AppVersion,
  ProfileHeader,
  SettingsLinkRow,
} from "@/components/account";

export default function Account() {
  const theme = useAppTheme();
  const { mode, setMode } = useThemePreference();
  const { user, signOut } = useAuth();
  const confirm = useConfirm();

  const handleSignOut = () => {
    confirm({
      title: "Sign Out",
      message: "Are you sure you want to sign out?",
      confirmText: "Sign Out",
      destructive: true,
      onConfirm: signOut,
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ProfileHeader
        name={user?.user_metadata?.full_name ?? "User"}
        email={user?.email}
      />

      <View style={{ marginTop: 24, paddingHorizontal: 24 }}>
        <List.Subheader>Appearance</List.Subheader>
        <Card mode="contained" style={{ marginBottom: 16 }}>
          <Card.Content style={{ paddingVertical: 16 }}>
            <SegmentedButtons
              value={mode}
              onValueChange={(v) => setMode(v as typeof mode)}
              buttons={[
                { value: "light", label: "Light", icon: "weather-sunny" },
                {
                  value: "system",
                  label: "System",
                  icon: "theme-light-dark",
                },
                { value: "dark", label: "Dark", icon: "weather-night" },
              ]}
            />
          </Card.Content>
        </Card>

        <Card mode="contained">
          <SettingsLinkRow
            title="Edit Profile"
            icon="account-outline"
            onPress={() => router.push("/(tabs)/account/edit-profile")}
          />
          <Divider />
          <SettingsLinkRow
            title="Notifications"
            icon="bell-outline"
            onPress={() => router.push("/(tabs)/account/notifications")}
          />
          <Divider />
          <SettingsLinkRow
            title="Help & Support"
            icon="help-circle-outline"
            onPress={() => router.push("/(tabs)/account/help")}
          />
        </Card>

        <Card mode="contained" style={{ marginTop: 16 }}>
          <SettingsLinkRow
            title="Sign Out"
            icon="logout"
            color={theme.colors.error}
            showChevron={false}
            onPress={handleSignOut}
          />
        </Card>
      </View>

      <AppVersion style={{ marginTop: 32, marginBottom: 24 }} />
    </ScrollView>
  );
}

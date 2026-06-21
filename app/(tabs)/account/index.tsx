import { View, ScrollView } from "react-native";
import {
  Avatar,
  Card,
  Divider,
  List,
  SegmentedButtons,
  Text,
} from "react-native-paper";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/lib/confirm";
import { useAppTheme } from "@/lib/theme";
import { useThemePreference } from "@/lib/theme-preference";

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
      className="flex-1"
      style={{ backgroundColor: theme.colors.background }}
    >
      <View
        className="px-6 py-8 items-center"
        style={{ backgroundColor: theme.colors.surface }}
      >
        <Avatar.Icon
          size={80}
          icon="account"
          style={{ backgroundColor: theme.colors.primaryContainer }}
          color={theme.colors.onPrimaryContainer}
        />
        <Text variant="titleLarge" style={{ fontWeight: "bold", marginTop: 16 }}>
          {user?.user_metadata?.full_name ?? "User"}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
        >
          {user?.email}
        </Text>
      </View>

      <View className="mt-6 px-6">
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
          <List.Item
            title="Edit Profile"
            left={(props) => <List.Icon {...props} icon="account-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/(tabs)/account/edit-profile")}
          />
          <Divider />
          <List.Item
            title="Notifications"
            left={(props) => <List.Icon {...props} icon="bell-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/(tabs)/account/notifications")}
          />
          <Divider />
          <List.Item
            title="Help & Support"
            left={(props) => (
              <List.Icon {...props} icon="help-circle-outline" />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => router.push("/(tabs)/account/help")}
          />
        </Card>

        <Card mode="contained" style={{ marginTop: 16 }}>
          <List.Item
            title="Sign Out"
            titleStyle={{ color: theme.colors.error, fontWeight: "500" }}
            left={(props) => (
              <List.Icon {...props} icon="logout" color={theme.colors.error} />
            )}
            onPress={handleSignOut}
          />
        </Card>
      </View>

      <Text
        variant="labelSmall"
        style={{
          textAlign: "center",
          color: theme.colors.onSurfaceVariant,
          marginTop: 32,
          marginBottom: 24,
        }}
      >
        SplitBill v1.0.0
      </Text>
    </ScrollView>
  );
}

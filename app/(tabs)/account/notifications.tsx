import { View, ScrollView } from "react-native";
import {
  ActivityIndicator,
  Card,
  Divider,
  List,
  Switch,
  Text,
} from "react-native-paper";
import {
  useNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notifications";
import { useAppTheme } from "@/lib/theme";

export default function Notifications() {
  const theme = useAppTheme();
  const { prefs, setPref, loading } = useNotificationPrefs();

  if (loading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const pushOff = !prefs.pushEnabled;

  const renderSwitch = (key: keyof NotificationPrefs, disabled?: boolean) => (
    <Switch
      value={prefs[key]}
      onValueChange={(value) => setPref(key, value)}
      disabled={disabled}
    />
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <List.Subheader>General</List.Subheader>
        <Card mode="contained">
          <List.Item
            title="Push Notifications"
            description="Turn all notifications on or off"
            left={(props) => <List.Icon {...props} icon="bell-outline" />}
            right={() => renderSwitch("pushEnabled")}
          />
        </Card>

        <List.Subheader style={{ marginTop: 16 }}>Activity</List.Subheader>
        <Card mode="contained">
          <List.Item
            title="New Expenses"
            description="When someone adds an expense"
            left={(props) => <List.Icon {...props} icon="receipt" />}
            right={() => renderSwitch("newExpenses", pushOff)}
            style={pushOff ? { opacity: 0.4 } : undefined}
          />
          <Divider />
          <List.Item
            title="Settlements"
            description="When a payment is recorded"
            left={(props) => (
              <List.Icon {...props} icon="check-circle-outline" />
            )}
            right={() => renderSwitch("settlements", pushOff)}
            style={pushOff ? { opacity: 0.4 } : undefined}
          />
          <Divider />
          <List.Item
            title="Group Invites"
            description="When you're added to a group"
            left={(props) => <List.Icon {...props} icon="account-group-outline" />}
            right={() => renderSwitch("groupInvites", pushOff)}
            style={pushOff ? { opacity: 0.4 } : undefined}
          />
          <Divider />
          <List.Item
            title="Payment Reminders"
            description="Periodic reminders for unsettled balances"
            left={(props) => <List.Icon {...props} icon="alarm" />}
            right={() => renderSwitch("paymentReminders", pushOff)}
            style={pushOff ? { opacity: 0.4 } : undefined}
          />
        </Card>

        <Text
          variant="bodySmall"
          style={{
            color: theme.colors.onSurfaceVariant,
            marginTop: 24,
            marginBottom: 24,
            paddingHorizontal: 4,
            lineHeight: 20,
          }}
        >
          Notification preferences are stored on this device and control which
          alerts SplitBill sends you.
        </Text>
      </View>
    </ScrollView>
  );
}

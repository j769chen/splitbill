import { View, Text, Switch, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notifications";

type ToggleRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
};

function ToggleRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
  isLast,
}: ToggleRowProps) {
  return (
    <View
      className={`flex-row items-center px-4 py-4 ${
        isLast ? "" : "border-b border-gray-50"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <Ionicons name={icon} size={22} color="#6B7280" />
      <View className="flex-1 ml-3 mr-3">
        <Text className="text-base text-gray-700">{label}</Text>
        {description ? (
          <Text className="text-xs text-gray-400 mt-0.5">{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#E5E7EB", true: "#80D9CF" }}
        thumbColor={value ? "#1B998B" : "#F3F4F6"}
        ios_backgroundColor="#E5E7EB"
      />
    </View>
  );
}

export default function Notifications() {
  const { prefs, setPref, loading } = useNotificationPrefs();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1B998B" />
      </View>
    );
  }

  const pushOff = !prefs.pushEnabled;
  const toggle =
    (key: keyof NotificationPrefs) => (value: boolean) =>
      setPref(key, value);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 ml-1">
          General
        </Text>
        <View className="bg-white rounded-2xl overflow-hidden">
          <ToggleRow
            icon="notifications-outline"
            label="Push Notifications"
            description="Turn all notifications on or off"
            value={prefs.pushEnabled}
            onValueChange={toggle("pushEnabled")}
            isLast
          />
        </View>

        <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 mt-6 ml-1">
          Activity
        </Text>
        <View className="bg-white rounded-2xl overflow-hidden">
          <ToggleRow
            icon="receipt-outline"
            label="New Expenses"
            description="When someone adds an expense"
            value={prefs.newExpenses}
            onValueChange={toggle("newExpenses")}
            disabled={pushOff}
          />
          <ToggleRow
            icon="checkmark-circle-outline"
            label="Settlements"
            description="When a payment is recorded"
            value={prefs.settlements}
            onValueChange={toggle("settlements")}
            disabled={pushOff}
          />
          <ToggleRow
            icon="people-outline"
            label="Group Invites"
            description="When you're added to a group"
            value={prefs.groupInvites}
            onValueChange={toggle("groupInvites")}
            disabled={pushOff}
          />
          <ToggleRow
            icon="alarm-outline"
            label="Payment Reminders"
            description="Periodic reminders for unsettled balances"
            value={prefs.paymentReminders}
            onValueChange={toggle("paymentReminders")}
            disabled={pushOff}
            isLast
          />
        </View>

        <Text className="text-xs text-gray-400 mt-6 px-1 leading-5">
          Notification preferences are stored on this device and control which
          alerts SplitBill sends you.
        </Text>
      </View>
    </ScrollView>
  );
}

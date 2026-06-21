import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/lib/confirm";

export default function Account() {
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
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 py-8 items-center border-b border-gray-100">
        <View className="w-20 h-20 rounded-full bg-primary-100 items-center justify-center mb-4">
          <Ionicons name="person" size={40} color="#1B998B" />
        </View>
        <Text className="text-xl font-bold text-gray-900">
          {user?.user_metadata?.full_name ?? "User"}
        </Text>
        <Text className="text-sm text-gray-500 mt-1">{user?.email}</Text>
      </View>

      <View className="mt-6 px-6">
        <View className="bg-white rounded-2xl overflow-hidden">
          <View className="flex-row items-center px-4 py-4 border-b border-gray-50">
            <Ionicons name="person-outline" size={22} color="#6B7280" />
            <Text className="flex-1 ml-3 text-base text-gray-700">
              Edit Profile
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
          <View className="flex-row items-center px-4 py-4 border-b border-gray-50">
            <Ionicons
              name="notifications-outline"
              size={22}
              color="#6B7280"
            />
            <Text className="flex-1 ml-3 text-base text-gray-700">
              Notifications
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
          <View className="flex-row items-center px-4 py-4">
            <Ionicons
              name="help-circle-outline"
              size={22}
              color="#6B7280"
            />
            <Text className="flex-1 ml-3 text-base text-gray-700">
              Help & Support
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </View>

        <Pressable
          role="button"
          className="bg-white rounded-2xl mt-4 px-4 py-4 flex-row items-center active:bg-gray-50"
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text className="flex-1 ml-3 text-base text-red-500 font-medium">
            Sign Out
          </Text>
        </Pressable>
      </View>

      <Text className="text-center text-gray-400 text-xs mt-8">
        SplitBill v1.0.0
      </Text>
    </View>
  );
}

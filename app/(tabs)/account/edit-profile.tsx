import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/lib/queries/useProfile";
import { useSnackbar } from "@/lib/snackbar";

export default function EditProfile() {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const { showError, showSuccess } = useSnackbar();

  const initialName = user?.user_metadata?.full_name ?? "";
  const [fullName, setFullName] = useState<string>(initialName);

  const trimmed = fullName.trim();
  const isDirty = trimmed !== initialName;

  const handleSave = async () => {
    if (!trimmed) {
      showError("Please enter your name");
      return;
    }
    try {
      await updateProfile.mutateAsync({ fullName: trimmed });
      showSuccess("Profile updated");
      router.back();
    } catch (error: any) {
      showError(
        error?.message ?? "Couldn't update your profile. Please try again."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1 px-6 pt-8">
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-primary-100 items-center justify-center">
            <Ionicons name="person" size={48} color="#1B998B" />
          </View>
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Full Name
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900"
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </View>

        <View className="mt-6">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Email</Text>
          <View className="flex-row items-center bg-gray-100 border border-gray-200 rounded-xl px-4 py-3.5">
            <Text className="flex-1 text-base text-gray-500">
              {user?.email}
            </Text>
            <Ionicons name="lock-closed" size={16} color="#9CA3AF" />
          </View>
          <Text className="text-xs text-gray-400 mt-1.5">
            Your email address can't be changed.
          </Text>
        </View>

        <Pressable
          role="button"
          className={`rounded-xl py-4 mt-8 ${
            isDirty ? "bg-primary-500 active:bg-primary-600" : "bg-gray-200"
          }`}
          onPress={handleSave}
          disabled={!isDirty || updateProfile.isPending}
        >
          {updateProfile.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className={`text-center font-semibold text-base ${
                isDirty ? "text-white" : "text-gray-400"
              }`}
            >
              Save Changes
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

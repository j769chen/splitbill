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
import { useCreateGroup } from "@/lib/queries/useGroups";
import { notify } from "@/lib/alert";

export default function CreateGroup() {
  const [name, setName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const createGroup = useCreateGroup();

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify("Invalid Email", "Please enter a valid email address");
      return;
    }
    if (memberEmails.includes(email)) {
      notify("Duplicate", "This email is already added");
      return;
    }
    setMemberEmails([...memberEmails, email]);
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    setMemberEmails(memberEmails.filter((e) => e !== email));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      notify("Error", "Please enter a group name");
      return;
    }
    try {
      await createGroup.mutateAsync({
        name: name.trim(),
        memberEmails,
      });
      router.back();
    } catch (error: any) {
      notify("Error", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1 px-6 pt-6">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Group Name
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900"
            placeholder="e.g., Trip to Japan"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        <View className="mt-6">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Add Members by Email
          </Text>
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900"
              placeholder="friend@example.com"
              placeholderTextColor="#9CA3AF"
              value={emailInput}
              onChangeText={setEmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={addEmail}
              returnKeyType="done"
            />
            <Pressable
              role="button"
              className="bg-primary-500 rounded-xl px-4 items-center justify-center active:bg-primary-600"
              onPress={addEmail}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {memberEmails.length > 0 && (
          <View className="mt-4 gap-2">
            {memberEmails.map((email) => (
              <View
                key={email}
                className="flex-row items-center bg-primary-50 rounded-xl px-4 py-3"
              >
                <Ionicons name="person-outline" size={18} color="#1B998B" />
                <Text className="flex-1 ml-2 text-sm text-gray-700">
                  {email}
                </Text>
                <Pressable role="button" onPress={() => removeEmail(email)}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          role="button"
          className="bg-primary-500 rounded-xl py-4 mt-8 active:bg-primary-600"
          onPress={handleCreate}
          disabled={createGroup.isPending}
        >
          {createGroup.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-center font-semibold text-base">
              Create Group
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

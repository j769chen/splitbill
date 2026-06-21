import { useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Button, Chip, IconButton, TextInput } from "react-native-paper";
import { useCreateGroup } from "@/lib/queries/useGroups";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";

export default function CreateGroup() {
  const theme = useAppTheme();
  const [name, setName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const createGroup = useCreateGroup();
  const { showError } = useSnackbar();

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Please enter a valid email address");
      return;
    }
    if (memberEmails.includes(email)) {
      showError("This email is already added");
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
      showError("Please enter a group name");
      return;
    }
    try {
      await createGroup.mutateAsync({
        name: name.trim(),
        memberEmails,
      });
      router.back();
    } catch (error: any) {
      showError(error?.message ?? "Couldn't create the group. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: theme.colors.background }}
    >
      <ScrollView className="flex-1 px-6 pt-6">
        <TextInput
          mode="outlined"
          label="Group Name"
          placeholder="e.g., Trip to Japan"
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <View className="mt-6">
          <View className="flex-row items-center gap-2">
            <TextInput
              mode="outlined"
              label="Add Members by Email"
              placeholder="friend@example.com"
              value={emailInput}
              onChangeText={setEmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
              onSubmitEditing={addEmail}
              returnKeyType="done"
              style={{ flex: 1 }}
            />
            <IconButton
              mode="contained"
              icon="plus"
              size={24}
              onPress={addEmail}
              containerColor={theme.colors.primary}
              iconColor={theme.colors.onPrimary}
            />
          </View>
        </View>

        {memberEmails.length > 0 && (
          <View className="mt-4 flex-row flex-wrap gap-2">
            {memberEmails.map((email) => (
              <Chip
                key={email}
                icon="account"
                onClose={() => removeEmail(email)}
              >
                {email}
              </Chip>
            ))}
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleCreate}
          loading={createGroup.isPending}
          disabled={createGroup.isPending}
          contentStyle={{ paddingVertical: 6 }}
          style={{ marginTop: 32 }}
        >
          Create Group
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Chip,
  IconButton,
  TextInput,
} from "react-native-paper";
import { useCheckEmailExists, useCreateGroup } from "@/lib/queries/useGroups";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";

export default function CreateGroup() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const createGroup = useCreateGroup();
  const checkEmail = useCheckEmailExists();
  const { showError } = useSnackbar();

  // Validates the current email input. Returns the verified email to add, an
  // empty string when there's nothing pending, or null when validation failed
  // (an error has already been shown to the user).
  const validatePendingEmail = async (): Promise<string | null> => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Please enter a valid email address");
      return null;
    }
    if (email === user?.email?.toLowerCase()) {
      showError("You're already a member of the group");
      return null;
    }
    if (memberEmails.includes(email)) {
      showError("This email is already added");
      return null;
    }
    try {
      const exists = await checkEmail.mutateAsync(email);
      if (!exists) {
        showError(`No SplitBill account found for ${email}`);
        return null;
      }
    } catch {
      showError("Couldn't verify this email. Please try again.");
      return null;
    }
    return email;
  };

  const addEmail = async () => {
    const email = await validatePendingEmail();
    if (!email) return;
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

    // Flush any email still sitting in the input so it isn't silently dropped.
    // If validation fails (invalid / non-existent account) we stop here rather
    // than quietly creating a one-person group.
    const pendingEmail = await validatePendingEmail();
    if (pendingEmail === null) return;

    const finalEmails = pendingEmail
      ? [...memberEmails, pendingEmail]
      : memberEmails;
    if (pendingEmail) {
      setMemberEmails(finalEmails);
      setEmailInput("");
    }

    try {
      await createGroup.mutateAsync({
        name: name.trim(),
        memberEmails: finalEmails,
      });
      router.back();
    } catch (error: any) {
      showError(error?.message ?? "Couldn't create the group. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <TextInput
          mode="outlined"
          label="Group Name"
          placeholder="e.g., Trip to Japan"
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
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
              editable={!checkEmail.isPending}
              style={{ flex: 1 }}
            />
            {checkEmail.isPending ? (
              <View
                style={{
                  width: 48,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : (
              <IconButton
                mode="contained"
                icon="plus"
                size={24}
                onPress={addEmail}
                containerColor={theme.colors.primary}
                iconColor={theme.colors.onPrimary}
              />
            )}
          </View>
        </View>

        {memberEmails.length > 0 && (
          <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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

import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { Button, Text, TextInput } from "react-native-paper";
import { useAddContact } from "@/lib/queries/useContacts";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";

export default function AddContact() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const addContact = useAddContact();
  const { showError, showSuccess } = useSnackbar();

  const handleAdd = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      showError("Please enter an email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      showError("Please enter a valid email address");
      return;
    }
    if (normalized === user?.email?.toLowerCase()) {
      showError("You can't add yourself as a contact");
      return;
    }

    try {
      await addContact.mutateAsync(normalized);
      showSuccess("Contact added");
      router.back();
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't add the contact. Please try again.")
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}
        >
          Add an existing SplitBill user by their email to start splitting
          one-on-one expenses.
        </Text>

        <TextInput
          mode="outlined"
          label="Email"
          placeholder="friend@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          autoFocus
        />

        <Button
          mode="contained"
          onPress={handleAdd}
          loading={addContact.isPending}
          disabled={addContact.isPending}
          contentStyle={{ paddingVertical: 6 }}
          style={{ marginTop: 32 }}
        >
          Add Contact
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

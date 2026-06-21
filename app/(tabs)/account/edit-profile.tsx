import { useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Avatar, Button, HelperText, TextInput } from "react-native-paper";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/lib/queries/useProfile";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { getErrorMessage } from "@/lib/utils";

export default function EditProfile() {
  const theme = useAppTheme();
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
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't update your profile. Please try again.")
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <Avatar.Icon
            size={96}
            icon="account"
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.onPrimaryContainer}
          />
        </View>

        <TextInput
          mode="outlined"
          label="Full Name"
          placeholder="Your name"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <View style={{ marginTop: 24 }}>
          <TextInput
            mode="outlined"
            label="Email"
            value={user?.email ?? ""}
            disabled
            right={<TextInput.Icon icon="lock" />}
          />
          <HelperText type="info" visible>
            Your email address can't be changed.
          </HelperText>
        </View>

        <Button
          mode="contained"
          onPress={handleSave}
          disabled={!isDirty || updateProfile.isPending}
          loading={updateProfile.isPending}
          contentStyle={{ paddingVertical: 6 }}
          style={{ marginTop: 24 }}
        >
          Save Changes
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

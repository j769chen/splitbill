import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, HelperText, TextInput } from "react-native-paper";
import { useAuth } from "@/lib/auth";
import { useUpdateProfile } from "@/lib/queries/useProfile";
import { useSnackbar } from "@/lib/snackbar";
import { getErrorMessage } from "@/lib/utils";
import { FormScreen } from "@/components/FormScreen";
import { ProfileAvatar } from "@/components/account/ProfileAvatar";

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
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't update your profile. Please try again.")
      );
    }
  };

  return (
    <FormScreen paddingTop={32}>
      <View style={{ alignItems: "center", marginBottom: 32 }}>
        <ProfileAvatar size={96} />
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
    </FormScreen>
  );
}

import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text } from "react-native-paper";
import { useGroup } from "@/lib/queries/useGroups";
import {
  useAddGroupMembers,
  useLookupUserByEmail,
} from "@/lib/queries/useGroups";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { MemberEmailInput } from "@/components/groups/MemberEmailInput";

export default function AddGroupMembers() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: group } = useGroup(groupId!);

  const [emailInput, setEmailInput] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);

  const addMembers = useAddGroupMembers();
  const lookupUserByEmail = useLookupUserByEmail();
  const { showError, showSuccess } = useSnackbar();

  const memberCount = group?.group_members?.length ?? 0;
  const existingMemberIds = (group?.group_members ?? []).map((m) => m.user_id);

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
      const profile = await lookupUserByEmail.mutateAsync(email);
      if (!profile) {
        showError(`No SplitBill account found for ${email}`);
        return null;
      }
      if (existingMemberIds.includes(profile.id)) {
        showError("This person is already a member of the group");
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

  const handleAddMembers = async () => {
    const pendingEmail = await validatePendingEmail();
    if (pendingEmail === null) return;

    const finalEmails = pendingEmail
      ? [...memberEmails, pendingEmail]
      : memberEmails;

    if (finalEmails.length === 0) {
      showError("Add at least one email to invite");
      return;
    }

    try {
      await addMembers.mutateAsync({
        groupId: groupId!,
        memberEmails: finalEmails,
        existingMemberIds,
      });
      showSuccess(finalEmails.length > 1 ? "Members added" : "Member added");
      router.back();
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't add members. Please try again.")
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
          variant="titleMedium"
          style={{ fontWeight: "bold", marginBottom: 4 }}
        >
          Add members
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {memberCount} member{memberCount === 1 ? "" : "s"} in this group
        </Text>

        <MemberEmailInput
          value={emailInput}
          onChangeText={setEmailInput}
          onAdd={addEmail}
          onRemove={removeEmail}
          emails={memberEmails}
          isPending={lookupUserByEmail.isPending}
        />

        <Button
          mode="contained"
          onPress={handleAddMembers}
          loading={addMembers.isPending}
          disabled={addMembers.isPending}
          contentStyle={{ paddingVertical: 6 }}
          style={{ marginTop: 32 }}
        >
          Add Members
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Divider, Text, TextInput } from "react-native-paper";
import { useGroup } from "@/lib/queries/useGroups";
import {
  useAddGroupMembers,
  useCheckEmailExists,
  useRenameGroup,
} from "@/lib/queries/useGroups";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { MemberEmailInput } from "@/components/groups/MemberEmailInput";

export default function ManageGroup() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: group } = useGroup(groupId!);

  const [name, setName] = useState(group?.name ?? "");
  const [emailInput, setEmailInput] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);

  const renameGroup = useRenameGroup();
  const addMembers = useAddGroupMembers();
  const checkEmail = useCheckEmailExists();
  const { showError, showSuccess } = useSnackbar();

  const memberCount = group?.group_members?.length ?? 0;
  const existingMemberIds = (group?.group_members ?? []).map((m) => m.user_id);

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showError("Please enter a group name");
      return;
    }
    if (trimmed === group?.name) {
      showError("That's already the group name");
      return;
    }
    try {
      await renameGroup.mutateAsync({ groupId: groupId!, name: trimmed });
      showSuccess("Group renamed");
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't rename the group. Please try again.")
      );
    }
  };

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
          style={{ fontWeight: "bold", marginBottom: 12 }}
        >
          Group name
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            mode="outlined"
            label="Group Name"
            value={name}
            onChangeText={setName}
            style={{ flex: 1 }}
          />
        </View>
        <Button
          mode="contained"
          onPress={handleRename}
          loading={renameGroup.isPending}
          disabled={renameGroup.isPending}
          contentStyle={{ paddingVertical: 4 }}
          style={{ marginTop: 16, alignSelf: "flex-start" }}
        >
          Save Name
        </Button>

        <Divider style={{ marginVertical: 28 }} />

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
          isPending={checkEmail.isPending}
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

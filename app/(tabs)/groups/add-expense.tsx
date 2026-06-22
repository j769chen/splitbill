import { useState } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { useGroup } from "@/lib/queries/useGroups";
import { useCreateExpense } from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { computeSplits, getErrorMessage } from "@/lib/utils";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
import { MemberSplitRow } from "@/components/groups/MemberSplitRow";
import { PaidByPicker } from "@/components/groups/PaidByPicker";
import type { SplitType } from "@/lib/types";

export default function AddExpense() {
  const theme = useAppTheme();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const { data: group } = useGroup(groupId!);
  const createExpense = useCreateExpense();
  const { showError } = useSnackbar();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(user?.id ?? "");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [excludedMemberIds, setExcludedMemberIds] = useState<string[]>([]);

  const members = group?.group_members ?? [];
  const selectedMembers = members
    .map((member) => member.user_id)
    .filter((userId) => !excludedMemberIds.includes(userId));
  const effectivePaidBy = paidBy || user?.id || "";
  const totalAmount = parseFloat(amount) || 0;

  const memberName = (member: { user_id: string; profiles?: { full_name?: string } | null }) =>
    member.profiles?.full_name ??
    (member.user_id === user?.id ? "You" : "Unknown");

  const toggleMember = (userId: string) => {
    setExcludedMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showError("Please enter a description");
      return;
    }
    if (!totalAmount || totalAmount <= 0) {
      showError("Please enter a valid amount");
      return;
    }
    if (selectedMembers.length === 0) {
      showError("Please select at least one member");
      return;
    }
    if (!effectivePaidBy) {
      showError("Please select who paid");
      return;
    }

    const result = computeSplits(
      splitType,
      totalAmount,
      selectedMembers,
      customSplits
    );
    if (!result.ok) {
      showError(result.error);
      return;
    }
    const splits = result.splits;

    try {
      await createExpense.mutateAsync({
        groupId: groupId!,
        paidBy: effectivePaidBy,
        amount: totalAmount,
        description: description.trim(),
        splitType,
        splits,
      });
      router.back();
    } catch (error) {
      showError(
        getErrorMessage(error, "Couldn't add the expense. Please try again.")
      );
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
          label="Description"
          placeholder="What was this expense for?"
          value={description}
          onChangeText={setDescription}
          autoFocus
        />

        <View style={{ marginTop: 16 }}>
          <TextInput
            mode="outlined"
            label="Amount ($)"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>

        <PaidByPicker
          members={members}
          paidBy={effectivePaidBy}
          onSelect={setPaidBy}
          getMemberName={memberName}
        />

        <View style={{ marginTop: 24 }}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
          >
            Split Type
          </Text>
          <SegmentedButtons
            value={splitType}
            onValueChange={(v) => setSplitType(v as SplitType)}
            buttons={[
              { value: "equal", label: "Equal" },
              { value: "exact", label: "Exact" },
              { value: "percentage", label: "%" },
            ]}
          />
        </View>

        <View style={{ marginTop: 24 }}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
          >
            Split between
          </Text>
          <View style={{ gap: 8 }}>
            {members.map((member) => {
              const isSelected = selectedMembers.includes(member.user_id);
              const perPerson =
                splitType === "equal" && isSelected && selectedMembers.length > 0
                  ? totalAmount / selectedMembers.length
                  : 0;

              return (
                <MemberSplitRow
                  key={member.user_id}
                  userId={member.user_id}
                  name={memberName(member)}
                  isSelected={isSelected}
                  splitType={splitType}
                  perPerson={perPerson}
                  totalAmount={totalAmount}
                  customValue={customSplits[member.user_id] || ""}
                  onToggle={toggleMember}
                  onChangeCustom={(userId: string, val: string) =>
                    setCustomSplits((prev) => ({ ...prev, [userId]: val }))
                  }
                />
              );
            })}
          </View>
        </View>

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={createExpense.isPending}
          disabled={createExpense.isPending}
          contentStyle={{ paddingVertical: 6 }}
          style={{ marginTop: 32, marginBottom: 32 }}
        >
          Add Expense
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

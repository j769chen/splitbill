import { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Button,
  Checkbox,
  Menu,
  SegmentedButtons,
  Text,
  TextInput,
  TouchableRipple,
} from "react-native-paper";
import { useGroup } from "@/lib/queries/useGroups";
import { useCreateExpense } from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { computeSplits, getErrorMessage } from "@/lib/utils";
import { useSnackbar } from "@/lib/snackbar";
import { useAppTheme } from "@/lib/theme";
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
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [paidByMenuVisible, setPaidByMenuVisible] = useState(false);

  const members = group?.group_members ?? [];
  const totalAmount = parseFloat(amount) || 0;

  const memberName = (member: { user_id: string; profiles?: { full_name?: string } | null }) =>
    member.profiles?.full_name ??
    (member.user_id === user?.id ? "You" : "Unknown");

  const paidByMember = members.find((m) => m.user_id === paidBy);
  const paidByLabel = paidByMember ? memberName(paidByMember) : "Select a person";

  useEffect(() => {
    if (group?.group_members) {
      setSelectedMembers(group.group_members.map((m) => m.user_id));
    }
  }, [group?.group_members]);

  useEffect(() => {
    if (user?.id && !paidBy) {
      setPaidBy(user.id);
    }
  }, [user?.id, paidBy]);

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
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
    if (!paidBy) {
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
        paidBy,
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

        <View style={{ marginTop: 24 }}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}
          >
            Paid by
          </Text>
          <Menu
            visible={paidByMenuVisible}
            onDismiss={() => setPaidByMenuVisible(false)}
            anchor={
              <TouchableRipple onPress={() => setPaidByMenuVisible(true)}>
                <View pointerEvents="none">
                  <TextInput
                    mode="outlined"
                    editable={false}
                    value={paidByLabel}
                    right={<TextInput.Icon icon="menu-down" />}
                  />
                </View>
              </TouchableRipple>
            }
          >
            {members.map((member) => (
              <Menu.Item
                key={member.user_id}
                title={memberName(member)}
                trailingIcon={
                  paidBy === member.user_id ? "check" : undefined
                }
                onPress={() => {
                  setPaidBy(member.user_id);
                  setPaidByMenuVisible(false);
                }}
              />
            ))}
          </Menu>
        </View>

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
              const name = memberName(member);
              const perPerson =
                splitType === "equal" && isSelected && selectedMembers.length > 0
                  ? totalAmount / selectedMembers.length
                  : 0;

              return (
                <View key={member.user_id}>
                  <TouchableRipple
                    onPress={() => toggleMember(member.user_id)}
                    borderless
                    style={{
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected
                        ? theme.colors.primary
                        : theme.colors.outline,
                      backgroundColor: isSelected
                        ? theme.colors.primaryContainer
                        : theme.colors.surface,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", padding: 12 }}>
                      <Checkbox
                        status={isSelected ? "checked" : "unchecked"}
                        onPress={() => toggleMember(member.user_id)}
                      />
                      <Text
                        variant="bodyMedium"
                        style={{
                          flex: 1,
                          marginLeft: 8,
                          fontWeight: "500",
                          color: isSelected
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurface,
                        }}
                      >
                        {name}
                      </Text>
                      {splitType === "equal" &&
                        isSelected &&
                        totalAmount > 0 && (
                          <Text
                            variant="bodyMedium"
                            style={{
                              fontWeight: "600",
                              color: theme.colors.primary,
                            }}
                          >
                            ${perPerson.toFixed(2)}
                          </Text>
                        )}
                    </View>
                  </TouchableRipple>

                  {isSelected && splitType !== "equal" && (
                    <TextInput
                      mode="outlined"
                      dense
                      style={{ marginTop: 4, marginLeft: 32 }}
                      placeholder={splitType === "percentage" ? "%" : "$0.00"}
                      value={customSplits[member.user_id] || ""}
                      onChangeText={(val) =>
                        setCustomSplits({
                          ...customSplits,
                          [member.user_id]: val,
                        })
                      }
                      keyboardType="decimal-pad"
                    />
                  )}
                </View>
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

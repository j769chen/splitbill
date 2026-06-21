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
  Chip,
  SegmentedButtons,
  Text,
  TextInput,
  TouchableRipple,
} from "react-native-paper";
import { useGroup } from "@/lib/queries/useGroups";
import { useCreateExpense } from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { getErrorMessage, splitEqual } from "@/lib/utils";
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

  const members = group?.group_members ?? [];
  const totalAmount = parseFloat(amount) || 0;

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

    let splits: { userId: string; amount: number }[];

    if (splitType === "equal") {
      const amounts = splitEqual(totalAmount, selectedMembers.length);
      splits = selectedMembers.map((userId, i) => ({
        userId,
        amount: amounts[i],
      }));
    } else if (splitType === "exact") {
      splits = selectedMembers.map((userId) => ({
        userId,
        amount: parseFloat(customSplits[userId] || "0"),
      }));
      const sum = splits.reduce((acc, s) => acc + s.amount, 0);
      if (Math.abs(sum - totalAmount) > 0.01) {
        showError(
          `Split amounts ($${sum.toFixed(2)}) don't add up to total ($${totalAmount.toFixed(2)})`
        );
        return;
      }
    } else {
      const pctSum = selectedMembers.reduce(
        (acc, userId) => acc + parseFloat(customSplits[userId] || "0"),
        0
      );
      if (Math.abs(pctSum - 100) > 0.01) {
        showError(
          `Percentages must add up to 100% (currently ${pctSum.toFixed(1)}%)`
        );
        return;
      }
      // Distribute by percentage, assigning any rounding remainder to the
      // last member so splits always sum exactly to the total.
      splits = selectedMembers.map((userId) => {
        const pct = parseFloat(customSplits[userId] || "0");
        return { userId, amount: Math.round(totalAmount * pct) / 100 };
      });
      const splitSum = splits.reduce((acc, s) => acc + s.amount, 0);
      const remainder = Math.round((totalAmount - splitSum) * 100) / 100;
      if (remainder !== 0 && splits.length > 0) {
        const last = splits[splits.length - 1];
        last.amount = Math.round((last.amount + remainder) * 100) / 100;
      }
    }

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {members.map((member) => (
                <Chip
                  key={member.user_id}
                  selected={paidBy === member.user_id}
                  showSelectedCheck={false}
                  onPress={() => setPaidBy(member.user_id)}
                >
                  {member.profiles?.full_name ??
                    (member.user_id === user?.id ? "You" : "Unknown")}
                </Chip>
              ))}
            </View>
          </ScrollView>
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
              const memberName =
                member.profiles?.full_name ??
                (member.user_id === user?.id ? "You" : "Unknown");
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
                        {memberName}
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

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useGroup } from "@/lib/queries/useGroups";
import { useCreateExpense } from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { splitEqual } from "@/lib/utils";
import type { SplitType } from "@/lib/types";

export default function AddExpense() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const { data: group } = useGroup(groupId!);
  const createExpense = useCreateExpense();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(user?.id ?? "");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customSplits, setCustomSplits] = useState<
    Record<string, string>
  >({});
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    group?.group_members.map((m) => m.user_id) ?? []
  );

  const members = group?.group_members ?? [];
  const totalAmount = parseFloat(amount) || 0;

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description");
      return;
    }
    if (!totalAmount || totalAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (selectedMembers.length === 0) {
      Alert.alert("Error", "Please select at least one member");
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
        Alert.alert(
          "Error",
          `Split amounts ($${sum.toFixed(2)}) don't add up to total ($${totalAmount.toFixed(2)})`
        );
        return;
      }
    } else {
      splits = selectedMembers.map((userId) => {
        const pct = parseFloat(customSplits[userId] || "0");
        return { userId, amount: Math.round(totalAmount * pct) / 100 };
      });
      const pctSum = selectedMembers.reduce(
        (acc, userId) => acc + parseFloat(customSplits[userId] || "0"),
        0
      );
      if (Math.abs(pctSum - 100) > 0.01) {
        Alert.alert("Error", `Percentages must add up to 100% (currently ${pctSum.toFixed(1)}%)`);
        return;
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
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1 px-6 pt-6">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Description
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900"
            placeholder="What was this expense for?"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            autoFocus
          />
        </View>

        <View className="mt-4">
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Amount ($)
          </Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-2xl font-bold text-gray-900"
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>

        <View className="mt-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Paid by
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {members.map((member) => (
                <TouchableOpacity
                  key={member.user_id}
                  className={`px-4 py-2 rounded-full border ${
                    paidBy === member.user_id
                      ? "bg-primary-500 border-primary-500"
                      : "bg-white border-gray-200"
                  }`}
                  onPress={() => setPaidBy(member.user_id)}
                >
                  <Text
                    className={`text-sm font-medium ${
                      paidBy === member.user_id
                        ? "text-white"
                        : "text-gray-700"
                    }`}
                  >
                    {member.profiles?.full_name ??
                      (member.user_id === user?.id ? "You" : "Unknown")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="mt-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Split Type
          </Text>
          <View className="flex-row gap-2">
            {(["equal", "exact", "percentage"] as SplitType[]).map((type) => (
              <TouchableOpacity
                key={type}
                className={`flex-1 py-2.5 rounded-xl border ${
                  splitType === type
                    ? "bg-primary-500 border-primary-500"
                    : "bg-white border-gray-200"
                }`}
                onPress={() => setSplitType(type)}
              >
                <Text
                  className={`text-center text-sm font-medium capitalize ${
                    splitType === type ? "text-white" : "text-gray-700"
                  }`}
                >
                  {type === "percentage" ? "%" : type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mt-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Split between
          </Text>
          <View className="gap-2">
            {members.map((member) => {
              const isSelected = selectedMembers.includes(member.user_id);
              const memberName =
                member.profiles?.full_name ??
                (member.user_id === user?.id ? "You" : "Unknown");
              const perPerson =
                splitType === "equal" && isSelected
                  ? totalAmount / selectedMembers.length
                  : 0;

              return (
                <View key={member.user_id}>
                  <TouchableOpacity
                    className={`flex-row items-center p-3 rounded-xl border ${
                      isSelected
                        ? "bg-primary-50 border-primary-200"
                        : "bg-white border-gray-200"
                    }`}
                    onPress={() => toggleMember(member.user_id)}
                  >
                    <Ionicons
                      name={
                        isSelected
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={22}
                      color={isSelected ? "#1B998B" : "#9CA3AF"}
                    />
                    <Text className="flex-1 ml-3 text-sm font-medium text-gray-700">
                      {memberName}
                    </Text>
                    {splitType === "equal" && isSelected && totalAmount > 0 && (
                      <Text className="text-sm text-primary-600 font-semibold">
                        ${perPerson.toFixed(2)}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {isSelected && splitType !== "equal" && (
                    <TextInput
                      className="mt-1 ml-8 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
                      placeholder={
                        splitType === "percentage" ? "%" : "$0.00"
                      }
                      placeholderTextColor="#9CA3AF"
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

        <TouchableOpacity
          className="bg-primary-500 rounded-xl py-4 mt-8 mb-8"
          onPress={handleSubmit}
          disabled={createExpense.isPending}
          activeOpacity={0.8}
        >
          {createExpense.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-center font-semibold text-base">
              Add Expense
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

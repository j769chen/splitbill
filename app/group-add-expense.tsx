import { useLocalSearchParams } from "expo-router";
import { useGroup } from "@/lib/queries/useGroups";
import {
  useCreateExpense,
  useExpenses,
  useUpdateExpense,
} from "@/lib/queries/useExpenses";
import { useAuth } from "@/lib/auth";
import { ExpenseFormScreen } from "@/components/ExpenseFormScreen";
import type { MemberWithProfile } from "@/lib/types";

export default function AddExpense() {
  const { groupId, expenseId } = useLocalSearchParams<{
    groupId: string;
    expenseId?: string;
  }>();
  const isEdit = !!expenseId;
  const { user } = useAuth();
  const { data: group } = useGroup(groupId);
  const { data: expenses } = useExpenses(groupId);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const existingExpense = isEdit
    ? expenses?.find((e) => e.id === expenseId)
    : undefined;

  const memberName = (member: MemberWithProfile) =>
    member.profiles?.full_name ??
    (member.user_id === user?.id ? "You" : "Unknown");

  return (
    <ExpenseFormScreen
      members={group?.group_members ?? []}
      memberName={memberName}
      baseCurrency={group?.currency ?? "USD"}
      baseCurrencyLabel="group currency"
      existingExpense={existingExpense}
      isEdit={isEdit}
      noMembersError="Please select at least one member"
      isPending={isEdit ? updateExpense.isPending : createExpense.isPending}
      onSubmit={(submission) =>
        isEdit && expenseId
          ? updateExpense.mutateAsync({ expenseId, groupId, ...submission })
          : createExpense.mutateAsync({ groupId, ...submission })
      }
    />
  );
}

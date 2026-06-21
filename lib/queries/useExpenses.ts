import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { ExpenseWithSplits, Profile, SplitType } from "../types";
import { useAuth } from "../auth";

export interface ActivityExpense {
  id: string;
  description: string;
  amount: number;
  date: string;
  paid_by: string;
  payer: Profile | null;
  groups: { name: string } | null;
}

// Recent expenses across every group the user belongs to. RLS limits results
// to groups the current user is a member of.
export function useRecentActivity() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["activity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          `
          id,
          description,
          amount,
          date,
          paid_by,
          payer:profiles!expenses_paid_by_fkey (*),
          groups (name)
        `
        )
        .order("date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as ActivityExpense[];
    },
    enabled: !!user,
  });
}

export function useExpenses(groupId: string) {
  return useQuery({
    queryKey: ["expenses", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          `
          *,
          payer:profiles!expenses_paid_by_fkey (*),
          expense_splits (
            *,
            profiles (*)
          )
        `
        )
        .eq("group_id", groupId)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as unknown as ExpenseWithSplits[];
    },
    enabled: !!groupId,
  });
}

interface CreateExpenseInput {
  groupId: string;
  paidBy: string;
  amount: number;
  description: string;
  category?: string;
  splitType: SplitType;
  splits: { userId: string; amount: number }[];
  date?: string;
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          group_id: input.groupId,
          paid_by: input.paidBy,
          amount: input.amount,
          description: input.description,
          category: input.category ?? null,
          split_type: input.splitType,
          date: input.date ?? new Date().toISOString(),
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      const expenseData = expense as any;

      const { error: splitsError } = await supabase
        .from("expense_splits")
        .insert(
          input.splits.map((s) => ({
            expense_id: expenseData.id,
            user_id: s.userId,
            amount: s.amount,
          }))
        );

      if (splitsError) throw splitsError;

      return expenseData;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["expenses", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["balances", variables.groupId],
      });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expenseId,
      groupId,
    }: {
      expenseId: string;
      groupId: string;
    }) => {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["expenses", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["balances", variables.groupId],
      });
    },
  });
}

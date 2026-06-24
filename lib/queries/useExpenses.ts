import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { ExpenseWithSplits, Profile, SplitType } from "../types";
import { useAuth } from "../auth";
import { convertSplitsToBase, validateSplitsTotal } from "../utils";

export interface ActivityExpense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  paid_by: string;
  payer: Profile | null;
  groups: { name: string } | null;
}

// Builds the RPC split payload, converting each split into the group/pair base
// currency at the given rate so the server can store base_amount per split.
function buildSplitsPayload(
  splits: { userId: string; amount: number }[],
  amount: number,
  rate: number
) {
  const baseTotal = Math.round(amount * rate * 100) / 100;
  return convertSplitsToBase(splits, rate, baseTotal).map((s) => ({
    userId: s.userId,
    amount: s.amount,
    baseAmount: s.baseAmount,
  }));
}

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
          currency,
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
  currency?: string;
  exchangeRate?: number;
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      const splitAmounts = input.splits.map((s) => s.amount);
      if (!validateSplitsTotal(input.amount, splitAmounts)) {
        throw new Error("Split amounts must add up to the expense total");
      }

      const rate = input.exchangeRate ?? 1;
      const { data: expense, error: expenseError } = await supabase.rpc(
        "create_expense_with_splits",
        {
          p_group_id: input.groupId,
          p_paid_by: input.paidBy,
          p_amount: input.amount,
          p_description: input.description,
          p_category: input.category ?? null,
          p_split_type: input.splitType,
          p_splits: buildSplitsPayload(input.splits, input.amount, rate),
          p_date: input.date ?? null,
          p_currency: input.currency ?? "USD",
          p_exchange_rate: rate,
        }
      );

      if (expenseError) throw expenseError;
      return expense;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["expenses", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["balances", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise-all", variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["activity", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

interface UpdateExpenseInput extends CreateExpenseInput {
  expenseId: string;
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateExpenseInput) => {
      const splitAmounts = input.splits.map((s) => s.amount);
      if (!validateSplitsTotal(input.amount, splitAmounts)) {
        throw new Error("Split amounts must add up to the expense total");
      }

      const rate = input.exchangeRate ?? 1;
      const { data: expense, error: expenseError } = await supabase.rpc(
        "update_expense_with_splits",
        {
          p_expense_id: input.expenseId,
          p_paid_by: input.paidBy,
          p_amount: input.amount,
          p_description: input.description,
          p_category: input.category ?? null,
          p_split_type: input.splitType,
          p_splits: buildSplitsPayload(input.splits, input.amount, rate),
          p_date: input.date ?? null,
          p_currency: input.currency ?? "USD",
          p_exchange_rate: rate,
        }
      );

      if (expenseError) throw expenseError;
      return expense;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["expenses", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["balances", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise-all", variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["activity", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
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
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise-all", variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

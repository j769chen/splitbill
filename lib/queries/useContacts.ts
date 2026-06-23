import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type {
  ContactExpenseWithSplits,
  ContactWithBalance,
  SplitType,
} from "../types";
import { useAuth } from "../auth";
import { validateSplitsTotal } from "../utils";

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function useContacts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_contacts_with_balances");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        balance: Number(row.balance),
      })) as ContactWithBalance[];
    },
    enabled: !!user,
  });
}

export function useContactBalance(contactUserId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-balance", user?.id, contactUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_contact_balance", {
        p_contact_user_id: contactUserId,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    enabled: !!user && !!contactUserId,
  });
}

export function useContactExpenses(contactUserId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-expenses", user?.id, contactUserId],
    queryFn: async () => {
      const [lo, hi] = sortPair(user!.id, contactUserId);

      const { data, error } = await supabase
        .from("contact_expenses")
        .select(
          `
          *,
          payer:profiles!contact_expenses_paid_by_fkey (*),
          expense_splits:contact_expense_splits (
            *,
            profiles (*)
          )
        `
        )
        .eq("user_lo", lo)
        .eq("user_hi", hi)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as unknown as ContactExpenseWithSplits[];
    },
    enabled: !!user && !!contactUserId,
  });
}

export function useAddContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const normalized = email.trim().toLowerCase();

      const { data: matches, error: lookupError } = await supabase.rpc(
        "get_user_ids_by_email",
        { emails: [normalized] }
      );
      if (lookupError) throw lookupError;

      const match = matches?.[0];
      if (!match) {
        throw new Error(`No SplitBill account found for ${normalized}`);
      }

      const { error } = await supabase.rpc("add_contact", {
        p_contact_user_id: match.id,
      });
      if (error) throw new Error(error.message);

      return match.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

interface CreateContactExpenseInput {
  contactUserId: string;
  paidBy: string;
  amount: number;
  description: string;
  category?: string;
  splitType: SplitType;
  splits: { userId: string; amount: number }[];
  date?: string;
}

export function useCreateContactExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateContactExpenseInput) => {
      const splitAmounts = input.splits.map((s) => s.amount);
      if (!validateSplitsTotal(input.amount, splitAmounts)) {
        throw new Error("Split amounts must add up to the expense total");
      }

      const { data: expense, error } = await supabase.rpc(
        "create_contact_expense_with_splits",
        {
          p_contact_user_id: input.contactUserId,
          p_paid_by: input.paidBy,
          p_amount: input.amount,
          p_description: input.description,
          p_category: input.category ?? null,
          p_split_type: input.splitType,
          p_splits: input.splits,
          p_date: input.date ?? null,
        }
      );

      if (error) throw error;
      return expense;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({
        queryKey: ["contact-expenses", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({
        queryKey: ["contact-balance", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useDeleteContactExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      expenseId,
    }: {
      expenseId: string;
      contactUserId: string;
    }) => {
      const { error } = await supabase
        .from("contact_expenses")
        .delete()
        .eq("id", expenseId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({
        queryKey: ["contact-expenses", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({
        queryKey: ["contact-balance", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

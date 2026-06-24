import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { PaymentWithProfiles, Profile } from "../types";
import { useAuth } from "../auth";

export interface ActivityPayment {
  id: string;
  amount: number;
  currency: string;
  created_at: string;
  paid_by: string;
  paid_to: string;
  note: string | null;
  payer: Profile | null;
  payee: Profile | null;
  groups: { name: string } | null;
}

export function useRecentPayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["activity-payments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          id,
          amount,
          currency,
          created_at,
          paid_by,
          paid_to,
          note,
          payer:profiles!payments_paid_by_fkey (*),
          payee:profiles!payments_paid_to_fkey (*),
          groups (name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as ActivityPayment[];
    },
    enabled: !!user,
  });
}

export function useGroupPayments(groupId: string) {
  return useQuery({
    queryKey: ["payments", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          *,
          payer:profiles!payments_paid_by_fkey (*),
          payee:profiles!payments_paid_to_fkey (*)
        `
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as PaymentWithProfiles[];
    },
    enabled: !!groupId,
  });
}

interface CreatePaymentInput {
  groupId: string;
  paidBy: string;
  paidTo: string;
  amount: number;
  note?: string;
  currency?: string;
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      // Settle-up payments are recorded in the group's base currency, so the
      // base amount equals the amount at a rate of 1.
      const { data, error } = await supabase
        .from("payments")
        .insert({
          group_id: input.groupId,
          paid_by: input.paidBy,
          paid_to: input.paidTo,
          amount: input.amount,
          note: input.note ?? null,
          currency: input.currency ?? "USD",
          exchange_rate: 1,
          base_amount: input.amount,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["balances", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise-all", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["payments", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["expenses", variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["activity-payments"] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

interface UpdatePaymentInput {
  paymentId: string;
  groupId: string;
  paidBy: string;
  paidTo: string;
  amount: number;
  note?: string;
  currency?: string;
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePaymentInput) => {
      const { data, error } = await supabase
        .from("payments")
        .update({
          paid_by: input.paidBy,
          paid_to: input.paidTo,
          amount: input.amount,
          note: input.note ?? null,
          ...(input.currency
            ? {
                currency: input.currency,
                exchange_rate: 1,
                base_amount: input.amount,
              }
            : { base_amount: input.amount }),
        })
        .eq("id", input.paymentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["balances", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise-all", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["payments", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["expenses", variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["activity-payments"] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
    }: {
      paymentId: string;
      groupId: string;
    }) => {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["payments", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["balances", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise-all", variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["activity-payments"] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-breakdown"] });
      queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

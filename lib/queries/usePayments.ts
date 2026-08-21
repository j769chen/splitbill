import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type {
  ActivityPayment,
  PaymentWithProfiles,
} from "../types";
import { useAuth } from "../auth";
import { invalidateGroupQueries } from "./invalidate";

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
          group_id,
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
      invalidateGroupQueries(queryClient, variables.groupId);
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
      invalidateGroupQueries(queryClient, variables.groupId);
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
      const { data, error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId)
        .select("id");

      if (error) throw error;
      if (!data?.length) {
        throw new Error("You can't delete this payment.");
      }
    },
    onSuccess: (_, variables) => {
      invalidateGroupQueries(queryClient, variables.groupId);
    },
  });
}

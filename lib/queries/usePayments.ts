import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { PaymentWithProfiles } from "../types";

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
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          group_id: input.groupId,
          paid_by: input.paidBy,
          paid_to: input.paidTo,
          amount: input.amount,
          note: input.note ?? null,
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
        queryKey: ["payments", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["expenses", variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
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
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
    },
  });
}

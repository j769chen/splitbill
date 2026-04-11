import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";

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
        queryKey: ["expenses", variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

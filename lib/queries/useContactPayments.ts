import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type {
  ActivityContactPayment,
  ContactPaymentWithProfiles,
} from "../types";
import { useAuth } from "../auth";
import { invalidateContactPairQueries } from "./invalidate";
import { sortPair } from "./contact-pair";

export function useRecentContactPayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-payments-activity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_payments")
        .select(
          `
          id,
          amount,
          currency,
          created_at,
          paid_by,
          paid_to,
          note,
          payer:profiles!contact_payments_paid_by_fkey (*),
          payee:profiles!contact_payments_paid_to_fkey (*)
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as ActivityContactPayment[];
    },
    enabled: !!user,
  });
}

export function useContactPayments(contactUserId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-payments", user?.id, contactUserId],
    queryFn: async () => {
      const [lo, hi] = sortPair(user!.id, contactUserId);

      const { data, error } = await supabase
        .from("contact_payments")
        .select(
          `
          *,
          payer:profiles!contact_payments_paid_by_fkey (*),
          payee:profiles!contact_payments_paid_to_fkey (*)
        `
        )
        .eq("user_lo", lo)
        .eq("user_hi", hi)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as ContactPaymentWithProfiles[];
    },
    enabled: !!user && !!contactUserId,
  });
}

interface CreateContactPaymentInput {
  contactUserId: string;
  paidBy: string;
  paidTo: string;
  amount: number;
  note?: string;
  currency?: string;
}

export function useCreateContactPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateContactPaymentInput) => {
      const [lo, hi] = sortPair(input.paidBy, input.paidTo);

      const { data, error } = await supabase
        .from("contact_payments")
        .insert({
          paid_by: input.paidBy,
          paid_to: input.paidTo,
          user_lo: lo,
          user_hi: hi,
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
      invalidateContactPairQueries(
        queryClient,
        user?.id,
        variables.contactUserId
      );
    },
  });
}

interface UpdateContactPaymentInput extends CreateContactPaymentInput {
  paymentId: string;
}

export function useUpdateContactPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateContactPaymentInput) => {
      const { data, error } = await supabase
        .from("contact_payments")
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
      invalidateContactPairQueries(
        queryClient,
        user?.id,
        variables.contactUserId
      );
    },
  });
}

export function useDeleteContactPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      paymentId,
    }: {
      paymentId: string;
      contactUserId: string;
    }) => {
      const { data, error } = await supabase
        .from("contact_payments")
        .delete()
        .eq("id", paymentId)
        .select("id");

      if (error) throw error;
      if (!data?.length) {
        throw new Error("You can't delete this payment.");
      }
    },
    onSuccess: (_, variables) => {
      invalidateContactPairQueries(
        queryClient,
        user?.id,
        variables.contactUserId
      );
    },
  });
}

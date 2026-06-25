import { useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { supabase } from "../supabase";
import type {
  ContactExpenseWithSplits,
  ContactGroupBreakdown,
  ContactPaymentWithProfiles,
  ContactRequest,
  ContactWithBalance,
  Profile,
  SplitType,
} from "../types";
import { useAuth } from "../auth";
import { convert } from "../currency";
import { useDisplayCurrency } from "../display-currency";
import { useExchangeRates } from "../exchange-rates";
import { convertSplitsToBase, validateSplitsTotal } from "../utils";

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

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

export interface ActivityContactExpense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  paid_by: string;
  user_lo: string;
  user_hi: string;
  payer: Profile | null;
  user_lo_profile: Profile | null;
  user_hi_profile: Profile | null;
}

export function useRecentContactActivity() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-activity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_expenses")
        .select(
          `
          id,
          description,
          amount,
          currency,
          date,
          paid_by,
          user_lo,
          user_hi,
          payer:profiles!contact_expenses_paid_by_fkey (*),
          user_lo_profile:profiles!contact_expenses_user_lo_fkey (*),
          user_hi_profile:profiles!contact_expenses_user_hi_fkey (*)
        `
        )
        .order("date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as ActivityContactExpense[];
    },
    enabled: !!user,
  });
}

export interface ActivityContactPayment {
  id: string;
  amount: number;
  currency: string;
  created_at: string;
  paid_by: string;
  paid_to: string;
  note: string | null;
  payer: Profile | null;
  payee: Profile | null;
}

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

interface ContactBalanceContextRow {
  contact_user_id: string;
  full_name: string;
  avatar_url: string | null;
  currency: string;
  balance: number;
  is_accepted: boolean;
}

export function useContacts() {
  const { user } = useAuth();
  const { currency: displayCurrency } = useDisplayCurrency();
  const { data: rates } = useExchangeRates();

  const query = useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: async (): Promise<ContactBalanceContextRow[]> => {
      const { data, error } = await supabase.rpc(
        "get_contacts_with_combined_balances"
      );
      if (error) throw error;
      return (data ?? []).map((row) => ({
        contact_user_id: row.contact_user_id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        currency: row.currency,
        balance: Number(row.balance),
        is_accepted: row.is_accepted,
      }));
    },
    enabled: !!user,
  });

  // Each contact has one row per currency context (1-on-1 ledger + each shared
  // group). Convert every piece to the display currency, then sum per contact.
  const contacts = useMemo<ContactWithBalance[]>(() => {
    const byContact = new Map<string, ContactWithBalance>();
    for (const row of query.data ?? []) {
      const existing = byContact.get(row.contact_user_id);
      const converted = convert(
        row.balance,
        row.currency,
        displayCurrency,
        rates
      );
      if (existing) {
        existing.balance += converted;
      } else {
        byContact.set(row.contact_user_id, {
          contact_user_id: row.contact_user_id,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
          balance: converted,
          is_accepted: row.is_accepted,
        });
      }
    }
    return Array.from(byContact.values()).map((c) => ({
      ...c,
      balance: Math.round(c.balance * 100) / 100,
    }));
  }, [query.data, rates, displayCurrency]);

  return { ...query, data: query.data ? contacts : undefined };
}

export function useContactBalance(contactUserId: string) {
  const { user } = useAuth();
  const { currency: displayCurrency } = useDisplayCurrency();
  const { data: rates } = useExchangeRates();

  const query = useQuery({
    queryKey: ["contact-balance", user?.id, contactUserId],
    queryFn: async (): Promise<{ currency: string; balance: number }[]> => {
      const { data, error } = await supabase.rpc(
        "get_contact_balance_contexts",
        {
          p_contact_user_id: contactUserId,
        }
      );
      if (error) throw error;
      return (data ?? []).map((row) => ({
        currency: row.currency,
        balance: Number(row.balance),
      }));
    },
    enabled: !!user && !!contactUserId,
  });

  // Combined balance: convert each per-currency context into the display
  // currency and sum.
  const balance = useMemo(() => {
    let total = 0;
    for (const ctx of query.data ?? []) {
      total += convert(ctx.balance, ctx.currency, displayCurrency, rates);
    }
    return Math.round(total * 100) / 100;
  }, [query.data, rates, displayCurrency]);

  return { ...query, data: query.data ? balance : undefined };
}

export function useContactPairBalance(contactUserId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-pair-balance", user?.id, contactUserId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_contact_balance", {
        p_contact_user_id: contactUserId,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    enabled: !!user && !!contactUserId,
  });
}

export function useContactGroupBreakdown(contactUserId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-group-breakdown", user?.id, contactUserId],
    queryFn: async (): Promise<ContactGroupBreakdown[]> => {
      const { data, error } = await supabase.rpc(
        "get_contact_group_breakdown",
        {
          p_contact_user_id: contactUserId,
        }
      );
      if (error) throw error;
      return (data ?? []).map((row) => ({
        group_id: row.group_id,
        group_name: row.group_name,
        balance: Number(row.balance),
        currency: row.currency,
      }));
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

function invalidateContactRequestQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["contact-requests"] });
  queryClient.invalidateQueries({ queryKey: ["contacts"] });
  queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
}

export function useSendContactRequest() {
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

      const { error } = await supabase.rpc("send_contact_request", {
        p_recipient_user_id: match.id,
      });
      if (error) throw new Error(error.message);

      return match.id;
    },
    onSuccess: () => {
      invalidateContactRequestQueries(queryClient);
    },
  });
}

export function useContactRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_contact_requests");
      if (error) throw error;

      const requests: ContactRequest[] = (data ?? []).map((row) => ({
        id: row.id,
        direction: row.direction,
        status: row.status,
        created_at: row.created_at,
        profile: {
          id: row.user_id,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
        },
      }));

      return {
        incoming: requests.filter((r) => r.direction === "incoming"),
        outgoing: requests.filter((r) => r.direction === "outgoing"),
      };
    },
    enabled: !!user,
  });
}

export function useRespondContactRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      accept,
    }: {
      requestId: string;
      accept: boolean;
    }) => {
      const { error } = await supabase.rpc("respond_contact_request", {
        p_request_id: requestId,
        p_accept: accept,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateContactRequestQueries(queryClient);
    },
  });
}

export function useCancelContactRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("cancel_contact_request", {
        p_request_id: requestId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidateContactRequestQueries(queryClient);
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
  currency?: string;
  exchangeRate?: number;
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

      const rate = input.exchangeRate ?? 1;
      const { data: expense, error } = await supabase.rpc(
        "create_contact_expense_with_splits",
        {
          p_contact_user_id: input.contactUserId,
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
      queryClient.invalidateQueries({
        queryKey: ["contact-pair-balance", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activity"] });
    },
  });
}

interface UpdateContactExpenseInput extends CreateContactExpenseInput {
  expenseId: string;
}

export function useUpdateContactExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateContactExpenseInput) => {
      const splitAmounts = input.splits.map((s) => s.amount);
      if (!validateSplitsTotal(input.amount, splitAmounts)) {
        throw new Error("Split amounts must add up to the expense total");
      }

      const rate = input.exchangeRate ?? 1;
      const { data: expense, error } = await supabase.rpc(
        "update_contact_expense_with_splits",
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
      queryClient.invalidateQueries({
        queryKey: ["contact-pair-balance", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activity"] });
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
      queryClient.invalidateQueries({
        queryKey: ["contact-pair-balance", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activity"] });
    },
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

function invalidateContactPaymentQueries(
  queryClient: QueryClient,
  userId: string | undefined,
  contactUserId: string
) {
  queryClient.invalidateQueries({ queryKey: ["contacts"] });
  queryClient.invalidateQueries({
    queryKey: ["contact-payments", userId, contactUserId],
  });
  queryClient.invalidateQueries({
    queryKey: ["contact-balance", userId, contactUserId],
  });
  queryClient.invalidateQueries({
    queryKey: ["contact-pair-balance", userId, contactUserId],
  });
  queryClient.invalidateQueries({ queryKey: ["total-balance"] });
  queryClient.invalidateQueries({ queryKey: ["contact-activity"] });
  queryClient.invalidateQueries({ queryKey: ["contact-payments-activity"] });
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
      invalidateContactPaymentQueries(
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
      invalidateContactPaymentQueries(
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
      const { error } = await supabase
        .from("contact_payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      invalidateContactPaymentQueries(
        queryClient,
        user?.id,
        variables.contactUserId
      );
    },
  });
}

export function useContactCurrency(contactUserId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-currency", user?.id, contactUserId],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("get_contact_currency", {
        p_contact_user_id: contactUserId,
      });
      if (error) throw error;
      return (data as string) ?? "USD";
    },
    enabled: !!user && !!contactUserId,
  });
}

export function useSetContactCurrency() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      contactUserId,
      currency,
    }: {
      contactUserId: string;
      currency: string;
    }) => {
      const { data, error } = await supabase.rpc("set_contact_currency", {
        p_contact_user_id: contactUserId,
        p_currency: currency,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["contact-currency", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({
        queryKey: ["contact-balance", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({
        queryKey: ["contact-pair-balance", user?.id, variables.contactUserId],
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
    },
  });
}

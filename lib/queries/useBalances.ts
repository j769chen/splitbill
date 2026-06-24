import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { GroupBalance } from "../types";
import { useAuth } from "../auth";
import { convert } from "../currency";
import { useDisplayCurrency } from "../display-currency";
import { useExchangeRates } from "../exchange-rates";

export function useGroupBalances(groupId: string) {
  return useQuery({
    queryKey: ["balances", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_balances", {
        p_group_id: groupId,
      });

      if (error) throw error;
      return (data ?? []) as GroupBalance[];
    },
    enabled: !!groupId,
  });
}

export function useMyGroupPairwiseBalances(groupId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["group-pairwise", groupId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_group_pairwise_balances_for_me",
        { p_group_id: groupId }
      );

      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        balance: Number(row.balance),
      })) as GroupBalance[];
    },
    enabled: !!user && !!groupId,
  });
}

export function useUserTotalBalance() {
  const { user } = useAuth();
  const { currency: displayCurrency } = useDisplayCurrency();
  const { data: rates } = useExchangeRates();

  const query = useQuery({
    queryKey: ["total-balance", user?.id],
    queryFn: async (): Promise<{ balance: number; currency: string }[]> => {
      const { data, error } = await supabase.rpc("get_user_total_balance", {
        p_user_id: user!.id,
      });

      if (error) throw error;
      return (data ?? []).map((row) => ({
        balance: Number(row.balance),
        currency: row.currency,
      }));
    },
    enabled: !!user,
  });

  // Each context's net is in its own currency. Convert to the display currency,
  // then fold positives into "owed" and negatives into "owing".
  const data = useMemo(() => {
    let totalOwed = 0;
    let totalOwing = 0;
    for (const ctx of query.data ?? []) {
      const converted = convert(ctx.balance, ctx.currency, displayCurrency, rates);
      if (converted > 0.005) totalOwed += converted;
      else if (converted < -0.005) totalOwing += -converted;
    }
    totalOwed = Math.round(totalOwed * 100) / 100;
    totalOwing = Math.round(totalOwing * 100) / 100;
    return {
      totalOwed,
      totalOwing,
      net: Math.round((totalOwed - totalOwing) * 100) / 100,
      displayCurrency,
    };
  }, [query.data, rates, displayCurrency]);

  return { ...query, data: query.data ? data : undefined };
}

export function useSetGroupCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      currency,
    }: {
      groupId: string;
      currency: string;
    }) => {
      const { data, error } = await supabase.rpc("set_group_currency", {
        p_group_id: groupId,
        p_currency: currency,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["balances", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
    },
  });
}

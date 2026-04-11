import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { GroupBalance } from "../types";
import { useAuth } from "../auth";

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

export function useUserTotalBalance() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["total-balance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_total_balance", {
        p_user_id: user!.id,
      });

      if (error) throw error;
      const result = (data as any)?.[0] ?? { total_owed: 0, total_owing: 0 };
      return {
        totalOwed: Number(result.total_owed),
        totalOwing: Number(result.total_owing),
        net: Number(result.total_owed) - Number(result.total_owing),
      };
    },
    enabled: !!user,
  });
}

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

let channelSeq = 0;

// Group expenses/payments feed the combined contact balance and the per-group
// breakdown, so realtime changes must refresh contact queries too.
function invalidateContactQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["contacts"] });
  queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
  queryClient.invalidateQueries({ queryKey: ["contact-group-breakdown"] });
}

export function useRealtimeSubscription(groupId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!groupId) return;

    const prefix = `realtime:group-${groupId}-`;
    for (const existing of supabase.getChannels()) {
      if (existing.topic.startsWith(prefix)) {
        supabase.removeChannel(existing);
      }
    }

    const channel = supabase
      .channel(`group-${groupId}-${channelSeq++}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
          queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
          queryClient.invalidateQueries({ queryKey: ["total-balance"] });
          invalidateContactQueries(queryClient);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expense_splits",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["expenses", groupId] });
          queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
          queryClient.invalidateQueries({ queryKey: ["total-balance"] });
          invalidateContactQueries(queryClient);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["payments", groupId] });
          queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
          queryClient.invalidateQueries({ queryKey: ["total-balance"] });
          invalidateContactQueries(queryClient);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["group", groupId] });
          queryClient.invalidateQueries({ queryKey: ["groups"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}

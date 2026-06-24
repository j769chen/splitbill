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

// Keeps the contact-requests list + badge live for the signed-in user.
//
// We intentionally do NOT use a server-side `filter` here. Supabase Realtime
// redacts the row payload via RLS before postgres_changes filters are applied,
// so a `recipient_id=eq.<id>` filter never matches (the record is `{}` to the
// subscriber) and no events arrive. Instead we listen to every change and let
// the follow-up query refetch under RLS, which mirrors how the group
// subscription invalidates on any event rather than trusting the payload.
export function useContactRequestsSubscription(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const prefix = "realtime:contact-requests-";
    for (const existing of supabase.getChannels()) {
      if (existing.topic.startsWith(prefix)) {
        supabase.removeChannel(existing);
      }
    }

    // Accepting a request creates the contacts pair, so refresh those too.
    const channel = supabase
      .channel(`contact-requests-${channelSeq++}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_requests",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["contact-requests"] });
          queryClient.invalidateQueries({ queryKey: ["contacts"] });
          queryClient.invalidateQueries({ queryKey: ["contact-balance"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
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
          queryClient.invalidateQueries({
            queryKey: ["group-pairwise-all", groupId],
          });
          queryClient.invalidateQueries({
            queryKey: ["group-simplified", groupId],
          });
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
          queryClient.invalidateQueries({
            queryKey: ["group-pairwise-all", groupId],
          });
          queryClient.invalidateQueries({
            queryKey: ["group-simplified", groupId],
          });
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
          queryClient.invalidateQueries({
            queryKey: ["group-pairwise-all", groupId],
          });
          queryClient.invalidateQueries({
            queryKey: ["group-simplified", groupId],
          });
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
          queryClient.invalidateQueries({ queryKey: ["balances", groupId] });
          queryClient.invalidateQueries({
            queryKey: ["group-pairwise-all", groupId],
          });
          queryClient.invalidateQueries({
            queryKey: ["group-simplified", groupId],
          });
          queryClient.invalidateQueries({ queryKey: ["total-balance"] });
          invalidateContactQueries(queryClient);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}

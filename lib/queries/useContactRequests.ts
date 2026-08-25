import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { ContactRequest } from "../types";
import { useAuth } from "../auth";
import { invalidateContactQueries } from "./invalidate";

function invalidateContactRequestQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["contact-requests"] });
  invalidateContactQueries(queryClient);
}

export function useSendContactRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      // The RPC resolves the address itself and raises when no account matches,
      // so the client never sees a user id for an arbitrary email.
      const { error } = await supabase.rpc("send_contact_request", {
        p_recipient_email: email.trim().toLowerCase(),
      });
      if (error) throw new Error(error.message);
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

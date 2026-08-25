import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type {
  ActivitySimplifyDebtsEvent,
  GroupWithMembers,
} from "../types";
import { useAuth } from "../auth";
import {
  invalidateActivityQueries,
  invalidateContactQueries,
  invalidateGroupQueries,
} from "./invalidate";

export function useGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["groups", user?.id],
    queryFn: async () => {
      const { data: memberships, error: membershipsError } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);

      if (membershipsError) throw membershipsError;

      const groupIds = memberships?.map((m) => m.group_id) ?? [];
      if (groupIds.length === 0) return [];

      const { data, error } = await supabase
        .from("groups")
        .select(
          `
          *,
          group_members (
            *,
            profiles (*)
          )
        `
        )
        .in("id", groupIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as GroupWithMembers[];
    },
    enabled: !!user,
  });
}

export function useGroup(groupId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select(
          `
          *,
          group_members (
            *,
            profiles (*)
          )
        `
        )
        .eq("id", groupId)
        .single();

      if (error) throw error;
      return data as unknown as GroupWithMembers;
    },
    enabled: !!groupId,
    initialData: () =>
      queryClient
        .getQueryData<GroupWithMembers[]>(["groups", user?.id])
        ?.find((g) => g.id === groupId),
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(["groups", user?.id])?.dataUpdatedAt,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      memberEmails,
      currency,
    }: {
      name: string;
      memberEmails: string[];
      currency?: string;
    }) => {
      // The RPC takes emails and resolves them itself, so the client never
      // handles a user id for an address the signed-in user just typed, and
      // the "does this account exist" check runs in the same transaction as
      // the insert instead of racing it.
      const { data: group, error } = await supabase.rpc(
        "create_group_with_members",
        {
          p_name: name,
          p_member_emails: memberEmails,
          p_currency: currency ?? "USD",
        }
      );

      if (error) throw new Error(error.message);

      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useAddGroupMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      memberEmails,
    }: {
      groupId: string;
      memberEmails: string[];
    }) => {
      // Unregistered addresses and people already in the group are reported by
      // the RPC, by email, so the caller still gets a named error.
      const { error } = await supabase.rpc("add_group_members", {
        p_group_id: groupId,
        p_member_emails: memberEmails,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      // New members change the simplified plan, so everything derived from the
      // group moves, including the contact surfaces.
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      invalidateGroupQueries(queryClient, variables.groupId);
    },
  });
}

export function useRenameGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      name,
    }: {
      groupId: string;
      name: string;
    }) => {
      const { data, error } = await supabase.rpc("rename_group", {
        p_group_id: groupId,
        p_name: name,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useRecentGroupSettingChanges() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["simplify-debts-activity", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_simplify_debts_events")
        .select(
          `
          id,
          group_id,
          actor_id,
          enabled,
          created_at,
          actor:profiles!group_simplify_debts_events_actor_id_fkey (*),
          groups (name)
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as ActivitySimplifyDebtsEvent[];
    },
    enabled: !!user,
  });
}

export function useSetGroupSimplifyDebts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      enabled,
    }: {
      groupId: string;
      enabled: boolean;
    }) => {
      const { data, error } = await supabase.rpc("set_group_simplify_debts", {
        p_group_id: groupId,
        p_enabled: enabled,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      // Simplification drives the contact surfaces and the activity feed too.
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      invalidateGroupQueries(queryClient, variables.groupId);
    },
  });
}

export function useCheckEmailExists() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("check_emails_registered", {
        p_emails: [email],
      });
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
}

// Whether an email can be invited to this group: 'ok', 'not_registered', or
// 'already_member'. The group is passed to the server rather than comparing
// ids on the client, because the lookup no longer returns a user id.
export function useCheckGroupMemberEmail() {
  return useMutation({
    mutationFn: async ({
      groupId,
      email,
    }: {
      groupId: string;
      email: string;
    }) => {
      const { data, error } = await supabase.rpc("check_group_member_email", {
        p_group_id: groupId,
        p_email: email,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      // Ownership transfer + deletion are done in a single SECURITY DEFINER
      // RPC so they happen atomically and bypass the groups UPDATE/DELETE RLS
      // edge cases (e.g. transferring created_by to another user).
      const { error } = await supabase.rpc("leave_group", {
        p_group_id: groupId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Leaving a group can drop group-mates (and their phantom simplified
      // debts) off the contact surfaces and the activity feed.
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      invalidateContactQueries(queryClient);
      invalidateActivityQueries(queryClient);
    },
  });
}

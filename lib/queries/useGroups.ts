import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { GroupWithMembers } from "../types";
import { useAuth } from "../auth";

export function useGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["groups", user?.id],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);

      const groupIds = memberships?.map((m: any) => m.group_id) ?? [];
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
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      name,
      memberEmails,
    }: {
      name: string;
      memberEmails: string[];
    }) => {
      const uniqueEmails = Array.from(
        new Set(memberEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))
      ).filter((e) => e !== user!.email?.toLowerCase());

      let inviteeIds: string[] = [];

      if (uniqueEmails.length > 0) {
        const { data: matches, error: lookupError } = await supabase.rpc(
          "get_user_ids_by_email",
          { emails: uniqueEmails }
        );

        if (lookupError) throw lookupError;

        const rows = (matches as { id: string; email: string }[] | null) ?? [];
        const resolvedEmails = new Set(
          rows.map((r) => r.email.toLowerCase())
        );
        const unresolved = uniqueEmails.filter(
          (e) => !resolvedEmails.has(e)
        );

        if (unresolved.length > 0) {
          throw new Error(
            `No SplitBill account found for: ${unresolved.join(", ")}`
          );
        }

        // Dedupe and exclude the creator so a duplicate id can't fail the
        // UNIQUE(group_id, user_id) batch insert.
        inviteeIds = Array.from(new Set(rows.map((r) => r.id))).filter(
          (id) => id !== user!.id
        );
      }

      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({ name, created_by: user!.id })
        .select()
        .single();

      if (groupError) throw groupError;

      const groupData = group as any;

      const { error: selfMemberError } = await supabase
        .from("group_members")
        .insert({ group_id: groupData.id, user_id: user!.id });

      if (selfMemberError) throw selfMemberError;

      if (inviteeIds.length > 0) {
        const { error: inviteError } = await supabase
          .from("group_members")
          .insert(
            inviteeIds.map((id) => ({
              group_id: groupData.id,
              user_id: id,
            }))
          );

        if (inviteError) throw inviteError;
      }

      return groupData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useCheckEmailExists() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("get_user_ids_by_email", {
        emails: [email],
      });
      if (error) throw error;
      return ((data as { id: string; email: string }[] | null)?.length ?? 0) > 0;
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
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
    },
  });
}

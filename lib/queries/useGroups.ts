import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { GroupWithMembers } from "../types";
import { useAuth } from "../auth";

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

        const rows = matches ?? [];
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

      const { data: group, error: groupError } = await supabase.rpc(
        "create_group_with_members",
        { p_name: name, p_member_ids: inviteeIds }
      );

      if (groupError) throw groupError;
      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useAddGroupMembers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      groupId,
      memberEmails,
      existingMemberIds = [],
    }: {
      groupId: string;
      memberEmails: string[];
      existingMemberIds?: string[];
    }) => {
      const uniqueEmails = Array.from(
        new Set(memberEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))
      ).filter((e) => e !== user!.email?.toLowerCase());

      if (uniqueEmails.length === 0) {
        throw new Error("Add at least one other person's email");
      }

      const { data: matches, error: lookupError } = await supabase.rpc(
        "get_user_ids_by_email",
        { emails: uniqueEmails }
      );
      if (lookupError) throw lookupError;

      const rows = matches ?? [];
      const resolvedEmails = new Set(rows.map((r) => r.email.toLowerCase()));
      const unresolved = uniqueEmails.filter((e) => !resolvedEmails.has(e));

      if (unresolved.length > 0) {
        throw new Error(
          `No SplitBill account found for: ${unresolved.join(", ")}`
        );
      }

      // Block people who already belong to the group before hitting the RPC so
      // the user gets a clear, named error instead of a silent no-op.
      const existing = new Set(existingMemberIds);
      const alreadyMembers = rows.filter((r) => existing.has(r.id));
      if (alreadyMembers.length > 0) {
        throw new Error(
          `Already in this group: ${alreadyMembers
            .map((r) => r.email)
            .join(", ")}`
        );
      }

      const memberIds = Array.from(new Set(rows.map((r) => r.id))).filter(
        (id) => id !== user!.id
      );

      const { error } = await supabase.rpc("add_group_members", {
        p_group_id: groupId,
        p_member_ids: memberIds,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group", variables.groupId] });
      queryClient.invalidateQueries({
        queryKey: ["balances", variables.groupId],
      });
      queryClient.invalidateQueries({
        queryKey: ["group-pairwise", variables.groupId],
      });
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

export function useCheckEmailExists() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("get_user_ids_by_email", {
        emails: [email],
      });
      if (error) throw error;
      return (data?.length ?? 0) > 0;
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

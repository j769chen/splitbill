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
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({ name, created_by: user!.id })
        .select()
        .single();

      if (groupError) throw groupError;

      const groupData = group as any;

      await supabase
        .from("group_members")
        .insert({ group_id: groupData.id, user_id: user!.id });

      if (memberEmails.length > 0) {
        const { data: userIds } = await supabase.rpc(
          "get_user_ids_by_email",
          { emails: memberEmails }
        );

        if (userIds && (userIds as any[]).length > 0) {
          await supabase.from("group_members").insert(
            (userIds as any[]).map((u: any) => ({
              group_id: groupData.id,
              user_id: u.id,
            }))
          );
        }
      }

      return groupData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const uid = user!.id;

      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("user_id, joined_at")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true });

      if (membersError) throw membersError;

      const others = (members ?? []).filter((m: any) => m.user_id !== uid);

      // Last member out: delete the whole group (cascades members/expenses/etc.)
      if (others.length === 0) {
        const { error } = await supabase
          .from("groups")
          .delete()
          .eq("id", groupId);
        if (error) throw error;
        return;
      }

      // If the leaving user owns the group, hand ownership to the earliest
      // remaining member so the group isn't left orphaned.
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("created_by")
        .eq("id", groupId)
        .single();

      if (groupError) throw groupError;

      if ((group as any).created_by === uid) {
        const { error: transferError } = await supabase
          .from("groups")
          .update({ created_by: (others[0] as any).user_id })
          .eq("id", groupId);
        if (transferError) throw transferError;
      }

      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", uid);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
    },
  });
}

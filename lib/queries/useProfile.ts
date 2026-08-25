import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth";

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  return useMutation({
    mutationFn: async ({ fullName }: { fullName: string }) => {
      const { error: profileError } = await supabase.rpc("update_profile", {
        p_full_name: fullName,
      });
      if (profileError) throw new Error(profileError.message);

      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (authError) throw authError;
    },
    onSuccess: async () => {
      await refreshUser();
      // The display name is denormalised into every list that joins profiles.
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["contact-payments"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["activity-payments"] });
      queryClient.invalidateQueries({ queryKey: ["contact-activity"] });
      queryClient.invalidateQueries({
        queryKey: ["contact-payments-activity"],
      });
    },
  });
}

-- Drop get_group_pairwise_balances_for_me. The members card now derives each
-- member's balance from the simplify-aware debt edges (get_group_balances +
-- get_group_pairwise_balances), so this per-caller RPC has no remaining callers.

drop function if exists "public"."get_group_pairwise_balances_for_me"(p_group_id uuid);

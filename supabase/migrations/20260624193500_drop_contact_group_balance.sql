-- Drop the unused get_contact_group_balance aggregate. It has no callers: the
-- current contact balance comes from get_contact_balance (1-on-1) plus the
-- per-group get_contact_group_breakdown via get_contact_balance_contexts.

drop function if exists public.get_contact_group_balance(p_contact_user_id uuid);

-- ============================================================
-- Fix: group creation fails with
--   insert or update on table "group_members" violates foreign
--   key constraint "group_members_user_id_fkey"
--
-- group_members.user_id references public.profiles(id), but the
-- invite lookup (get_user_ids_by_email) returned ids straight from
-- auth.users. Any auth user without a matching profile row (e.g.
-- created before the on_auth_user_created trigger existed, or for
-- whom the trigger did not fire) caused the FK insert to fail.
--
-- This migration:
--   1. Backfills profiles for every existing auth user missing one.
--   2. Hardens get_user_ids_by_email to only return users that
--      actually have a profile, so a missing profile can never again
--      crash group creation (the invitee is simply skipped).
-- ============================================================

-- 1. Backfill missing profiles from auth.users.
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'User'),
  au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 2. Only return ids that have a profile, so invitable === insertable.
CREATE OR REPLACE FUNCTION public.get_user_ids_by_email(emails TEXT[])
RETURNS TABLE (id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT au.id
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE au.email = ANY(emails);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

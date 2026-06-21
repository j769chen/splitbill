-- ============================================================
-- Make get_user_ids_by_email also return the matched email.
--
-- group creation resolves invitee emails to user ids before
-- inserting the group. Returning the email alongside the id lets
-- the client tell exactly which invited emails had no SplitBill
-- account, so it can report them instead of silently creating a
-- one-person group.
--
-- The return type changes, so the function must be dropped first
-- (CREATE OR REPLACE cannot change a function's return type).
-- ============================================================

DROP FUNCTION IF EXISTS public.get_user_ids_by_email(TEXT[]);

CREATE FUNCTION public.get_user_ids_by_email(emails TEXT[])
RETURNS TABLE (id UUID, email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email::TEXT
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE au.email = ANY(emails);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

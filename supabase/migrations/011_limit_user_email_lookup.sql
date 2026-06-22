-- ============================================================
-- Limit auth.users email lookup batches.
--
-- The invite flow needs this RPC to resolve candidate group members,
-- but SECURITY DEFINER access to auth.users should not allow bulk
-- account enumeration.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_ids_by_email(emails TEXT[])
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF array_length(emails, 1) > 20 THEN
    RAISE EXCEPTION 'Too many emails requested';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email::TEXT
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE au.email = ANY(emails);
END;
$$;

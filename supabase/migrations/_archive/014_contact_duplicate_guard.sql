-- ============================================================
-- Reject adding a contact that the caller already has.
--
-- Previously add_contact silently no-opped on a duplicate
-- (ON CONFLICT DO NOTHING). Now it raises so the UI can tell the
-- user the contact is already added. The reciprocal entry still
-- upserts, since the other user may already have the caller.
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_contact(p_contact_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_contact_user_id IS NULL OR p_contact_user_id = v_uid THEN
    RAISE EXCEPTION 'You cannot add yourself as a contact';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_contact_user_id) THEN
    RAISE EXCEPTION 'Contact user does not exist';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contacts
    WHERE owner_id = v_uid AND contact_user_id = p_contact_user_id
  ) THEN
    RAISE EXCEPTION 'This contact is already added';
  END IF;

  INSERT INTO public.contacts (owner_id, contact_user_id)
  VALUES (v_uid, p_contact_user_id);

  INSERT INTO public.contacts (owner_id, contact_user_id)
  VALUES (p_contact_user_id, v_uid)
  ON CONFLICT (owner_id, contact_user_id) DO NOTHING;
END;
$$;

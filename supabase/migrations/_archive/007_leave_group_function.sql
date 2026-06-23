-- ============================================================
-- Fix: leaving a group fails with
--   new row violates row-level security policy for table "groups"
--
-- When the group creator leaves while other members remain, the
-- client transferred ownership with an UPDATE on groups. The
-- "Group creator can update group" policy only has a USING clause,
-- which Postgres also applies as the WITH CHECK on the new row. The
-- transfer sets created_by to a DIFFERENT user, so the new row fails
-- auth.uid() = created_by and the update is rejected.
--
-- Rather than loosen RLS, perform the entire leave operation in one
-- SECURITY DEFINER function so the membership check, ownership
-- transfer, and deletions happen atomically and bypass these RLS
-- edge cases. auth.uid() still resolves to the calling user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.leave_group(p_group_id UUID)
RETURNS VOID AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_other_count INT;
  v_created_by UUID;
  v_new_owner UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'You are not a member of this group';
  END IF;

  SELECT COUNT(*) INTO v_other_count
  FROM public.group_members
  WHERE group_id = p_group_id AND user_id <> v_uid;

  -- Last member out: remove the whole group (cascades members/expenses/etc.)
  IF v_other_count = 0 THEN
    DELETE FROM public.groups WHERE id = p_group_id;
    RETURN;
  END IF;

  -- Hand ownership to the earliest-joined remaining member before leaving
  -- so the group isn't orphaned.
  SELECT created_by INTO v_created_by FROM public.groups WHERE id = p_group_id;

  IF v_created_by = v_uid THEN
    SELECT user_id INTO v_new_owner
    FROM public.group_members
    WHERE group_id = p_group_id AND user_id <> v_uid
    ORDER BY joined_at ASC
    LIMIT 1;

    UPDATE public.groups SET created_by = v_new_owner WHERE id = p_group_id;
  END IF;

  DELETE FROM public.group_members
  WHERE group_id = p_group_id AND user_id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

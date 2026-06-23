-- ============================================================
-- Fix: payment signs in get_group_balances
-- Run this if you already applied the earlier setup/migrations.
--
-- balance > 0 means "this user is owed money".
--   - paying an expense           -> +paid
--   - your share of an expense     -> -owed
--   - sending a settle-up payment  -> +sent      (you reduce what you owe)
--   - receiving a settle-up payment-> -received  (you reduce what you're owed)
--
-- The original function used "+ received - sent", which moved balances the
-- wrong way when settling up (it doubled the debt instead of clearing it).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_group_balances(p_group_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  balance NUMERIC(12, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gm.user_id,
    p.full_name,
    COALESCE(paid.total_paid, 0)
      - COALESCE(owed.total_owed, 0)
      + COALESCE(sent.total_sent, 0)
      - COALESCE(received.total_received, 0)
    AS balance
  FROM public.group_members gm
  JOIN public.profiles p ON p.id = gm.user_id
  LEFT JOIN (
    SELECT e.paid_by AS uid, SUM(e.amount) AS total_paid
    FROM public.expenses e WHERE e.group_id = p_group_id GROUP BY e.paid_by
  ) paid ON paid.uid = gm.user_id
  LEFT JOIN (
    SELECT es.user_id AS uid, SUM(es.amount) AS total_owed
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    WHERE e.group_id = p_group_id GROUP BY es.user_id
  ) owed ON owed.uid = gm.user_id
  LEFT JOIN (
    SELECT py.paid_to AS uid, SUM(py.amount) AS total_received
    FROM public.payments py WHERE py.group_id = p_group_id GROUP BY py.paid_to
  ) received ON received.uid = gm.user_id
  LEFT JOIN (
    SELECT py.paid_by AS uid, SUM(py.amount) AS total_sent
    FROM public.payments py WHERE py.group_id = p_group_id GROUP BY py.paid_by
  ) sent ON sent.uid = gm.user_id
  WHERE gm.group_id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

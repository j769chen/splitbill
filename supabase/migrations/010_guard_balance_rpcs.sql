-- ============================================================
-- Guard SECURITY DEFINER balance RPCs.
--
-- These functions bypass table RLS, so they must enforce the same
-- caller authorization before returning financial data.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_group_balances(p_group_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  balance NUMERIC(12, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_group_member(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not a member of this group';
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.get_user_total_balance(p_user_id UUID)
RETURNS TABLE (
  total_owed NUMERIC(12, 2),
  total_owing NUMERIC(12, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only view your own total balance';
  END IF;

  RETURN QUERY
  WITH user_groups AS (
    SELECT group_id FROM public.group_members WHERE user_id = p_user_id
  ),
  balances AS (
    SELECT gb.balance
    FROM user_groups ug
    CROSS JOIN LATERAL public.get_group_balances(ug.group_id) gb
    WHERE gb.user_id = p_user_id
  )
  SELECT
    COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS total_owed,
    COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) AS total_owing
  FROM balances;
END;
$$;

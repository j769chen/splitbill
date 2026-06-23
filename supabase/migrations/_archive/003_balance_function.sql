-- ============================================================
-- Balance Calculation Functions
-- ============================================================

-- Get net balance for each member in a group
-- Positive = owed money (others owe them)
-- Negative = owes money (they owe others)
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
  -- Total amount this user paid for expenses in the group
  LEFT JOIN (
    SELECT e.paid_by AS uid, SUM(e.amount) AS total_paid
    FROM public.expenses e
    WHERE e.group_id = p_group_id
    GROUP BY e.paid_by
  ) paid ON paid.uid = gm.user_id
  -- Total amount this user owes from expense splits
  LEFT JOIN (
    SELECT es.user_id AS uid, SUM(es.amount) AS total_owed
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    WHERE e.group_id = p_group_id
    GROUP BY es.user_id
  ) owed ON owed.uid = gm.user_id
  -- Total payments received by this user
  LEFT JOIN (
    SELECT py.paid_to AS uid, SUM(py.amount) AS total_received
    FROM public.payments py
    WHERE py.group_id = p_group_id
    GROUP BY py.paid_to
  ) received ON received.uid = gm.user_id
  -- Total payments sent by this user
  LEFT JOIN (
    SELECT py.paid_by AS uid, SUM(py.amount) AS total_sent
    FROM public.payments py
    WHERE py.group_id = p_group_id
    GROUP BY py.paid_by
  ) sent ON sent.uid = gm.user_id
  WHERE gm.group_id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get total balance summary for a user across all groups
CREATE OR REPLACE FUNCTION public.get_user_total_balance(p_user_id UUID)
RETURNS TABLE (
  total_owed NUMERIC(12, 2),
  total_owing NUMERIC(12, 2)
) AS $$
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to look up user IDs by email (used when adding members)
CREATE OR REPLACE FUNCTION public.get_user_ids_by_email(emails TEXT[])
RETURNS TABLE (id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT au.id
  FROM auth.users au
  WHERE au.email = ANY(emails);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

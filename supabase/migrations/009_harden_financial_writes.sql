-- ============================================================
-- Harden financial writes and make multi-step writes atomic.
-- ============================================================

ALTER FUNCTION public.is_group_member(UUID, UUID) SET search_path = public;
ALTER FUNCTION public.get_group_balances(UUID) SET search_path = public;
ALTER FUNCTION public.get_user_total_balance(UUID) SET search_path = public;
ALTER FUNCTION public.get_user_ids_by_email(TEXT[]) SET search_path = public;
ALTER FUNCTION public.leave_group(UUID) SET search_path = public;

DROP POLICY IF EXISTS "Members can create expenses" ON public.expenses;
CREATE POLICY "Members can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND public.is_group_member(group_id, paid_by)
  );

DROP POLICY IF EXISTS "Members can create expense splits" ON public.expense_splits;
CREATE POLICY "Members can create expense splits"
  ON public.expense_splits FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT e.id
      FROM public.expenses e
      WHERE public.is_group_member(e.group_id, auth.uid())
        AND public.is_group_member(e.group_id, user_id)
    )
  );

DROP POLICY IF EXISTS "Members can create payments" ON public.payments;
CREATE POLICY "Members can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    AND public.is_group_member(group_id, paid_by)
    AND public.is_group_member(group_id, paid_to)
    AND (auth.uid() = paid_by OR auth.uid() = paid_to)
  );

CREATE OR REPLACE FUNCTION public.create_group_with_members(
  p_name TEXT,
  p_member_ids UUID[] DEFAULT '{}'
)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_group public.groups;
  v_member_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF btrim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  INSERT INTO public.groups (name, created_by)
  VALUES (btrim(p_name), v_uid)
  RETURNING * INTO v_group;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group.id, v_uid);

  FOREACH v_member_id IN ARRAY COALESCE(p_member_ids, '{}'::UUID[])
  LOOP
    IF v_member_id <> v_uid THEN
      INSERT INTO public.group_members (group_id, user_id)
      VALUES (v_group.id, v_member_id)
      ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_group;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_expense_with_splits(
  p_group_id UUID,
  p_paid_by UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_category TEXT,
  p_split_type public.split_type,
  p_splits JSONB,
  p_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_expense public.expenses;
  v_split JSONB;
  v_split_user UUID;
  v_split_amount NUMERIC(12, 2);
  v_split_total NUMERIC(12, 2) := 0;
  v_split_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_group_member(p_group_id, v_uid) THEN
    RAISE EXCEPTION 'You are not a member of this group';
  END IF;

  IF NOT public.is_group_member(p_group_id, p_paid_by) THEN
    RAISE EXCEPTION 'Expense payer must be a group member';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  IF btrim(COALESCE(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Expense description is required';
  END IF;

  FOR v_split IN SELECT value FROM jsonb_array_elements(COALESCE(p_splits, '[]'::jsonb))
  LOOP
    v_split_user := (v_split->>'userId')::UUID;
    v_split_amount := round((v_split->>'amount')::NUMERIC, 2);

    IF v_split_amount < 0 THEN
      RAISE EXCEPTION 'Split amount cannot be negative';
    END IF;

    IF NOT public.is_group_member(p_group_id, v_split_user) THEN
      RAISE EXCEPTION 'Every split user must be a group member';
    END IF;

    v_split_count := v_split_count + 1;
    v_split_total := v_split_total + v_split_amount;
  END LOOP;

  IF v_split_count = 0 THEN
    RAISE EXCEPTION 'At least one split is required';
  END IF;

  IF v_split_total <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Split amounts must add up to the expense total';
  END IF;

  INSERT INTO public.expenses (
    group_id,
    paid_by,
    amount,
    description,
    category,
    split_type,
    date
  )
  VALUES (
    p_group_id,
    p_paid_by,
    round(p_amount, 2),
    btrim(p_description),
    p_category,
    p_split_type,
    COALESCE(p_date, now())
  )
  RETURNING * INTO v_expense;

  FOR v_split IN SELECT value FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO public.expense_splits (expense_id, user_id, amount)
    VALUES (
      v_expense.id,
      (v_split->>'userId')::UUID,
      round((v_split->>'amount')::NUMERIC, 2)
    );
  END LOOP;

  RETURN v_expense;
END;
$$;

-- ============================================================
-- Contacts and one-on-one contact expenses.
--
-- A contact is an existing SplitBill user you have connected with.
-- A contact expense is a 1-on-1 split between you and that contact.
-- The participant pair is stored normalized (user_lo < user_hi) so a
-- single row is shared by both sides regardless of who created it.
-- ============================================================

-- Contacts (directed friend-list entry; add_contact inserts both directions)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_user_id),
  CHECK (owner_id <> contact_user_id)
);

-- Contact expenses (one-on-one)
CREATE TABLE public.contact_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_lo UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_hi UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT,
  split_type public.split_type NOT NULL DEFAULT 'equal',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_lo < user_hi)
);

-- Per-participant share of each contact expense
CREATE TABLE public.contact_expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.contact_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  UNIQUE (expense_id, user_id)
);

-- Indexes
CREATE INDEX idx_contacts_owner ON public.contacts(owner_id);
CREATE INDEX idx_contacts_contact_user ON public.contacts(contact_user_id);
CREATE INDEX idx_contact_expenses_paid_by ON public.contact_expenses(paid_by);
CREATE INDEX idx_contact_expenses_user_lo ON public.contact_expenses(user_lo);
CREATE INDEX idx_contact_expenses_user_hi ON public.contact_expenses(user_hi);
CREATE INDEX idx_contact_expense_splits_expense ON public.contact_expense_splits(expense_id);
CREATE INDEX idx_contact_expense_splits_user ON public.contact_expense_splits(user_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_expense_splits ENABLE ROW LEVEL SECURITY;

-- Helper to check contact-expense participation WITHOUT triggering RLS on
-- contact_expense_splits, mirroring is_group_member.
CREATE OR REPLACE FUNCTION public.is_contact_participant(
  p_expense_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.contact_expenses ce
    WHERE ce.id = p_expense_id
      AND (ce.user_lo = p_user_id OR ce.user_hi = p_user_id)
  );
$$;

-- ---- CONTACTS ----

CREATE POLICY "Users can view their contacts"
  ON public.contacts FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can add their contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can remove their contacts"
  ON public.contacts FOR DELETE
  USING (owner_id = auth.uid());

-- ---- CONTACT EXPENSES ----

CREATE POLICY "Participants can view contact expenses"
  ON public.contact_expenses FOR SELECT
  USING (auth.uid() = user_lo OR auth.uid() = user_hi);

CREATE POLICY "Participants can create contact expenses"
  ON public.contact_expenses FOR INSERT
  WITH CHECK (
    (auth.uid() = user_lo OR auth.uid() = user_hi)
    AND (paid_by = user_lo OR paid_by = user_hi)
  );

CREATE POLICY "Payer can update contact expenses"
  ON public.contact_expenses FOR UPDATE
  USING (auth.uid() = paid_by);

CREATE POLICY "Payer can delete contact expenses"
  ON public.contact_expenses FOR DELETE
  USING (auth.uid() = paid_by);

-- ---- CONTACT EXPENSE SPLITS ----

CREATE POLICY "Participants can view contact expense splits"
  ON public.contact_expense_splits FOR SELECT
  USING (public.is_contact_participant(expense_id, auth.uid()));

CREATE POLICY "Participants can create contact expense splits"
  ON public.contact_expense_splits FOR INSERT
  WITH CHECK (public.is_contact_participant(expense_id, auth.uid()));

CREATE POLICY "Payer can update contact expense splits"
  ON public.contact_expense_splits FOR UPDATE
  USING (
    expense_id IN (
      SELECT id FROM public.contact_expenses WHERE paid_by = auth.uid()
    )
  );

CREATE POLICY "Payer can delete contact expense splits"
  ON public.contact_expense_splits FOR DELETE
  USING (
    expense_id IN (
      SELECT id FROM public.contact_expenses WHERE paid_by = auth.uid()
    )
  );

-- ============================================================
-- RPCs
-- ============================================================

-- Add a contact (and the reciprocal entry) so each user sees the other.
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

  INSERT INTO public.contacts (owner_id, contact_user_id)
  VALUES (v_uid, p_contact_user_id)
  ON CONFLICT (owner_id, contact_user_id) DO NOTHING;

  INSERT INTO public.contacts (owner_id, contact_user_id)
  VALUES (p_contact_user_id, v_uid)
  ON CONFLICT (owner_id, contact_user_id) DO NOTHING;
END;
$$;

-- Create a one-on-one expense between the caller and a contact.
CREATE OR REPLACE FUNCTION public.create_contact_expense_with_splits(
  p_contact_user_id UUID,
  p_paid_by UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_category TEXT,
  p_split_type public.split_type,
  p_splits JSONB,
  p_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.contact_expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lo UUID;
  v_hi UUID;
  v_expense public.contact_expenses;
  v_split JSONB;
  v_split_user UUID;
  v_split_amount NUMERIC(12, 2);
  v_split_total NUMERIC(12, 2) := 0;
  v_split_count INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_contact_user_id IS NULL OR p_contact_user_id = v_uid THEN
    RAISE EXCEPTION 'Invalid contact';
  END IF;

  IF p_paid_by <> v_uid AND p_paid_by <> p_contact_user_id THEN
    RAISE EXCEPTION 'Expense payer must be you or the contact';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  IF btrim(COALESCE(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Expense description is required';
  END IF;

  IF v_uid < p_contact_user_id THEN
    v_lo := v_uid;
    v_hi := p_contact_user_id;
  ELSE
    v_lo := p_contact_user_id;
    v_hi := v_uid;
  END IF;

  FOR v_split IN SELECT value FROM jsonb_array_elements(COALESCE(p_splits, '[]'::jsonb))
  LOOP
    v_split_user := (v_split->>'userId')::UUID;
    v_split_amount := round((v_split->>'amount')::NUMERIC, 2);

    IF v_split_amount < 0 THEN
      RAISE EXCEPTION 'Split amount cannot be negative';
    END IF;

    IF v_split_user <> v_lo AND v_split_user <> v_hi THEN
      RAISE EXCEPTION 'Every split user must be a participant';
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

  INSERT INTO public.contact_expenses (
    paid_by,
    user_lo,
    user_hi,
    amount,
    description,
    category,
    split_type,
    date
  )
  VALUES (
    p_paid_by,
    v_lo,
    v_hi,
    round(p_amount, 2),
    btrim(p_description),
    p_category,
    p_split_type,
    COALESCE(p_date, now())
  )
  RETURNING * INTO v_expense;

  FOR v_split IN SELECT value FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO public.contact_expense_splits (expense_id, user_id, amount)
    VALUES (
      v_expense.id,
      (v_split->>'userId')::UUID,
      round((v_split->>'amount')::NUMERIC, 2)
    );
  END LOOP;

  RETURN v_expense;
END;
$$;

-- Net balance for the caller versus a specific contact.
-- Positive = the contact owes the caller; negative = the caller owes.
CREATE OR REPLACE FUNCTION public.get_contact_balance(p_contact_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lo UUID;
  v_hi UUID;
  v_balance NUMERIC(12, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_contact_user_id IS NULL OR p_contact_user_id = v_uid THEN
    RETURN 0;
  END IF;

  IF v_uid < p_contact_user_id THEN
    v_lo := v_uid;
    v_hi := p_contact_user_id;
  ELSE
    v_lo := p_contact_user_id;
    v_hi := v_uid;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      -- Caller paid: the contact's share is owed to the caller.
      WHEN ce.paid_by = v_uid AND ces.user_id = p_contact_user_id THEN ces.amount
      -- Contact paid: the caller's share is owed to the contact.
      WHEN ce.paid_by = p_contact_user_id AND ces.user_id = v_uid THEN -ces.amount
      ELSE 0
    END
  ), 0)
  INTO v_balance
  FROM public.contact_expenses ce
  JOIN public.contact_expense_splits ces ON ces.expense_id = ce.id
  WHERE ce.user_lo = v_lo AND ce.user_hi = v_hi;

  RETURN v_balance;
END;
$$;

-- List the caller's contacts with their current net balance. Includes both
-- explicit contacts and anyone the caller shares a contact expense with.
CREATE OR REPLACE FUNCTION public.get_contacts_with_balances()
RETURNS TABLE (
  contact_user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  balance NUMERIC(12, 2)
)
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

  RETURN QUERY
  WITH contact_ids AS (
    SELECT c.contact_user_id AS uid
    FROM public.contacts c
    WHERE c.owner_id = v_uid
    UNION
    SELECT CASE WHEN ce.user_lo = v_uid THEN ce.user_hi ELSE ce.user_lo END AS uid
    FROM public.contact_expenses ce
    WHERE ce.user_lo = v_uid OR ce.user_hi = v_uid
  )
  SELECT
    ci.uid,
    p.full_name,
    p.avatar_url,
    public.get_contact_balance(ci.uid) AS balance
  FROM contact_ids ci
  JOIN public.profiles p ON p.id = ci.uid
  WHERE ci.uid <> v_uid
  ORDER BY p.full_name;
END;
$$;

-- ============================================================
-- Fold contact balances into the overall user total balance.
-- ============================================================

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
  group_balances AS (
    SELECT gb.balance
    FROM user_groups ug
    CROSS JOIN LATERAL public.get_group_balances(ug.group_id) gb
    WHERE gb.user_id = p_user_id
  ),
  contact_balances AS (
    SELECT cwb.balance
    FROM public.get_contacts_with_balances() cwb
  ),
  all_balances AS (
    SELECT balance FROM group_balances
    UNION ALL
    SELECT balance FROM contact_balances
  )
  SELECT
    COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS total_owed,
    COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) AS total_owing
  FROM all_balances;
END;
$$;

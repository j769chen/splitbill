-- ============================================================
-- SplitBill Full Database Setup
-- Run this in the Supabase SQL Editor to set up everything
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TYPE public.split_type AS ENUM ('equal', 'exact', 'percentage');

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT,
  split_type public.split_type NOT NULL DEFAULT 'equal',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  UNIQUE (expense_id, user_id)
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paid_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (paid_by != paid_to)
);

CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_expenses_group ON public.expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX idx_expense_splits_expense ON public.expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user ON public.expense_splits(user_id);
CREATE INDEX idx_payments_group ON public.payments(group_id);
CREATE INDEX idx_payments_paid_by ON public.payments(paid_by);
CREATE INDEX idx_payments_paid_to ON public.payments(paid_to);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Helper to check group membership WITHOUT triggering RLS on group_members.
-- A SELECT policy on group_members that itself queries group_members causes
-- "infinite recursion detected in policy" in Postgres. Running the check inside
-- a SECURITY DEFINER function bypasses RLS and breaks the recursion.
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE POLICY "Users can view any profile"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Members can view their groups"
  ON public.groups FOR SELECT
  USING (
    public.is_group_member(id, auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creator can update group"
  ON public.groups FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Group creator can delete group"
  ON public.groups FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group members can add new members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    OR auth.uid() = user_id
  );

CREATE POLICY "Members can leave group"
  ON public.group_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Members can view group expenses"
  ON public.expenses FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Expense creator can update"
  ON public.expenses FOR UPDATE USING (auth.uid() = paid_by);

CREATE POLICY "Expense creator can delete"
  ON public.expenses FOR DELETE USING (auth.uid() = paid_by);

CREATE POLICY "Members can view expense splits"
  ON public.expense_splits FOR SELECT
  USING (expense_id IN (
    SELECT e.id FROM public.expenses e
    WHERE public.is_group_member(e.group_id, auth.uid())
  ));

CREATE POLICY "Members can create expense splits"
  ON public.expense_splits FOR INSERT
  WITH CHECK (expense_id IN (
    SELECT e.id FROM public.expenses e
    WHERE public.is_group_member(e.group_id, auth.uid())
  ));

CREATE POLICY "Expense payer can update splits"
  ON public.expense_splits FOR UPDATE
  USING (expense_id IN (SELECT id FROM public.expenses WHERE paid_by = auth.uid()));

CREATE POLICY "Expense payer can delete splits"
  ON public.expense_splits FOR DELETE
  USING (expense_id IN (SELECT id FROM public.expenses WHERE paid_by = auth.uid()));

CREATE POLICY "Members can view group payments"
  ON public.payments FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Payment creator can delete"
  ON public.payments FOR DELETE USING (auth.uid() = paid_by);

-- ============================================================
-- 3. FUNCTIONS
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

-- Only return ids that have a profile row. group_members.user_id has an
-- FK to profiles(id), so returning a profile-less auth user here would make
-- group creation fail with group_members_user_id_fkey.
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

-- ============================================================
-- 4. ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_splits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

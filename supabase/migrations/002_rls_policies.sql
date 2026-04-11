-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----

CREATE POLICY "Users can view any profile"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- GROUPS ----

CREATE POLICY "Members can view their groups"
  ON public.groups FOR SELECT
  USING (
    id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creator can update group"
  ON public.groups FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Group creator can delete group"
  ON public.groups FOR DELETE
  USING (auth.uid() = created_by);

-- ---- GROUP MEMBERS ----

CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can add new members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

CREATE POLICY "Members can leave group"
  ON public.group_members FOR DELETE
  USING (auth.uid() = user_id);

-- ---- EXPENSES ----

CREATE POLICY "Members can view group expenses"
  ON public.expenses FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Expense creator can update"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = paid_by);

CREATE POLICY "Expense creator can delete"
  ON public.expenses FOR DELETE
  USING (auth.uid() = paid_by);

-- ---- EXPENSE SPLITS ----

CREATE POLICY "Members can view expense splits"
  ON public.expense_splits FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create expense splits"
  ON public.expense_splits FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Expense payer can update splits"
  ON public.expense_splits FOR UPDATE
  USING (
    expense_id IN (
      SELECT id FROM public.expenses
      WHERE paid_by = auth.uid()
    )
  );

CREATE POLICY "Expense payer can delete splits"
  ON public.expense_splits FOR DELETE
  USING (
    expense_id IN (
      SELECT id FROM public.expenses
      WHERE paid_by = auth.uid()
    )
  );

-- ---- PAYMENTS ----

CREATE POLICY "Members can view group payments"
  ON public.payments FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.group_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Payment creator can delete"
  ON public.payments FOR DELETE
  USING (auth.uid() = paid_by);

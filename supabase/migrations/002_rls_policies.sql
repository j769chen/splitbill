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

-- Helper to check group membership WITHOUT triggering RLS on group_members.
-- A SELECT policy on group_members that itself queries group_members causes
-- "infinite recursion detected in policy". A SECURITY DEFINER function bypasses
-- RLS and breaks the recursion.
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
  USING (public.is_group_member(id, auth.uid()));

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
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group members can add new members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    OR auth.uid() = user_id
  );

CREATE POLICY "Members can leave group"
  ON public.group_members FOR DELETE
  USING (auth.uid() = user_id);

-- ---- EXPENSES ----

CREATE POLICY "Members can view group expenses"
  ON public.expenses FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

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
      WHERE public.is_group_member(e.group_id, auth.uid())
    )
  );

CREATE POLICY "Members can create expense splits"
  ON public.expense_splits FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      WHERE public.is_group_member(e.group_id, auth.uid())
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
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Payment creator can delete"
  ON public.payments FOR DELETE
  USING (auth.uid() = paid_by);

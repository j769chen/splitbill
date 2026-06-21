-- ============================================================
-- Fix: RLS infinite recursion on group_members
-- Run this if you already applied the earlier setup/migrations.
--
-- The original "Members can view group members" policy queried
-- group_members from within a policy ON group_members, which Postgres
-- rejects with: "infinite recursion detected in policy for relation
-- group_members". Other policies that subqueried group_members also
-- triggered that recursive policy. The fix routes the membership check
-- through a SECURITY DEFINER function that bypasses RLS.
-- ============================================================

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

-- groups
-- Creators must be able to SELECT their group immediately after INSERT
-- (the .select() returning step runs before they're added to group_members),
-- so allow access via membership OR ownership.
DROP POLICY IF EXISTS "Members can view their groups" ON public.groups;
CREATE POLICY "Members can view their groups"
  ON public.groups FOR SELECT
  USING (
    public.is_group_member(id, auth.uid())
    OR created_by = auth.uid()
  );

-- group_members
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Group members can add new members" ON public.group_members;
CREATE POLICY "Group members can add new members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    public.is_group_member(group_id, auth.uid())
    OR auth.uid() = user_id
  );

-- expenses
DROP POLICY IF EXISTS "Members can view group expenses" ON public.expenses;
CREATE POLICY "Members can view group expenses"
  ON public.expenses FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can create expenses" ON public.expenses;
CREATE POLICY "Members can create expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- expense_splits
DROP POLICY IF EXISTS "Members can view expense splits" ON public.expense_splits;
CREATE POLICY "Members can view expense splits"
  ON public.expense_splits FOR SELECT
  USING (expense_id IN (
    SELECT e.id FROM public.expenses e
    WHERE public.is_group_member(e.group_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Members can create expense splits" ON public.expense_splits;
CREATE POLICY "Members can create expense splits"
  ON public.expense_splits FOR INSERT
  WITH CHECK (expense_id IN (
    SELECT e.id FROM public.expenses e
    WHERE public.is_group_member(e.group_id, auth.uid())
  ));

-- payments
DROP POLICY IF EXISTS "Members can view group payments" ON public.payments;
CREATE POLICY "Members can view group payments"
  ON public.payments FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can create payments" ON public.payments;
CREATE POLICY "Members can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (public.is_group_member(group_id, auth.uid()));

-- ============================================================
-- Allow any group member to delete activity items.
--
-- Deletes were previously restricted to the record creator (paid_by).
-- The Activity feed now lets any member of the group remove an expense
-- or payment, so relax the DELETE policies from creator-only to
-- group-membership. Non-members remain blocked.
-- ============================================================

-- Expenses: any group member can delete (was: only paid_by)
DROP POLICY IF EXISTS "Expense creator can delete" ON public.expenses;
CREATE POLICY "Members can delete expenses"
  ON public.expenses FOR DELETE
  USING (public.is_group_member(group_id, auth.uid()));

-- Payments: any group member can delete (was: only paid_by)
DROP POLICY IF EXISTS "Payment creator can delete" ON public.payments;
CREATE POLICY "Members can delete payments"
  ON public.payments FOR DELETE
  USING (public.is_group_member(group_id, auth.uid()));

-- Expense splits: keep consistent for direct deletes. Cascade deletes
-- from expenses bypass RLS, so this is for completeness.
DROP POLICY IF EXISTS "Expense payer can delete splits" ON public.expense_splits;
CREATE POLICY "Members can delete expense splits"
  ON public.expense_splits FOR DELETE
  USING (
    expense_id IN (
      SELECT e.id FROM public.expenses e
      WHERE public.is_group_member(e.group_id, auth.uid())
    )
  );

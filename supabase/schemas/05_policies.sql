-- Row Level Security policies (final state).
--
-- Every write goes through a SECURITY DEFINER RPC in 04_functions.sql, so the
-- tables carry SELECT policies only. That is deliberate: RLS can express "you
-- are a member of this group" but not "these splits add up to the expense
-- total", so leaving direct INSERT/UPDATE/DELETE open let a client PostgREST
-- call skip every validation the RPCs perform and write an unbalanced ledger.
-- With no policy for a command, RLS denies it.
--
-- Caveat: the diff tool tracks `create policy` but NOT `alter policy`. To
-- change a policy here, edit its definition in place; the generated migration
-- will drop and recreate it.

-- profiles
-- Writes: update_profile.
-- Visibility is scoped to people the caller shares something with (see
-- can_view_profile). The RPCs that legitimately need to name a non-visible
-- profile are SECURITY DEFINER and bypass this.
create policy "Users can view profiles they share context with"
  on public.profiles for select using (public.can_view_profile(id));

-- groups
-- Writes: create_group_with_members, rename_group, set_group_currency,
-- set_group_simplify_debts, leave_group.
create policy "Members can view their groups"
  on public.groups for select
  using (
    public.is_group_member(id, auth.uid())
    or created_by = auth.uid()
  );

-- group_members
-- Writes: create_group_with_members, add_group_members, leave_group.
create policy "Members can view group members"
  on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));

-- expenses
-- Writes: create_expense_with_splits, update_expense_with_splits,
-- delete_expense.
create policy "Members can view group expenses"
  on public.expenses for select
  using (public.is_group_member(group_id, auth.uid()));

-- expense_splits
-- Writes: create_expense_with_splits, update_expense_with_splits (and the
-- cascade from delete_expense).
create policy "Members can view expense splits"
  on public.expense_splits for select
  using (expense_id in (
    select e.id from public.expenses e
    where public.is_group_member(e.group_id, auth.uid())
  ));

-- payments
-- Writes: create_payment, update_payment, delete_payment.
create policy "Members can view group payments"
  on public.payments for select
  using (public.is_group_member(group_id, auth.uid()));

-- group_simplify_debts_events
-- Writes: set_group_simplify_debts.
create policy "Members can view simplify debts events"
  on public.group_simplify_debts_events for select
  using (public.is_group_member(group_id, auth.uid()));

-- contacts
-- Writes: create_contact_pair, via send_contact_request/respond_contact_request.
create policy "Users can view their contacts"
  on public.contacts for select using (owner_id = auth.uid());

-- contact_expenses
-- Writes: create_contact_expense_with_splits,
-- update_contact_expense_with_splits, delete_contact_expense. Creating one
-- requires an accepted contact, which a direct insert did not.
create policy "Participants can view contact expenses"
  on public.contact_expenses for select
  using (auth.uid() = user_lo or auth.uid() = user_hi);

-- contact_expense_splits
-- Writes: the contact-expense RPCs (and the cascade from
-- delete_contact_expense).
create policy "Participants can view contact expense splits"
  on public.contact_expense_splits for select
  using (public.is_contact_participant(expense_id, auth.uid()));

-- contact_payments
-- Writes: create_contact_payment, update_contact_payment,
-- delete_contact_payment.
create policy "Participants can view contact payments"
  on public.contact_payments for select
  using (auth.uid() = user_lo or auth.uid() = user_hi);

-- contact_requests
-- Writes: send/respond/cancel_contact_request.
create policy "Participants can view contact requests"
  on public.contact_requests for select
  using (requester_id = auth.uid() or recipient_id = auth.uid());

-- contact_pair_settings
-- Writes: set_contact_currency.
create policy "Participants can view contact pair settings"
  on public.contact_pair_settings for select
  using (auth.uid() = user_lo or auth.uid() = user_hi);

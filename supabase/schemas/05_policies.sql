-- Row Level Security policies (final state).
--
-- These reflect the hardened write policies (every participant must be a group
-- member) and the relaxed delete policies (any group member may delete activity
-- items). RLS is enabled on the tables themselves in the table schema files.
--
-- Caveat: the diff tool tracks `create policy` but NOT `alter policy`. To
-- change a policy here, edit its definition in place; the generated migration
-- will drop and recreate it.

-- profiles
create policy "Users can view any profile"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- groups
create policy "Members can view their groups"
  on public.groups for select
  using (
    public.is_group_member(id, auth.uid())
    or created_by = auth.uid()
  );

create policy "Authenticated users can create groups"
  on public.groups for insert with check (auth.uid() = created_by);

create policy "Group creator can update group"
  on public.groups for update using (auth.uid() = created_by);

create policy "Group creator can delete group"
  on public.groups for delete using (auth.uid() = created_by);

-- group_members
create policy "Members can view group members"
  on public.group_members for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Group members can add new members"
  on public.group_members for insert
  with check (
    public.is_group_member(group_id, auth.uid())
    or auth.uid() = user_id
  );

create policy "Members can leave group"
  on public.group_members for delete using (auth.uid() = user_id);

-- expenses
create policy "Members can view group expenses"
  on public.expenses for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Members can create expenses"
  on public.expenses for insert
  with check (
    public.is_group_member(group_id, auth.uid())
    and public.is_group_member(group_id, paid_by)
  );

create policy "Expense creator can update"
  on public.expenses for update using (auth.uid() = paid_by);

create policy "Members can delete expenses"
  on public.expenses for delete
  using (public.is_group_member(group_id, auth.uid()));

-- expense_splits
create policy "Members can view expense splits"
  on public.expense_splits for select
  using (expense_id in (
    select e.id from public.expenses e
    where public.is_group_member(e.group_id, auth.uid())
  ));

create policy "Members can create expense splits"
  on public.expense_splits for insert
  with check (
    expense_id in (
      select e.id
      from public.expenses e
      where public.is_group_member(e.group_id, auth.uid())
        and public.is_group_member(e.group_id, user_id)
    )
  );

create policy "Expense payer can update splits"
  on public.expense_splits for update
  using (expense_id in (select id from public.expenses where paid_by = auth.uid()));

create policy "Members can delete expense splits"
  on public.expense_splits for delete
  using (
    expense_id in (
      select e.id from public.expenses e
      where public.is_group_member(e.group_id, auth.uid())
    )
  );

-- payments
create policy "Members can view group payments"
  on public.payments for select
  using (public.is_group_member(group_id, auth.uid()));

create policy "Members can create payments"
  on public.payments for insert
  with check (
    public.is_group_member(group_id, auth.uid())
    and public.is_group_member(group_id, paid_by)
    and public.is_group_member(group_id, paid_to)
    and (auth.uid() = paid_by or auth.uid() = paid_to)
  );

create policy "Members can delete payments"
  on public.payments for delete
  using (public.is_group_member(group_id, auth.uid()));

-- contacts
create policy "Users can view their contacts"
  on public.contacts for select using (owner_id = auth.uid());

create policy "Users can add their contacts"
  on public.contacts for insert with check (owner_id = auth.uid());

create policy "Users can remove their contacts"
  on public.contacts for delete using (owner_id = auth.uid());

-- contact_expenses
create policy "Participants can view contact expenses"
  on public.contact_expenses for select
  using (auth.uid() = user_lo or auth.uid() = user_hi);

create policy "Participants can create contact expenses"
  on public.contact_expenses for insert
  with check (
    (auth.uid() = user_lo or auth.uid() = user_hi)
    and (paid_by = user_lo or paid_by = user_hi)
  );

create policy "Payer can update contact expenses"
  on public.contact_expenses for update using (auth.uid() = paid_by);

create policy "Payer can delete contact expenses"
  on public.contact_expenses for delete using (auth.uid() = paid_by);

-- contact_expense_splits
create policy "Participants can view contact expense splits"
  on public.contact_expense_splits for select
  using (public.is_contact_participant(expense_id, auth.uid()));

create policy "Participants can create contact expense splits"
  on public.contact_expense_splits for insert
  with check (public.is_contact_participant(expense_id, auth.uid()));

create policy "Payer can update contact expense splits"
  on public.contact_expense_splits for update
  using (expense_id in (
    select id from public.contact_expenses where paid_by = auth.uid()
  ));

create policy "Payer can delete contact expense splits"
  on public.contact_expense_splits for delete
  using (expense_id in (
    select id from public.contact_expenses where paid_by = auth.uid()
  ));

-- contact_requests
-- Reads are allowed for either party; all writes go through SECURITY DEFINER
-- RPCs (send/respond/cancel), so no direct insert/update/delete policies.
create policy "Participants can view contact requests"
  on public.contact_requests for select
  using (requester_id = auth.uid() or recipient_id = auth.uid());

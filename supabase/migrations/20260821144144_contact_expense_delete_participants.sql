drop policy "Payer can delete contact expense splits" on "public"."contact_expense_splits";

drop policy "Payer can delete contact expenses" on "public"."contact_expenses";


  create policy "Participants can delete contact expense splits"
  on "public"."contact_expense_splits"
  as permissive
  for delete
  to public
using (public.is_contact_participant(expense_id, auth.uid()));



  create policy "Participants can delete contact expenses"
  on "public"."contact_expenses"
  as permissive
  for delete
  to public
using (((auth.uid() = user_lo) OR (auth.uid() = user_hi)));




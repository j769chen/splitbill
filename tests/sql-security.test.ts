import { readFileSync } from "fs";
import { join } from "path";

const migrationPath = (fileName: string) =>
  join(process.cwd(), "supabase", "migrations", fileName);

const readMigration = (fileName: string) =>
  readFileSync(migrationPath(fileName), "utf8");

const schemaPath = (fileName: string) =>
  join(process.cwd(), "supabase", "schemas", fileName);

const readSchema = (fileName: string) =>
  readFileSync(schemaPath(fileName), "utf8");

const functionBody = (sql: string, functionName: string) => {
  const match = sql.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${functionName}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`,
      "i"
    )
  );
  if (!match) {
    throw new Error(`Missing ${functionName} function definition`);
  }
  return match[1];
};

describe("SQL security guards", () => {
  it("keeps fresh installs from exposing balances through SECURITY DEFINER RPCs", () => {
    const fullSetup = readMigration("000_full_setup.sql");

    expect(functionBody(fullSetup, "get_group_balances")).toMatch(
      /IF NOT public\.is_group_member\(p_group_id,\s*auth\.uid\(\)\) THEN/i
    );
    expect(functionBody(fullSetup, "get_user_total_balance")).toMatch(
      /p_user_id <> auth\.uid\(\)/i
    );
  });

  it("keeps the declarative schema source guarding balance RPCs", () => {
    const functions = readSchema("04_functions.sql");

    expect(functionBody(functions, "get_group_balances")).toMatch(
      /IF NOT public\.is_group_member\(p_group_id,\s*auth\.uid\(\)\) THEN/i
    );
    expect(functionBody(functions, "get_user_total_balance")).toMatch(
      /p_user_id <> auth\.uid\(\)/i
    );
  });

  it("scopes the contact group-balance RPC to the authenticated caller", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_contact_group_balance");

    // Must require an authenticated caller and derive everything from auth.uid()
    // so it can only ever reveal the caller's own pairwise position.
    expect(body).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/e\.paid_by = v_uid/i);
  });

  it("only returns the caller's own contacts from the combined-balance RPC", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_contacts_with_combined_balances");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/c\.owner_id = v_uid/i);
  });

  it("scopes the per-group contact breakdown to the authenticated caller", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_contact_group_breakdown");

    expect(body).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    // shared_groups intersects the caller's memberships with the contact's,
    // so only groups the caller belongs to can ever appear.
    expect(body).toMatch(/where gm\.user_id = v_uid/i);
  });

  it("guards the send-contact-request RPC", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "send_contact_request");

    expect(body).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    // Cannot request yourself, and cannot duplicate an existing contact.
    expect(body).toMatch(/p_recipient_user_id = v_uid/i);
    expect(body).toMatch(/owner_id = v_uid and contact_user_id = p_recipient_user_id/i);
  });

  it("restricts responding to requests addressed to the caller", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "respond_contact_request");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/v_request\.recipient_id <> v_uid/i);
  });

  it("restricts cancelling to requests sent by the caller", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "cancel_contact_request");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/v_request\.requester_id <> v_uid/i);
  });

  it("scopes the contact-requests listing to the caller", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_contact_requests");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/cr\.requester_id = v_uid or cr\.recipient_id = v_uid/i);
  });

  it("gates one-on-one expense creation on an accepted contact", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "create_contact_expense_with_splits");

    expect(body).toMatch(/You can only add expenses with accepted contacts/i);
    expect(body).toMatch(/owner_id = v_uid and contact_user_id = p_contact_user_id/i);
  });

  it("restricts contact_requests reads to the two participants", () => {
    const policies = readSchema("05_policies.sql");

    expect(policies).toMatch(
      /create policy "Participants can view contact requests"[\s\S]*?on public\.contact_requests for select[\s\S]*?using \(requester_id = auth\.uid\(\) or recipient_id = auth\.uid\(\)\)/i
    );
  });

  it("guards the group pairwise-balance RPC to authenticated members", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_group_pairwise_balances_for_me");

    expect(body).toMatch(/v_uid uuid := auth\.uid\(\)/i);
    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(
      /IF NOT public\.is_group_member\(p_group_id,\s*v_uid\) THEN/i
    );
    // Everything is derived from the caller, so it can only reveal the caller's
    // own pairwise positions in the group.
    expect(body).toMatch(/e\.paid_by = v_uid/i);
  });

  it("restricts adding group members to authenticated members", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "add_group_members");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(
      /IF NOT public\.is_group_member\(p_group_id,\s*v_uid\) THEN/i
    );
    // Re-adding an existing member is rejected rather than silently skipped.
    expect(body).toMatch(/User is already a member of this group/i);
  });

  it("restricts renaming to members and rejects blank names", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "rename_group");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(
      /IF NOT public\.is_group_member\(p_group_id,\s*v_uid\) THEN/i
    );
    expect(body).toMatch(/btrim\(coalesce\(p_name, ''\)\) = ''/i);
  });

  it("caps email lookup batches to limit account enumeration", () => {
    const fullSetup = readMigration("000_full_setup.sql");

    expect(functionBody(fullSetup, "get_user_ids_by_email")).toMatch(
      /array_length\(emails,\s*1\)\s*>\s*20/i
    );
  });

  it("keeps the declarative schema source capping the email lookup RPC", () => {
    const functions = readSchema("04_functions.sql");

    expect(functionBody(functions, "get_user_ids_by_email")).toMatch(
      /array_length\(emails,\s*1\)\s*>\s*20/i
    );
  });

  it("authorizes group expense edits to any member and re-validates splits", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "update_expense_with_splits");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/raise exception 'Expense not found'/i);
    // Any member of the expense's group may edit (mirrors the delete policy).
    expect(body).toMatch(
      /IF NOT public\.is_group_member\(v_group_id,\s*v_uid\) THEN/i
    );
    expect(body).toMatch(
      /IF NOT public\.is_group_member\(v_group_id,\s*p_paid_by\) THEN/i
    );
    expect(body).toMatch(
      /Split amounts must add up to the expense total/i
    );
  });

  it("restricts contact expense edits to participants and re-validates splits", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "update_contact_expense_with_splits");

    expect(body).toMatch(/raise exception 'Not authenticated'/i);
    expect(body).toMatch(/raise exception 'Expense not found'/i);
    expect(body).toMatch(/v_uid <> v_lo and v_uid <> v_hi/i);
    expect(body).toMatch(/p_paid_by <> v_lo and p_paid_by <> v_hi/i);
    expect(body).toMatch(/Split amounts must add up to the expense total/i);
  });

  it("folds one-on-one contact payments into the contact balance", () => {
    const functions = readSchema("04_functions.sql");
    const body = functionBody(functions, "get_contact_balance");

    expect(body).toMatch(/from public\.contact_payments cp/i);
    expect(body).toMatch(
      /cp\.paid_by = v_uid and cp\.paid_to = p_contact_user_id then cp\.base_amount/i
    );
    expect(body).toMatch(
      /cp\.paid_by = p_contact_user_id and cp\.paid_to = v_uid then -cp\.base_amount/i
    );
  });

  it("only lets group members update payments and keeps payer/payee in-group", () => {
    const policies = readSchema("05_policies.sql");

    expect(policies).toMatch(
      /create policy "Members can update payments"[\s\S]*?on public\.payments for update[\s\S]*?using \(public\.is_group_member\(group_id,\s*auth\.uid\(\)\)\)[\s\S]*?is_group_member\(group_id,\s*paid_by\)[\s\S]*?is_group_member\(group_id,\s*paid_to\)/i
    );
  });

  it("restricts contact_payments access to the two participants", () => {
    const policies = readSchema("05_policies.sql");

    expect(policies).toMatch(
      /create policy "Participants can view contact payments"[\s\S]*?on public\.contact_payments for select[\s\S]*?using \(auth\.uid\(\) = user_lo or auth\.uid\(\) = user_hi\)/i
    );
    expect(policies).toMatch(
      /create policy "Participants can create contact payments"[\s\S]*?on public\.contact_payments for insert[\s\S]*?paid_by = user_lo or paid_by = user_hi[\s\S]*?paid_to = user_lo or paid_to = user_hi/i
    );
    expect(policies).toMatch(
      /create policy "Participants can update contact payments"[\s\S]*?on public\.contact_payments for update/i
    );
    expect(policies).toMatch(
      /create policy "Participants can delete contact payments"[\s\S]*?on public\.contact_payments for delete[\s\S]*?using \(auth\.uid\(\) = user_lo or auth\.uid\(\) = user_hi\)/i
    );
  });
});

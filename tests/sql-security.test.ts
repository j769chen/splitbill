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
});

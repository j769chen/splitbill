import { existsSync, readFileSync } from "fs";
import { join } from "path";

const migrationPath = (fileName: string) =>
  join(process.cwd(), "supabase", "migrations", fileName);

const readMigration = (fileName: string) =>
  readFileSync(migrationPath(fileName), "utf8");

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

  it("patches existing installs with guarded balance RPC definitions", () => {
    const patchName = "010_guard_balance_rpcs.sql";

    expect(existsSync(migrationPath(patchName))).toBe(true);
    const patch = readMigration(patchName);
    expect(functionBody(patch, "get_group_balances")).toMatch(
      /IF NOT public\.is_group_member\(p_group_id,\s*auth\.uid\(\)\) THEN/i
    );
    expect(functionBody(patch, "get_user_total_balance")).toMatch(
      /p_user_id <> auth\.uid\(\)/i
    );
  });

  it("caps email lookup batches to limit account enumeration", () => {
    const fullSetup = readMigration("000_full_setup.sql");

    expect(functionBody(fullSetup, "get_user_ids_by_email")).toMatch(
      /array_length\(emails,\s*1\)\s*>\s*20/i
    );
  });

  it("patches existing installs with a capped email lookup RPC", () => {
    const patchName = "011_limit_user_email_lookup.sql";

    expect(existsSync(migrationPath(patchName))).toBe(true);
    const patch = readMigration(patchName);
    expect(functionBody(patch, "get_user_ids_by_email")).toMatch(
      /array_length\(emails,\s*1\)\s*>\s*20/i
    );
  });
});

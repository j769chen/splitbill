---
name: code-review-splitbill
description: Perform a dry-run code review on current SplitBill branch changes (vs origin/main) using the repo's .agents/rules, without posting comments. Use when previewing what review would flag before pushing.
---

# Code Review (Dry Run)

Reviews current branch changes against `origin/main` locally, without posting to GitHub.

This is the SplitBill app — an Expo (React Native) + Supabase + TanStack Query
project. Reviews should reflect that stack, not generic web conventions.

## Prerequisites

**Preferred model**: GPT-5.2 (best for thorough code review)

!!IMPORTANT!!: Before starting, check what model you are. If you are not GPT-5.2-high, use `AskQuestion` to verify:
- Prompt: "Code review works best with GPT-5.2, but you're currently using [model name]. Continue anyway?"
- Options: "Yes, continue with current model" / "Cancel (I'll switch models)"

## Workflow

### 1. Get Changes

Run in parallel:
```bash
git fetch origin main
git diff origin/main...HEAD              # Full diff
git diff --name-only origin/main...HEAD  # File list for triage
git log origin/main...HEAD --oneline     # Commits to understand goal
```

### 2. Load Review Guidelines

Read the rule files that match what changed. They live in `.agents/rules/`:

- React / components / hooks (`app/**`, `components/**`): `.agents/rules/react.md`
- State & data (TanStack Query hooks in `lib/queries/**`, contexts in `lib/*.tsx`): `.agents/rules/state-management.md`
- TypeScript & code style (any `.ts` / `.tsx`): `.agents/rules/typescript.md`
- Tests (if/when any exist): `.agents/rules/testing.md`

The rules use stable IDs (e.g. Rule 1-1, Rule 6-3). Reference these IDs when flagging issues.

### 3. Risk-Based Triage

Categorize changed files:
- **High risk**: Money/split math (`lib/utils.ts`, `add-expense`, `settle-up`, balance logic), Supabase mutations and RPC calls (`lib/queries/**`), auth (`lib/auth.tsx`), realtime invalidation (`lib/realtime.ts`), SQL migrations and RLS policies (`supabase/migrations/**`)
- **Medium risk**: Screens and navigation (`app/**`), query hooks, shared components, context providers
- **Low risk**: Theme tokens, copy, static assets, config

### 4. Two-Pass Review

**Pass 1 - Architecture**:
- Does the change fit existing patterns (file-based routes under `app/`, query hooks under `lib/queries/`, `@/` path alias)?
- Is server state in TanStack Query (not local state or context)? Are query keys and `invalidateQueries` consistent with `lib/realtime.ts`?
- Are cross-cutting concerns using existing providers (`useAuth`, `useSnackbar`, `useConfirm`, `useAppTheme`) instead of new ad-hoc ones?

**Pass 2 - Line-Level**:
- Apply the rules from the loaded `.agents/rules/*.md` files.
- Watch for repo-specific hazards:
  - Money handled as floats — check rounding and that splits sum exactly to the total.
  - Supabase calls that ignore `error` (always `throw error` in query/mutation functions).
  - Mutations that don't invalidate the right query keys on success.
  - `as any` / `as unknown as T` casts on Supabase responses (flag per Rule 8-1).
  - Secrets or PII — only `EXPO_PUBLIC_*` env vars are safe to ship to the client.
  - Logic that assumes RLS isn't enforced, or trusts client-supplied user IDs.

### 5. Output Summary

Present findings in this format:

```markdown
## Code Review Summary

**Files reviewed**: X files (Y high-risk, Z medium-risk)

### Issues Found

#### 🔴 Critical
- [file:line] Issue description (Rule X-X)

#### 🟡 Warnings
- [file:line] Issue description (Rule X-X)

#### 🔵 Suggestions
- [file:line] Issue description

### No Issues
✅ No issues found (if applicable)
```

## Notes

- This is a **dry run** - no comments are posted to GitHub
- Focus on actionable feedback, not style nitpicks
- Reference specific rule IDs (e.g. Rule 6-3) when flagging issues
- There is currently no automated test suite; verify type-safety with `npx tsc --noEmit` when relevant

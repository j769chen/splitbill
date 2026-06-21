# Testing & Verification

Guidelines for verifying changes in this app. For an overview of the stack, see
the [README](../../README.md).

> **Current state**: This project uses Jest with the `jest-expo` preset. The first
> tests cover pure money utilities in `lib/utils.test.ts`. Expand coverage from
> pure financial logic outward before adding heavier component tests.

---

## Verifying Changes Today

### Rule 1: Type-Check Before Completing Work

**MANDATORY**: TypeScript runs in `strict` mode. Before marking work complete, run:

```bash
npx tsc --noEmit
```

Fix every type error you introduced. Do not suppress errors with `@ts-ignore` or
`as any` (see TypeScript Rule 8-1).

### Rule 2: Run Tests Before Completing Work

**MANDATORY**: Run the automated tests before marking work complete:

```bash
npm test -- --runInBand
```

Run focused tests while developing:

```bash
npm test -- --runInBand lib/utils.test.ts
```

### Rule 3: Manually Exercise the Change

**MANDATORY**: Automated tests do not replace manual flow checks for UI changes.
Run the app and exercise the affected flow:

```bash
npx expo start   # then press i (iOS), a (Android), or w (web)
```

When relevant, verify:
- The happy path **and** the failure path (e.g. trigger the `showError` branch).
- Light **and** dark mode (theme tokens, legibility — see React Rule 2-1).
- Realtime: a change in one place invalidates the right caches (`lib/realtime.ts`).
- Money math: splits sum exactly to the total for equal, exact, and percentage modes.

### Rule 4: Keep the Type Surface Honest

**MANDATORY**: Types are part of the contract. Define shapes in `lib/types.ts` and
avoid casting away mismatches outside the Supabase query boundary (TypeScript Rule
8-1).

---

## Test Coverage Priorities

### Rule 4: Prioritize Pure Logic First

**Requirement**: The highest-value, lowest-cost tests are unit tests for the pure
functions in `lib/utils.ts` — split math (`splitEqual`), balance calculation, and
debt simplification. These have clear inputs/outputs and no React or Supabase
dependencies.

**Severity**: Blocking for new or changed pure financial logic

**Examples**:

```ts
import { splitEqual } from "@/lib/utils";

it("distributes the remainder so splits sum to the total", () => {
  const parts = splitEqual(10, 3);
  expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(10);
});
```

### Rule 5: Test Behavior, Not Implementation

**Requirement**: Test observable behavior (what the user sees / what a function
returns), not internal details. Use clear, descriptive test names. Avoid asserting
on private state or exact call counts unless the behavior depends on them.

**Severity**: Non-blocking

### Rule 6: Mock at the Supabase Boundary

**Requirement**: When testing query hooks or screens, mock the `supabase` client
(`lib/supabase.ts`) rather than the network, and wrap components in a real
`QueryClientProvider` plus the app's context providers (`AuthProvider`,
`SnackbarProvider`, theme). This mirrors how data actually flows in the app.

**Severity**: Non-blocking

### Rule 7: No Flaky Tests

**Requirement**: Tests must be deterministic — proper cleanup between tests, no
real timers (mock system time, not the date library), and no reliance on network or
realtime timing.

**Severity**: Non-blocking

---

## Quick Checklist

Before completing any work:

- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] `npm test -- --runInBand` passes
- [ ] The changed flow was manually exercised (happy path + failure path)
- [ ] Light and dark mode both look correct (if UI changed)
- [ ] New pure logic in `lib/utils.ts` has tests
- [ ] No `as any` / `@ts-ignore` introduced to silence errors

# TypeScript & Code Style

Guidelines for TypeScript standards and code style in this app. The project uses
`strict` mode (`tsconfig.json`) and the `@/*` path alias. For an overview, see the
[README](../../README.md).

---

## TypeScript Standards

- Prefer explicit types for exported functions, hooks, components, and public APIs.
- Extract complex conditionals into well-named variables.
- Use early returns to reduce nesting.
- Handle error and edge cases first (e.g. check `error` from Supabase before using `data`).
- Avoid `let`; prefer `const` and write code that avoids mutation.
- Type the shapes you own in `lib/types.ts`; reuse those types in query hooks and screens.

### Avoid `any` and `unknown`

- **Never use `any`** — it disables type checking entirely. Use precise types; prefer unions, generics, and discriminated unions.
- **Avoid `unknown` as a shortcut** — it is appropriate only when the type is genuinely unknowable at compile time (parsing untrusted JSON, `catch` block errors). If you know the shape, define it in `lib/types.ts`.

### Avoid type casting (`as`)

- **Type casting (`as`) is a last resort.** Prefer:
  - Proper interface/type definitions that match the actual shape
  - Generics for flexible typing
  - Union types and type guards for narrowing
  - `Partial<T>`, `Pick<T>`, `Omit<T>` for partial types

### Define explicit interfaces

- **Prefer explicit, named interfaces/types over wide generic types.** Define the actual shape of your data instead of `Record<string, any>` or `{ [key: string]: unknown }`.
- Be pragmatic: `Record<string, T>` is fine when keys are genuinely dynamic (e.g. the per-member `customSplits` map keyed by user id in `add-expense.tsx`).

## Formatting and Structure

- Match existing file style; do not reformat unrelated code.
- Keep comments minimal; explain "why" only when necessary for non-obvious logic (money rounding, RLS workarounds, realtime races).

---

## TypeScript

### Rule 8-1: Avoiding Type Casting (`as`)

**Requirement**: Do not use `as` to force types — fix the underlying type mismatch instead. Never use `as any` or `as unknown as T` except as a deliberately-isolated escape hatch (see the Supabase note below).

**Severity**: Non-blocking (Blocking for `as any`)

**Alternatives**: Proper type definitions in `lib/types.ts`, narrowing with type guards and/or type predicates.

**Supabase note**: Supabase's generated row types and nested `select(...)` joins don't always line up with hand-written types, so the codebase casts query results (e.g. `data as unknown as GroupWithMembers[]`). This is the *one* tolerated place for such casts. Keep them confined to the boundary inside query hooks (`lib/queries/**`) — cast once where the data enters the app, type everything downstream, and never spread `as any` through screens or utilities.

**Examples**:

⚠️ **Tolerated** (at the query boundary):

```ts
return data as unknown as GroupWithMembers[];
```

❌ **Incorrect** (casting in a screen / business logic):

```ts
const amount = (split as any).amount;
```

---

### Rule 8-2: Explicit Interfaces Over Wide Types

**Requirement**: When the shape of data is known, define an explicit interface in `lib/types.ts` instead of `Record<string, any>`, `{ [key: string]: unknown }`, or `object`. `Record<K, V>` is fine when keys are genuinely dynamic.

**Severity**: Non-blocking

**Examples**:

✅ **Correct** (dynamic keys are legitimate here):

```ts
const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
```

---

### Rule 8-3: Don't Type Away Money Bugs

**Requirement**: Amounts are handled as `number` (floats). Types won't catch rounding errors, so be explicit and defensive: validate that splits sum to the total, round consistently, and assign any rounding remainder deliberately (as `add-expense.tsx` does).

**Severity**: Non-blocking (Blocking when splits can fail to reconcile)

**Examples**:

✅ **Correct** (remainder assigned so splits sum exactly):

```ts
const remainder = Math.round((totalAmount - splitSum) * 100) / 100;
if (remainder !== 0 && splits.length > 0) {
  const last = splits[splits.length - 1];
  last.amount = Math.round((last.amount + remainder) * 100) / 100;
}
```

---

## Code Style

### Rule 3-1: Optional Chaining and Nullish Coalescing

**Requirement**: Use optional chaining (`?.`) and nullish coalescing (`??`) for safe access and defaults, rather than manual `&&` chains or `||` (which treats `0`/`""` as missing).

**Severity**: Non-blocking

**Examples**:

❌ **Incorrect** (`||` discards a legitimate `0`):

```ts
const amount = parseFloat(input) || 0; // fine for "no value", but...
const count = group.count || defaultCount; // bug if count is 0
```

✅ **Correct**:

```ts
const name = member.profiles?.full_name ?? "Unknown";
const count = group.count ?? defaultCount;
```

---

### Rule 3-2: Use the `@/` Path Alias

**Requirement**: Import shared modules with the `@/` alias (`@/lib/auth`, `@/lib/queries/useGroups`, `@/lib/utils`) rather than long relative paths. Relative imports within a directory (e.g. `../supabase` inside `lib/queries`) are fine.

**Severity**: Non-blocking

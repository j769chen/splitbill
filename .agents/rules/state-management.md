# State Management

Guidelines for state management in this app: **TanStack Query v5** for server
state, **React Context** for cross-cutting UI concerns, and `useState` for local
component state. There is no Redux, Zustand, or RTK Query here. For an overview,
see the [README](../../README.md).

---

### Rule 6-1: Server State Belongs in TanStack Query

**Requirement**: All Supabase data (groups, expenses, balances, payments, profiles) must be fetched and cached through TanStack Query hooks in `lib/queries/**`. Do not duplicate server data into `useState`/context, and do not refetch manually with `useEffect`.

**Detection Pattern**: Supabase `.from(...)`/`.rpc(...)` calls inside a component or `useEffect`, or server responses copied into `useState`/context.

**Severity**: Blocking

**Benefits**: Automatic caching, refetching, invalidation, and request de-duplication. Local state and context are for client-side UI only.

**Examples**:

✅ **Correct** (a query hook in `lib/queries/`):

```ts
export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data as unknown as GroupWithMembers;
    },
    enabled: !!groupId,
  });
}
```

---

### Rule 6-2: Always Throw on Supabase Errors

**Requirement**: Inside a `queryFn` or `mutationFn`, check the `{ data, error }` result and `throw error` when present. Never silently ignore a Supabase error — TanStack Query relies on a thrown error to populate `isError`/`error`.

**Detection Pattern**: A destructured `error` from a Supabase call that is never thrown or handled.

**Severity**: Blocking

**Examples**:

❌ **Incorrect**:

```ts
const { data } = await supabase.from("expenses").insert(row);
return data;
```

✅ **Correct**:

```ts
const { data, error } = await supabase.from("expenses").insert(row).select().single();
if (error) throw error;
return data;
```

---

### Rule 6-3: Invalidate the Right Query Keys After Mutations

**Requirement**: A mutation's `onSuccess` must invalidate every query key whose data it affects. Keys must stay consistent with the realtime invalidations in `lib/realtime.ts` (e.g. adding an expense affects `["expenses", groupId]`, `["balances", groupId]`, and `["total-balance"]`).

**Detection Pattern**: A `useMutation` that mutates data but invalidates no keys, or invalidates a key that doesn't match the query that reads that data.

**Severity**: Blocking

**Examples**:

✅ **Correct**:

```ts
return useMutation({
  mutationFn: async (groupId: string) => {
    const { error } = await supabase.rpc("leave_group", { p_group_id: groupId });
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["total-balance"] });
  },
});
```

---

### Rule 6-4: Consistent, Scoped Query Keys

**Requirement**: Query keys should be arrays scoped from broad to narrow, including any identifier the query depends on (`["group", groupId]`, `["expenses", groupId]`, `["groups", user?.id]`). Use `enabled` to avoid running queries before required inputs exist.

**Severity**: Non-blocking (Blocking if mismatched keys break invalidation)

**Why**: Consistent keys let mutations and realtime subscriptions invalidate exactly the right caches.

---

### Rule 6-5: Context for Cross-Cutting UI, Not Feature State

**Requirement**: Use React Context only for genuinely app-wide concerns. The established providers are `AuthProvider`/`useAuth` (`lib/auth.tsx`), `SnackbarProvider`/`useSnackbar` (`lib/snackbar.tsx`), the theme preference provider (`lib/theme-preference.tsx`), and the confirm dialog (`lib/confirm.tsx`). Don't create new contexts for state that belongs to a single screen or subtree.

**Severity**: Non-blocking

**Alternatives** before adding a context:
1. `useState` lifted to the lowest common ancestor
2. Passing children/components as props (composition)
3. A TanStack Query hook if the data is server state

---

### Rule 6-6: Stable / Memoized Context Values

**Requirement**: A context `value` that is an object must be stable across renders so consumers don't re-render unnecessarily. Memoize the value (and any action functions) with `useMemo`/`useCallback`, or build it from already-stable references.

**Severity**: Blocking (for contexts consumed widely)

**Examples**:

✅ **Correct** (action functions kept stable with `useCallback`, as in `lib/snackbar.tsx`):

```tsx
const show = useCallback((message: string, options?: SnackbarOptions) => {
  /* ... */
}, []);
const value = useMemo(() => ({ show, showError, showSuccess }), [show, showError, showSuccess]);
return <SnackbarContext.Provider value={value}>{children}</SnackbarContext.Provider>;
```

---

### Rule 6-7: Guard Context Consumption

**Requirement**: Custom context hooks that require a provider should throw a clear error when used outside it, as `useSnackbar` does. This catches provider-ordering mistakes early.

**Severity**: Non-blocking

**Examples**:

✅ **Correct**:

```ts
export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used within a SnackbarProvider");
  return ctx;
}
```

---

### Rule 6-8: Local State Stays Local

**Requirement**: State used by a single component (form fields, toggles, selection) should be `useState` in that component, as in `add-expense.tsx`. Don't promote it to context or a query cache.

**Severity**: Non-blocking

**Benefits**: Simpler lifecycle, easier reasoning, fewer unnecessary re-renders.

---

### Rule 6-9: Keep State Low in the Tree

**Requirement**: Move state to the lowest common ancestor of the components that need it. Avoid threading props through 3+ intermediate components that don't use them (prop drilling).

**Severity**: Non-blocking

**Alternatives**:
1. Composition — pass child components as props
2. Move state closer to where it's used
3. Only if truly shared app-wide: an existing context

---

### Rule 6-10: User Feedback via Snackbar / Confirm, Not Alert

**Requirement**: Surface success/error feedback through `useSnackbar` (`showError`/`showSuccess`/`showInfo`) and confirmations through `useConfirm` (`lib/confirm.tsx`). Prefer these over raw `Alert.alert`, so feedback is themed and consistent.

**Severity**: Non-blocking

**Examples**:

✅ **Correct**:

```tsx
const { showError } = useSnackbar();
try {
  await createExpense.mutateAsync(payload);
  router.back();
} catch (error: any) {
  showError(error?.message ?? "Couldn't add the expense. Please try again.");
}
```

---

### Rule 6-11: Optimistic Updates Are Opt-In

**Requirement**: Optimistic updates add real complexity. Because this app uses Supabase realtime to invalidate caches (`lib/realtime.ts`), a plain `invalidateQueries` after a mutation is usually fast enough. Only add optimistic updates when there's a measured UX problem.

**Severity**: Non-blocking

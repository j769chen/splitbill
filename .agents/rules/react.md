# React, Components, Hooks & React Native Paper

Detailed guidelines for React components, React Native Paper (Material Design 3),
and React hooks in this Expo app. For an overview of the stack, see the
[README](../../README.md).

---

## Components

- Use function components only; no class components.
- Prefer controlled inputs and small, composable components.
- Keep screens (`app/**`) thin: push data fetching into query hooks (`lib/queries/**`) and reusable UI into `components/**`.
- We use **React Native Paper** (Material Design 3) for UI primitives — import from `react-native-paper` (`Button`, `Text`, `TextInput`, `Chip`, `Card`, etc.). Do not reach for raw `react-native` `Text`/`Button` when a Paper equivalent exists.
- Use the `@/` path alias for absolute imports (e.g. `@/lib/auth`), configured in `tsconfig.json`.
- Routes are file-based via Expo Router under `app/`. Use `router` / `useLocalSearchParams` from `expo-router` for navigation and params, not hand-rolled navigation state.

## Hooks

- AVOID `useEffect`. Prefer computing during render, handling in event handlers, using a key, or other alternatives. See [Rule 7-2](#rule-7-2-unnecessary-useeffect).
- Subscriptions to external systems (Supabase realtime, auth state, `AppState`, event listeners) are the legitimate use of `useEffect` — see `lib/realtime.ts` and `lib/auth.tsx`.

---

## React Components

### Rule 1-1: Functional Components Only

**Requirement**: All components must be functional components with hooks. Class components are not used in this codebase.

**Detection Pattern**: `class \w+ extends (React\.)?Component` or `class \w+ extends (React\.)?PureComponent`

**Severity**: Blocking

**Examples**:

❌ **Incorrect** (class component):

```tsx
class GroupCard extends React.Component {
  render() {
    return <Text>{this.props.name}</Text>;
  }
}
```

✅ **Correct** (functional component):

```tsx
const GroupCard = ({ name }: Props) => {
  return <Text>{name}</Text>;
};
```

---

### Rule 1-2: Large Function Detection

**Requirement**: Functions with complex logic (not counting JSX) should be kept reasonably small. Screen components can be longer if the additional lines are straightforward JSX markup or type definitions.

**Severity**: Non-blocking

**When to flag**:
- Business logic, data transformations, or conditionals exceeding ~100 lines
- Event handlers (e.g. a submit handler) where the logic portion grows large — `add-expense.tsx`'s `handleSubmit` is near the upper bound

**When NOT to flag**:
- Long JSX that is mostly presentational markup
- Files padded by TypeScript interfaces/types

**Refactoring suggestions**:
- Move split/balance math into `lib/utils.ts` (pure, testable functions)
- Extract repeated row/list rendering into a component in `components/`
- Split large screens into smaller presentational sub-components

---

### Rule 1-3: Multiple Components Per File

**Requirement**: Each reusable component should be in its own file under `components/` for better organization.

**Severity**: Non-blocking

**Exception**: Small presentational child components (a few lines) specific to one screen can remain in that screen file.

---

### Rule 1-4: Excessive Comments

**Requirement**: Avoid redundant comments that describe *what* code does. Keep comments that explain *why* — non-obvious money/rounding decisions, RLS workarounds, or realtime/race-condition handling. Code should be self-documenting through clear naming.

**Severity**: Non-blocking

**Good comments**: e.g. the rounding-remainder note in `add-expense.tsx`, the `leave_group` RPC atomicity note in `useGroups.ts`
**Bad comments**: `// set the amount`, `// call mutate`, obvious restatements

---

### Rule 1-5: Logic in Components

**Requirement**: Components should not contain complex computation or business logic. Move pure computation (split math, balance simplification, formatting) into `lib/utils.ts`.

**Severity**: Non-blocking

**Benefits**:
- Easier to test pure functions in isolation
- Keeps render functions readable
- Better separation of concerns

---

## React Native Paper & Styling

### Rule 2-1: Use Theme Tokens, Not Hardcoded Colors

**Requirement**: Read colors from the app theme via `useAppTheme()` (`lib/theme.ts`) — e.g. `theme.colors.primary`, `theme.colors.onSurface`, `theme.colors.error`. Do not hardcode hex colors in components, because the app supports light and dark mode (`lib/theme-preference.tsx`).

**Detection Pattern**: Hex color literals (`#RRGGBB`) inside `app/**` or `components/**` style objects.

**Severity**: Non-blocking (Blocking if it breaks dark mode legibility)

**Exception**: Pure white/black used intentionally as on-color contrast (as in `lib/snackbar.tsx`) is acceptable, but prefer `theme.colors.on*` tokens where one exists.

**Examples**:

❌ **Incorrect**:

```tsx
<Text style={{ color: "#111827" }}>Total</Text>
```

✅ **Correct**:

```tsx
const theme = useAppTheme();
<Text style={{ color: theme.colors.onSurface }}>Total</Text>
```

---

### Rule 2-2: Prefer Paper Components Over Raw Primitives

**Requirement**: Use React Native Paper components for anything with a Paper equivalent (`Text`, `Button`, `TextInput`, `Chip`, `Checkbox`, `Card`, `SegmentedButtons`, `Snackbar`, `Portal`). Use raw `react-native` primitives (`View`, `ScrollView`, `KeyboardAvoidingView`) only for layout.

**Severity**: Non-blocking

**Why**: Paper components are theme-aware (MD3) and keep typography/spacing consistent across the app.

---

### Rule 2-3: Variant Props for Typography

**Requirement**: Use Paper `Text` `variant` props (`bodyMedium`, `labelLarge`, `titleLarge`, etc.) instead of manually setting `fontSize`/`fontWeight` where a variant fits.

**Severity**: Non-blocking

**Examples**:

✅ **Correct**:

```tsx
<Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
  Split Type
</Text>
```

---

## React Hooks

### Rule 7-1: Unstable Function Dependencies

**Requirement**: Functions used in another hook's dependency array should be stable (wrapped in `useCallback`, defined outside the component, or hoisted). Profile before optimizing — if the component rarely re-renders, the cost of `useCallback` may not be worth it.

**Severity**: Non-blocking

**Alternatives**:
1. Extract the function outside the component if it doesn't use props/state
2. Use refs to store the latest callback version

---

### Rule 7-2: Unnecessary useEffect

**Requirement**: `useEffect` should only be used when synchronizing with something **outside React**. If no external system is involved, you probably don't need it.

**Severity**: Non-blocking

**Quick litmus test** — Ask yourself:
1. Am I syncing with something outside React (Supabase, `AppState`, listeners)? → If no, don't use it
2. Could this be done during render instead? → If yes, remove `useEffect`
3. Can this be handled directly in the event where the change occurs? → If yes, remove `useEffect`
4. Am I just transforming data? → Compute directly or memoize, no effect
5. Am I reacting to prop changes? → Use a key, no effect

**✅ OK to use useEffect**:
- Supabase realtime subscriptions (`lib/realtime.ts`)
- Subscribing to auth state changes (`lib/auth.tsx`)
- Subscribing/unsubscribing to event listeners, `AppState`, `Keyboard`, dimensions

**❌ NOT OK to use useEffect**:
- Deriving state (calculate during render instead)
- Data fetching (use TanStack Query hooks in `lib/queries/**`)
- Transforming props/data (compute directly or `useMemo` if expensive)
- Updating state because a prop changed (derive during render, or use a key)
- Notifying parents of changes (call back in the event, not in an effect)

**⚠️ NEVER suggest adding useEffect as a fix.** If code avoids `useEffect`, that is correct. The alternatives above (compute during render, handle in events, use a key, use a query hook) are always preferred.

> Note: one-time hydration from async device storage should live in a small
> shared hook, not repeated ad hoc in feature components.

---

### Rule 7-3: Unnecessary useCallback or useMemo

**Requirement**: Only memoize when necessary.

**Severity**: Non-blocking

**Memoize when**:
1. The function/value is used in another hook's dependency array
2. It prevents expensive re-renders of child components (profile first)
3. The computation is genuinely expensive (e.g. balance simplification over large groups)

The `useCallback`s in `lib/snackbar.tsx` are a good example — they keep context action functions stable for consumers (see Rule 6-3).

---

### Rule 7-4: Lazy State Initialization

**Requirement**: Pass a function to `useState` when the initial value is the result of an expensive computation, a `JSON.parse`, an `AsyncStorage`/`SecureStore` read, or any work that should only happen once on mount. Without the function form, the initializer expression is evaluated on every render.

**Severity**: Non-blocking

**Detection Pattern**: `useState(<call-expression>)` where the call expression is non-trivial.

**Examples**:

❌ **Incorrect** (runs on every render):

```tsx
const [config, setConfig] = useState(JSON.parse(rawConfig));
```

✅ **Correct** (runs only on mount):

```tsx
const [config, setConfig] = useState(() => JSON.parse(rawConfig));
```

**When you do NOT need the function form**:
- Primitives or cheap literals: `useState(0)`, `useState("")`, `useState(false)`, `useState([])`
- Direct prop/state references: `useState(user?.id ?? "")`

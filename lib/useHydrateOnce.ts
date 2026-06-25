import { useRef } from "react";

// Seeds local form state exactly once from asynchronously-loaded data (a
// TanStack Query result). `hydrate` runs a single time, during render, as soon
// as `ready` becomes true. This replaces the `useEffect` + `hydrated` flag
// idiom for one-time hydration — setting state during render is the preferred
// no-effect approach for adjusting state when a condition flips (see
// .agents/rules/react.md Rule 7-2).
export function useHydrateOnce(ready: boolean, hydrate: () => void): void {
  const hydrated = useRef(false);
  if (ready && !hydrated.current) {
    hydrated.current = true;
    hydrate();
  }
}

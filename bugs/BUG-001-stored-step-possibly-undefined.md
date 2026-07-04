# BUG-001: 'stored.step' is possibly 'undefined'

**File:** `src/app/onboarding/onboarding-wizard.tsx`, line 249

**Severity:** Low
**Status:** Open

## Description

TypeScript error TS18048: In the `useEffect` block that restores progress from localStorage, `stored.step` is accessed without narrowing for `undefined`. The optional chaining on `stored?.step >= 0` only guards the comparison itself — TypeScript does not narrow `stored.step` to `number` inside the branch.

## Error

```
src/app/onboarding/onboarding-wizard.tsx(249,16): error TS18048: 'stored.step' is possibly 'undefined'.
```

## Code

```typescript
    } else if (stored?.step >= 0 && stored.step <= 13) {
```

## Root Cause

`loadFromStorage()` returns `StoredState | null`, and `StoredState.step` is typed as `number` (not `number | undefined`). However, the optional chaining in `stored?.step` evaluates to `number | undefined`, and TS doesn't narrow the union inside the branch body. Lines 251-252 have a related issue: they assume `stored` is non-null inside the block, but TS can't prove it from the `stored?.` condition.

## Suggested Fix

Use a guard assignment before the condition:

```typescript
    } else if (stored !== null && stored !== undefined && stored.step >= 0 && stored.step <= 13) {
```

This narrows both `stored` and `stored.step` properly for the entire block.

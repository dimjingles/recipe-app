# BUG-002: 'stored' is possibly 'null' inside restore-progress block

**File:** `src/app/onboarding/onboarding-wizard.tsx`, lines 251-252

**Severity:** Low
**Status:** Open

## Description

TypeScript error TS18047: Inside the `else if` branch at line 249, `stored.answers` (line 251) and `stored.step` (line 252) are accessed but TypeScript cannot narrow `stored` from `StoredState | null` because the condition uses optional chaining (`stored?.step`).

## Error

```
src/app/onboarding/onboarding-wizard.tsx(251,18): error TS18047: 'stored' is possibly 'null'.
src/app/onboarding/onboarding-wizard.tsx(252,15): error TS18047: 'stored' is possibly 'null'.
```

## Code

```typescript
    } else if (stored?.step >= 0 && stored.step <= 13) {
      // Mid-flow page refresh → restore progress
      setAnswers(stored.answers)       // line 251
      setStep(stored.step)             // line 252
```

## Root Cause

Same root as BUG-001: the `stored?.step >= 0` guard uses optional chaining, which doesn't narrow `stored` to `StoredState` for the block body. TypeScript sees `stored` as still possibly `null`.

## Suggested Fix

Same fix as BUG-001 — switch to `stored !== null && stored !== undefined && stored.step >= 0 && stored.step <= 13` to narrow properly.

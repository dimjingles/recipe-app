# BUG-003: Missing 'difficulty' field in recipe insert

**File:** `src/lib/db/recipes.ts`, line 52

**Severity:** Medium
**Status:** Open

## Description

TypeScript error TS2345: The `createRecipe` function inserts a new recipe into Supabase but does not include the `difficulty` field, which is marked as required in the generated Supabase types (nullable: `number | null`).

## Error

```
src/lib/db/recipes.ts(52,13): error TS2345: ...
  Property 'difficulty' is missing in type '{ user_id: string; ...; tags: string[]; }' 
  but required in type 'Omit<{ id: string; ...; difficulty: number | null; ... }>'.
```

## Code

```typescript
    .insert({
      user_id: user.id,
      name: recipeData.name,
      description: recipeData.description ?? null,
      cuisine: recipeData.cuisine ?? null,
      cook_time_minutes: recipeData.cook_time_minutes ?? null,
      servings: recipeData.servings ?? 4,
      instructions: recipeData.instructions ?? null,
      image_url: recipeData.image_url ?? null,
      tags: recipeData.tags ?? [],
      // difficulty is missing
    })
```

## Root Cause

The function accepts a `recipe` parameter that doesn't include `difficulty` in its type definition (line 40-42). The Supabase DB schema requires it. Either the schema migration added it after the function was written, or it was always required and never plumbed through.

## Suggested Fix

1. Add `difficulty` to the `createRecipe` parameter type (e.g. `difficulty?: number` so existing callers don't break)
2. Default it in the insert: `difficulty: recipeData.difficulty ?? null`
3. Update callers to provide a value

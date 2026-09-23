// PostgREST column lists shared by the queries behind list views. Keeping the
// detail-only columns (instructions, structured steps, techniques, adaptation
// metadata, …) out of these keeps list payloads — and the copy the client
// persists to localStorage — small. Must match RecipeSummary in
// src/types/database.ts.
export const RECIPE_SUMMARY_COLUMNS =
  'id, user_id, name, cuisine, cook_time_minutes, servings, calories, difficulty, ' +
  'image_url, gallery_images, tags, categories, cooked_count, last_cooked_at, rank, ' +
  'feedback, recipe_type, visibility, original_recipe_id, created_at'

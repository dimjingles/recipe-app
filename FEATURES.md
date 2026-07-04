# Recipe App — Feature Backlog

Planned features that haven't been built yet. Move to Done when shipped.

---

## Pending

*(No pending features)*

---

## Done

### AI-generated cooking instructions
Generate step-by-step instructions for a recipe using AI, based on the ingredients and dish name. User can review and edit before saving.

- **Implementation:** Added `/api/recipes/generate-instructions` POST route that calls Claude Haiku with recipe name + ingredients. Returns instructions text + inferred difficulty (1-3). Both `recipe-editor.tsx` and `edit-recipe-form.tsx` have a "Generate with AI" button next to the instructions textarea.

### Difficulty rating (knife emojis)
Add a difficulty field (1–3) represented visually as 🔪 / 🔪🔪 / 🔪🔪🔪. Difficulty is inferred from the instructions by AI as a default, but the user can override it. Store as an integer (1, 2, or 3) in the database.

- **Implementation:** Added `difficulty integer check (difficulty between 1 and 3)` column via `supabase/migrations/add_difficulty.sql`. Updated `types/database.ts` Row/Insert types. Three-button picker in both editor forms. AI infers during instruction generation. Displayed as knife emojis on recipe detail page. User can override freely.

### Recipe tags
Support common tags for filtering and browsing: Vegan, Vegetarian, Gluten-Free, Dairy-Free, Nut-Free, Spice Level (Mild / Medium / Hot), Quick (<30 min), Meal Prep. Tags should be selectable via a multi-select chip UI. Allow user-defined custom tags as well.

- **Implementation:** Replaced the comma-separated text input with a chip-based multi-select UI in both `recipe-editor.tsx` and `edit-recipe-form.tsx`. Predefined tags are toggle-able chips; custom tags can be typed in an input below and added as chips with an X to remove. Added tag filter chip row in `recipe-library.tsx`. Backed by existing `tags text[]` column.

### Recipe image
Images are extracted from the source URL on import (JSON-LD `image` field, falling back to `og:image`). Displayed as hero on the detail page and as thumbnails in the library list. Stored as `image_url` in the recipes table.

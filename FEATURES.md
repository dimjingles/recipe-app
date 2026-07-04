# Recipe App — Feature Backlog

Planned features that haven't been built yet. Move to Done when shipped.

---

## Pending

### AI-generated cooking instructions
Generate step-by-step instructions for a recipe using AI, based on the ingredients and dish name. User can review and edit before saving.

### Difficulty rating (knife emojis)
Add a difficulty field (1–3) represented visually as 🔪 / 🔪🔪 / 🔪🔪🔪. Difficulty is inferred from the instructions by AI as a default, but the user can override it. Store as an integer (1, 2, or 3) in the database.

### Recipe tags
Support common tags for filtering and browsing: Vegan, Vegetarian, Gluten-Free, Dairy-Free, Nut-Free, Spice Level (Mild / Medium / Hot), Quick (<30 min), Meal Prep. Tags should be selectable via a multi-select chip UI. Allow user-defined custom tags as well.

---

## Done

### Recipe image
Images are extracted from the source URL on import (JSON-LD `image` field, falling back to `og:image`). Displayed as hero on the detail page and as thumbnails in the library list. Stored as `image_url` in the recipes table.

<!-- Move completed items here with a brief note on implementation. -->

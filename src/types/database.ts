export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ── Instruction step types ────────────────────────────────────────────────────
/** Discriminated token types used to highlight critical cooking info inline. */
export type StepTokenType = 'text' | 'time' | 'temp' | 'quantity' | 'doneness' | 'ingredient'

/** A single span within a step's text. Concatenating all `value` strings
 *  in a step reproduces `text` exactly. */
export interface StepToken {
  type: StepTokenType
  value: string
}

/** One numbered instruction step with typed inline highlights. */
export interface InstructionStep {
  /** 1-indexed step number */
  n: number
  /** Full human-readable text of the step (join of all token values) */
  text: string
  /** Tokenised spans — render these for highlighted display */
  tokens: StepToken[]
}

export interface SkillProfile {
  techniques_mastered: string[]
  techniques_seen: string[]
  difficulty_ceiling: 1 | 2 | 3
  last_stretch_technique: string | null
}

export type RecipeSortPreference = 'ranking' | 'recently_cooked' | 'most_cooked'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          onboarding_completed: boolean
          household_size: string | null
          cook_frequency: string | null
          referral_source: string | null
          primary_goal: string | null
          diet: string | null
          allergies: string[]
          favorite_cuisines: string[]
          skill_level: string | null
          meal_reminders: boolean
          skill_profile: SkillProfile | null
          recipe_sort_preference: RecipeSortPreference
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          onboarding_completed?: boolean
          household_size?: string | null
          cook_frequency?: string | null
          referral_source?: string | null
          primary_goal?: string | null
          diet?: string | null
          allergies?: string[]
          favorite_cuisines?: string[]
          skill_level?: string | null
          meal_reminders?: boolean
          skill_profile?: SkillProfile | null
          recipe_sort_preference?: RecipeSortPreference
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      recipes: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          cuisine: string | null
          cook_time_minutes: number | null
          servings: number
          instructions: string | null
          instruction_steps: InstructionStep[] | null
          difficulty: number | null
          image_url: string | null
          gallery_images: string[]
          tags: string[]
          techniques: string[]
          cooked_count: number
          last_cooked_at: string | null
          rank: number | null
          feedback: 'like' | 'okay' | 'dislike' | null
          recipe_type: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['recipes']['Row'], 'id' | 'created_at' | 'cooked_count' | 'last_cooked_at' | 'rank' | 'feedback' | 'recipe_type' | 'gallery_images' | 'techniques' | 'instruction_steps'> & {
          id?: string
          created_at?: string
          cooked_count?: number
          last_cooked_at?: string | null
          rank?: number | null
          feedback?: 'like' | 'okay' | 'dislike' | null
          recipe_type?: string | null
          gallery_images?: string[]
          difficulty?: number | null
          techniques?: string[]
          instruction_steps?: InstructionStep[] | null
        }
        Update: Partial<Database['public']['Tables']['recipes']['Insert']>
        Relationships: []
      }
      techniques: {
        Row: {
          key: string
          label: string
          category: string
          description: string
          prerequisites: string[]
        }
        Insert: Database['public']['Tables']['techniques']['Row']
        Update: Partial<Database['public']['Tables']['techniques']['Insert']>
        Relationships: []
      }
      ingredients: {
        Row: {
          id: string
          recipe_id: string
          name: string
          quantity: string | null
          unit: string | null
          category: string | null
        }
        Insert: Omit<Database['public']['Tables']['ingredients']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['ingredients']['Insert']>
        Relationships: []
      }
      cooking_log: {
        Row: {
          id: string
          user_id: string
          recipe_id: string
          cooked_at: string
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['cooking_log']['Row'], 'id' | 'cooked_at'> & {
          id?: string
          cooked_at?: string
        }
        Update: Partial<Database['public']['Tables']['cooking_log']['Insert']>
        Relationships: []
      }
      weekly_plans: {
        Row: {
          id: string
          user_id: string
          week_start: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['weekly_plans']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['weekly_plans']['Insert']>
        Relationships: []
      }
      weekly_plan_slots: {
        Row: {
          id: string
          plan_id: string
          recipe_id: string
          day_of_week: number
          meal_type: string
        }
        Insert: Omit<Database['public']['Tables']['weekly_plan_slots']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['weekly_plan_slots']['Insert']>
        Relationships: []
      }
      cookbooks: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['cookbooks']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['cookbooks']['Insert']>
        Relationships: []
      }
      cookbook_recipes: {
        Row: {
          id: string
          cookbook_id: string
          recipe_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['cookbook_recipes']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['cookbook_recipes']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Recipe = Database['public']['Tables']['recipes']['Row']
export type Technique = Database['public']['Tables']['techniques']['Row']
export type Ingredient = Database['public']['Tables']['ingredients']['Row']
export type CookingLog = Database['public']['Tables']['cooking_log']['Row']
export type WeeklyPlan = Database['public']['Tables']['weekly_plans']['Row']
export type WeeklyPlanSlot = Database['public']['Tables']['weekly_plan_slots']['Row']
export type Cookbook = Database['public']['Tables']['cookbooks']['Row']
export type CookbookRecipe = Database['public']['Tables']['cookbook_recipes']['Row']

export type RecipeWithIngredients = Recipe & {
  ingredients: Ingredient[]
  cookbook_recipes?: { cookbook_id: string }[]
}

export type RecipeWithDetails = Recipe & {
  ingredients: Ingredient[]
  cooking_log: CookingLog[]
  cookbook_recipes?: { cookbook_id: string }[]
}

export type CookbookWithCount = Cookbook & {
  cookbook_recipes: { recipe_id: string }[]
}

export type CookbookWithRecipes = Cookbook & {
  cookbook_recipes: { recipe: Recipe }[]
}

export type SlotWithRecipe = WeeklyPlanSlot & {
  recipe: Recipe
}

export type PlanWithSlots = WeeklyPlan & {
  weekly_plan_slots: SlotWithRecipe[]
}

// ── Recipe import / extraction types ─────────────────────────────────────────

export interface ExtractedIngredient {
  name: string
  quantity: string
  unit: string
  category: string
}

/**
 * Structured recipe returned by the /api/recipes/import extraction endpoint.
 * Does NOT correspond to a saved DB row — it is a preview the user reviews
 * and edits before saving through the standard POST /api/recipes route.
 */
export interface ExtractedRecipe {
  name: string
  description?: string
  cuisine?: string
  cook_time_minutes?: number
  servings?: number
  instructions?: string
  difficulty?: number
  ingredients: ExtractedIngredient[]
  /** og:image or JSON-LD image — stored in recipes.image_url when saving */
  image_url?: string
  /** Gallery images extracted from JSON-LD (beyond the cover) */
  gallery_images?: string[]
  /** The original URL the recipe was imported from */
  source_url?: string
}

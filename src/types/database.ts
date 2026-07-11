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

// ── AI Recipe Adaptation ──────────────────────────────────────────────────────
export type AdaptationType =
  | 'dietary_swap'
  | 'portion_scaling'
  | 'pantry_substitution'
  | 'freeform'

/** Provenance stored on a variant recipe's `adaptation_metadata` column. */
export interface AdaptationMetadata {
  adaptation_type: AdaptationType
  /** The user's request, e.g. "make it vegan" or "I don't have eggs". */
  user_request: string
  /** Material changes the user should know about (texture, flavour, technique). */
  warnings: string[]
  /** Per-ingredient substitution notes explaining what changed and why. */
  substitution_notes: string[]
  /** The recipe this variant was adapted from (may since be deleted). */
  created_from_recipe_id: string
  /** Snapshot of the original name for display even if the original is gone. */
  created_from_name: string
}

export type RecipeSortPreference = 'ranking' | 'recently_cooked' | 'most_cooked' | 'cook_time'

/** Sort order for the recipe library: 'default' is top-to-bottom, 'reversed' flips it bottom-to-top. */
export type RecipeSortDirection = 'default' | 'reversed'

/** Chef AI voice/persona in the "Cook with AI" flow. */
export type ChefPersona = 'warm' | 'pro' | 'minimal' | 'playful' | 'calm'
/** How much the Chef AI explains. 'auto' follows the user's tracked skill profile. */
export type ChefSkillPref = 'auto' | 'beginner' | 'intermediate' | 'expert'
/** How the Chef AI walks through a recipe. */
export type ChefPacing = 'step_by_step' | 'hands_free' | 'overview_first'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
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
          recipe_sort_direction: RecipeSortDirection
          chef_persona: ChefPersona
          chef_skill_pref: ChefSkillPref
          chef_pacing: ChefPacing
          chef_voice_uri: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
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
          recipe_sort_direction?: RecipeSortDirection
          chef_persona?: ChefPersona
          chef_skill_pref?: ChefSkillPref
          chef_pacing?: ChefPacing
          chef_voice_uri?: string | null
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
          owner_scope: string
          household_id: string | null
          visibility: string
          original_recipe_id: string | null
          adaptation_metadata: AdaptationMetadata | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['recipes']['Row'], 'id' | 'created_at' | 'cooked_count' | 'last_cooked_at' | 'rank' | 'feedback' | 'recipe_type' | 'gallery_images' | 'techniques' | 'instruction_steps' | 'owner_scope' | 'household_id' | 'visibility' | 'original_recipe_id' | 'adaptation_metadata'> & {
          id?: string
          created_at?: string
          cooked_count?: number
          last_cooked_at?: string | null
          rank?: number | null
          feedback?: 'like' | 'okay' | 'dislike' | null
          recipe_type?: string | null
          owner_scope?: string
          household_id?: string | null
          visibility?: string
          gallery_images?: string[]
          difficulty?: number | null
          techniques?: string[]
          instruction_steps?: InstructionStep[] | null
          original_recipe_id?: string | null
          adaptation_metadata?: AdaptationMetadata | null
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
        Relationships: [
          {
            foreignKeyName: 'ingredients_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'cooking_log_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'weekly_plan_slots_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'weekly_plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'weekly_plan_slots_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      cookbooks: {
        Row: {
          id: string
          user_id: string
          name: string
          owner_scope: string
          household_id: string | null
          visibility: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['cookbooks']['Row'], 'id' | 'created_at' | 'owner_scope' | 'household_id' | 'visibility'> & {
          id?: string
          owner_scope?: string
          household_id?: string | null
          visibility?: string
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
        Relationships: [
          {
            foreignKeyName: 'cookbook_recipes_cookbook_id_fkey'
            columns: ['cookbook_id']
            isOneToOne: false
            referencedRelation: 'cookbooks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cookbook_recipes_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      friendships: {
        Row: {
          user_id_a: string
          user_id_b: string
          status: string
          requested_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id_a: string
          user_id_b: string
          status?: string
          requested_by: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['friendships']['Insert']>
        Relationships: []
      }
      households: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['households']['Insert']>
        Relationships: []
      }
      household_members: {
        Row: {
          household_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          household_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: Partial<Database['public']['Tables']['household_members']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
        ]
      }
      recipe_rankings: {
        Row: {
          user_id: string
          recipe_id: string
          rank: number
          updated_at: string
        }
        Insert: {
          user_id: string
          recipe_id: string
          rank: number
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['recipe_rankings']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'recipe_rankings_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      activity: {
        Row: {
          id: string
          actor_id: string
          type: string
          recipe_id: string | null
          cookbook_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id: string
          type: string
          recipe_id?: string | null
          cookbook_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['activity']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'activity_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'activity_cookbook_id_fkey'
            columns: ['cookbook_id']
            isOneToOne: false
            referencedRelation: 'cookbooks'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      find_user_by_email: {
        Args: { lookup_email: string }
        Returns: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
        }[]
      }
      are_friends: {
        Args: { u1: string; u2: string }
        Returns: boolean
      }
      send_friend_request: {
        Args: { target_id: string }
        Returns: undefined
      }
      respond_to_request: {
        Args: { other_id: string; do_accept: boolean }
        Returns: undefined
      }
      unfriend: {
        Args: { other_id: string }
        Returns: undefined
      }
      same_household: {
        Args: { u1: string; u2: string }
        Returns: boolean
      }
      is_household_member: {
        Args: { hh: string }
        Returns: boolean
      }
      create_household: {
        Args: { p_name: string }
        Returns: string
      }
      create_household_invite: {
        Args: { p_household: string }
        Returns: string
      }
      household_invite_info: {
        Args: { p_token: string }
        Returns: { household_id: string; name: string }[]
      }
      accept_household_invite: {
        Args: { p_token: string }
        Returns: string
      }
      leave_household: {
        Args: { p_household: string }
        Returns: undefined
      }
    }
  }
}

// ── Social identity ───────────────────────────────────────────────────────────

/** The only profile fields ever exposed to other users (via `public_profiles`). */
export type PublicProfile = Database['public']['Views']['public_profiles']['Row']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Recipe = Database['public']['Tables']['recipes']['Row']
export type Technique = Database['public']['Tables']['techniques']['Row']
export type Ingredient = Database['public']['Tables']['ingredients']['Row']
export type CookingLog = Database['public']['Tables']['cooking_log']['Row']
export type WeeklyPlan = Database['public']['Tables']['weekly_plans']['Row']
export type WeeklyPlanSlot = Database['public']['Tables']['weekly_plan_slots']['Row']
export type Cookbook = Database['public']['Tables']['cookbooks']['Row']
export type CookbookRecipe = Database['public']['Tables']['cookbook_recipes']['Row']
export type Household = Database['public']['Tables']['households']['Row']
export type HouseholdMember = Database['public']['Tables']['household_members']['Row']
export type RecipeRanking = Database['public']['Tables']['recipe_rankings']['Row']

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

// ── AI Recipe Adaptation draft ───────────────────────────────────────────────

/**
 * Adapted recipe returned by POST /api/recipes/[id]/adapt. Like ExtractedRecipe,
 * this is a preview the user reviews before saving as a new variant — it does NOT
 * correspond to a saved row. Saving it creates a fresh recipe linked to the
 * original via `original_recipe_id` + `adaptation_metadata`.
 */
export interface AdaptedRecipeDraft {
  name: string
  description?: string
  cuisine?: string
  cook_time_minutes?: number
  servings?: number
  instructions: string
  difficulty?: number
  tags: string[]
  ingredients: ExtractedIngredient[]
  /** Material changes the user should know about before cooking. */
  warnings: string[]
  /** What was substituted and how it affects the result. */
  substitution_notes: string[]
  /** Echoed back so the client can persist provenance without re-deriving it. */
  adaptation_type: AdaptationType
  user_request: string
  created_from_recipe_id: string
  created_from_name: string
}

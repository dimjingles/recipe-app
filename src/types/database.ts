export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
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
          image_url: string | null
          tags: string[]
          cooked_count: number
          last_cooked_at: string | null
          rank: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['recipes']['Row'], 'id' | 'created_at' | 'cooked_count' | 'last_cooked_at' | 'rank'> & {
          id?: string
          created_at?: string
          cooked_count?: number
          last_cooked_at?: string | null
          rank?: number | null
        }
        Update: Partial<Database['public']['Tables']['recipes']['Insert']>
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}

export type Recipe = Database['public']['Tables']['recipes']['Row']
export type Ingredient = Database['public']['Tables']['ingredients']['Row']
export type CookingLog = Database['public']['Tables']['cooking_log']['Row']
export type WeeklyPlan = Database['public']['Tables']['weekly_plans']['Row']
export type WeeklyPlanSlot = Database['public']['Tables']['weekly_plan_slots']['Row']

export type RecipeWithIngredients = Recipe & {
  ingredients: Ingredient[]
}

export type RecipeWithDetails = Recipe & {
  ingredients: Ingredient[]
  cooking_log: CookingLog[]
}

export type SlotWithRecipe = WeeklyPlanSlot & {
  recipe: Recipe
}

export type PlanWithSlots = WeeklyPlan & {
  weekly_plan_slots: SlotWithRecipe[]
}

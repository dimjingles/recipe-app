import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

/**
 * Service-role Supabase client — BYPASSES Row Level Security.
 *
 * Never import this into client components or expose its results wholesale.
 * The only sanctioned use is server-side code that has already narrowed the
 * query to data the caller is allowed to see — e.g. fetching a single recipe
 * by its unguessable public `share_token` for the /share/[token] page.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (server-only env var, never NEXT_PUBLIC_*).
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

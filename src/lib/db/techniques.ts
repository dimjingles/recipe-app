import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Database, Technique } from '@/types/database'

/**
 * The technique catalogue (~100 rows of static reference data), cached across
 * requests for a day. It was re-queried on every recipe page, skills page and
 * chat turn. Uses a cookieless anon client — reading cookies inside a cache
 * scope isn't allowed, and the table is public-read under RLS anyway.
 */
export const getTechniques = unstable_cache(
  async (): Promise<Technique[]> => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data, error } = await supabase
      .from('techniques')
      .select('*')
      .order('category')
      .order('label')
    // Throwing keeps a transient failure out of the cache.
    if (error) throw error
    return (data ?? []) as Technique[]
  },
  ['techniques-catalogue'],
  { revalidate: 86_400 },
)

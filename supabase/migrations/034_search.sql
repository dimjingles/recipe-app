-- Search page: Beli-style recents and friends' recipe search.
--
-- recipe_search_recents: the recipes a user opened (or created) from /search,
-- newest first. One row per (user, recipe) — re-opening bumps searched_at. The
-- FK cascade drops rows for deleted recipes; reads join recipes under RLS, so a
-- recipe made private or from someone unfriended drops out of the list too.
create table if not exists recipe_search_recents (
  user_id     uuid not null references auth.users on delete cascade,
  recipe_id   uuid not null references recipes(id) on delete cascade,
  searched_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index if not exists recipe_search_recents_user_time_idx
  on recipe_search_recents (user_id, searched_at desc);
-- Serves the recipes FK cascade.
create index if not exists recipe_search_recents_recipe_id_idx
  on recipe_search_recents (recipe_id);

alter table recipe_search_recents enable row level security;
drop policy if exists "Own search recents" on recipe_search_recents;
create policy "Own search recents" on recipe_search_recents for all
  using (user_id = (select auth.uid()))
  -- Only recipes the caller can see (own or a friend's shared one).
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from recipes r where r.id = recipe_id)
  );

-- friend_recipes(): friends' shared recipes, optionally filtered by a text
-- query, with owner profiles and ingredient names in one statement. Serves both
-- the search page's "From friends" results and the candidate pool for
-- "Recipes we think you'll like".
--
-- Filters to the caller's friends up front (served by recipes_user_created_idx)
-- rather than leaning on RLS row by row. SECURITY INVOKER, so RLS still applies.
-- The query is matched literally: LIKE wildcards in it are escaped.
create or replace function friend_recipes(p_query text default null, p_limit int default 20)
returns table (
  id                 uuid,
  user_id            uuid,
  name               text,
  cuisine            text,
  image_url          text,
  cook_time_minutes  integer,
  categories         text[],
  tags               text[],
  feedback           text,
  cooked_count       integer,
  original_recipe_id uuid,
  created_at         timestamptz,
  username           citext,
  display_name       text,
  avatar_url         text,
  ingredient_names   text[]
)
language sql stable security invoker set search_path = public as $$
  with q as (
    select nullif(btrim(p_query), '') as raw,
           replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') as lit
  )
  select r.id, r.user_id, r.name, r.cuisine, coalesce(r.image_url, r.gallery_images[1]),
         r.cook_time_minutes, r.categories, r.tags, r.feedback, r.cooked_count,
         r.original_recipe_id, r.created_at,
         p.username, p.display_name, p.avatar_url,
         array(select i.name from ingredients i where i.recipe_id = r.id)
  from recipes r
  cross join q
  left join public_profiles p on p.id = r.user_id
  where r.user_id in (select my_friend_ids())
    and r.visibility = 'friends'
    and (
      q.raw is null
      or r.name ilike '%' || q.lit || '%' escape '\'
      or r.cuisine ilike '%' || q.lit || '%' escape '\'
      or exists (
        select 1 from ingredients i
        where i.recipe_id = r.id and i.name ilike '%' || q.lit || '%' escape '\'
      )
    )
  order by
    case
      when q.raw is null then 0
      when r.name ilike q.lit || '%' escape '\' then 0
      when r.name ilike '%' || q.lit || '%' escape '\' then 1
      else 2
    end,
    r.created_at desc
  limit least(greatest(p_limit, 1), 200)
$$;
grant execute on function friend_recipes(text, int) to authenticated;

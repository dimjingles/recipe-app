-- log_cook(): record a cook in one round-trip.
--
-- POST /api/recipes/[id]/log used to make six sequential requests (insert log →
-- read recipe → write cooked_count → read profile → write skills → insert
-- activity), plus a separate feedback request from the client. The
-- read-modify-write of cooked_count also lost counts under concurrent logs.
--
-- SECURITY INVOKER: every statement runs under the caller's RLS, and the recipe
-- update is additionally scoped to the caller's own recipe.
create or replace function log_cook(
  p_recipe_id    uuid,
  p_cooked_at    timestamptz default now(),
  p_notes        text default null,
  p_set_feedback boolean default false,
  p_feedback     text default null
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_uid        uuid := auth.uid();
  v_techniques text[];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update recipes
     set cooked_count   = cooked_count + 1,
         -- A back-dated log must not move last_cooked_at backwards.
         last_cooked_at = greatest(last_cooked_at, p_cooked_at),
         feedback       = case when p_set_feedback then p_feedback else feedback end
   where id = p_recipe_id and user_id = v_uid
  returning techniques into v_techniques;

  if not found then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;

  insert into cooking_log (recipe_id, user_id, notes, cooked_at)
  values (p_recipe_id, v_uid, p_notes, p_cooked_at);

  -- Cooking a recipe masters its techniques. Only techniques_mastered is
  -- touched; the app fills the other skill_profile defaults on read.
  if coalesce(array_length(v_techniques, 1), 0) > 0 then
    update profiles
       set skill_profile = jsonb_set(
             coalesce(skill_profile, '{}'::jsonb),
             '{techniques_mastered}',
             to_jsonb(array(
               select distinct k from (
                 select jsonb_array_elements_text(coalesce(skill_profile -> 'techniques_mastered', '[]'::jsonb)) as k
                 union all
                 select unnest(v_techniques)
               ) keys
             ))
           ),
           updated_at = now()
     where id = v_uid;
  end if;

  insert into activity (actor_id, type, recipe_id)
  values (v_uid, 'recipe_cooked', p_recipe_id);
end;
$$;
grant execute on function log_cook(uuid, timestamptz, text, boolean, text) to authenticated;
